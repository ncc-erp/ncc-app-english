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
const isDbOnly = process.argv.includes('--db-only');

interface DbResponseRecord {
	id: string;
	attempt_id: string;
	question_id: string;
	audio_storage_path: string | null;
	audio_url: string | null;
}

async function main() {
	console.log('===========================================================');
	console.log('🚀 MIGRATION: SUPABASE STORAGE -> CLOUDFLARE R2 (WITH DB CHECK)');
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
	const r2PublicDomain = (getArg('r2-public-domain') || process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');

	// 3. Database config
	const dbConnectionString = getArg('database-url') || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

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
	if (r2PublicDomain) {
		console.log(`🌐 R2 Domain: ${r2PublicDomain}`);
	}
	if (isDryRun) {
		console.log('⚠️  CHẾ ĐỘ DRY-RUN: Chỉ kiểm tra danh sách file và DB, không upload hay sửa DB.');
	}
	if (isDbOnly) {
		console.log('🎯 CHẾ ĐỘ DB-ONLY: Chỉ di chuyển các file có bản ghi tương ứng trong Database.');
	}
	console.log('');

	// 4. Kết nối DB và nạp danh sách responses để check record ID
	let pool: Pool | null = null;
	const dbByPath = new Map<string, DbResponseRecord>();
	const dbByAttemptAndQ = new Map<string, DbResponseRecord>();

	if (dbConnectionString) {
		console.log('🔌 Đang kết nối tới Neon Database và tải danh sách bản ghi...');
		try {
			pool = new Pool({
				connectionString: dbConnectionString,
				ssl: { rejectUnauthorized: false }
			});
			const res = await pool.query<DbResponseRecord>(
				`SELECT id, attempt_id, question_id, audio_storage_path, audio_url FROM ielts_speaking_responses`
			);

			for (const r of res.rows) {
				if (r.audio_storage_path) {
					dbByPath.set(r.audio_storage_path.trim(), r);
				}
				if (r.attempt_id && r.question_id) {
					dbByAttemptAndQ.set(`${r.attempt_id.trim()}:${r.question_id.trim()}`, r);
				}
			}
			console.log(`   ➔ Đã nạp ${res.rows.length} bản ghi response từ Database.\n`);
		} catch (dbErr) {
			console.warn('   ⚠️ Không kết nối được Database (bỏ qua DB check):', (dbErr as Error).message, '\n');
		}
	} else {
		console.log('ℹ️ Không có DATABASE_URL -> Bỏ qua kiểm tra bản ghi Database.\n');
	}

	// 5. Thu thập danh sách file từ Supabase Storage và DB
	const pathsToMigrate = new Set<string>();

	// 5a. Thêm từ DB
	for (const p of dbByPath.keys()) {
		pathsToMigrate.add(p);
	}

	// 5b. Quét đệ quy từ Supabase Storage Bucket (nếu không chạy chế độ db-only)
	if (isDbOnly) {
		console.log(`   ➔ Chế độ DB-Only: Tìm thấy ${pathsToMigrate.size} file tương ứng với các bản ghi Database cần xử lý.\n`);
	} else {
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
		console.log(`   ➔ Tổng hợp: Tìm thấy ${pathsToMigrate.size} file âm thanh cần xử lý.\n`);
	}

	if (pathsToMigrate.size === 0) {
		console.log('ℹ️ Không có file nào để migrate.');
		if (pool) await pool.end();
		return;
	}

	// 6. Xử lý từng file (Check DB + Copy sang R2 + Cập nhật DB)
	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;
	let matchedDbCount = 0;
	let updatedDbCount = 0;
	const total = pathsToMigrate.size;
	let index = 0;

	for (const filePath of pathsToMigrate) {
		index++;

		// Phân tích đường dẫn: <user_id>/<attempt_id>/<question_id>.<ext>
		const parts = filePath.split('/');
		const attemptIdFromPath = parts.length >= 2 ? parts[1] : undefined;
		const questionIdFromPath = parts.length >= 3 ? parts[2].replace(/\.[^.]+$/, '') : undefined;
		const lookupKey = attemptIdFromPath && questionIdFromPath ? `${attemptIdFromPath}:${questionIdFromPath}` : '';

		// Tìm bản ghi trong Database
		const dbRecord = dbByPath.get(filePath) || (lookupKey ? dbByAttemptAndQ.get(lookupKey) : undefined);

		let dbInfo = '⚠️ [DB: Không có trong DB]';
		if (dbRecord) {
			matchedDbCount++;
			dbInfo = `✅ [DB ID: ${dbRecord.id}] [Attempt: ${dbRecord.attempt_id}] [Q: ${dbRecord.question_id}]`;
		} else if (isDbOnly) {
			// Bỏ qua nếu bật cờ --db-only và không có trong DB
			continue;
		}

		const prefix = `[${index}/${total}] ${filePath}`;

		// Kiểm tra file trên R2
		let alreadyOnR2 = false;
		try {
			await r2Client.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: filePath }));
			alreadyOnR2 = true;
		} catch {
			alreadyOnR2 = false;
		}

		if (alreadyOnR2) {
			console.log(`⏭️  ${prefix}\n     ${dbInfo} ➔ Đã có trên R2 (Bỏ qua upload)`);
			skipCount++;
		} else if (isDryRun) {
			console.log(`🔎 [DRY-RUN] ${prefix}\n     ${dbInfo} ➔ Sẽ được chuyển sang R2`);
			successCount++;
		} else {
			try {
				// Tải từ Supabase
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
					console.error(`❌ ${prefix}\n     ${dbInfo} ➔ Lỗi tải từ Supabase (${downloadRes.status} ${downloadRes.statusText})`);
					errorCount++;
					continue;
				}

				const contentType =
					downloadRes.headers.get('content-type') || (filePath.endsWith('.ogg') ? 'audio/ogg' : filePath.endsWith('.mp3') ? 'audio/mp3' : 'audio/webm');

				const arrayBuffer = await downloadRes.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);

				// Upload sang R2
				await r2Client.send(
					new PutObjectCommand({
						Bucket: r2Bucket,
						Key: filePath,
						Body: buffer,
						ContentType: contentType
					})
				);

				const sizeKb = (buffer.length / 1024).toFixed(1);
				console.log(`✅ ${prefix} (${sizeKb} KB)\n     ${dbInfo} ➔ Upload R2 thành công`);
				successCount++;
			} catch (uploadErr) {
				console.error(`❌ ${prefix}\n     ${dbInfo} ➔ Lỗi upload R2:`, uploadErr);
				errorCount++;
				continue;
			}
		}

		// Cập nhật bản ghi DB tương ứng nếu không phải Dry-run
		if (!isDryRun && dbRecord && pool) {
			try {
				let needUpdate = false;
				const updates: string[] = [];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const values: any[] = [];
				let paramIdx = 1;

				if (dbRecord.audio_storage_path !== filePath) {
					updates.push(`audio_storage_path = $${paramIdx++}`);
					values.push(filePath);
					needUpdate = true;
				}

				if (r2PublicDomain) {
					const newUrl = `${r2PublicDomain}/${filePath}`;
					if (dbRecord.audio_url !== newUrl) {
						updates.push(`audio_url = $${paramIdx++}`);
						values.push(newUrl);
						needUpdate = true;
					}
				}

				if (needUpdate) {
					values.push(dbRecord.id);
					await pool.query(
						`UPDATE ielts_speaking_responses SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
						values
					);
					updatedDbCount++;
				}
			} catch (dbUpdateErr) {
				console.error(`     ⚠️ Lỗi cập nhật DB record ${dbRecord.id}:`, dbUpdateErr);
			}
		}
	}

	// 7. Cập nhật attempt score_result nếu có R2 public domain
	if (!isDryRun && r2PublicDomain && pool) {
		console.log('\n🔄 Đang cập nhật URLs trong JSON score_result của ielts_speaking_attempts...');
		try {
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
					await pool.query(
						`UPDATE ielts_speaking_attempts SET score_result = $1 WHERE id = $2`,
						[JSON.stringify(updatedScoreResult), att.id]
					);
					updatedAttempts++;
				}
			}
			if (updatedAttempts > 0) {
				console.log(`   ➔ Đã cập nhật R2 URLs trong score_result cho ${updatedAttempts} attempts.`);
			}
		} catch (err) {
			console.error('   ❌ Lỗi cập nhật attempts:', err);
		}
	}

	if (pool) await pool.end();

	console.log('\n===========================================================');
	console.log(`🎉 KẾT QUẢ MIGRATION:`);
	console.log(`   - Tổng số file xử lý       : ${total}`);
	console.log(`   - Khớp bản ghi Database    : ${matchedDbCount}`);
	console.log(`   - Chuyển thành công R2     : ${successCount}`);
	console.log(`   - Đã có sẵn trên R2 (Skip) : ${skipCount}`);
	console.log(`   - Lỗi                      : ${errorCount}`);
	if (!isDryRun && updatedDbCount > 0) {
		console.log(`   - Đã cập nhật DB records   : ${updatedDbCount}`);
	}
	console.log('===========================================================\n');
}

main().catch((err) => {
	console.error('Fatal Migration Error:', err);
	process.exit(1);
});
