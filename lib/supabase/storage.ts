import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const isR2Enabled = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

const r2Bucket = process.env.R2_BUCKET_NAME || process.env.SUPABASE_STORAGE_BUCKET || 'ielts-recordings';

let r2ClientInstance: S3Client | null = null;
function getR2Client(): S3Client {
	if (!r2ClientInstance) {
		r2ClientInstance = new S3Client({
			region: 'auto',
			endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: process.env.R2_ACCESS_KEY_ID!,
				secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
			}
		});
	}
	return r2ClientInstance;
}

// -------------------------------------------------------------
// Supabase Storage Fallback Helpers
// -------------------------------------------------------------
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'ielts-recordings';

function getSupabaseConfig() {
	const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!baseUrl || !serviceRoleKey) {
		throw new Error(
			'Storage is not configured. Please set R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) or Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).'
		);
	}

	return { baseUrl: baseUrl.replace(/\/$/, ''), serviceRoleKey };
}

// -------------------------------------------------------------
// Storage API Methods (R2 prioritized, Supabase fallback)
// -------------------------------------------------------------

export async function uploadAudio(path: string, body: ArrayBuffer, contentType: string) {
	if (isR2Enabled) {
		const client = getR2Client();
		await client.send(
			new PutObjectCommand({
				Bucket: r2Bucket,
				Key: path,
				Body: Buffer.from(body),
				ContentType: contentType || 'audio/webm'
			})
		);
		return;
	}

	const { baseUrl, serviceRoleKey } = getSupabaseConfig();
	const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			'Content-Type': contentType || 'audio/webm',
			'x-upsert': 'true'
		},
		body
	});

	if (!response.ok) {
		throw new Error(`Supabase upload failed: ${await response.text()}`);
	}
}

export async function createSignedAudioUrl(path: string, expiresIn = 3600) {
	if (isR2Enabled) {
		const client = getR2Client();
		const command = new GetObjectCommand({
			Bucket: r2Bucket,
			Key: path
		});
		return await getSignedUrl(client, command, { expiresIn });
	}

	const { baseUrl, serviceRoleKey } = getSupabaseConfig();
	const response = await fetch(`${baseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			apikey: serviceRoleKey,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ expiresIn })
	});

	if (!response.ok) {
		throw new Error(`Supabase signed URL failed: ${await response.text()}`);
	}

	const data = (await response.json()) as {
		signedURL?: string;
		signedUrl?: string;
	};
	const signedPath = data.signedURL || data.signedUrl;
	if (!signedPath) throw new Error('Supabase did not return a signed URL.');

	return signedPath.startsWith('http') ? signedPath : `${baseUrl}/storage/v1${signedPath}`;
}

export async function downloadAudioBuffer(path: string): Promise<{ buffer: Buffer; contentType: string } | null> {
	if (isR2Enabled) {
		try {
			const client = getR2Client();
			const res = await client.send(
				new GetObjectCommand({
					Bucket: r2Bucket,
					Key: path
				})
			);
			const byteArray = await res.Body?.transformToByteArray();
			if (!byteArray) return null;
			return {
				buffer: Buffer.from(byteArray),
				contentType: res.ContentType || (path.endsWith('.ogg') ? 'audio/ogg' : path.endsWith('.mp3') ? 'audio/mp3' : 'audio/webm')
			};
		} catch (error) {
			console.error(`[Cloudflare R2] Error downloading audio ${path}:`, error);
			return null;
		}
	}

	try {
		const { baseUrl, serviceRoleKey } = getSupabaseConfig();

		// 1. Try authenticated object endpoint (standard for private buckets)
		let response = await fetch(`${baseUrl}/storage/v1/object/authenticated/${bucket}/${path}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${serviceRoleKey}`,
				apikey: serviceRoleKey
			}
		});

		// 2. Fallback to direct object endpoint
		if (!response.ok) {
			response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${serviceRoleKey}`,
					apikey: serviceRoleKey
				}
			});
		}

		// 3. Fallback to fresh signed URL
		if (!response.ok) {
			try {
				const signedUrl = await createSignedAudioUrl(path, 120);
				response = await fetch(signedUrl);
			} catch (signErr) {
				console.warn(`[Supabase Storage] Failed to create signed URL fallback for ${path}:`, signErr);
			}
		}

		if (!response.ok) {
			console.warn(`[Supabase Storage] Failed to download audio ${path}: ${response.status} ${response.statusText}`);
			return null;
		}

		const contentType =
			response.headers.get('content-type') ||
			(path.endsWith('.ogg') ? 'audio/ogg' : path.endsWith('.mp3') ? 'audio/mp3' : path.endsWith('.wav') ? 'audio/wav' : 'audio/webm');

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		return {
			buffer,
			contentType: contentType.split(';')[0].trim()
		};
	} catch (error) {
		console.error(`[Supabase Storage] Error downloading audio ${path}:`, error);
		return null;
	}
}

export async function downloadAudioAsBase64(path: string): Promise<{ base64: string; mimeType: string } | null> {
	const result = await downloadAudioBuffer(path);
	if (!result) return null;
	return {
		base64: result.buffer.toString('base64'),
		mimeType: result.contentType
	};
}
