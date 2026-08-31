import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { ProcessInfo } from './types';

const MAX_BUFFER_SIZE = 1024 * 1024;
const COMMAND_TIMEOUT_MS = 10000;
const MAX_PID_32BIT = 2147483647;
const MIN_PORT = 1;
const MAX_PORT = 65535;

export function validatePid(pid: number): boolean {
	return Number.isInteger(pid) && pid > 0 && pid <= MAX_PID_32BIT;
}

export function validatePort(port: number): boolean {
	return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

export function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function executeCommand(command: string, args: string[], timeoutMs: number = COMMAND_TIMEOUT_MS): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { shell: false });
		let stdout = '';
		let stderr = '';
		let stdoutBytes = 0;
		let settled = false;

		const settle = (fn: () => void) => {
			if (settled) { return; }
			settled = true;
			clearTimeout(timeout);
			fn();
		};

		const timeout = setTimeout(() => {
			proc.kill();
			settle(() => reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms`)));
		}, timeoutMs);

		proc.stdout.on('data', (data: Buffer) => {
			if (settled) { return; }
			stdoutBytes += data.length;
			if (stdoutBytes > MAX_BUFFER_SIZE) {
				proc.kill();
				settle(() => reject(new Error(`Command '${command}' output exceeded max buffer`)));
				return;
			}
			stdout += data.toString();
		});

		proc.stderr.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on('error', (err) => {
			settle(() => reject(err));
		});

		proc.on('close', (code) => {
			if (code === 0) {
				settle(() => resolve(stdout));
			} else {
				settle(() => reject(new Error(stderr.trim() || `Command '${command}' exited with code ${code}`)));
			}
		});
	});
}

export interface PlatformStrategy {
	getProcesses(): Promise<ProcessInfo[]>;
	getPorts(pid: number): Promise<number[]>;
}

class WindowsPlatform implements PlatformStrategy {
	async getProcesses(): Promise<ProcessInfo[]> {
		const processFilter = "CommandLine LIKE '%language_server%' OR CommandLine LIKE '%--hub-port%'";
		let stdout: string;
		try {
			stdout = await executeCommand('powershell', [
				'-NoProfile',
				'-Command',
				`Get-CimInstance Win32_Process -Filter "${processFilter}" | Select-Object ProcessId, CommandLine | ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`
			]);
		} catch {
			try {
				const wmicOutput = await executeCommand('wmic', [
					'process',
					'where',
					"CommandLine like '%language_server%' or CommandLine like '%--hub-port%'",
					'get',
					'CommandLine,ProcessId',
					'/format:csv'
				]);
				return this.parseWmicOutput(wmicOutput);
			} catch (err) {
				throw new Error(`Failed to query Windows processes: ${getErrorMessage(err)}`, { cause: err });
			}
		}

		const processes: ProcessInfo[] = [];
		for (const line of stdout.trim().split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) { continue; }
			const sepIdx = trimmed.indexOf('|');
			if (sepIdx === -1) { continue; }
			const pid = parseInt(trimmed.substring(0, sepIdx).trim(), 10);
			const cmd = trimmed.substring(sepIdx + 1).trim();
			if (validatePid(pid) && cmd) {
				processes.push({ pid, cmd });
			}
		}
		return processes;
	}

	async getPorts(pid: number): Promise<number[]> {
		let stdout: string;
		try {
			stdout = await executeCommand('powershell', [
				'-NoProfile',
				'-Command',
				`Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort`
			]);
		} catch {
			try {
				const netstatOutput = await executeCommand('netstat', ['-ano', '-p', 'tcp']);
				return this.parseNetstatOutput(netstatOutput, pid);
			} catch (err) {
				throw new Error(`Failed to query ports: ${getErrorMessage(err)}`, { cause: err });
			}
		}

		const ports: number[] = [];
		for (const line of stdout.trim().split(/\r?\n/)) {
			const port = parseInt(line.trim(), 10);
			if (validatePort(port)) {
				ports.push(port);
			}
		}
		return ports;
	}

	private parseWmicOutput(stdout: string): ProcessInfo[] {
		const lines = stdout.trim().split(/\r?\n/);
		const processes: ProcessInfo[] = [];
		for (const line of lines) {
			if (!line || line.startsWith('Node,')) { continue; }
			const lastComma = line.lastIndexOf(',');
			if (lastComma === -1) { continue; }
			const pid = parseInt(line.substring(lastComma + 1).trim(), 10);
			const firstComma = line.indexOf(',');
			if (firstComma === -1 || firstComma === lastComma) { continue; }
			const cmd = line.substring(firstComma + 1, lastComma).trim();
			if (validatePid(pid) && cmd) {
				processes.push({ pid, cmd });
			}
		}
		return processes;
	}

	private parseNetstatOutput(stdout: string, pid: number): number[] {
		const ports: number[] = [];
		for (const line of stdout.split(/\r?\n/)) {
			const parts = line.trim().split(/\s+/);
			if (parts.length < 5 || parts[3] !== 'LISTENING') { continue; }
			const linePid = parseInt(parts[parts.length - 1], 10);
			if (linePid !== pid) { continue; }
			const localAddr = parts[1];
			const lastColon = localAddr.lastIndexOf(':');
			if (lastColon !== -1) {
				const port = parseInt(localAddr.substring(lastColon + 1), 10);
				if (validatePort(port)) {
					ports.push(port);
				}
			}
		}
		return ports;
	}
}

class UnixPlatform implements PlatformStrategy {
	async getProcesses(): Promise<ProcessInfo[]> {
		const stdout = await executeCommand('ps', ['-eo', 'pid,args']);
		const currentUserUid = os.platform() === 'linux' ? os.userInfo().uid : -1;
		const currentHome = os.homedir();

		const candidates = stdout
			.split('\n')
			.filter(line => line.includes('language_server') || line.includes('--hub-port'))
			.map(line => {
				const match = line.trim().match(/^(\d+)\s+(.+)$/);
				if (!match) { return null; }
				const pid = parseInt(match[1], 10);
				const cmd = match[2].trim();
				return cmd && validatePid(pid) ? { pid, cmd } : null;
			})
			.filter((p): p is ProcessInfo => p !== null);

		const validated: ProcessInfo[] = [];
		for (const p of candidates) {
			if (await this.isValidProcess(p.pid, currentUserUid, currentHome)) {
				validated.push(p);
			}
		}
		return validated;
	}

	async getPorts(pid: number): Promise<number[]> {
		if (os.platform() === 'darwin') {
			try {
				const stdout = await executeCommand('lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P', '-p', String(pid)]);
				return this.parseLsofOutput(stdout);
			} catch {
				return [];
			}
		}

		for (const [cmd, args] of [
			['ss', ['-tlnp']],
			['lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P', '-p', String(pid)]],
			['netstat', ['-tlnp']]
		] as const) {
			try {
				const stdout = await executeCommand(cmd, [...args]);
				if (cmd === 'ss') return this.parseSsOutput(stdout, pid);
				if (cmd === 'lsof') return this.parseLsofOutput(stdout);
				if (cmd === 'netstat') return this.parseNetstatOutput(stdout, pid);
			} catch {
				// try next
			}
		}
		return [];
	}

	private async isValidProcess(pid: number, expectedUid: number, expectedHome: string): Promise<boolean> {
		if (os.platform() !== 'linux') { return true; }
		try {
			const stat = await fs.promises.stat(`/proc/${pid}`);
			if (stat.uid !== expectedUid) { return false; }
			const environ = await fs.promises.readFile(`/proc/${pid}/environ`);
			const homeLine = environ.toString().split('\0').find(l => l.startsWith('HOME='));
			return homeLine?.substring(5) === expectedHome;
		} catch {
			return false;
		}
	}

	private parseLsofOutput(stdout: string): number[] {
		const ports: number[] = [];
		const regex = /:(\d+)\s+\(LISTEN\)/g;
		let match;
		while ((match = regex.exec(stdout)) !== null) {
			const port = parseInt(match[1], 10);
			if (validatePort(port)) { ports.push(port); }
		}
		return ports;
	}

	private parseSsOutput(stdout: string, pid: number): number[] {
		const ports: number[] = [];
		const pidPattern = new RegExp(`pid=${pid}\\b`);
		for (const line of stdout.split('\n')) {
			if (!pidPattern.test(line)) { continue; }
			const match = line.match(/:(\d+)\s/);
			if (match) {
				const port = parseInt(match[1], 10);
				if (validatePort(port)) { ports.push(port); }
			}
		}
		return ports;
	}

	private parseNetstatOutput(stdout: string, pid: number): number[] {
		const ports: number[] = [];
		const pidPattern = new RegExp(`\\b${pid}/`);
		for (const line of stdout.split('\n')) {
			if (!pidPattern.test(line)) { continue; }
			const match = line.match(/:(\d+)\s/);
			if (match) {
				const port = parseInt(match[1], 10);
				if (validatePort(port)) { ports.push(port); }
			}
		}
		return ports;
	}
}

let platformStrategyInstance: PlatformStrategy | null = null;

export function getPlatformStrategy(): PlatformStrategy {
	if (!platformStrategyInstance) {
		platformStrategyInstance = os.platform() === 'win32' ? new WindowsPlatform() : new UnixPlatform();
	}
	return platformStrategyInstance;
}
