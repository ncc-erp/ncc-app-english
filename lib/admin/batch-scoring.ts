import { pgDb } from '@/lib/db/postgres';
import { evaluateIELTSAttemptWithAI } from '@/lib/ielts/ai-evaluator';
import { IELTSScoreResult } from '@/types/ielts';

export type BatchJobStatus = 'idle' | 'running' | 'done' | 'error';

export interface BatchAttemptResult {
	attempt_id: string;
	user_id: string;
	topic_id: string;
	status: 'success' | 'failed' | 'skipped';
	overall_band?: number | null;
	error?: string;
	duration_ms?: number;
}

export interface BatchJobState {
	status: BatchJobStatus;
	total: number;
	done: number; // processed (success + failed + skipped)
	succeeded: number;
	failed: number;
	current_attempt_id: string | null;
	results: BatchAttemptResult[];
	started_at: string | null;
	finished_at: string | null;
	error?: string;
}

// State lives on globalThis (same pattern as lib/bot/bot-service.ts) rather than plain
// module scope, so it survives HMR in dev and cannot be duplicated into two copies if the
// bundler ever inlines this module into more than one route bundle. On the VPS it is a
// single long-lived `node server.js` process, so the state persists across requests; it is
// lost on container restart, which is fine — the job is idempotent because a scored attempt
// gains a score_result and drops out of the `score_result IS NULL` filter on the next run.
declare global {
	// eslint-disable-next-line no-var
	var __batchScoringState: BatchJobState | undefined;
	// eslint-disable-next-line no-var
	var __batchScoringRunning: boolean | undefined;
}

function emptyState(): BatchJobState {
	return {
		status: 'idle',
		total: 0,
		done: 0,
		succeeded: 0,
		failed: 0,
		current_attempt_id: null,
		results: [],
		started_at: null,
		finished_at: null
	};
}

function getState(): BatchJobState {
	if (!globalThis.__batchScoringState) {
		globalThis.__batchScoringState = emptyState();
	}
	return globalThis.__batchScoringState;
}

export function getJobState(): BatchJobState {
	const s = getState();
	return { ...s, results: [...s.results] };
}

export function startBatchJob(): { started: boolean; state: BatchJobState } {
	const s = getState();
	if (s.status === 'running' || globalThis.__batchScoringRunning) {
		return { started: false, state: getJobState() };
	}

	globalThis.__batchScoringState = {
		status: 'running',
		total: 0,
		done: 0,
		succeeded: 0,
		failed: 0,
		current_attempt_id: null,
		results: [],
		started_at: new Date().toISOString(),
		finished_at: null
	};
	globalThis.__batchScoringRunning = true;

	// Fire-and-forget: the POST handler returns immediately, the client polls GET for progress.
	void runBatchLoop().finally(() => {
		globalThis.__batchScoringRunning = false;
	});

	return { started: true, state: getJobState() };
}

async function runBatchLoop(): Promise<void> {
	const s = getState();
	try {
		const rows = await pgDb.getUnscoredIELTSAttempts();
		s.total = rows.length;
		console.log(`[batch-scoring] Starting: ${rows.length} unscored attempt(s)`);

		if (rows.length === 0) {
			s.status = 'done';
			s.finished_at = new Date().toISOString();
			return;
		}

		// Sequential on purpose: each attempt downloads audio from R2 and calls the AI
		// endpoint, which is expensive and rate-limited. Parallel scoring would risk OOM / 429.
		for (const row of rows) {
			s.current_attempt_id = row.id;
			const t0 = Date.now();
			try {
				// Hydrate the full attempt right before scoring so we work with fresh audio URLs.
				const attempt = await pgDb.getIELTSAttempt(row.id);
				if (!attempt) {
					s.results.push({ attempt_id: row.id, user_id: row.user_id, topic_id: row.topic_id, status: 'skipped', error: 'Attempt not found' });
					s.failed++;
					s.done++;
					continue;
				}

				// Race guard: scored by another path (e.g. the student opened the result page) meanwhile.
				if (attempt.score_result) {
					s.results.push({ attempt_id: row.id, user_id: row.user_id, topic_id: row.topic_id, status: 'skipped', error: 'Already scored' });
					s.done++;
					continue;
				}

				const topic = await pgDb.getIELTSTopic(attempt.topic_id);
				if (!topic) {
					s.results.push({ attempt_id: row.id, user_id: row.user_id, topic_id: row.topic_id, status: 'failed', error: 'Topic not found' });
					s.failed++;
					s.done++;
					continue;
				}

				let res: IELTSScoreResult | null = null;
				try {
					// evaluateIELTSAttemptWithAI already retries internally (3 attempts x 300s) and
					// returns null on any failure rather than throwing, so no extra retry here.
					res = await evaluateIELTSAttemptWithAI(attempt, topic);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					console.error(`[batch-scoring] [${row.id}] evaluateIELTSAttemptWithAI threw:`, msg);
					s.results.push({
						attempt_id: row.id,
						user_id: row.user_id,
						topic_id: row.topic_id,
						status: 'failed',
						error: msg,
						duration_ms: Date.now() - t0
					});
					s.failed++;
					s.done++;
					continue;
				}

				if (!res) {
					console.error(`[batch-scoring] [${row.id}] AI returned null`);
					s.results.push({
						attempt_id: row.id,
						user_id: row.user_id,
						topic_id: row.topic_id,
						status: 'failed',
						error: 'AI returned null',
						duration_ms: Date.now() - t0
					});
					s.failed++;
					s.done++;
					continue;
				}

				await pgDb.updateIELTSAttemptStatus(row.id, 'submitted', attempt.current_part || 'part3', res.overall_band, res);
				console.log(`[batch-scoring] [${row.id}] scored band=${res.overall_band} in ${Date.now() - t0}ms`);
				s.results.push({
					attempt_id: row.id,
					user_id: row.user_id,
					topic_id: row.topic_id,
					status: 'success',
					overall_band: res.overall_band,
					duration_ms: Date.now() - t0
				});
				s.succeeded++;
				s.done++;
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				console.error(`[batch-scoring] [${row.id}] unexpected error:`, msg);
				s.results.push({
					attempt_id: row.id,
					user_id: row.user_id,
					topic_id: row.topic_id,
					status: 'failed',
					error: msg,
					duration_ms: Date.now() - t0
				});
				s.failed++;
				s.done++;
			}
		}

		s.status = 'done';
		s.finished_at = new Date().toISOString();
		s.current_attempt_id = null;
		console.log(`[batch-scoring] Done: ${s.succeeded} succeeded, ${s.failed} failed, ${s.total} total`);
	} catch (e) {
		s.status = 'error';
		s.error = e instanceof Error ? e.message : String(e);
		s.finished_at = new Date().toISOString();
		s.current_attempt_id = null;
		console.error('[batch-scoring] Fatal job error:', s.error);
	}
}
