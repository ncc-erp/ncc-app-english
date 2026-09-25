import type { IELTSSpeakingAttempt, IELTSSpeakingTopic, IELTSScoreResult, IELTSPerQuestionAnalysis } from '@/types/ielts';
import { getIELTSStatusTitle } from './score-calculator';
import type { QuestionItem } from './audio-loader';

export function hasSpokenContent(items: QuestionItem[]): boolean {
	return items.some((i) => Boolean(i.audioBase64) || Boolean(i.liveTranscript?.trim().length > 2));
}

const MAX_AUDIO_BASE64_BYTES = 3 * 1024 * 1024;

export function filterOversizedAudio(items: QuestionItem[]): { filtered: QuestionItem[]; audioCount: number } {
	let audioCount = 0;
	const filtered = items.map((i) => {
		if (!i.audioBase64) return i;
		if (i.audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
			console.warn(`[AI Evaluator] Skipping oversized audio for ${i.id}: ${(i.audioBase64.length / 1e6).toFixed(1)} MB`);
			return { ...i, audioBase64: undefined, audioMimeType: undefined };
		}
		audioCount++;
		return i;
	});
	return { filtered, audioCount };
}

const ZERO_CRITERIA = [
	{ code: 'FC' as const, name: 'Fluency & Coherence', summary: 'Không có phần nói nào được thực hiện.' },
	{ code: 'LR' as const, name: 'Lexical Resource', summary: 'Không có từ vựng nào được sử dụng.' },
	{ code: 'GRA' as const, name: 'Grammatical Range & Accuracy', summary: 'Không có ngữ pháp nào được sử dụng.' },
	{ code: 'PR' as const, name: 'Pronunciation', summary: 'Không có âm thanh nào được ghi nhận.' }
];

export function buildBandZeroResult(attempt: IELTSSpeakingAttempt, topic: IELTSSpeakingTopic, items: QuestionItem[]): IELTSScoreResult {
	const perQuestionAnalysis: Record<string, IELTSPerQuestionAnalysis> = {};
	for (const q of items) {
		perQuestionAnalysis[q.id] = {
			question_id: q.id,
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
		criteria_scores: ZERO_CRITERIA.map((c) => ({ ...c, score: 0.0, key_observations: [] })),
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
