import type { IELTSSpeakingAttempt, IELTSSpeakingTopic } from '@/types/ielts';
import type { IELTSEvaluationAIOutput } from './schemas/evaluation-zod-schema';
import { getIELTSStatusTitle } from './score-calculator';
import type { QuestionItem } from './audio-loader';
import type { IELTSScoreResult, IELTSPerQuestionAnalysis } from '@/types/ielts';

function clampBand(val: unknown): number {
	const n = Number(val);
	return !isNaN(n) && n >= 0 && n <= 9 ? n : 0;
}

function wordSimilarity(a: string, b: string): number {
	const w1 = a.toLowerCase().split(/\s+/).filter(Boolean);
	const w2 = b.toLowerCase().split(/\s+/).filter(Boolean);
	if (!w1.length || !w2.length) return 0;
	const s = new Set(w1);
	return Math.round((w2.filter((w) => s.has(w)).length / Math.max(w1.length, w2.length)) * 100);
}

const CRITERION_MAP: Array<{
	code: 'FC' | 'LR' | 'GRA' | 'PR';
	name: string;
	bandKey: keyof Pick<IELTSEvaluationAIOutput, 'fluency_coherence' | 'lexical_resource' | 'grammatical_range_accuracy' | 'pronunciation'>;
	fbKey: 'fluency' | 'vocabulary' | 'grammar' | 'pronunciation';
}> = [
	{ code: 'FC', name: 'Fluency & Coherence', bandKey: 'fluency_coherence', fbKey: 'fluency' },
	{ code: 'LR', name: 'Lexical Resource', bandKey: 'lexical_resource', fbKey: 'vocabulary' },
	{ code: 'GRA', name: 'Grammatical Range & Accuracy', bandKey: 'grammatical_range_accuracy', fbKey: 'grammar' },
	{ code: 'PR', name: 'Pronunciation', bandKey: 'pronunciation', fbKey: 'pronunciation' }
];

export function mapToScoreResult(
	parsed: IELTSEvaluationAIOutput,
	attempt: IELTSSpeakingAttempt,
	topic: IELTSSpeakingTopic,
	items: QuestionItem[]
): IELTSScoreResult {
	const bands = Object.fromEntries(CRITERION_MAP.map((c) => [c.code, clampBand(parsed[c.bandKey])])) as Record<'FC' | 'LR' | 'GRA' | 'PR', number>;
	const raw = Number(parsed.overall_band);
	const overallBand = !isNaN(raw) && raw >= 0 && raw <= 9 ? raw : Math.round(((bands.FC + bands.LR + bands.GRA + bands.PR) / 4) * 2) / 2;

	const parsedItems = Array.isArray(parsed.per_question_items) ? parsed.per_question_items : [];
	const per_question_analysis: Record<string, IELTSPerQuestionAnalysis> = {};

	items.forEach((qItem, idx) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const matched = (parsedItems as any[]).find((x: any) => x.question_id === qItem.id) || parsedItems[idx];
		const liveStt = attempt.responses?.[qItem.id]?.transcript || matched?.live_stt_transcript || qItem.liveTranscript || '';
		const aiTranscript = matched?.ai_generated_transcript || liveStt || 'Audio analyzed';
		per_question_analysis[qItem.id] = {
			question_id: qItem.id,
			live_stt_transcript: liveStt,
			ai_generated_transcript: aiTranscript,
			match_percentage: matched?.match_percentage ?? (liveStt ? wordSimilarity(liveStt, aiTranscript) : 100),
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
		criteria_scores: CRITERION_MAP.map((c) => ({
			code: c.code,
			name: c.name,
			score: bands[c.code],
			summary: parsed.criterion_feedback[c.fbKey] || '',
			key_observations: parsed.criterion_key_observations[c.fbKey] || []
		})),
		filler_words: parsed.filler_words || [],
		vocab_upgrades: parsed.vocab_upgrades || [],
		strengths: parsed.strengths || [],
		areas_for_improvement: parsed.weaknesses || [],
		criterion_feedback: parsed.criterion_feedback,
		estimated_band_reason: parsed.estimated_band_reason,
		per_question_analysis
	};
}
