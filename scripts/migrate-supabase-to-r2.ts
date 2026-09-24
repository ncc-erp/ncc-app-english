import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load .env.local and .env
try {
	loadEnvConfig(path.resolve(__dirname, '..'));
} catch {
	// ignore
}
try {
	loadEnvConfig(process.cwd());
} catch {
	// ignore
}

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';

function getArg(name: string): string | undefined {
	const prefix = `--${name}=`;
	const arg = process.argv.find((a) => a.startsWith(prefix));
	if (arg) return arg.slice(prefix.length).trim();
	const index = process.argv.indexOf(`--${name}`);
	if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
		return process.argv[index + 1].trim();
	}
	return undefined;
}

const isDryRun = process.argv.includes('--dry-run');

async function main() {
	console.log('===========================================================');
	console.log('🚀 MIGRATION: SUPABASE STORAGE -> CLOUDFLARE R2');
	console.log('===========================================================\n');

	// 1. Supabase config
	const supabaseUrl = (getArg('supabase-url') || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
	const supabaseKey = getArg('supabase-key') || process.env.SUPABASE_SERVICE_ROLE_KEY;
	const supabaseBucket = getArg('supabase-bucket') || process.env.SUPABASE_STORAGE_BUCKET || 'ielts-recordings';

	// 2. Cloudflare R2 config
	const r2AccountId = getArg('r2-account') || process.env.R2_ACCOUNT_ID;
	const r2AccessKeyId = getArg('r2-key') || process.env.R2_ACCESS_KEY_ID;
	const r2SecretAccessKey = getArg('r2-secret') || process.env.R2_SECRET_ACCESS_KEY;
	const r2Bucket = getArg('r2-bucket') || process.env.R2_BUCKET_NAME || 'ielts-recordings';

	const missingFields: string[] = [];
	if (!supabaseUrl) missingFields.push('SUPABASE_URL (--supabase-url)');
	if (!supabaseKey) missingFields.push('SUPABASE_SERVICE_ROLE_KEY (--supabase-key)');
	if (!r2AccountId) missingFields.push('R2_ACCOUNT_ID (--r2-account)');
	if (!r2AccessKeyId) missingFields.push('R2_ACCESS_KEY_ID (--r2-key)');
	if (!r2SecretAccessKey) missingFields.push('R2_SECRET_ACCESS_KEY (--r2-secret)');

	if (missingFields.length > 0) {
		console.error('❌ Thiếu các thông tin kết nối sau:');
		missingFields.forEach((f) => console.error(`   - ${f}`));
		console.log('\n💡 Bạn có thể cấu hình theo 1 trong 2 cách:');
		console.log('   Cách 1: Thêm vào file .env.local:');
		console.log('     SUPABASE_URL=https://<project-ref>.supabase.co');
		console.log('     SUPABASE_SERVICE_ROLE_KEY=eyJ...');
		console.log('     R2_ACCOUNT_ID=<cloudflare_account_id>');
		console.log('     R2_ACCESS_KEY_ID=<access_key_id>');
		console.log('     R2_SECRET_ACCESS_KEY=<secret_access_key>');
		console.log('     R2_BUCKET_NAME=ielts-recordings\n');
		console.log('   Cách 2: Truyền trực tiếp qua tham số dòng lệnh:');
		console.log('     npm run migrate:storage -- \\');
		console.log('       --supabase-url="https://xxx.supabase.co" \\');
		console.log('       --supabase-key="eyJ..." \\');
		console.log('       --r2-account="<account_id>" \\');
		console.log('       --r2-key="<access_key>" \\');
		console.log('       --r2-secret="<secret_key>" \\');
		console.log('       --r2-bucket="ielts-recordings"\n');
		process.exit(1);
	}

	const r2Client = new S3Client({
		region: 'auto',
		endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: r2AccessKeyId!,
			secretAccessKey: r2SecretAccessKey!
		}
	});

	console.log(`📦 Nguồn: Supabase Storage [Bucket: ${supabaseBucket}] (${supabaseUrl})`);
	console.log(`🎯 Đích : Cloudflare R2     [Bucket: ${r2Bucket}] (Account: ${r2AccountId})`);
	if (isDryRun) {
		console.log('⚠️  CHẾ ĐỘ DRY-RUN: Chỉ kiểm tra danh sách file, không upload lên R2.\n');
	} else {
		console.log('');
	}

	// 3. Thu thập danh sách file cần chuyển
	const pathsToMigrate = new Set<string>();

	// 3a. Lấy từ PostgreSQL nếu có DB connection
	const dbConnectionString = getArg('database-url') || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

	if (dbConnectionString) {
		console.log('🔍 Đang quét danh sách file từ database PostgreSQL...');
		try {
			const pool = new Pool({
				connectionString: dbConnectionString,
				ssl: { rejectUnauthorized: false }
			});
			const res = await pool.query<{ audio_storage_path: string }>(
				`SELECT DISTINCT audio_storage_path FROM ielts_speaking_responses WHERE audio_storage_path IS NOT NULL AND audio_storage_path != ''`
			);
			for (const row of res.rows) {
				if (row.audio_storage_path) {
					pathsToMigrate.add(row.audio_storage_path.trim());
				}
			}
			console.log(`   ➔ Tìm thấy ${res.rows.length} đường dẫn file từ database.`);
			await pool.end();
		} catch (dbErr) {
			console.warn('   ⚠️ Không kết nối được Database (bỏ qua quét DB):', (dbErr as Error).message);
		}
	}

	// 3b. Quét đệ quy từ Supabase Storage API
	console.log('🔍 Đang quét danh sách file trực tiếp từ Supabase Storage Bucket...');
	async function listSupabaseFiles(prefix = ''): Promise<string[]> {
		const files: string[] = [];
		try {
			const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${supabaseBucket}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${supabaseKey}`,
					apikey: supabaseKey!,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prefix,
					limit: 1000,
					offset: 0,
					sortBy: { column: 'name', order: 'asc' }
				})
			});

			if (!res.ok) {
				console.warn(`   ⚠️ Supabase list thất bại ở prefix "${prefix}": ${res.status} ${await res.text()}`);
				return files;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const items = (await res.json()) as any[];
			for (const item of items) {
				const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
				if (item.id === null) {
					// Thư mục con -> quét tiếp
					const subFiles = await listSupabaseFiles(itemPath);
					files.push(...subFiles);
				} else {
					files.push(itemPath);
				}
			}
		} catch (err) {
			console.warn(`   ⚠️ Lỗi khi quét prefix "${prefix}":`, err);
		}
		return files;
	}

	const scannedFiles = await listSupabaseFiles('');
	for (const f of scannedFiles) {
		pathsToMigrate.add(f);
	}
	console.log(`   ➔ Tổng hợp: Tìm thấy ${pathsToMigrate.size} file âm thanh cần kiểm tra.\n`);

	if (pathsToMigrate.size === 0) {
		console.log('ℹ️ Không có file nào trong Supabase Storage.');
		return;
	}

	// 4. Di chuyển từng file sang R2
	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;
	const total = pathsToMigrate.size;
	let index = 0;

	for (const filePath of pathsToMigrate) {
		index++;
		const prefix = `[${index}/${total}] ${filePath}`;

		// Kiểm tra xem file đã có trên R2 chưa (tránh upload lại)
		try {
			await r2Client.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: filePath }));
			console.log(`⏭️  ${prefix} -> Đã có trên R2 (Bỏ qua)`);
			skipCount++;
			continue;
		} catch {
			// Chưa có trên R2 -> tiếp tục tải và đẩy lên
		}

		if (isDryRun) {
			console.log(`🔎 [DRY-RUN] ${prefix} -> Sẽ được chuyển sang R2`);
			successCount++;
			continue;
		}

		try {
			// Tải file từ Supabase
			let downloadRes = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${supabaseBucket}/${filePath}`, {
				headers: {
					Authorization: `Bearer ${supabaseKey}`,
					apikey: supabaseKey!
				}
			});

			if (!downloadRes.ok) {
				downloadRes = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${filePath}`, {
					headers: {
						Authorization: `Bearer ${supabaseKey}`,
						apikey: supabaseKey!
					}
				});
			}

			if (!downloadRes.ok) {
				console.error(`❌ ${prefix} -> Lỗi tải từ Supabase (${downloadRes.status} ${downloadRes.statusText})`);
				errorCount++;
				continue;
			}

			const contentType =
				downloadRes.headers.get('content-type') || (filePath.endsWith('.ogg') ? 'audio/ogg' : filePath.endsWith('.mp3') ? 'audio/mp3' : 'audio/webm');

			const arrayBuffer = await downloadRes.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// Đẩy lên R2
			await r2Client.send(
				new PutObjectCommand({
					Bucket: r2Bucket,
					Key: filePath,
					Body: buffer,
					ContentType: contentType
				})
			);

			const sizeKb = (buffer.length / 1024).toFixed(1);
			console.log(`✅ ${prefix} (${sizeKb} KB) -> Đã chuyển sang R2 thành công`);
			successCount++;
		} catch (uploadErr) {
			console.error(`❌ ${prefix} -> Lỗi di chuyển:`, uploadErr);
			errorCount++;
		}
	}

	console.log('\n===========================================================');
	console.log(`🎉 KẾT QUẢ MIGRATION FILE:`);
	console.log(`   - Tổng số file      : ${total}`);
	console.log(`   - Chuyển thành công : ${successCount}`);
	console.log(`   - Đã có sẵn trên R2 : ${skipCount}`);
	console.log(`   - Gặp lỗi           : ${errorCount}`);
	console.log('===========================================================');

	// 5. Cập nhật Neon PostgreSQL database
	const shouldUpdateDb = !process.argv.includes('--skip-db');
	if (shouldUpdateDb && dbConnectionString && !isDryRun) {
		console.log('\n🔄 Đang cập nhật dữ liệu trong database Neon...');
		try {
			const pool = new Pool({
				connectionString: dbConnectionString,
				ssl: { rejectUnauthorized: false }
			});

			const r2PublicDomain = (getArg('r2-public-domain') || process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');

			// 5a. Chuẩn hóa audio_storage_path cho những row bị thiếu nhưng có audio_url
			const fixPathsRes = await pool.query(`
				UPDATE ielts_speaking_responses
				SET audio_storage_path = substring(audio_url from '(?:ielts-recordings|ielts-speaking-recordings)/([^?#]+)')
				WHERE (audio_storage_path IS NULL OR audio_storage_path = '')
				  AND audio_url ~ '(?:ielts-recordings|ielts-speaking-recordings)/([^?#]+)';
			`);
			if (fixPathsRes.rowCount && fixPathsRes.rowCount > 0) {
				console.log(`   ➔ Đã chuẩn hóa audio_storage_path cho ${fixPathsRes.rowCount} bản ghi.`);
			}

			// 5b. Nếu có R2_PUBLIC_DOMAIN, cập nhật audio_url thành URL R2
			if (r2PublicDomain) {
				const updateUrlRes = await pool.query(
					`UPDATE ielts_speaking_responses
					 SET audio_url = $1 || '/' || audio_storage_path
					 WHERE audio_storage_path IS NOT NULL AND audio_storage_path != ''`,
					[r2PublicDomain]
				);
				console.log(`   ➔ Đã cập nhật audio_url thành R2 URL (${r2PublicDomain}/...) cho ${updateUrlRes.rowCount} bản ghi.`);

				// Cập nhật các URL supabase cũ trong score_result của ielts_speaking_attempts
				const attemptsWithOldUrl = await pool.query(
					`SELECT id, score_result FROM ielts_speaking_attempts WHERE score_result::text LIKE '%supabase.co%'`
				);
				let updatedAttempts = 0;
				for (const att of attemptsWithOldUrl.rows) {
					if (!att.score_result) continue;
					const updatedScoreResult = JSON.parse(JSON.stringify(att.score_result));
					if (updatedScoreResult.responses) {
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						for (const [, r] of Object.entries(updatedScoreResult.responses as Record<string, any>)) {
							if (r.audio_url && typeof r.audio_url === 'string') {
								const match = r.audio_url.match(/(?:ielts-recordings|ielts-speaking-recordings)\/([^?#]+)/);
								if (match?.[1]) {
									const decoded = decodeURIComponent(match[1]);
									r.audio_storage_path = decoded;
									r.audio_url = `${r2PublicDomain}/${decoded}`;
								}
							}
						}
						await pool.query(`UPDATE ielts_speaking_attempts SET score_result = $1 WHERE id = $2`, [JSON.stringify(updatedScoreResult), att.id]);
						updatedAttempts++;
					}
				}
				if (updatedAttempts > 0) {
					console.log(`   ➔ Đã cập nhật R2 URLs trong score_result cho ${updatedAttempts} attempts.`);
				}
			} else {
				console.log('   ℹ️ Gợi ý: Nếu Cloudflare R2 của bạn có bật Public URL / Custom domain, hãy truyền thêm:');
				console.log('      --r2-public-domain="https://pub-xxx.r2.dev" (hoặc cấu hình R2_PUBLIC_DOMAIN trong .env.local)');
				console.log('      để script tự động thay thế toàn bộ link Supabase cũ trong database sang link R2!');
			}

			await pool.end();
			console.log('   ✅ Kiểm tra và cập nhật database Neon hoàn tất!\n');
		} catch (dbUpdateErr) {
			console.error('   ❌ Lỗi khi cập nhật database Neon:', dbUpdateErr);
		}
	}
}

main().catch((err) => {
	console.error('Fatal Migration Error:', err);
	process.exit(1);
});
