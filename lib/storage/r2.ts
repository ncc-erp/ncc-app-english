import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extractAudioStoragePath } from './utils';

export { extractAudioStoragePath };

const DEFAULT_BUCKET = 'ielts-recordings';

function getR2Config() {
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const bucket = process.env.R2_BUCKET_NAME || DEFAULT_BUCKET;
	const publicDomain = (process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_URL || process.env.R2_PUBLIC_URL || '').replace(
		/\/$/,
		''
	);

	if (!accountId || !accessKeyId || !secretAccessKey) {
		throw new Error(
			'Cloudflare R2 is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY in environment variables.'
		);
	}

	return { accountId, accessKeyId, secretAccessKey, bucket, publicDomain };
}

let r2ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
	if (!r2ClientInstance) {
		const { accountId, accessKeyId, secretAccessKey } = getR2Config();
		r2ClientInstance = new S3Client({
			region: 'auto',
			endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId,
				secretAccessKey
			}
		});
	}
	return r2ClientInstance;
}

/**
 * Uploads an audio recording file directly to Cloudflare R2 bucket.
 */
export async function uploadAudio(
	path: string,
	body: ArrayBuffer | Buffer,
	contentType = 'audio/webm'
): Promise<string> {
	const { bucket } = getR2Config();
	const client = getR2Client();
	const cleanPath = extractAudioStoragePath(path);
	const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

	await client.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: cleanPath,
			Body: buffer,
			ContentType: contentType || 'audio/webm'
		})
	);

	return cleanPath;
}

/**
 * Creates an audio access URL:
 * - If R2_PUBLIC_DOMAIN is set, returns the direct public CDN URL (no expiration).
 * - Otherwise creates a temporary presigned URL via AWS SDK (default: 3600 seconds).
 */
export async function createSignedAudioUrl(path: string, expiresIn = 3600): Promise<string> {
	const { bucket, publicDomain } = getR2Config();
	const cleanPath = extractAudioStoragePath(path);

	if (publicDomain) {
		return `${publicDomain}/${cleanPath}`;
	}

	const client = getR2Client();
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: cleanPath
	});

	return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Downloads audio file buffer and its MIME content type from Cloudflare R2.
 */
export async function downloadAudioBuffer(
	path: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
	try {
		const { bucket } = getR2Config();
		const client = getR2Client();
		const cleanPath = extractAudioStoragePath(path);

		const res = await client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: cleanPath
			})
		);

		const byteArray = await res.Body?.transformToByteArray();
		if (!byteArray) return null;

		const defaultContentType = cleanPath.endsWith('.ogg')
			? 'audio/ogg'
			: cleanPath.endsWith('.mp3')
				? 'audio/mp3'
				: cleanPath.endsWith('.wav')
					? 'audio/wav'
					: 'audio/webm';

		return {
			buffer: Buffer.from(byteArray),
			contentType: res.ContentType || defaultContentType
		};
	} catch (error) {
		console.error(`[Cloudflare R2] Error downloading audio ${path}:`, error);
		return null;
	}
}

/**
 * Downloads audio file from Cloudflare R2 and converts it to base64.
 * Useful for AI evaluations (Anthropic, Gemini, Deepgram, etc.).
 */
export async function downloadAudioAsBase64(
	path: string
): Promise<{ base64: string; mimeType: string } | null> {
	const result = await downloadAudioBuffer(path);
	if (!result) return null;
	return {
		base64: result.buffer.toString('base64'),
		mimeType: result.contentType
	};
}

/**
 * Checks whether an audio file exists in Cloudflare R2 bucket.
 */
export async function checkAudioExists(path: string): Promise<boolean> {
	try {
		const { bucket } = getR2Config();
		const client = getR2Client();
		const cleanPath = extractAudioStoragePath(path);

		await client.send(
			new HeadObjectCommand({
				Bucket: bucket,
				Key: cleanPath
			})
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Deletes an audio file from Cloudflare R2 bucket.
 */
export async function deleteAudio(path: string): Promise<boolean> {
	try {
		const { bucket } = getR2Config();
		const client = getR2Client();
		const cleanPath = extractAudioStoragePath(path);

		await client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: cleanPath
			})
		);
		return true;
	} catch (error) {
		console.error(`[Cloudflare R2] Error deleting audio ${path}:`, error);
		return false;
	}
}
