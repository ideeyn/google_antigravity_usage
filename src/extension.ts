import * as vscode from 'vscode';
import { fetchUsageData } from './api';
import { buildStatusBarText, buildTooltip, DisplayOptions } from './formatter';
import { getErrorMessage } from './platform';
import { UsageData } from './types';

let statusBarItem: vscode.StatusBarItem | undefined;
let refreshTimer: NodeJS.Timeout | undefined;
let lastData: UsageData | null = null;

function getDisplayOptions(): DisplayOptions {
	const config = vscode.workspace.getConfiguration('antigravity-usage');
	return {
		showGemini5h: config.get<boolean>('show-gemini-5h', true),
		showGeminiWeekly: config.get<boolean>('show-gemini-weekly', true),
		showOther5h: config.get<boolean>('show-other-5h', true),
		showOtherWeekly: config.get<boolean>('show-other-weekly', true),
		warningLimitGemini: config.get<number>('limit-gemini-warning', 20),
		runoutLimitGemini: config.get<number>('limit-gemini-runout', 10),
		warningLimitOther: config.get<number>('limit-other-warning', 20),
		runoutLimitOther: config.get<number>('limit-other-runout', 10)
	};
}

function updateStatusBar(data: UsageData | null, errorMsg?: string) {
	if (!statusBarItem) { return; }

	if (errorMsg) {
		statusBarItem.text = 'Antigravity: Disconnected';
		const md = new vscode.MarkdownString(`**Antigravity Usage**\n\n${errorMsg}\n\n---\n\n<table width="100%"><tr><td align="left"><a href="command:antigravity-usage.open-settings" style="text-decoration:none;">$(gear) Settings</a></td><td align="right"><a href="command:antigravity-usage.refresh" style="text-decoration:none;">Refresh $(refresh)</a></td></tr></table>`, true);
		md.isTrusted = true;
		md.supportHtml = true;
		statusBarItem.tooltip = md;
		statusBarItem.show();
		return;
	}

	if (data) {
		lastData = data;
		const options = getDisplayOptions();
		statusBarItem.text = buildStatusBarText(data, options);
		statusBarItem.tooltip = buildTooltip(data, options);
		statusBarItem.show();
	}
}

async function toggleSetting(key: string) {
	const config = vscode.workspace.getConfiguration('antigravity-usage');
	const current = config.get<boolean>(key, true);
	await config.update(key, !current, vscode.ConfigurationTarget.Global);
	if (lastData) {
		updateStatusBar(lastData);
		// Briefly hide and re-show status bar item to dismiss the stale hover popup
		statusBarItem?.hide();
		setTimeout(() => {
			statusBarItem?.show();
		}, 50);
	}
}

const STARTUP_GRACE_MS = 60 * 1000;
const STARTUP_RETRY_MS = 5000;
let activationTime = 0;
let isConnected = false;

async function refresh(isManual: boolean = false) {
	try {
		const data = await fetchUsageData();
		const wasDisconnected = !isConnected;
		isConnected = true;
		updateStatusBar(data);
		if (wasDisconnected) {
			setupTimer();
		}
		if (isManual) {
			vscode.window.setStatusBarMessage('Antigravity Usage refreshed', 2000);
		}
	} catch (err) {
		const inGracePeriod = !isConnected && (Date.now() - activationTime < STARTUP_GRACE_MS);
		if (inGracePeriod) {
			if (statusBarItem) {
				statusBarItem.text = 'Antigravity: Loading...';
				statusBarItem.show();
			}
		} else {
			updateStatusBar(null, getErrorMessage(err));
			if (isManual) {
				vscode.window.showWarningMessage(`Antigravity Usage: ${getErrorMessage(err)}`);
			}
		}
	}
}

function setupTimer() {
	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = undefined;
	}

	const config = vscode.workspace.getConfiguration('antigravity-usage');
	const intervalSec = config.get<number>('refresh-interval', 60);

	if (intervalSec <= 0 && isConnected) {
		return;
	}

	const inGracePeriod = !isConnected && (Date.now() - activationTime < STARTUP_GRACE_MS);
	const delayMs = inGracePeriod ? STARTUP_RETRY_MS : Math.max(5, intervalSec) * 1000;

	refreshTimer = setInterval(() => {
		refresh(false);
	}, delayMs);
}

function createStatusBarItem(): vscode.StatusBarItem {
	const config = vscode.workspace.getConfiguration('antigravity-usage');
	const alignmentStr = config.get<string>('status-bar-alignment', 'Right');
	const alignment = alignmentStr === 'Left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;
	const priority = config.get<number>('status-bar-priority', 110);

	const item = vscode.window.createStatusBarItem(alignment, priority);
	item.command = 'antigravity-usage.refresh';
	item.text = 'Antigravity: Loading...';
	return item;
}

export function activate(context: vscode.ExtensionContext) {
	activationTime = Date.now();
	isConnected = false;

	statusBarItem = createStatusBarItem();
	context.subscriptions.push(statusBarItem);
	statusBarItem.show();

	context.subscriptions.push(
		vscode.commands.registerCommand('antigravity-usage.refresh', () => refresh(true)),
		vscode.commands.registerCommand('antigravity-usage.open-settings', () => {
			vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity-usage');
		}),
		vscode.commands.registerCommand('antigravity-usage.toggle-gemini-5h', () => toggleSetting('show-gemini-5h')),
		vscode.commands.registerCommand('antigravity-usage.toggle-gemini-weekly', () => toggleSetting('show-gemini-weekly')),
		vscode.commands.registerCommand('antigravity-usage.toggle-other-5h', () => toggleSetting('show-other-5h')),
		vscode.commands.registerCommand('antigravity-usage.toggle-other-weekly', () => toggleSetting('show-other-weekly'))
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('antigravity-usage')) {
				if (e.affectsConfiguration('antigravity-usage.status-bar-alignment') || e.affectsConfiguration('antigravity-usage.status-bar-priority')) {
					statusBarItem?.dispose();
					statusBarItem = createStatusBarItem();
					context.subscriptions.push(statusBarItem);
				}
				if (lastData) {
					updateStatusBar(lastData);
				}
				if (e.affectsConfiguration('antigravity-usage.refresh-interval')) {
					setupTimer();
				}
			}
		})
	);

	setupTimer();
	refresh(false);

	const graceTimeout = setTimeout(() => {
		if (!isConnected) {
			setupTimer();
			refresh(false);
		}
	}, STARTUP_GRACE_MS);
	context.subscriptions.push({ dispose: () => clearTimeout(graceTimeout) });
}

export function deactivate() {
	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = undefined;
	}
	if (statusBarItem) {
		statusBarItem.dispose();
		statusBarItem = undefined;
	}
}

