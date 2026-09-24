import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { evaluateIELTSAttemptWithAI } from '@/lib/ielts/ai-evaluator';
import { IELTSScoreResult } from '@/types/ielts';
import { toTeaserResult } from '@/lib/ielts/result-view';

export const maxDuration = 300; // 300 seconds (maximum allowed on Vercel)
export const dynamic = 'force-dynamic';

// In-flight deduplication map to prevent multiple concurrent evaluations for the same attempt
const inFlightRescores = new Map<string, Promise<IELTSScoreResult | null>>();

export async function POST(req: NextRequest) {
	const startTime = Date.now();
	console.log(`[POST /api/ielts/rescore] [Start] Incoming request at ${new Date().toISOString()}`);

	const session = await getSession();

	if (!session.user) {
		console.warn(`[POST /api/ielts/rescore] [401 Unauthorized] No active session found (${Date.now() - startTime}ms)`);
		return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const userId = session.user.user_id;
	const mezonId = session.user.mezon_id;
	console.log(`[POST /api/ielts/rescore] [Auth OK] User: user_id=${userId}, mezon_id=${mezonId}, clan_member=${session.user.clan_member}`);

	try {
		let body: { attemptId?: string };
		try {
			body = await req.json();
		} catch (parseError) {
			console.error(`[POST /api/ielts/rescore] [400 Bad Request] Failed to parse request JSON body:`, parseError);
			return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
		}

		const { attemptId } = body;

		if (!attemptId) {
			console.warn(`[POST /api/ielts/rescore] [400 Bad Request] Missing attemptId in request body`);
			return NextResponse.json({ success: false, error: 'Missing attemptId' }, { status: 400 });
		}

		console.log(`[POST /api/ielts/rescore] [${attemptId}] Querying attempt from DB...`);
		const attempt = await pgDb.getIELTSAttempt(attemptId);
		if (!attempt) {
			console.warn(`[POST /api/ielts/rescore] [${attemptId}] [404 Not Found] IELTS attempt not found in database`);
			return NextResponse.json({ success: false, error: 'IELTS attempt not found' }, { status: 404 });
		}

		console.log(
			`[POST /api/ielts/rescore] [${attemptId}] Attempt loaded: status=${attempt.status}, current_part=${attempt.current_part}, owner_user_id=${attempt.user_id}, responses_count=${Object.keys(attempt.responses || {}).length}`
		);

		if (attempt.user_id !== userId && attempt.user_id !== mezonId) {
			console.warn(
				`[POST /api/ielts/rescore] [${attemptId}] [404 Forbidden/Not Found] Ownership mismatch: attempt.user_id=${attempt.user_id} vs session.user_id=${userId}, session.mezon_id=${mezonId}`
			);
			return NextResponse.json({ success: false, error: 'IELTS attempt not found' }, { status: 404 });
		}

		console.log(`[POST /api/ielts/rescore] [${attemptId}] Querying topic ${attempt.topic_id} from DB...`);
		const topic = await pgDb.getIELTSTopic(attempt.topic_id);
		if (!topic) {
			console.warn(`[POST /api/ielts/rescore] [${attemptId}] [404 Not Found] Topic ${attempt.topic_id} not found in database`);
			return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
		}

		console.log(
			`[POST /api/ielts/rescore] [${attemptId}] Topic loaded: "${topic.title}" (P1: ${topic.part1_questions?.length ?? 0}, P2: ${!!topic.part2_cue_card}, P3: ${topic.part3_questions?.length ?? 0})`
		);

		let scoreResult: IELTSScoreResult | null = null;

		if (inFlightRescores.has(attemptId)) {
			console.log(`[POST /api/ielts/rescore] [${attemptId}] Evaluation already in-flight. Sharing promise...`);
			scoreResult = await inFlightRescores.get(attemptId)!;
		} else {
			console.log(
				`[POST /api/ielts/rescore] [${attemptId}] Starting AI evaluation. Config: AI_ENDPOINT=${process.env.AI_ENDPOINT || '(default: https://llm.mrdnd.dev/v1/chat/completions)'}, AI_MODEL=${process.env.AI_MODEL || '(default: gemini-3.7-flash-high)'}, hasApiKey=${Boolean(process.env.AI_API_KEY)}`
			);
			const evaluationPromise = (async () => {
				const evalStartTime = Date.now();
				try {
					console.log(`[POST /api/ielts/rescore] [${attemptId}] Invoking evaluateIELTSAttemptWithAI...`);
					const res = await evaluateIELTSAttemptWithAI(attempt, topic);
					const evalDuration = Date.now() - evalStartTime;

					if (res) {
						console.log(`[POST /api/ielts/rescore] [${attemptId}] AI evaluation succeeded in ${evalDuration}ms. overall_band=${res.overall_band}`);
						console.log(`[POST /api/ielts/rescore] [${attemptId}] Updating attempt status in DB to 'submitted'...`);
						await pgDb.updateIELTSAttemptStatus(attemptId, 'submitted', attempt.current_part || 'part3', res.overall_band, res);
						console.log(`[POST /api/ielts/rescore] [${attemptId}] DB updated successfully with score result.`);
					} else {
						console.error(`[POST /api/ielts/rescore] [${attemptId}] evaluateIELTSAttemptWithAI returned null after ${evalDuration}ms.`);
					}
					return res;
				} catch (evalErr) {
					const evalDuration = Date.now() - evalStartTime;
					console.error(`[POST /api/ielts/rescore] [${attemptId}] Exception inside evaluateIELTSAttemptWithAI after ${evalDuration}ms:`, evalErr);
					throw evalErr;
				} finally {
					inFlightRescores.delete(attemptId);
					console.log(`[POST /api/ielts/rescore] [${attemptId}] Removed from inFlightRescores map.`);
				}
			})();

			inFlightRescores.set(attemptId, evaluationPromise);
			scoreResult = await evaluationPromise;
		}

		if (!scoreResult) {
			const totalDuration = Date.now() - startTime;
			console.error(`[POST /api/ielts/rescore] [${attemptId}] [500 Error] Score result is null after ${totalDuration}ms`);
			return NextResponse.json(
				{
					success: false,
					error:
						'AI evaluation returned empty or failed. Please verify AI_API_KEY, AI_ENDPOINT (e.g. https://llm.mrdnd.dev), and model configuration.'
				},
				{ status: 500 }
			);
		}

		// Same gate as GET /api/ielts/[attemptId]: a fresh score does not bypass
		// clan verification.
		const isUnlocked = session.user.clan_member === true || attempt.unlocked === true;
		const totalDuration = Date.now() - startTime;
		console.log(
			`[POST /api/ielts/rescore] [${attemptId}] [200 Success] Completed in ${totalDuration}ms. isUnlocked=${isUnlocked}, overall_band=${scoreResult.overall_band}`
		);

		return NextResponse.json({
			success: true,
			result: isUnlocked ? { ...scoreResult, unlocked: true } : toTeaserResult(scoreResult)
		});
	} catch (error) {
		const totalDuration = Date.now() - startTime;
		console.error(`[POST /api/ielts/rescore] [500 Exception after ${totalDuration}ms]:`, {
			error,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		});
		return NextResponse.json({ success: false, error: 'Failed to re-score attempt with AI' }, { status: 500 });
	}
}
