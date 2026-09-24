export function parseMeetingInput(body: unknown): { title: string; scheduled_at: string } | null {
	if (!body || typeof body !== 'object') return null;
	const { title, scheduled_at } = body as Record<string, unknown>;
	if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) return null;
	if (typeof scheduled_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(scheduled_at)) return null;
	const date = new Date(scheduled_at);
	if (!Number.isFinite(date.getTime())) return null;
	return { title: title.trim(), scheduled_at: date.toISOString() };
}
