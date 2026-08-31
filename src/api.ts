import * as http from 'http';
import * as https from 'https';
import { delay, getPlatformStrategy, validatePort } from './platform';
import { CachedConnection, ProcessInfo, ServerQuotaSummaryResponse, UsageData } from './types';

const REQUEST_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 100;
const MAX_PORT_ATTEMPTS = 3;
const MAX_BUFFER_SIZE = 1024 * 1024;
const LOCALHOST = '127.0.0.1';

const API_ENDPOINT_QUOTA = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';

let cachedConn: CachedConnection | null = null;

function extractCsrfToken(cmd: string): string | undefined {
	const patterns = [
		/--csrf_token[=\s]+"([^"]+)"/i,
		/--csrf_token[=\s]+'([^']+)'/i,
		/--csrf_token[=\s]+([^\s"']+)/i
	];
	for (const pattern of patterns) {
		const match = cmd.match(pattern);
		if (match?.[1]) {
			return match[1].trim();
		}
	}
	return undefined;
}

function extractHubPort(cmd: string): number | undefined {
	const match = cmd.match(/--hub-port(?:=|\s+)(?:"(\d{1,5})"|'(\d{1,5})'|(\d{1,5}))/i);
	if (!match) { return undefined; }
	const port = parseInt(match[1] ?? match[2] ?? match[3], 10);
	return validatePort(port) ? port : undefined;
}

function extractAppConfigCsrfToken(html: string): string | undefined {
	const match = html.match(/__APP_CONFIG__\s*=\s*(\{.*?\})\s*;/s);
	if (!match?.[1]) { return undefined; }
	try {
		const config = JSON.parse(match[1]) as { csrfToken?: unknown };
		return typeof config.csrfToken === 'string' && config.csrfToken.trim().length > 0
			? config.csrfToken.trim()
			: undefined;
	} catch {
		return undefined;
	}
}

function fetchHubRootPage(port: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = http.get(
			{ hostname: LOCALHOST, port, path: '/', method: 'GET', timeout: REQUEST_TIMEOUT_MS },
			(res) => {
				res.setEncoding('utf8');
				let data = '';
				res.on('data', (chunk: string) => {
					data += chunk;
					if (data.length > MAX_BUFFER_SIZE) {
						req.destroy();
						reject(new Error('Hub response exceeded max size'));
					}
				});
				res.on('end', () => resolve(data));
				res.on('error', reject);
			}
		);
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Hub request timed out'));
		});
	});
}

function makePostRequest<T>(protocol: 'https' | 'http', port: number, csrfToken: string, path: string, body: object): Promise<T> {
	return new Promise((resolve, reject) => {
		const payload = JSON.stringify(body);
		const options: https.RequestOptions = {
			hostname: LOCALHOST,
			port,
			path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(payload),
				'X-Codeium-Csrf-Token': csrfToken,
				'Connect-Protocol-Version': '1'
			},
			timeout: REQUEST_TIMEOUT_MS
		};

		const handleRes = (res: http.IncomingMessage) => {
			res.setEncoding('utf8');
			let data = '';
			res.on('data', (chunk) => {
				data += chunk;
				if (data.length > MAX_BUFFER_SIZE) {
					req.destroy();
					reject(new Error('Response buffer exceeded'));
				}
			});
			res.on('end', () => {
				const status = res.statusCode ?? 0;
				if (status < 200 || status >= 300) {
					return reject(new Error(`HTTP ${status}`));
				}
				try {
					resolve(JSON.parse(data));
				} catch {
					reject(new Error('Invalid JSON'));
				}
			});
			res.on('error', reject);
		};

		const req = protocol === 'https'
			? https.request({ ...options, rejectUnauthorized: false }, handleRes)
			: http.request(options, handleRes);

		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy();
			reject(new Error('Request timed out'));
		});

		req.write(payload);
		req.end();
	});
}

async function requestRpc<T>(port: number, csrfToken: string, path: string, body: object): Promise<T> {
	try {
		return await makePostRequest<T>('https', port, csrfToken, path, body);
	} catch {
		return await makePostRequest<T>('http', port, csrfToken, path, body);
	}
}

async function validatePortConnection(port: number, csrfToken: string): Promise<boolean> {
	try {
		await requestRpc(port, csrfToken, API_ENDPOINT_QUOTA, {});
		return true;
	} catch {
		return false;
	}
}

async function findValidPort(ports: number[], csrfToken: string): Promise<number> {
	for (let attempt = 0; attempt < MAX_PORT_ATTEMPTS; attempt++) {
		if (attempt > 0) { await delay(RETRY_DELAY_MS); }
		for (const port of ports) {
			if (await validatePortConnection(port, csrfToken)) {
				return port;
			}
		}
	}
	throw new Error('Could not validate listening port with CSRF token');
}

async function resolveProcess(proc: ProcessInfo): Promise<{ port: number; csrfToken: string }> {
	const token = extractCsrfToken(proc.cmd);
	if (token) {
		const ports = await getPlatformStrategy().getPorts(proc.pid);
		if (ports.length === 0) {
			throw new Error('No listening ports for process');
		}
		const validPort = await findValidPort(ports, token);
		return { port: validPort, csrfToken: token };
	}

	const hubPort = extractHubPort(proc.cmd);
	if (hubPort !== undefined) {
		const hubHtml = await fetchHubRootPage(hubPort);
		const hubToken = extractAppConfigCsrfToken(hubHtml);
		if (hubToken && await validatePortConnection(hubPort, hubToken)) {
			return { port: hubPort, csrfToken: hubToken };
		}
	}

	throw new Error('Process has no valid CSRF token or hub port');
}

function scoreProcess(processInfo: ProcessInfo): number {
	const cmd = processInfo.cmd.toLowerCase();
	let score = 0;
	if (cmd.includes('--csrf_token')) { score += 10; }
	if (cmd.includes('antigravity')) { score += 5; }
	if (cmd.includes('language_server')) { score += 5; }
	if (cmd.includes('dart') || cmd.includes('flutter')) { score -= 10; }
	return score;
}

export async function getConnection(): Promise<{ port: number; csrfToken: string }> {
	if (cachedConn) {
		const isValid = await validatePortConnection(cachedConn.port, cachedConn.csrfToken);
		if (isValid) {
			return { port: cachedConn.port, csrfToken: cachedConn.csrfToken };
		}
		cachedConn = null;
	}

	const processes = await getPlatformStrategy().getProcesses();
	if (processes.length === 0) {
		throw new Error('Antigravity process not found');
	}

	const sorted = [...processes].sort((a, b) => scoreProcess(b) - scoreProcess(a));

	for (const proc of sorted) {
		try {
			const conn = await resolveProcess(proc);
			cachedConn = { ...conn, timestamp: Date.now() };
			return conn;
		} catch {
			// try next candidate
		}
	}

	throw new Error('Could not connect to Antigravity Language Server');
}

function parseResetTimestamp(val: string | number | undefined): number | null {
	if (val == null) { return null; }
	const ts = typeof val === 'number' ? val : new Date(val).getTime();
	return Number.isFinite(ts) ? ts : null;
}

export async function fetchUsageData(): Promise<UsageData> {
	const { port, csrfToken } = await getConnection();
	const response = await requestRpc<ServerQuotaSummaryResponse>(port, csrfToken, API_ENDPOINT_QUOTA, {});

	const usage: UsageData = {};

	for (const group of response?.response?.groups ?? []) {
		const name = (group.displayName ?? '').toLowerCase();
		const isGemini = name.includes('gemini') || name.includes('flash');

		for (const bucket of group.buckets ?? []) {
			const fraction = parseFloat(String(bucket.remainingFraction ?? ''));
			if (!Number.isFinite(fraction)) { continue; }

			const percentage = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
			const resetTime = parseResetTimestamp(bucket.resetTime);
			const windowType = (bucket.window ?? bucket.bucketId ?? bucket.displayName ?? '').toLowerCase();

			const is5h = windowType.includes('5h') || windowType.includes('five') || windowType.includes('hour');
			const isWeekly = windowType.includes('week');

			if (isGemini) {
				if (is5h && (!usage.gemini5h || percentage < usage.gemini5h.percentage)) {
					usage.gemini5h = { percentage, resetTime };
				} else if (isWeekly && (!usage.geminiWeekly || percentage < usage.geminiWeekly.percentage)) {
					usage.geminiWeekly = { percentage, resetTime };
				}
			} else {
				if (is5h && (!usage.other5h || percentage < usage.other5h.percentage)) {
					usage.other5h = { percentage, resetTime };
				} else if (isWeekly && (!usage.otherWeekly || percentage < usage.otherWeekly.percentage)) {
					usage.otherWeekly = { percentage, resetTime };
				}
			}
		}
	}

	return usage;
}
