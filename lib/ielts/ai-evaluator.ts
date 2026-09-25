import { generateText, Output, APICallError } from 'ai';
import type { IELTSSpeakingAttempt, IELTSSpeakingTopic, IELTSScoreResult } from '@/types/ielts';
import { OFFICIAL_IELTS_EXAMINER_PROMPT } from './prompts/examiner';
import { getIeltsModel } from './ai-model';
import { ieltsEvaluationZodSchema, type IELTSEvaluationAIOutput } from './schemas/evaluation-zod-schema';
import { fetchAllQuestionItems, type QuestionItem } from './audio-loader';
import { hasSpokenContent, filterOversizedAudio, buildBandZeroResult } from './evaluation-guards';
import { mapToScoreResult } from './evaluation-mapper';

const MAX_RETRIES = 2;
const TIMEOUT_MS = 300_000;
const MAX_OUTPUT_TOKENS = 8192;

type UserContentPart = { type: 'text'; text: string } | { type: 'file'; data: Uint8Array; mediaType: string };

function buildUserContent(topic: IELTSSpeakingTopic, attempt: IELTSSpeakingAttempt, items: QuestionItem[]): UserContentPart[] {
	const parts: UserContentPart[] = [
		{
			type: 'text',
			text: `Exam Topic: "${topic.title}" (Category: ${topic.category})\nPart 2 Preparation Notes: "${attempt.part2_notes || 'None'}"\n\nListen to each audio attached below and evaluate:`
		}
	];
	for (const item of items) {
		const sttNote = !item.liveTranscript?.trim() ? '\n🔇 Browser STT was empty.' : `\n📝 STT reference: "${item.liveTranscript.trim().slice(0, 80)}"`;
		parts.push({
			type: 'text',
			text: `\n---\n[Question ID: ${item.id} | ${item.part}]\nPrompt: "${item.questionText}"\nDuration: ${item.duration}s${sttNote}`
		});
		if (item.audioBase64 && item.audioMimeType) {
			parts.push({ type: 'file', data: Buffer.from(item.audioBase64, 'base64'), mediaType: item.audioMimeType.split(';')[0].trim() || 'audio/webm' });
		}
	}
	parts.push({
		type: 'text',
		text: '\nOutput ONLY valid JSON strictly conforming to the JSON Schema. Do NOT include markdown code ticks or commentary outside the JSON object.'
	});
	return parts;
}

function isRetryableStatus(err: unknown): boolean {
	if (APICallError.isInstance(err)) return err.statusCode === 499 || err.statusCode === 503 || err.isRetryable;
	const cause = (err as { cause?: unknown })?.cause;
	if (cause && APICallError.isInstance(cause))
		return (cause as InstanceType<typeof APICallError>).statusCode === 499 || (cause as InstanceType<typeof APICallError>).isRetryable;
	return false;
}

async function callAIWithRetry(
	model: NonNullable<ReturnType<typeof getIeltsModel>>['model'],
	userContent: UserContentPart[]
): Promise<IELTSEvaluationAIOutput | null> {
	for (let i = 0; i <= MAX_RETRIES; i++) {
		const ac = new AbortController();
		const tid = setTimeout(() => ac.abort(), TIMEOUT_MS);
		try {
			const { output } = await generateText({
				model: model as Parameters<typeof generateText>[0]['model'],
				output: Output.object({ schema: ieltsEvaluationZodSchema }),
				system: OFFICIAL_IELTS_EXAMINER_PROMPT,
				messages: [{ role: 'user', content: userContent }],
				maxOutputTokens: MAX_OUTPUT_TOKENS,
				abortSignal: ac.signal,
				maxRetries: 2
			});
			clearTimeout(tid);
			if (!output) throw new Error('AI returned no structured output');
			return output as IELTSEvaluationAIOutput;
		} catch (err) {
			clearTimeout(tid);
			const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
			const retryable = isTimeout || isRetryableStatus(err);
			if (retryable && i < MAX_RETRIES) {
				const delay = (i + 1) * 3000;
				const code = APICallError.isInstance(err) ? err.statusCode : (err as { statusCode?: number })?.statusCode;
				console.warn(
					`[AI Evaluator Warning] ${isTimeout ? 'Timeout' : `API ${code ?? 'unknown'}`} (attempt ${i + 1}/${MAX_RETRIES + 1}). Retrying in ${delay / 1000}s…`
				);
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}
			if (isTimeout) console.error('[AI Evaluator Error] Request timed out after retries:', err);
			else if (APICallError.isInstance(err) || (err as { name?: string })?.name === 'AI_NoObjectGeneratedError')
				console.warn('[AI Evaluator Warning] AI SDK error:', err);
			else console.error('[AI Evaluator Error]:', err);
			return null;
		}
	}
	return null;
}

export async function evaluateIELTSAttemptWithAI(attempt: IELTSSpeakingAttempt, topic: IELTSSpeakingTopic): Promise<IELTSScoreResult | null> {
	const resolved = getIeltsModel();
	if (!resolved) {
		console.warn('[AI Evaluator Warning] Missing AI_API_KEY.');
		return null;
	}
	const items = await fetchAllQuestionItems(attempt, topic);
	if (!hasSpokenContent(items)) {
		console.log('[AI Evaluator] No assessable speech detected. Return Band 0.');
		return buildBandZeroResult(attempt, topic, items);
	}
	const { filtered, audioCount } = filterOversizedAudio(items);
	if (audioCount === 0) {
		console.warn('[AI Evaluator] Cannot evaluate: no audio files downloaded.');
		return null;
	}
	console.log(
		`[AI Evaluator] Sending request via AI SDK: ${audioCount} clip(s), ~${(filtered.reduce((s, q) => s + (q.audioBase64?.length ?? 0), 0) / 1e6).toFixed(2)} MB, model=${resolved.modelId}, endpoint=${resolved.endpoint}`
	);
	const userContent = buildUserContent(topic, attempt, filtered);
	const parsed = await callAIWithRetry(resolved.model, userContent);
	if (!parsed) return null;
	return mapToScoreResult(parsed, attempt, topic, filtered);
}
