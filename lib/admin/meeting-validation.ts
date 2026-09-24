function parseTimestamp(value: unknown): Date | null {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}

export function parseMeetingInput(body: unknown): { title: string; scheduled_at: string; ended_at: string } | null {
	if (!body || typeof body !== 'object') return null;
	const { title, scheduled_at, ended_at } = body as Record<string, unknown>;
	if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) return null;
	const date = parseTimestamp(scheduled_at);
	const endDate = parseTimestamp(ended_at);
	if (!date || !endDate || endDate <= date) return null;
	return { title: title.trim(), scheduled_at: date.toISOString(), ended_at: endDate.toISOString() };
}
