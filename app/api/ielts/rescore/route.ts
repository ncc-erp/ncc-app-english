import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { pgDb } from '@/lib/db/postgres';
import { evaluateIELTSAttemptWithAI } from '@/lib/ielts/ai-evaluator';
import { IELTSScoreResult } from '@/types/ielts';

export const maxDuration = 90; // Extend timeout for multimodal AI scoring

// In-flight deduplication map to prevent multiple concurrent evaluations for the same attempt
const inFlightRescores = new Map<string, Promise<IELTSScoreResult | null>>();

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { attemptId } = await req.json();

    if (!attemptId) {
      return NextResponse.json({ success: false, error: 'Missing attemptId' }, { status: 400 });
    }

    const attempt = await pgDb.getIELTSAttempt(attemptId);
    if (!attempt) {
      return NextResponse.json({ success: false, error: 'IELTS attempt not found' }, { status: 404 });
    }

    const topic = await pgDb.getIELTSTopic(attempt.topic_id);
    if (!topic) {
      return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
    }

    let scoreResult: IELTSScoreResult | null = null;

    if (inFlightRescores.has(attemptId)) {
      console.log(`[Re-scoring Attempt]: ${attemptId} is already evaluating with AI. Sharing in-flight promise...`);
      scoreResult = await inFlightRescores.get(attemptId)!;
    } else {
      console.log(`[Re-scoring Attempt]: Starting AI evaluation for attempt ${attemptId}...`);
      const evaluationPromise = (async () => {
        try {
          const res = await evaluateIELTSAttemptWithAI(attempt, topic);
          if (res) {
            await pgDb.updateIELTSAttemptStatus(
              attemptId,
              'submitted',
              attempt.current_part || 'part3',
              res.overall_band,
              res
            );
          }
          return res;
        } finally {
          inFlightRescores.delete(attemptId);
        }
      })();

      inFlightRescores.set(attemptId, evaluationPromise);
      scoreResult = await evaluationPromise;
    }

    if (!scoreResult) {
      return NextResponse.json(
        { success: false, error: 'AI evaluation returned empty or failed. Please verify AI_API_KEY, AI_ENDPOINT (e.g. https://llm.mrdnd.dev), and model configuration.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: scoreResult,
    });
  } catch (error) {
    console.error('[POST /api/ielts/rescore] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-score attempt with AI' },
      { status: 500 }
    );
  }
}
