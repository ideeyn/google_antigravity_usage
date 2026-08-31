import * as vscode from 'vscode';
import { QuotaItem, UsageData } from './types';

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function formatCountdown(targetTime: number | null, now: number = Date.now()): string {
	if (!targetTime) { return ''; }
	const diffMs = targetTime - now;
	if (diffMs <= 0) { return '<1m'; }

	const days = Math.floor(diffMs / MS_PER_DAY);
	const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
	const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);

	if (days > 0) {
		return `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
	}
	if (hours > 0) {
		return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
	}
	return minutes > 0 ? `${minutes}m` : '<1m';
}

export function formatTwoUnitCountdown(targetTime: number | null, now: number = Date.now()): string {
	if (!targetTime) { return ''; }
	const diffMs = targetTime - now;
	if (diffMs <= 0) { return '<1m'; }

	const days = Math.floor(diffMs / MS_PER_DAY);
	const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
	const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);

	if (days > 0) {
		return `${days}d ${hours}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return minutes > 0 ? `${minutes}m` : '<1m';
}

export function formatSingleUnitCountdown(targetTime: number | null, now: number = Date.now()): string {
	if (!targetTime) { return ''; }
	const diffMs = targetTime - now;
	if (diffMs <= 0) { return '<1m'; }

	const days = Math.floor(diffMs / MS_PER_DAY);
	const hours = Math.floor(diffMs / MS_PER_HOUR);
	const minutes = Math.floor(diffMs / MS_PER_MINUTE);

	if (days > 0) { return `${days}d`; }
	if (hours > 0) { return `${hours}h`; }
	return minutes > 0 ? `${minutes}m` : '<1m';
}

export function formatProgressBar(percentage: number, totalChars: number = 20): string {
	const clamped = Math.max(0, Math.min(100, percentage));
	const filled = Math.round((clamped / 100) * totalChars);
	const empty = totalChars - filled;
	return `${'■'.repeat(filled)}${'·'.repeat(empty)}`;
}

export interface DisplayOptions {
	showGemini5h: boolean;
	showGeminiWeekly: boolean;
	showOther5h: boolean;
	showOtherWeekly: boolean;
	warningLimitGemini: number;
	runoutLimitGemini: number;
	warningLimitOther: number;
	runoutLimitOther: number;
}

function format5hStatus(item: QuotaItem | undefined): string {
	if (!item) { return '--%'; }
	const countdown = formatCountdown(item.resetTime);
	return countdown ? `${item.percentage}% (${countdown})` : `${item.percentage}%`;
}

function formatWeeklyStatus(item: QuotaItem | undefined): string {
	if (!item) { return '--%'; }
	const countdown = formatSingleUnitCountdown(item.resetTime);
	return countdown ? `${item.percentage}% (${countdown})` : `${item.percentage}%`;
}

function getCategorySymbol(
	defaultSymbol: string,
	fiveHourItem: QuotaItem | undefined,
	weeklyItem: QuotaItem | undefined,
	show5h: boolean,
	showWeekly: boolean,
	warningLimit: number,
	runoutLimit: number
): string {
	const percentages: number[] = [];
	if (show5h && fiveHourItem) {
		percentages.push(fiveHourItem.percentage);
	}
	if (showWeekly && weeklyItem) {
		percentages.push(weeklyItem.percentage);
	}
	if (percentages.length === 0) {
		return defaultSymbol;
	}
	const minPercentage = Math.min(...percentages);
	if (minPercentage <= runoutLimit) {
		return '🔴';
	}
	if (minPercentage <= warningLimit) {
		return '🟡';
	}
	return defaultSymbol;
}

function buildCategorySection(
	symbol: string,
	label: string,
	fiveHourItem: QuotaItem | undefined,
	weeklyItem: QuotaItem | undefined,
	show5h: boolean,
	showWeekly: boolean
): string | null {
	const parts: string[] = [];
	if (show5h && fiveHourItem) {
		parts.push(format5hStatus(fiveHourItem));
	}
	if (showWeekly && weeklyItem) {
		parts.push(formatWeeklyStatus(weeklyItem));
	}
	if (parts.length === 0) {
		return null;
	}
	return `${symbol} ${label} ${parts.join(' • ')}`;
}

export function buildStatusBarText(data: UsageData, options: DisplayOptions): string {
	const sections: string[] = [];

	// Gemini Section
	const geminiSymbol = getCategorySymbol(
		'✦',
		data.gemini5h,
		data.geminiWeekly,
		options.showGemini5h,
		options.showGeminiWeekly,
		options.warningLimitGemini,
		options.runoutLimitGemini
	);
	const geminiText = buildCategorySection(
		geminiSymbol,
		'Gemini',
		data.gemini5h,
		data.geminiWeekly,
		options.showGemini5h,
		options.showGeminiWeekly
	);
	if (geminiText) {
		sections.push(geminiText);
	}

	// Other (Claude / GPT) Section
	const otherSymbol = getCategorySymbol(
		'✳',
		data.other5h,
		data.otherWeekly,
		options.showOther5h,
		options.showOtherWeekly,
		options.warningLimitOther,
		options.runoutLimitOther
	);
	const otherText = buildCategorySection(
		otherSymbol,
		'Other',
		data.other5h,
		data.otherWeekly,
		options.showOther5h,
		options.showOtherWeekly
	);
	if (otherText) {
		sections.push(otherText);
	}

	if (sections.length === 0) {
		return 'Antigravity Quotas';
	}

	return sections.join('      ');
}

function getStatusIcon(percentage: number, warningLimit: number, runoutLimit: number): string {
	if (percentage <= runoutLimit) {
		return '🔴';
	}
	if (percentage <= warningLimit) {
		return '🟡';
	}
	return '🟢';
}

function formatBlock(
	title: string,
	item: QuotaItem | undefined,
	isEnabled: boolean,
	toggleCommand: string,
	warningLimit: number,
	runoutLimit: number
): string {
	const checkIcon = isEnabled ? '$(eye-closed)' : '$(eye)';
	const checkLabel = isEnabled ? 'hide bar' : 'show bar';
	const toggleLink = `<a href="command:${toggleCommand}" style="color: var(--vscode-descriptionForeground); text-decoration: none; opacity: 0.8;">${checkLabel} ${checkIcon}</a>`;

	const statusIcon = item ? `${getStatusIcon(item.percentage, warningLimit, runoutLimit)} ` : '';

	let content = '<span style="color: var(--vscode-descriptionForeground);"><i>No active quota</i></span>';
	if (item) {
		const bar = formatProgressBar(item.percentage, 20);
		const timeStr = formatTwoUnitCountdown(item.resetTime);
		const timePart = timeStr ? `&nbsp; <span style="color: var(--vscode-descriptionForeground);">${timeStr}</span>` : '';
		content = `<b>${item.percentage}%</b> &nbsp;<code>${bar}</code>${timePart}`;
	}

	return `<table width="100%"><tr><td align="left"><b>${statusIcon}${title}</b></td><td align="right">${toggleLink}</td></tr><tr><td colspan="2" style="padding-top: 2px; padding-bottom: 6px;">${content}</td></tr></table>`;
}

export function buildTooltip(data: UsageData, options: DisplayOptions): vscode.MarkdownString {
	const md = new vscode.MarkdownString('', true);
	md.isTrusted = true;
	md.supportHtml = true;

	const sections: string[] = [];

	// Gemini Category
	if (data.gemini5h || data.geminiWeekly) {
		const geminiBlocks: string[] = ['### ✦ Gemini'];
		geminiBlocks.push(
			formatBlock('5-Hour', data.gemini5h, options.showGemini5h, 'antigravity-usage.toggle-gemini-5h', options.warningLimitGemini, options.runoutLimitGemini)
		);
		geminiBlocks.push(
			formatBlock('Weekly', data.geminiWeekly, options.showGeminiWeekly, 'antigravity-usage.toggle-gemini-weekly', options.warningLimitGemini, options.runoutLimitGemini)
		);
		sections.push(geminiBlocks.join('\n\n'));
	}

	// Other Category
	if (data.other5h || data.otherWeekly) {
		const otherBlocks: string[] = ['### ✳ Other'];
		otherBlocks.push(
			formatBlock('5-Hour', data.other5h, options.showOther5h, 'antigravity-usage.toggle-other-5h', options.warningLimitOther, options.runoutLimitOther)
		);
		otherBlocks.push(
			formatBlock('Weekly', data.otherWeekly, options.showOtherWeekly, 'antigravity-usage.toggle-other-weekly', options.warningLimitOther, options.runoutLimitOther)
		);
		sections.push(otherBlocks.join('\n\n'));
	}

	if (sections.length === 0) {
		sections.push('*No quota data available*');
	}

	sections.push('<table width="100%"><tr><td align="left"><a href="command:antigravity-usage.open-settings" style="text-decoration:none;">$(gear) Settings</a></td><td align="right"><a href="command:antigravity-usage.refresh" style="text-decoration:none;">Refresh $(refresh)</a></td></tr></table>');

	md.appendMarkdown(sections.join('\n\n<br/>\n\n---\n\n'));
	return md;
}
