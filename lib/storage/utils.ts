/**
 * Utility functions for audio storage paths and URLs
 * Safe for both Client and Server environments (no AWS/Node dependencies).
 */

/**
 * Extracts the storage relative path (e.g. "userId/attemptId/questionId.webm")
 * from any input: raw path, Supabase signed URL, Cloudflare R2 presigned URL,
 * or custom CDN / public URL.
 */
export function extractAudioStoragePath(input: string | null | undefined): string {
	if (!input) return '';
	const cleanInput = input.trim();

	// If it's already a relative path without protocol (e.g., "231/attemptId/q1.webm"),
	// strip leading slashes and return.
	if (!cleanInput.startsWith('http://') && !cleanInput.startsWith('https://')) {
		// If it's an API route like "/api/admin/audio?path=...", extract param
		if (cleanInput.startsWith('/api/admin/audio')) {
			try {
				const dummyUrl = new URL(cleanInput, 'http://localhost');
				const p = dummyUrl.searchParams.get('path');
				if (p) return extractAudioStoragePath(p);
				const u = dummyUrl.searchParams.get('url');
				if (u) return extractAudioStoragePath(u);
			} catch {
				// ignore
			}
		}
		return cleanInput.replace(/^\/+/, '');
	}

	try {
		const parsed = new URL(cleanInput);
		let pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

		// 1. If path contains bucket prefix (e.g. "storage/v1/object/sign/ielts-recordings/20/..." or "ielts-recordings/20/...")
		const bucketMatch = pathname.match(/(?:ielts-recordings|ielts-speaking-recordings)\/(.+)$/);
		if (bucketMatch?.[1]) {
			return bucketMatch[1];
		}

		// 2. Otherwise pathname is the relative storage key (e.g. "20/ielts-att-xxx/p1-1.webm")
		return pathname;
	} catch {
		// Fallback for malformed URLs
		const match = cleanInput.match(/(?:ielts-recordings|ielts-speaking-recordings)\/([^?#]+)/);
		if (match?.[1]) {
			return decodeURIComponent(match[1]);
		}
		return cleanInput.split('?')[0].replace(/^\/+/, '');
	}
}
