export interface QuotaItem {
	percentage: number;
	resetTime: number | null;
}

export interface UsageData {
	gemini5h?: QuotaItem;
	geminiWeekly?: QuotaItem;
	other5h?: QuotaItem;
	otherWeekly?: QuotaItem;
}

export interface ProcessInfo {
	pid: number;
	cmd: string;
}

export interface CachedConnection {
	port: number;
	csrfToken: string;
	timestamp: number;
}

export interface ServerQuotaSummaryResponse {
	response?: {
		groups?: Array<{
			displayName?: string;
			buckets?: Array<{
				bucketId?: string;
				displayName?: string;
				remainingFraction?: number | string;
				resetTime?: string | number;
				window?: string;
			}>;
		}>;
	};
}

