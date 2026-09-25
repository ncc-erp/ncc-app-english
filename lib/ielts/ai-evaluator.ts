import { generateText, Output, APICallError } from 'ai';
import { IELTSSpeakingAttempt, IELTSSpeakingTopic, IELTSScoreResult, IELTSPerQuestionAnalysis } from '@/types/ielts';
import { getIELTSStatusTitle } from './score-calculator';
import { downloadAudioAsBase64, extractAudioStoragePath } from '@/lib/storage';
import { OFFICIAL_IELTS_EXAMINER_PROMPT } from './prompts/examiner';
import { getIeltsModel } from './ai-model';
import { ieltsEvaluationZodSchema, type IELTSEvaluationAIOutput } from './schemas/evaluation-zod-schema';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_AUDIO_BASE64_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_RETRIES = 2;
const TIMEOUT_MS = 300_000; // 5 min per attempt
const MAX_OUTPUT_TOKENS = 8192;

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type QuestionItem = {
	id: string;
	part: string;
	questionText: string;
	liveTranscript: string;
	duration: number;
	audioBase64?: string;
	audioMimeType?: string;
};

type UserContentPart = { type: 'text'; text: string } | { type: 'file'; data: Uint8Array; mediaType: string };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function computeWordSimilarity(text1: string, text2: string): number {
	const words1 = text1.toLowerCase().split(/\s+/).filter(Boolean);
	const words2 = text2.toLowerCase().split(/\s+/).filter(Boolean);
	if (words1.length === 0 || words2.length === 0) return 0;
	const set1 = new Set(words1);
	const common = words2.filter((w) => set1.has(w)).length;
	return Math.round((common / Math.max(words1.length, words2.length)) * 100);
}

function clampBand(val: unknown): number {
	const num = Number(val);
	return !isNaN(num) && num >= 0 && num <= 9 ? num : 0;
}

function isRetryableStatus(err: unknown): boolean {
	if (APICallError.isInstance(err)) {
		if (err.statusCode === 499 || err.statusCode === 503) return true;
		return err.isRetryable;
	}
	// Network/fetch failures surface as RetryError wrapping APICallError — unwrap one level
	const cause = (err as { cause?: unknown })?.cause;
	if (cause && APICallError.isInstance(cause)) {
		if ((cause as InstanceType<typeof APICallError>).statusCode === 499) return true;
		return (cause as InstanceType<typeof APICallError>).isRetryable;
	}
	return false;
}

// ---------------------------------------------------------------------------
// Audio fetching
// ---------------------------------------------------------------------------

async function fetchAudioForResponse(attempt: IELTSSpeakingAttempt, qId: string): Promise<{ base64: string; mimeType: string } | null> {
	const resp = attempt.responses?.[qId];
	if (!resp) return null;

	let storagePath = resp.audio_storage_path;
	if (!storagePath && resp.audio_url) storagePath = extractAudioStoragePath(resp.audio_url);

	if (storagePath) {
		const downloaded = await downloadAudioAsBase64(storagePath);
		if (downloaded) return downloaded;
	}

	if (resp.audio_url) {
		try {
			const audioRes = await fetch(resp.audio_url);
			if (audioRes.ok) {
				const arr = await audioRes.arrayBuffer();
				const cType = audioRes.headers.get('content-type') || 'audio/webm';
				return { base64: Buffer.from(arr).toString('base64'), mimeType: cType.split(';')[0].trim() };
			}
		} catch (err) {
			console.warn(`[AI Evaluator] Failed to fetch audio for ${qId}:`, err);
		}
	}
	return null;
}

async function fetchAllQuestionItems(attempt: IELTSSpeakingAttempt, topic: IELTSSpeakingTopic): Promise<QuestionItem[]> {
	const allQuestions = [
		...topic.part1_questions.map((q) => ({ id: q.id, part: 'Part 1', questionText: q.question_text })),
		...(topic.part2_cue_card
			? [
					{
						id: topic.part2_cue_card.id,
						part: 'Part 2 Cue Card',
						questionText: `${topic.part2_cue_card.prompt_lead} Points: ${topic.part2_cue_card.bullet_points.join(', ')}`
					}
				]
			: []),
		...topic.part3_questions.map((q) => ({ id: q.id, part: 'Part 3', questionText: q.question_text }))
	];

	return Promise.all(
		allQuestions.map(async (q) => {
			const resp = attempt.responses?.[q.id];
			const audioData = await fetchAudioForResponse(attempt, q.id);
			return {
				id: q.id,
				part: q.part,
				questionText: q.questionText,
				liveTranscript: resp?.transcript || '',
				duration: resp?.duration_seconds || 0,
				audioBase64: audioData?.base64,
				audioMimeType: audioData?.mimeType
			};
		})
	);
}

// ---------------------------------------------------------------------------
// Validation & guards
// ---------------------------------------------------------------------------

function hasSpokenContent(items: QuestionItem[]): boolean {
	return items.some((item) => Boolean(item.audioBase64) || (Boolean(item.liveTranscript) && item.liveTranscript.trim().length > 2));
}

function filterOversizedAudio(items: QuestionItem[]): { filtered: QuestionItem[]; audioCount: number } {
	const filtered = items.map((item) => ({ ...item }));
	let audioCount = 0;
	for (const item of filtered) {
		if (!item.audioBase64) continue;
		if (item.audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
			console.warn(`[AI Evaluator] Skipping oversized audio for ${item.id}: ${(item.audioBase64.length / 1024 / 1024).toFixed(1)} MB > 3 MB limit`);
			item.audioBase64 = undefined;
			item.audioMimeType = undefined;
		} else {
			audioCount++;
		}
	}
	return { filtered, audioCount };
}

function buildBandZeroResult(attempt: IELTSSpeakingAttempt, topic: IELTSSpeakingTopic, items: QuestionItem[]): IELTSScoreResult {
	const perQuestionAnalysis: Record<string, IELTSPerQuestionAnalysis> = {};
	for (const qItem of items) {
		perQuestionAnalysis[qItem.id] = {
			question_id: qItem.id,
			live_stt_transcript: 'Không có bản ghi giọng nói',
			ai_generated_transcript: 'Không phát hiện câu trả lời bằng giọng nói trong file âm thanh',
			match_percentage: 100,
			feedback: 'Không có âm thanh hoặc câu trả lời nào được ghi lại cho câu hỏi này.'
		};
	}

	return {
		attempt_id: attempt.id,
		topic_title: topic.title,
		part1_questions: topic.part1_questions,
		part2_cue_card: topic.part2_cue_card,
		part3_questions: topic.part3_questions,
		responses: attempt.responses,
		part2_notes: attempt.part2_notes,
		overall_band: 0.0,
		status_title: getIELTSStatusTitle(0.0),
		summary_feedback: 'Không phát hiện câu trả lời bằng giọng nói. Vui lòng kiểm tra cài đặt microphone.',
		criteria_scores: [
			{ code: 'FC', name: 'Fluency & Coherence', score: 0.0, summary: 'Không có phần nói nào được thực hiện.', key_observations: [] },
			{ code: 'LR', name: 'Lexical Resource', score: 0.0, summary: 'Không có từ vựng nào được sử dụng.', key_observations: [] },
			{ code: 'GRA', name: 'Grammatical Range & Accuracy', score: 0.0, summary: 'Không có ngữ pháp nào được sử dụng.', key_observations: [] },
			{ code: 'PR', name: 'Pronunciation', score: 0.0, summary: 'Không có âm thanh nào được ghi nhận.', key_observations: [] }
		],
		filler_words: [],
		vocab_upgrades: [],
		strengths: [],
		areas_for_improvement: ['Hãy trả lời bằng giọng nói cho từng câu hỏi.'],
		criterion_feedback: {
			fluency: 'Không phát hiện phần nói.',
			vocabulary: 'Không phát hiện phần nói.',
			grammar: 'Không phát hiện phần nói.',
			pronunciation: 'Không phát hiện phần nói.'
		},
		estimated_band_reason: 'Band 0 được chấm khi không có ngôn ngữ nào để đánh giá.',
		per_question_analysis: perQuestionAnalysis
	};
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildUserContent(topic: IELTSSpeakingTopic, attempt: IELTSSpeakingAttempt, items: QuestionItem[]): UserContentPart[] {
	const parts: UserContentPart[] = [
		{
			type: 'text',
			text: `Exam Topic: "${topic.title}" (Category: ${topic.category})\nPart 2 Preparation Notes: "${attempt.part2_notes || 'None'}"\n\nListen to each audio attached below and evaluate:`
		}
	];

	for (const item of items) {
		const isSilent = !item.liveTranscript || item.liveTranscript.trim().length === 0;
		const sttNote = isSilent ? '\n🔇 Browser STT was empty.' : `\n📝 STT reference: "${item.liveTranscript.trim().slice(0, 80)}"`;
		parts.push({
			type: 'text',
			text: `\n---\n[Question ID: ${item.id} | ${item.part}]\nPrompt: "${item.questionText}"\nDuration: ${item.duration}s${sttNote}`
		});
		if (item.audioBase64 && item.audioMimeType) {
			const mime = item.audioMimeType.split(';')[0].trim() || 'audio/webm';
			parts.push({
				type: 'file',
				data: Buffer.from(item.audioBase64, 'base64'),
				mediaType: mime
			});
		}
	}

	parts.push({
		type: 'text',
		text: '\nOutput ONLY valid JSON strictly conforming to the JSON Schema. Do NOT include markdown code ticks or commentary outside the JSON object.'
	});

	return parts;
}

// ---------------------------------------------------------------------------
// AI calling
// ---------------------------------------------------------------------------

async function callAIWithRetry(
	model: ReturnType<typeof getIeltsModel> extends { model: infer M } | null ? M : never,
	userContent: UserContentPart[]
): Promise<IELTSEvaluationAIOutput | null> {
	for (let attemptIdx = 0; attemptIdx <= MAX_RETRIES; attemptIdx++) {
		const abortController = new AbortController();
		const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);
		try {
			const { output: parsed } = await generateText({
				model: model as Parameters<typeof generateText>[0]['model'],
				output: Output.object({ schema: ieltsEvaluationZodSchema }),
				system: OFFICIAL_IELTS_EXAMINER_PROMPT,
				messages: [{ role: 'user', content: userContent }],
				maxOutputTokens: MAX_OUTPUT_TOKENS,
				abortSignal: abortController.signal,
				maxRetries: 2
			});
			clearTimeout(timeoutId);
			if (!parsed) throw new Error('AI returned no structured output');
			return parsed as IELTSEvaluationAIOutput;
		} catch (err) {
			clearTimeout(timeoutId);
			const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
			const retryable = isTimeout || isRetryableStatus(err);

			if (retryable && attemptIdx < MAX_RETRIES) {
				const delay = (attemptIdx + 1) * 3000;
				if (isTimeout) {
					console.warn(`[AI Evaluator Warning] Request timed out (attempt ${attemptIdx + 1}/${MAX_RETRIES + 1}). Retrying in ${delay / 1000}s…`);
				} else {
					const code = APICallError.isInstance(err) ? err.statusCode : (err as { statusCode?: number })?.statusCode;
					console.warn(
						`[AI Evaluator Warning] API status ${code ?? 'unknown'} (attempt ${attemptIdx + 1}/${MAX_RETRIES + 1}). Retrying in ${delay / 1000}s…`
					);
				}
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}

			if (isTimeout) {
				console.error('[AI Evaluator Error] Request timed out after retries:', err);
			} else if (APICallError.isInstance(err) || (err as { name?: string })?.name === 'AI_NoObjectGeneratedError') {
				console.warn('[AI Evaluator Warning] AI SDK error:', err);
			} else {
				console.error('[AI Evaluator Error]:', err);
			}
			return null;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Result mapping
// ---------------------------------------------------------------------------

function mapToScoreResult(
	parsed: IELTSEvaluationAIOutput,
	attempt: IELTSSpeakingAttempt,
	topic: IELTSSpeakingTopic,
	items: QuestionItem[]
): IELTSScoreResult {
	const fcScore = clampBand(parsed.fluency_coherence);
	const lrScore = clampBand(parsed.lexical_resource);
	const graScore = clampBand(parsed.grammatical_range_accuracy);
	const prScore = clampBand(parsed.pronunciation);

	const rawOverall = Number(parsed.overall_band);
	const overallBand =
		!isNaN(rawOverall) && rawOverall >= 0 && rawOverall <= 9 ? rawOverall : Math.round(((fcScore + lrScore + graScore + prScore) / 4) * 2) / 2;

	const parsedItems = Array.isArray(parsed.per_question_items) ? parsed.per_question_items : [];
	const perQuestionRecord: Record<string, IELTSPerQuestionAnalysis> = {};

	items.forEach((qItem, idx) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const matched = (parsedItems as any[]).find((x: any) => x.question_id === qItem.id) || parsedItems[idx];
		const liveStt = attempt.responses?.[qItem.id]?.transcript || matched?.live_stt_transcript || qItem.liveTranscript || '';
		const aiTranscript = matched?.ai_generated_transcript || liveStt || 'Audio analyzed';
		perQuestionRecord[qItem.id] = {
			question_id: qItem.id,
			live_stt_transcript: liveStt,
			ai_generated_transcript: aiTranscript,
			match_percentage: matched?.match_percentage ?? (liveStt ? computeWordSimilarity(liveStt, aiTranscript) : 100),
			feedback: matched?.feedback || 'Đã đánh giá.',
			academic_answer: matched?.academic_answer,
			natural_answer: matched?.natural_answer,
			grammar_corrections: matched?.grammar_corrections
		};
	});

	return {
		attempt_id: attempt.id,
		topic_title: topic.title,
		part1_questions: topic.part1_questions,
		part2_cue_card: topic.part2_cue_card,
		part3_questions: topic.part3_questions,
		responses: attempt.responses,
		part2_notes: attempt.part2_notes,
		overall_band: overallBand,
		status_title: getIELTSStatusTitle(overallBand),
		summary_feedback: parsed.overall_feedback || 'Đã hoàn tất đánh giá bằng AI.',
		criteria_scores: [
			{
				code: 'FC',
				name: 'Fluency & Coherence',
				score: fcScore,
				summary: parsed.criterion_feedback.fluency || '',
				key_observations: parsed.criterion_key_observations.fluency || []
			},
			{
				code: 'LR',
				name: 'Lexical Resource',
				score: lrScore,
				summary: parsed.criterion_feedback.vocabulary || '',
				key_observations: parsed.criterion_key_observations.vocabulary || []
			},
			{
				code: 'GRA',
				name: 'Grammatical Range & Accuracy',
				score: graScore,
				summary: parsed.criterion_feedback.grammar || '',
				key_observations: parsed.criterion_key_observations.grammar || []
			},
			{
				code: 'PR',
				name: 'Pronunciation',
				score: prScore,
				summary: parsed.criterion_feedback.pronunciation || '',
				key_observations: parsed.criterion_key_observations.pronunciation || []
			}
		],
		filler_words: parsed.filler_words || [],
		vocab_upgrades: parsed.vocab_upgrades || [],
		strengths: parsed.strengths || [],
		areas_for_improvement: parsed.weaknesses || [],
		criterion_feedback: parsed.criterion_feedback,
		estimated_band_reason: parsed.estimated_band_reason,
		per_question_analysis: perQuestionRecord
	};
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

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

	const estBytes = filtered.reduce((s, q) => s + (q.audioBase64?.length ?? 0), 0);
	console.log(
		`[AI Evaluator] Sending request via AI SDK: ${audioCount} audio clip(s), ~${(estBytes / 1024 / 1024).toFixed(2)} MB base64, model=${resolved.modelId}, endpoint=${resolved.endpoint}`
	);

	const userContent = buildUserContent(topic, attempt, filtered);
	const parsed = await callAIWithRetry(resolved.model, userContent);
	if (!parsed) return null;

	return mapToScoreResult(parsed, attempt, topic, filtered);
}
