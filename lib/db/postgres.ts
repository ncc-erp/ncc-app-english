import path from 'path';
import { Pool } from 'pg';
import { loadEnvConfig } from '@next/env';

// Ensure .env.local and .env are loaded even when run outside Next.js process (e.g. bot server worker)
try {
	loadEnvConfig(path.resolve(__dirname, '../..'));
} catch {
	// ignore
}
try {
	loadEnvConfig(process.cwd());
} catch {
	// ignore
}

import { ExamAttempt, Question, UserSession } from '@/types';
import { SEED_QUESTIONS } from '@/lib/exam/questions';
import { SEED_IELTS_TOPICS } from '@/lib/ielts/questions';
import { IELTSSpeakingAttempt, IELTSSpeakingResponse, IELTSSpeakingTopic, IELTSSpeakingStatus, IELTSPart, IELTSScoreResult } from '@/types/ielts';
import { Meeting, MeetingParticipant, MeetingParticipantRole, MeetingRoomOption, MeetingRosterMember } from '@/types/meeting';

// Global PostgreSQL connection pool instance for Next.js hot-reload handling
const globalForPg = global as unknown as {
	pgPool: Pool;
	dbInitialized?: boolean;
};

export function getPool(): Pool {
	if (globalForPg.pgPool) return globalForPg.pgPool;

	const connectionString =
		process.env.DATABASE_URL ||
		process.env.POSTGRES_URL ||
		process.env.POSTGRES_PRISMA_URL ||
		process.env.POSTGRES_URL_NON_POOLING ||
		process.env.POSTGRES_URL_NO_SSL;

	const host = process.env.POSTGRES_HOST || process.env.DB_HOST || '127.0.0.1';
	const user = process.env.POSTGRES_USER || process.env.DB_USERNAME || 'postgres';
	const password =
		process.env.POSTGRES_PASSWORD !== undefined
			? process.env.POSTGRES_PASSWORD
			: process.env.DB_PASSWORD !== undefined
				? process.env.DB_PASSWORD
				: '123qwer';
	const database = process.env.POSTGRES_DATABASE || process.env.DB_NAME || 'ncc_app_english';
	const port = parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || (host !== '127.0.0.1' && host !== 'localhost' ? '5432' : '8104'), 10);

	let newPool: Pool;

	if (connectionString) {
		newPool = new Pool({
			connectionString,
			ssl: process.env.POSTGRES_NO_SSL ? false : { rejectUnauthorized: false },
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 10000
		});
	} else if (host !== '127.0.0.1' && host !== 'localhost') {
		newPool = new Pool({
			host,
			port,
			user,
			password,
			database,
			ssl: { rejectUnauthorized: false },
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 10000
		});
	} else {
		newPool = new Pool({
			host,
			port,
			user,
			password,
			database,
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000
		});
	}

	globalForPg.pgPool = newPool;
	return newPool;
}

export const pool = new Proxy({} as Pool, {
	get(_target, prop) {
		const activePool = getPool();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const value = (activePool as any)[prop];
		if (typeof value === 'function') {
			return value.bind(activePool);
		}
		return value;
	}
});

let isInitializing = false;

// Auto initialize schema & seed questions & IELTS topics (seeded 8 topics)
export async function ensureDbInitialized() {
	if (globalForPg.dbInitialized || isInitializing) return;
	isInitializing = true;

	try {
		const client = await pool.connect();
		try {
			// 1. Create tables if not exist
			await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        DO $$ BEGIN
            CREATE TYPE section_enum AS ENUM ('grammar', 'vocabulary', 'reading');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE difficulty_enum AS ENUM ('easy', 'medium', 'hard');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE attempt_status_enum AS ENUM ('in_progress', 'submitted', 'abandoned');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            CREATE TYPE result_status_enum AS ENUM ('none', 'partial', 'full');
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        -- Shared with ncc-bot-interview-english (TypeORM owns this shape). Our extra fields
        -- (display_name, clan_member, clan_joined_at) live in metadata so synchronize can't drop them.
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            "mezonUserId" VARCHAR UNIQUE NOT NULL,
            username VARCHAR NOT NULL,
            email VARCHAR,
            "avatarUrl" VARCHAR,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            section section_enum NOT NULL,
            difficulty difficulty_enum NOT NULL,
            question_text TEXT NOT NULL,
            reading_passage TEXT,
            options JSONB NOT NULL,
            correct_option_id TEXT NOT NULL,
            explanation TEXT,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            status attempt_status_enum DEFAULT 'in_progress',
            result_status result_status_enum DEFAULT 'none',
            started_at TIMESTAMPTZ DEFAULT NOW(),
            submitted_at TIMESTAMPTZ,
            time_limit_seconds INT DEFAULT 900,
            raw_score INT,
            weighted_score INT,
            max_weighted_score INT DEFAULT 57,
            cefr_level TEXT,
            skill_scores JSONB,
            unlocked BOOLEAN DEFAULT FALSE,
            unlocked_at TIMESTAMPTZ,
            question_ids TEXT[] NOT NULL
        );

        CREATE TABLE IF NOT EXISTS answers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            attempt_id TEXT REFERENCES attempts(id) ON DELETE CASCADE,
            question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
            selected_option_id TEXT,
            is_correct BOOLEAN,
            answered_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_attempt_question UNIQUE(attempt_id, question_id)
        );

        CREATE TABLE IF NOT EXISTS clan_membership_cache (
            mezon_id TEXT PRIMARY KEY,
            clan_id TEXT NOT NULL,
            is_member BOOLEAN NOT NULL,
            checked_at TIMESTAMPTZ DEFAULT NOW(),
            source TEXT DEFAULT 'verify_api'
        );

        CREATE TABLE IF NOT EXISTS ielts_speaking_topics (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            part1_questions JSONB NOT NULL,
            part2_cue_card JSONB NOT NULL,
            part3_questions JSONB NOT NULL,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE ielts_speaking_topics ADD COLUMN IF NOT EXISTS description TEXT;

        CREATE TABLE IF NOT EXISTS ielts_speaking_attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            topic_id TEXT REFERENCES ielts_speaking_topics(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'in_progress',
            current_part TEXT DEFAULT 'part1',
            started_at TIMESTAMPTZ DEFAULT NOW(),
            submitted_at TIMESTAMPTZ,
            part2_notes TEXT,
            overall_band NUMERIC(3, 1),
            score_result JSONB,
            unlocked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE ielts_speaking_attempts ADD COLUMN IF NOT EXISTS unlocked BOOLEAN DEFAULT FALSE;

        CREATE TABLE IF NOT EXISTS ielts_speaking_responses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            attempt_id TEXT REFERENCES ielts_speaking_attempts(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL,
            part TEXT NOT NULL,
            audio_url TEXT,
            audio_storage_path TEXT,
            transcript TEXT,
            duration_seconds INT DEFAULT 0,
            answered_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_ielts_attempt_question UNIQUE(attempt_id, question_id)
        );

        ALTER TABLE ielts_speaking_responses ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;

        -- One row per redeemed bot launch token, so a link can only be used once
        CREATE TABLE IF NOT EXISTS launch_tokens (
            jti TEXT PRIMARY KEY,
            used_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            scheduled_at TIMESTAMPTZ NOT NULL,
            room_id TEXT,
            room_name TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            noshow_notified_at TIMESTAMPTZ
        );

        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS noshow_notified_at TIMESTAMPTZ;

        CREATE TABLE IF NOT EXISTS meeting_participants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            meeting_id TEXT REFERENCES meetings(id) ON DELETE CASCADE,
            mezon_id TEXT NOT NULL,
            username TEXT,
            display_name TEXT,
            avatar_url TEXT,
            role TEXT,
            joined_at TIMESTAMPTZ,
            reminded_10min_at TIMESTAMPTZ,
            reminded_start_at TIMESTAMPTZ,
            CONSTRAINT unique_meeting_participant UNIQUE(meeting_id, mezon_id)
        );

        -- Synced from the Mezon clan bot (rooms + student/teacher roster). Populated by the
        -- bot sync job; the admin UI only ever reads these two for its assign dropdowns.
        CREATE TABLE IF NOT EXISTS meeting_rooms_cache (
            room_id TEXT PRIMARY KEY,
            room_name TEXT NOT NULL,
            clan_id TEXT NOT NULL,
            synced_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS meeting_roster_cache (
            mezon_id TEXT PRIMARY KEY,
            username TEXT,
            display_name TEXT NOT NULL,
            avatar_url TEXT,
            role TEXT NOT NULL,
            clan_id TEXT NOT NULL,
            synced_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

			// 2. Check if questions table is populated
			const { rows: qRows } = await client.query('SELECT COUNT(*) as count FROM questions');
			if (parseInt(qRows[0].count, 10) === 0) {
				for (const q of SEED_QUESTIONS) {
					await client.query(
						`INSERT INTO questions (id, section, difficulty, question_text, reading_passage, options, correct_option_id, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
						[
							q.id,
							q.section,
							q.difficulty,
							q.question_text,
							q.reading_passage || null,
							JSON.stringify(q.options),
							q.correct_option_id || '',
							q.explanation || null
						]
					);
				}
				console.log(`[PostgreSQL] Seeded ${SEED_QUESTIONS.length} exam questions into DB.`);
			}

			// 3. Seed/Upsert IELTS topics
			for (const t of SEED_IELTS_TOPICS) {
				await client.query(
					`INSERT INTO ielts_speaking_topics (id, title, category, description, part1_questions, part2_cue_card, part3_questions)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             part1_questions = EXCLUDED.part1_questions,
             part2_cue_card = EXCLUDED.part2_cue_card,
             part3_questions = EXCLUDED.part3_questions;`,
					[
						t.id,
						t.title,
						t.category,
						t.description || null,
						JSON.stringify(t.part1_questions),
						JSON.stringify(t.part2_cue_card),
						JSON.stringify(t.part3_questions)
					]
				);
			}
			console.log(`[PostgreSQL] Seeded/Upserted ${SEED_IELTS_TOPICS.length} IELTS Speaking topics into DB.`);

			globalForPg.dbInitialized = true;
			console.log('[PostgreSQL] Database tables & schema initialized successfully.');
		} finally {
			client.release();
		}
	} catch (err) {
		console.error('[PostgreSQL Initialization Error]:', err);
		// Invalidate cached pool so credentials can be re-evaluated
		globalForPg.pgPool = undefined as any;
	} finally {
		isInitializing = false;
	}
}

// Projects the shared users table onto the field names the app uses (see DDL note).
const USER_COLS = `
  id::text AS id,
  "mezonUserId" AS mezon_id,
  username AS mezon_username,
  COALESCE(metadata->>'display_name', username) AS display_name,
  "avatarUrl" AS avatar_url,
  COALESCE((metadata->>'clan_member')::boolean, false) AS clan_member,
  COALESCE(metadata->>'role', 'user') AS role`;

// Reshapes a `meeting_participants JOIN meetings` row (columns aliased m_*) from the reminder
// queries back into { meeting, participant }, without the meeting's full participant list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMeetingParticipantPair(row: any): { meeting: Meeting; participant: MeetingParticipant } {
	return {
		meeting: {
			id: row.m_id,
			title: row.m_title,
			scheduled_at: new Date(row.m_scheduled_at).toISOString(),
			room_id: row.m_room_id || undefined,
			room_name: row.m_room_name || undefined,
			created_by: row.m_created_by,
			created_at: new Date(row.m_created_at).toISOString(),
			participant_count: 0,
			participants: []
		},
		participant: {
			mezon_id: row.mezon_id,
			username: row.username || undefined,
			display_name: row.display_name || row.username || row.mezon_id,
			avatar_url: row.avatar_url || undefined,
			role: row.role || undefined,
			joined_at: row.joined_at ? new Date(row.joined_at).toISOString() : undefined
		}
	};
}

export const pgDb = {
	async findOrCreateUser(mezonData: { mezon_id: string; username: string; display_name?: string; avatar_url?: string }): Promise<UserSession> {
		await ensureDbInitialized();
		const query = `
      INSERT INTO users ("mezonUserId", username, "avatarUrl", metadata)
      VALUES ($1, $2, $4, jsonb_build_object('display_name', $3::text))
      ON CONFLICT ("mezonUserId") DO UPDATE SET
        metadata = users.metadata || jsonb_build_object('display_name', EXCLUDED.metadata->>'display_name'),
        "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", users."avatarUrl"),
        "updatedAt" = NOW()
      RETURNING ${USER_COLS};
    `;
		const values = [mezonData.mezon_id, mezonData.username, mezonData.display_name || mezonData.username, mezonData.avatar_url || null];

		const { rows } = await pool.query(query, values);
		const u = rows[0];

		return {
			user_id: u.id,
			mezon_id: u.mezon_id,
			mezon_username: u.mezon_username,
			display_name: u.display_name,
			avatar_url: u.avatar_url,
			clan_member: u.clan_member,
			role: u.role === 'admin' ? 'admin' : 'user',
			isLoggedIn: true
		};
	},

	async createAttempt(userId: string, timeLimitSeconds: number = 900): Promise<ExamAttempt> {
		await ensureDbInitialized();

		const { rows: questionRows } = await pool.query('SELECT id FROM questions WHERE active = true ORDER BY RANDOM() LIMIT 20');
		let questionIds = questionRows.map((r) => r.id);

		if (questionIds.length === 0) {
			questionIds = SEED_QUESTIONS.map((q) => q.id);
		}

		const attemptId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

		const query = `
      INSERT INTO attempts (id, user_id, status, result_status, time_limit_seconds, max_weighted_score, unlocked, question_ids)
      VALUES ($1, $2, 'in_progress', 'none', $3, $4, false, $5)
      RETURNING *;
    `;
		const values = [attemptId, userId, timeLimitSeconds, questionIds.length, questionIds];

		const { rows } = await pool.query(query, values);
		const att = rows[0];

		return {
			id: att.id,
			user_id: att.user_id,
			status: att.status,
			result_status: att.result_status,
			started_at: att.started_at.toISOString(),
			time_limit_seconds: att.time_limit_seconds,
			max_weighted_score: att.max_weighted_score,
			unlocked: att.unlocked,
			question_ids: att.question_ids,
			answers: {}
		};
	},

	async getAttempt(attemptId: string): Promise<ExamAttempt | null> {
		await ensureDbInitialized();
		const query = `SELECT * FROM attempts WHERE id = $1`;
		const { rows } = await pool.query(query, [attemptId]);
		if (rows.length === 0) return null;

		const att = rows[0];

		const answersQuery = `SELECT question_id, selected_option_id FROM answers WHERE attempt_id = $1`;
		const { rows: ansRows } = await pool.query(answersQuery, [attemptId]);
		const answersRecord: Record<string, string> = {};
		ansRows.forEach((r) => {
			if (r.selected_option_id) {
				answersRecord[r.question_id] = r.selected_option_id;
			}
		});

		return {
			id: att.id,
			user_id: att.user_id,
			status: att.status,
			result_status: att.result_status,
			started_at: new Date(att.started_at).toISOString(),
			submitted_at: att.submitted_at ? new Date(att.submitted_at).toISOString() : undefined,
			time_limit_seconds: att.time_limit_seconds,
			raw_score: att.raw_score,
			weighted_score: att.weighted_score,
			max_weighted_score: att.max_weighted_score,
			cefr_level: att.cefr_level,
			unlocked: att.unlocked,
			question_ids: att.question_ids,
			answers: answersRecord
		};
	},

	async saveAnswer(attemptId: string, questionId: string, optionId: string): Promise<ExamAttempt | null> {
		await ensureDbInitialized();
		const upsertQuery = `
      INSERT INTO answers (attempt_id, question_id, selected_option_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET selected_option_id = EXCLUDED.selected_option_id, answered_at = NOW();
    `;
		await pool.query(upsertQuery, [attemptId, questionId, optionId]);

		return this.getAttempt(attemptId);
	},

	async updateAttempt(attemptId: string, updates: Partial<ExamAttempt>): Promise<ExamAttempt | null> {
		await ensureDbInitialized();

		const fields: string[] = [];
		const values: unknown[] = [attemptId];
		let paramIndex = 2;

		if (updates.status !== undefined) {
			fields.push(`status = $${paramIndex++}`);
			values.push(updates.status);
		}
		if (updates.result_status !== undefined) {
			fields.push(`result_status = $${paramIndex++}`);
			values.push(updates.result_status);
		}
		if (updates.submitted_at !== undefined) {
			fields.push(`submitted_at = $${paramIndex++}`);
			values.push(updates.submitted_at);
		}
		if (updates.raw_score !== undefined) {
			fields.push(`raw_score = $${paramIndex++}`);
			values.push(updates.raw_score);
		}
		if (updates.weighted_score !== undefined) {
			fields.push(`weighted_score = $${paramIndex++}`);
			values.push(updates.weighted_score);
		}
		if (updates.max_weighted_score !== undefined) {
			fields.push(`max_weighted_score = $${paramIndex++}`);
			values.push(updates.max_weighted_score);
		}
		if (updates.cefr_level !== undefined) {
			fields.push(`cefr_level = $${paramIndex++}`);
			values.push(updates.cefr_level);
		}
		if (updates.unlocked !== undefined) {
			fields.push(`unlocked = $${paramIndex++}`);
			values.push(updates.unlocked);
		}

		if (fields.length > 0) {
			const updateQuery = `UPDATE attempts SET ${fields.join(', ')} WHERE id = $1`;
			await pool.query(updateQuery, values);
		}

		return this.getAttempt(attemptId);
	},

	async getQuestionsByIds(ids: string[]): Promise<Question[]> {
		await ensureDbInitialized();
		if (!ids || ids.length === 0) return [];

		const query = `SELECT * FROM questions WHERE id = ANY($1)`;
		const { rows } = await pool.query(query, [ids]);

		return rows.map((r) => ({
			id: r.id,
			section: r.section,
			difficulty: r.difficulty,
			question_text: r.question_text,
			reading_passage: r.reading_passage || undefined,
			options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
			correct_option_id: r.correct_option_id,
			explanation: r.explanation || undefined
		}));
	},

	async updateUserClanMembership(mezonId: string, isMember: boolean): Promise<void> {
		await ensureDbInitialized();
		await pool.query(
			`UPDATE users
         SET metadata = metadata || jsonb_build_object('clan_member', $1::boolean, 'clan_joined_at', NOW()),
             "updatedAt" = NOW()
       WHERE "mezonUserId" = $2`,
			[isMember, mezonId]
		);
	},

	// ============================================================
	// IELTS SPEAKING DATABASE HELPERS
	// ============================================================
	async getIELTSTopics(): Promise<IELTSSpeakingTopic[]> {
		await ensureDbInitialized();
		try {
			await pool.query(`ALTER TABLE ielts_speaking_topics ADD COLUMN IF NOT EXISTS description TEXT;`);
		} catch {
			// Ignore if alter fails
		}
		let { rows } = await pool.query(`SELECT * FROM ielts_speaking_topics WHERE active = true ORDER BY created_at DESC`);

		if (rows.length < SEED_IELTS_TOPICS.length) {
			for (const t of SEED_IELTS_TOPICS) {
				await pool.query(
					`INSERT INTO ielts_speaking_topics (id, title, category, description, part1_questions, part2_cue_card, part3_questions)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             part1_questions = EXCLUDED.part1_questions,
             part2_cue_card = EXCLUDED.part2_cue_card,
             part3_questions = EXCLUDED.part3_questions;`,
					[
						t.id,
						t.title,
						t.category,
						t.description || null,
						JSON.stringify(t.part1_questions),
						JSON.stringify(t.part2_cue_card),
						JSON.stringify(t.part3_questions)
					]
				);
			}
			const reQuery = await pool.query(`SELECT * FROM ielts_speaking_topics WHERE active = true ORDER BY created_at DESC`);
			rows = reQuery.rows;
		}

		return rows.map((r) => ({
			id: r.id,
			title: r.title,
			category: r.category,
			description: r.description || undefined,
			part1_questions: typeof r.part1_questions === 'string' ? JSON.parse(r.part1_questions) : r.part1_questions,
			part2_cue_card: typeof r.part2_cue_card === 'string' ? JSON.parse(r.part2_cue_card) : r.part2_cue_card,
			part3_questions: typeof r.part3_questions === 'string' ? JSON.parse(r.part3_questions) : r.part3_questions
		}));
	},

	async getIELTSTopic(id: string): Promise<IELTSSpeakingTopic | null> {
		await ensureDbInitialized();
		const query = `SELECT * FROM ielts_speaking_topics WHERE id = $1`;
		const { rows } = await pool.query(query, [id]);
		if (rows.length === 0) {
			return SEED_IELTS_TOPICS.find((t) => t.id === id) || SEED_IELTS_TOPICS[0];
		}
		const r = rows[0];
		return {
			id: r.id,
			title: r.title,
			category: r.category,
			description: r.description || undefined,
			part1_questions: typeof r.part1_questions === 'string' ? JSON.parse(r.part1_questions) : r.part1_questions,
			part2_cue_card: typeof r.part2_cue_card === 'string' ? JSON.parse(r.part2_cue_card) : r.part2_cue_card,
			part3_questions: typeof r.part3_questions === 'string' ? JSON.parse(r.part3_questions) : r.part3_questions
		};
	},

	async createIELTSAttempt(userId: string, topicId: string): Promise<IELTSSpeakingAttempt> {
		await ensureDbInitialized();
		const topic = await this.getIELTSTopic(topicId);

		// Cancel any older 'in_progress' attempts for this user
		await pool.query(`UPDATE ielts_speaking_attempts SET status = 'cancelled' WHERE user_id = $1 AND status = 'in_progress'`, [userId]);

		const attemptId = `ielts-att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

		const query = `
      INSERT INTO ielts_speaking_attempts (id, user_id, topic_id, status, current_part)
      VALUES ($1, $2, $3, 'in_progress', 'part1')
      RETURNING *;
    `;
		const { rows } = await pool.query(query, [attemptId, userId, topicId]);
		const r = rows[0];

		return {
			id: r.id,
			user_id: r.user_id,
			topic_id: r.topic_id,
			topic_title: topic?.title || 'IELTS Speaking Topic',
			status: r.status as IELTSSpeakingStatus,
			current_part: r.current_part as IELTSPart,
			started_at: r.started_at.toISOString(),
			responses: {}
		};
	},

	async getIELTSAttempt(attemptId: string): Promise<IELTSSpeakingAttempt | null> {
		await ensureDbInitialized();
		const query = `SELECT * FROM ielts_speaking_attempts WHERE id = $1`;
		const { rows } = await pool.query(query, [attemptId]);
		if (rows.length === 0) return null;
		const r = rows[0];

		const topic = await this.getIELTSTopic(r.topic_id);

		// Get responses
		const resQuery = `SELECT * FROM ielts_speaking_responses WHERE attempt_id = $1`;
		const { rows: resRows } = await pool.query(resQuery, [attemptId]);
		const responsesRecord: Record<string, IELTSSpeakingResponse> = {};

		resRows.forEach((ans) => {
			responsesRecord[ans.question_id] = {
				question_id: ans.question_id,
				part: ans.part as IELTSPart,
				audio_url: ans.audio_url || undefined,
				audio_storage_path: ans.audio_storage_path || undefined,
				transcript: ans.transcript || undefined,
				duration_seconds: ans.duration_seconds || 0,
				answered_at: ans.answered_at ? new Date(ans.answered_at).toISOString() : undefined
			};
		});

		return {
			id: r.id,
			user_id: r.user_id,
			topic_id: r.topic_id,
			topic_title: topic?.title || 'IELTS Speaking Topic',
			status: r.status as IELTSSpeakingStatus,
			current_part: r.current_part as IELTSPart,
			started_at: new Date(r.started_at).toISOString(),
			submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined,
			part2_notes: r.part2_notes || undefined,
			band_score: r.overall_band ? parseFloat(r.overall_band) : undefined,
			unlocked: r.unlocked === true,
			score_result: r.score_result ? (typeof r.score_result === 'string' ? JSON.parse(r.score_result) : r.score_result) : undefined,
			responses: responsesRecord
		};
	},

	async saveIELTSResponse(
		attemptId: string,
		questionId: string,
		part: IELTSPart,
		audioUrl?: string,
		transcript?: string,
		durationSeconds: number = 0,
		audioStoragePath?: string
	): Promise<IELTSSpeakingAttempt | null> {
		await ensureDbInitialized();
		const query = `
      INSERT INTO ielts_speaking_responses (attempt_id, question_id, part, audio_url, audio_storage_path, transcript, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET audio_url = EXCLUDED.audio_url, audio_storage_path = EXCLUDED.audio_storage_path, transcript = EXCLUDED.transcript, duration_seconds = EXCLUDED.duration_seconds, answered_at = NOW();
    `;
		await pool.query(query, [attemptId, questionId, part, audioUrl || null, audioStoragePath || null, transcript || null, durationSeconds]);
		return this.getIELTSAttempt(attemptId);
	},

	async saveIELTSPart2Notes(attemptId: string, notes: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE ielts_speaking_attempts SET part2_notes = $1 WHERE id = $2`, [notes, attemptId]);
	},

	async updateIELTSAttemptUnlocked(attemptId: string, unlocked: boolean = true): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE ielts_speaking_attempts SET unlocked = $1 WHERE id = $2`, [unlocked, attemptId]);
	},

	async updateIELTSAttemptStatus(
		attemptId: string,
		status: IELTSSpeakingStatus,
		currentPart: IELTSPart,
		overallBand?: number,
		scoreResult?: IELTSScoreResult
	): Promise<IELTSSpeakingAttempt | null> {
		await ensureDbInitialized();
		const query = `
      UPDATE ielts_speaking_attempts
      SET status = $1, current_part = $2, overall_band = $3, score_result = $4, submitted_at = NOW()
      WHERE id = $5;
    `;
		await pool.query(query, [status, currentPart, overallBand || null, scoreResult ? JSON.stringify(scoreResult) : null, attemptId]);
		return this.getIELTSAttempt(attemptId);
	},

	async cancelIELTSAttempt(attemptId: string, userId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE ielts_speaking_attempts SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status != 'submitted'`, [
			attemptId,
			userId
		]);
	},

	async getUserIELTSAttempts(userId: string): Promise<IELTSSpeakingAttempt[]> {
		await ensureDbInitialized();
		const query = `
      SELECT a.*, t.title as topic_title
      FROM ielts_speaking_attempts a
      LEFT JOIN ielts_speaking_topics t ON a.topic_id = t.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC;
    `;
		const { rows } = await pool.query(query, [userId]);

		return rows.map((r) => ({
			id: r.id,
			user_id: r.user_id,
			topic_id: r.topic_id,
			topic_title: r.topic_title || 'IELTS Speaking Topic',
			status: r.status as IELTSSpeakingStatus,
			current_part: r.current_part as IELTSPart,
			started_at: new Date(r.started_at).toISOString(),
			submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined,
			part2_notes: r.part2_notes || undefined,
			band_score: r.overall_band ? parseFloat(r.overall_band) : undefined,
			responses: {}
		}));
	},

	async createIELTSTopic(topic: IELTSSpeakingTopic): Promise<IELTSSpeakingTopic> {
		await ensureDbInitialized();
		const id = topic.id || `topic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
		const query = `
      INSERT INTO ielts_speaking_topics (id, title, category, description, part1_questions, part2_cue_card, part3_questions, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *;
    `;
		const values = [
			id,
			topic.title,
			topic.category || 'General',
			topic.description || null,
			JSON.stringify(topic.part1_questions || []),
			JSON.stringify(topic.part2_cue_card || {}),
			JSON.stringify(topic.part3_questions || [])
		];

		const { rows } = await pool.query(query, values);
		const r = rows[0];
		return {
			id: r.id,
			title: r.title,
			category: r.category,
			description: r.description || undefined,
			part1_questions: typeof r.part1_questions === 'string' ? JSON.parse(r.part1_questions) : r.part1_questions,
			part2_cue_card: typeof r.part2_cue_card === 'string' ? JSON.parse(r.part2_cue_card) : r.part2_cue_card,
			part3_questions: typeof r.part3_questions === 'string' ? JSON.parse(r.part3_questions) : r.part3_questions
		};
	},

	async updateIELTSTopic(id: string, topic: Partial<IELTSSpeakingTopic>): Promise<IELTSSpeakingTopic | null> {
		await ensureDbInitialized();
		const fields: string[] = [];
		const values: unknown[] = [id];
		let paramIndex = 2;

		if (topic.title !== undefined) {
			fields.push(`title = $${paramIndex++}`);
			values.push(topic.title);
		}
		if (topic.category !== undefined) {
			fields.push(`category = $${paramIndex++}`);
			values.push(topic.category);
		}
		if (topic.description !== undefined) {
			fields.push(`description = $${paramIndex++}`);
			values.push(topic.description);
		}
		if (topic.part1_questions !== undefined) {
			fields.push(`part1_questions = $${paramIndex++}`);
			values.push(JSON.stringify(topic.part1_questions));
		}
		if (topic.part2_cue_card !== undefined) {
			fields.push(`part2_cue_card = $${paramIndex++}`);
			values.push(JSON.stringify(topic.part2_cue_card));
		}
		if (topic.part3_questions !== undefined) {
			fields.push(`part3_questions = $${paramIndex++}`);
			values.push(JSON.stringify(topic.part3_questions));
		}

		if (fields.length > 0) {
			const updateQuery = `UPDATE ielts_speaking_topics SET ${fields.join(', ')} WHERE id = $1`;
			await pool.query(updateQuery, values);
		}

		return this.getIELTSTopic(id);
	},

	async deleteIELTSTopic(id: string): Promise<boolean> {
		await ensureDbInitialized();
		const query = `DELETE FROM ielts_speaking_topics WHERE id = $1`;
		const result = await pool.query(query, [id]);
		return (result.rowCount ?? 0) > 0;
	},

	async getUserByMezonId(mezonId: string): Promise<UserSession | null> {
		await ensureDbInitialized();
		const query = `SELECT ${USER_COLS} FROM users WHERE "mezonUserId" = $1 OR id::text = $1`;
		const { rows } = await pool.query(query, [mezonId]);
		if (rows.length === 0) return null;
		const u = rows[0];
		return {
			user_id: u.id,
			mezon_id: u.mezon_id,
			mezon_username: u.mezon_username,
			display_name: u.display_name,
			avatar_url: u.avatar_url,
			clan_member: u.clan_member,
			role: u.role === 'admin' ? 'admin' : 'user',
			isLoggedIn: true
		};
	},

	async getUserById(userId: string): Promise<UserSession | null> {
		return this.getUserByMezonId(userId);
	},

	async setUserRole(mezonId: string, role: 'user' | 'admin'): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE users SET metadata = metadata || jsonb_build_object('role', $1::text), "updatedAt" = NOW() WHERE "mezonUserId" = $2`, [
			role,
			mezonId
		]);
	},

	/**
	 * Burns a bot launch token. Returns true only the first time a given jti is
	 * presented, so a launch link that leaks into a channel cannot be replayed.
	 */
	async consumeLaunchToken(jti: string): Promise<boolean> {
		await ensureDbInitialized();
		const { rowCount } = await pool.query(`INSERT INTO launch_tokens (jti) VALUES ($1) ON CONFLICT (jti) DO NOTHING`, [jti]);
		return rowCount === 1;
	},

	async getLatestSubmittedIELTSAttempt(userId: string): Promise<IELTSSpeakingAttempt | null> {
		await ensureDbInitialized();
		const query = `
      SELECT a.id
      FROM ielts_speaking_attempts a
      LEFT JOIN users u ON (u.id::text = a.user_id OR u."mezonUserId" = a.user_id)
      WHERE (a.user_id = $1 OR u.id::text = $1 OR u."mezonUserId" = $1)
        AND (a.status = 'submitted' OR a.overall_band IS NOT NULL OR a.score_result IS NOT NULL)
      ORDER BY COALESCE(a.submitted_at, a.started_at) DESC
      LIMIT 1;
    `;
		const { rows } = await pool.query(query, [userId]);
		if (rows.length === 0) return null;
		return this.getIELTSAttempt(rows[0].id);
	},

	async getRecentIELTSAttempts(userId: string, limit: number = 10): Promise<IELTSSpeakingAttempt[]> {
		await ensureDbInitialized();
		const query = `
      SELECT a.id
      FROM ielts_speaking_attempts a
      LEFT JOIN users u ON (u.id::text = a.user_id OR u."mezonUserId" = a.user_id)
      WHERE (a.user_id = $1 OR u.id::text = $1 OR u."mezonUserId" = $1)
        AND (a.status = 'submitted' OR a.overall_band IS NOT NULL OR a.score_result IS NOT NULL)
      ORDER BY COALESCE(a.submitted_at, a.started_at) DESC
      LIMIT $2;
    `;
		const { rows } = await pool.query(query, [userId, limit]);
		const results: IELTSSpeakingAttempt[] = [];
		for (const r of rows) {
			const att = await this.getIELTSAttempt(r.id);
			if (att) results.push(att);
		}
		return results;
	},

	async getIELTSAttemptByIdAndUser(attemptId: string, userId: string): Promise<IELTSSpeakingAttempt | null> {
		await ensureDbInitialized();
		const query = `
      SELECT a.id
      FROM ielts_speaking_attempts a
      LEFT JOIN users u ON (u.id::text = a.user_id OR u."mezonUserId" = a.user_id)
      WHERE a.id = $1
        AND (a.user_id = $2 OR u.id::text = $2 OR u."mezonUserId" = $2);
    `;
		const { rows } = await pool.query(query, [attemptId, userId]);
		if (rows.length === 0) return null;
		return this.getIELTSAttempt(attemptId);
	},

	/**
	 * Batch aggregates Speaking statistics directly from PostgreSQL
	 * for a given list of Mezon User IDs.
	 */
	async getStudentsSpeakingStatsBatch(mezonUserIds: string[]): Promise<
		Record<
			string,
			{
				total_attempts: number;
				average_band: number | null;
				highest_band: number | null;
				latest_attempt_at: string | null;
			}
		>
	> {
		await ensureDbInitialized();
		if (!mezonUserIds || mezonUserIds.length === 0) return {};

		const query = `
      SELECT
        COALESCE(u."mezonUserId", a.user_id) AS student_id,
        u."mezonUserId" AS user_mezon_id,
        a.user_id AS attempt_user_id,
        COUNT(a.id)::int AS total_attempts,
        ROUND(AVG(a.overall_band)::numeric, 1)::float AS average_band,
        MAX(a.overall_band)::float AS highest_band,
        MAX(COALESCE(a.submitted_at, a.started_at)) AS latest_attempt_at
      FROM ielts_speaking_attempts a
      LEFT JOIN users u ON (u.id::text = a.user_id OR u."mezonUserId" = a.user_id)
      WHERE (a.user_id = ANY($1) OR u."mezonUserId" = ANY($1))
        AND a.status = 'submitted'
      GROUP BY COALESCE(u."mezonUserId", a.user_id), u."mezonUserId", a.user_id;
    `;

		const { rows } = await pool.query(query, [mezonUserIds]);
		const result: Record<
			string,
			{
				total_attempts: number;
				average_band: number | null;
				highest_band: number | null;
				latest_attempt_at: string | null;
			}
		> = {};

		rows.forEach((r) => {
			const stat = {
				total_attempts: r.total_attempts || 0,
				average_band: r.average_band !== null ? Number(r.average_band) : null,
				highest_band: r.highest_band !== null ? Number(r.highest_band) : null,
				latest_attempt_at: r.latest_attempt_at ? new Date(r.latest_attempt_at).toISOString() : null
			};
			if (r.student_id) result[r.student_id] = stat;
			if (r.user_mezon_id) result[r.user_mezon_id] = stat;
			if (r.attempt_user_id) result[r.attempt_user_id] = stat;
		});

		return result;
	},

	/**
	 * System-wide speaking test metrics
	 */
	async getOverallSpeakingStats(): Promise<{
		total_attempts: number;
		average_band: number | null;
	}> {
		await ensureDbInitialized();
		const query = `
      SELECT
        COUNT(id)::int AS total_attempts,
        ROUND(AVG(overall_band)::numeric, 1)::float AS average_band
      FROM ielts_speaking_attempts
      WHERE status = 'submitted' AND (overall_band IS NOT NULL OR score_result IS NOT NULL);
    `;
		const { rows } = await pool.query(query);
		return {
			total_attempts: rows[0]?.total_attempts || 0,
			average_band: rows[0]?.average_band !== null ? Number(rows[0].average_band) : null
		};
	},

	/**
	 * Retrieves all detailed Speaking attempts for a specific student,
	 * including questions, transcripts, audio URLs, and AI evaluations.
	 */
	async getStudentSpeakingDetailedAttempts(studentId: string): Promise<IELTSSpeakingAttempt[]> {
		await ensureDbInitialized();
		const query = `
      SELECT a.id
      FROM ielts_speaking_attempts a
      LEFT JOIN users u ON (u.id::text = a.user_id OR u."mezonUserId" = a.user_id)
      WHERE (a.user_id = $1 OR u.id::text = $1 OR u."mezonUserId" = $1)
        AND a.status = 'submitted'
      ORDER BY COALESCE(a.submitted_at, a.started_at) DESC;
    `;
		const { rows } = await pool.query(query, [studentId]);
		const results: IELTSSpeakingAttempt[] = [];

		for (const r of rows) {
			const att = await this.getIELTSAttempt(r.id);
			if (att) results.push(att);
		}
		return results;
	},

	// ============================================================
	// MEETING MANAGEMENT
	// ============================================================
	async createMeeting(title: string, scheduledAt: string, createdBy: string): Promise<Meeting> {
		await ensureDbInitialized();
		const id = `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
		const query = `
      INSERT INTO meetings (id, title, scheduled_at, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
		const { rows } = await pool.query(query, [id, title, scheduledAt, createdBy]);
		const r = rows[0];
		return {
			id: r.id,
			title: r.title,
			scheduled_at: new Date(r.scheduled_at).toISOString(),
			room_id: r.room_id || undefined,
			room_name: r.room_name || undefined,
			created_by: r.created_by,
			created_at: new Date(r.created_at).toISOString(),
			participant_count: 0,
			participants: []
		};
	},

	// List view: each meeting carries only a 10-item participant preview plus the true count,
	// matching the ticket's "display 10, click through for the rest" requirement.
	async getMeetings(): Promise<Meeting[]> {
		await ensureDbInitialized();
		const { rows: meetingRows } = await pool.query(`SELECT * FROM meetings ORDER BY scheduled_at DESC LIMIT 50`);
		if (meetingRows.length === 0) return [];

		const meetingIds = meetingRows.map((r) => r.id);
		const { rows: participantRows } = await pool.query(`SELECT * FROM meeting_participants WHERE meeting_id = ANY($1) ORDER BY id ASC`, [meetingIds]);

		const participantsByMeeting = new Map<string, MeetingParticipant[]>();
		participantRows.forEach((p) => {
			const list = participantsByMeeting.get(p.meeting_id) || [];
			list.push({
				mezon_id: p.mezon_id,
				username: p.username || undefined,
				display_name: p.display_name || p.username || p.mezon_id,
				avatar_url: p.avatar_url || undefined,
				role: p.role || undefined,
				joined_at: p.joined_at ? new Date(p.joined_at).toISOString() : undefined
			});
			participantsByMeeting.set(p.meeting_id, list);
		});

		return meetingRows.map((r) => {
			const allParticipants = participantsByMeeting.get(r.id) || [];
			return {
				id: r.id,
				title: r.title,
				scheduled_at: new Date(r.scheduled_at).toISOString(),
				room_id: r.room_id || undefined,
				room_name: r.room_name || undefined,
				created_by: r.created_by,
				created_at: new Date(r.created_at).toISOString(),
				participant_count: allParticipants.length,
				participants: allParticipants.slice(0, 10)
			};
		});
	},

	async updateMeeting(id: string, title: string, scheduledAt: string): Promise<Meeting | null> {
		await ensureDbInitialized();
		await pool.query('UPDATE meetings SET title = $2, scheduled_at = $3 WHERE id = $1', [id, title, scheduledAt]);
		return this.getMeeting(id);
	},

	async deleteMeeting(id: string): Promise<boolean> {
		await ensureDbInitialized();
		const result = await pool.query('DELETE FROM meetings WHERE id = $1', [id]);
		return !!result.rowCount;
	},

	async getMeeting(id: string): Promise<Meeting | null> {
		await ensureDbInitialized();
		const { rows } = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [id]);
		if (rows.length === 0) return null;
		const r = rows[0];

		const { rows: participantRows } = await pool.query(`SELECT * FROM meeting_participants WHERE meeting_id = $1 ORDER BY id ASC`, [id]);
		const participants: MeetingParticipant[] = participantRows.map((p) => ({
			mezon_id: p.mezon_id,
			username: p.username || undefined,
			display_name: p.display_name || p.username || p.mezon_id,
			avatar_url: p.avatar_url || undefined,
			role: p.role || undefined,
			joined_at: p.joined_at ? new Date(p.joined_at).toISOString() : undefined
		}));

		return {
			id: r.id,
			title: r.title,
			scheduled_at: new Date(r.scheduled_at).toISOString(),
			room_id: r.room_id || undefined,
			room_name: r.room_name || undefined,
			created_by: r.created_by,
			created_at: new Date(r.created_at).toISOString(),
			participant_count: participants.length,
			participants
		};
	},

	// Upserts so re-assigning (e.g. changing someone's role) doesn't need a separate remove step.
	async saveMeetingAssignments(
		meetingId: string,
		participants: Omit<MeetingParticipant, 'joined_at'>[] | undefined,
		room: { id: string; name: string } | undefined,
		replace: boolean
	): Promise<Meeting | null> {
		await ensureDbInitialized();
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const locked = await client.query('SELECT id FROM meetings WHERE id = $1 FOR UPDATE', [meetingId]);
			if (!locked.rowCount) {
				await client.query('ROLLBACK');
				return null;
			}
			if (participants !== undefined) {
				if (replace)
					await client.query('DELETE FROM meeting_participants WHERE meeting_id = $1 AND NOT (mezon_id = ANY($2::text[]))', [
						meetingId,
						participants.map((p) => p.mezon_id)
					]);
				for (const p of participants) {
					await client.query(
						`INSERT INTO meeting_participants (meeting_id, mezon_id, username, display_name, avatar_url, role)
					VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (meeting_id, mezon_id) DO UPDATE SET
					username = EXCLUDED.username, display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, role = EXCLUDED.role`,
						[meetingId, p.mezon_id, p.username || null, p.display_name, p.avatar_url || null, p.role || null]
					);
				}
			}
			if (room !== undefined)
				await client.query('UPDATE meetings SET room_id = $2, room_name = $3 WHERE id = $1', [meetingId, room.id || null, room.name || null]);
			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
		return this.getMeeting(meetingId);
	},

	async assignMeetingParticipants(meetingId: string, participants: Omit<MeetingParticipant, 'joined_at'>[]): Promise<Meeting | null> {
		await ensureDbInitialized();
		for (const p of participants) {
			await pool.query(
				`INSERT INTO meeting_participants (meeting_id, mezon_id, username, display_name, avatar_url, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (meeting_id, mezon_id) DO UPDATE SET
           username = EXCLUDED.username,
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           role = EXCLUDED.role;`,
				[meetingId, p.mezon_id, p.username || null, p.display_name, p.avatar_url || null, p.role || null]
			);
		}
		return this.getMeeting(meetingId);
	},

	async assignMeetingRoom(meetingId: string, roomId: string, roomName: string): Promise<Meeting | null> {
		await ensureDbInitialized();
		await pool.query(`UPDATE meetings SET room_id = $1, room_name = $2 WHERE id = $3`, [roomId, roomName, meetingId]);
		return this.getMeeting(meetingId);
	},

	// Read side of the room/roster cache — the assign UI queries these regardless of whether
	// the bot sync job has run yet (empty tables just mean empty dropdowns).
	async getMeetingRoomsCache(): Promise<MeetingRoomOption[]> {
		await ensureDbInitialized();
		const { rows } = await pool.query(`SELECT * FROM meeting_rooms_cache ORDER BY room_name ASC`);
		return rows.map((r) => ({
			room_id: r.room_id,
			room_name: r.room_name,
			clan_id: r.clan_id,
			synced_at: new Date(r.synced_at).toISOString()
		}));
	},

	async getMeetingRosterCache(): Promise<MeetingRosterMember[]> {
		await ensureDbInitialized();
		const { rows } = await pool.query(`SELECT * FROM meeting_roster_cache ORDER BY display_name ASC`);
		return rows.map((r) => ({
			mezon_id: r.mezon_id,
			username: r.username || undefined,
			display_name: r.display_name,
			avatar_url: r.avatar_url || undefined,
			role: r.role,
			clan_id: r.clan_id,
			synced_at: new Date(r.synced_at).toISOString()
		}));
	},

	// Write side of the cache — this is what the Mezon bot sync job (Person B) calls after
	// pulling rooms/members from the "IELTS thầy Huy" clan.
	async upsertMeetingRoomsCache(rooms: { room_id: string; room_name: string; clan_id: string }[]): Promise<void> {
		await ensureDbInitialized();
		for (const room of rooms) {
			await pool.query(
				`INSERT INTO meeting_rooms_cache (room_id, room_name, clan_id, synced_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (room_id) DO UPDATE SET room_name = EXCLUDED.room_name, clan_id = EXCLUDED.clan_id, synced_at = NOW();`,
				[room.room_id, room.room_name, room.clan_id]
			);
		}
	},

	async upsertMeetingRosterCache(
		members: {
			mezon_id: string;
			username?: string;
			display_name: string;
			avatar_url?: string;
			role: MeetingParticipantRole;
			clan_id: string;
		}[]
	): Promise<void> {
		await ensureDbInitialized();
		for (const m of members) {
			await pool.query(
				`INSERT INTO meeting_roster_cache (mezon_id, username, display_name, avatar_url, role, clan_id, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (mezon_id) DO UPDATE SET
           username = EXCLUDED.username,
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           role = EXCLUDED.role,
           clan_id = EXCLUDED.clan_id,
           synced_at = NOW();`,
				[m.mezon_id, m.username || null, m.display_name, m.avatar_url || null, m.role, m.clan_id]
			);
		}
	},

	// A full Mezon scan is authoritative for one clan: replacing the cache removes people
	// whose Student/Teacher role was removed while the bot was offline.
	async replaceMeetingRosterCache(
		clanId: string,
		members: {
			mezon_id: string;
			username?: string;
			display_name: string;
			avatar_url?: string;
			role: MeetingParticipantRole;
			clan_id: string;
		}[]
	): Promise<void> {
		await ensureDbInitialized();
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query('DELETE FROM meeting_roster_cache WHERE clan_id = $1', [clanId]);
			for (const member of members) {
				await client.query(
					`INSERT INTO meeting_roster_cache (mezon_id, username, display_name, avatar_url, role, clan_id, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
					[member.mezon_id, member.username || null, member.display_name, member.avatar_url || null, member.role, member.clan_id]
				);
			}
			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	// Mirror of the two upserts above, for the onChannelDeleted / onRoleAssign(user_ids_removed) events.
	async deleteMeetingRoomCache(roomId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`DELETE FROM meeting_rooms_cache WHERE room_id = $1`, [roomId]);
	},

	async deleteMeetingRosterCache(mezonId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`DELETE FROM meeting_roster_cache WHERE mezon_id = $1`, [mezonId]);
	},

	// Called from the onVoiceJoinedEvent handler. Scoped to meetings using that room within a
	// +/-2h window of "now" so joining some unrelated, long-past/future meeting in the same
	// room doesn't get misattributed.
	async markMeetingParticipantJoinedByRoom(roomId: string, mezonId: string): Promise<boolean> {
		await ensureDbInitialized();
		const { rowCount } = await pool.query(
			`UPDATE meeting_participants mp
       SET joined_at = NOW()
       FROM meetings m
       WHERE mp.meeting_id = m.id
         AND m.room_id = $1
         AND mp.mezon_id = $2
         AND mp.joined_at IS NULL
         AND m.scheduled_at BETWEEN NOW() - INTERVAL '2 hours' AND NOW() + INTERVAL '2 hours';`,
			[roomId, mezonId]
		);
		return (rowCount ?? 0) > 0;
	},

	// Participants of meetings starting within MEETING_REMINDER_MINUTES_BEFORE (not yet sent the
	// T-10 reminder) or that have already started (not yet sent the "starting now" reminder).
	// Both thresholds are env-configurable so testing doesn't require sitting through real 10/5min waits.
	async getParticipantsNeeding10MinReminder(): Promise<{ meeting: Meeting; participant: MeetingParticipant }[]> {
		await ensureDbInitialized();
		const minutesBefore = parseInt(process.env.MEETING_REMINDER_MINUTES_BEFORE || '10', 10);
		const { rows } = await pool.query(
			`SELECT mp.*, m.id AS m_id, m.title AS m_title, m.scheduled_at AS m_scheduled_at, m.room_id AS m_room_id, m.room_name AS m_room_name, m.created_by AS m_created_by, m.created_at AS m_created_at
       FROM meeting_participants mp
       JOIN meetings m ON m.id = mp.meeting_id
       WHERE mp.reminded_10min_at IS NULL
         AND m.scheduled_at <= NOW() + make_interval(mins => $1::int)
         AND m.scheduled_at > NOW();`,
			[minutesBefore]
		);
		return rows.map(rowToMeetingParticipantPair);
	},

	// Grace window after start during which the "starting now" DM still fires - reuses the
	// no-show threshold as its upper bound so it always fires before the no-show check would run.
	async getParticipantsNeedingStartReminder(): Promise<{ meeting: Meeting; participant: MeetingParticipant }[]> {
		await ensureDbInitialized();
		const minutesAfter = parseInt(process.env.MEETING_NOSHOW_CHECK_MINUTES_AFTER || '5', 10);
		const { rows } = await pool.query(
			`SELECT mp.*, m.id AS m_id, m.title AS m_title, m.scheduled_at AS m_scheduled_at, m.room_id AS m_room_id, m.room_name AS m_room_name, m.created_by AS m_created_by, m.created_at AS m_created_at
       FROM meeting_participants mp
       JOIN meetings m ON m.id = mp.meeting_id
       WHERE mp.reminded_start_at IS NULL
         AND m.scheduled_at <= NOW()
         AND m.scheduled_at > NOW() - make_interval(mins => $1::int);`,
			[minutesAfter]
		);
		return rows.map(rowToMeetingParticipantPair);
	},

	async markParticipantReminded10Min(meetingId: string, mezonId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE meeting_participants SET reminded_10min_at = NOW() WHERE meeting_id = $1 AND mezon_id = $2`, [meetingId, mezonId]);
	},

	async markParticipantRemindedStart(meetingId: string, mezonId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE meeting_participants SET reminded_start_at = NOW() WHERE meeting_id = $1 AND mezon_id = $2`, [meetingId, mezonId]);
	},

	// Meetings that started MEETING_NOSHOW_CHECK_MINUTES_AFTER+ ago and haven't had their no-show
	// admin notification sent yet.
	async getMeetingsNeedingNoShowCheck(): Promise<Meeting[]> {
		await ensureDbInitialized();
		const minutesAfter = parseInt(process.env.MEETING_NOSHOW_CHECK_MINUTES_AFTER || '5', 10);
		const { rows } = await pool.query(
			`SELECT * FROM meetings
       WHERE noshow_notified_at IS NULL
         AND scheduled_at <= NOW() - make_interval(mins => $1::int)
         AND scheduled_at > NOW() - INTERVAL '1 hour';`,
			[minutesAfter]
		);
		const meetings: Meeting[] = [];
		for (const r of rows) {
			const meeting = await this.getMeeting(r.id);
			if (meeting) meetings.push(meeting);
		}
		return meetings;
	},

	async markMeetingNoShowNotified(meetingId: string): Promise<void> {
		await ensureDbInitialized();
		await pool.query(`UPDATE meetings SET noshow_notified_at = NOW() WHERE id = $1`, [meetingId]);
	}
};
