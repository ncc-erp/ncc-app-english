import { z } from 'zod';

export const ieltsEvaluationZodSchema = z.object({
	overall_band: z.number().min(0).max(9).describe('Overall band score (FC+LR+GRA+PR)/4 rounded to half-band.'),
	estimated_band_reason: z.string().describe('Rationale for the overall band, in Vietnamese.'),
	fluency_coherence: z.number().min(0).max(9),
	lexical_resource: z.number().min(0).max(9),
	grammatical_range_accuracy: z.number().min(0).max(9),
	pronunciation: z.number().min(0).max(9),
	overall_feedback: z.string().describe('Summary assessment, in Vietnamese.'),
	criterion_feedback: z.object({
		fluency: z.string(),
		vocabulary: z.string(),
		grammar: z.string(),
		pronunciation: z.string()
	}),
	criterion_key_observations: z.object({
		fluency: z.array(z.string()),
		vocabulary: z.array(z.string()),
		grammar: z.array(z.string()),
		pronunciation: z.array(z.string())
	}),
	filler_words: z.array(
		z.object({
			word: z.string(),
			count: z.number().int(),
			impact: z.enum(['low', 'moderate', 'high'])
		})
	),
	vocab_upgrades: z.array(
		z.object({
			original: z.string(),
			upgrade: z.string(),
			context_example: z.string()
		})
	),
	strengths: z.array(z.string()),
	weaknesses: z.array(z.string()),
	per_question_items: z.array(
		z.object({
			question_id: z.string(),
			live_stt_transcript: z.string(),
			ai_generated_transcript: z.string(),
			match_percentage: z.number().min(0).max(100),
			feedback: z.string(),
			grammar_corrections: z.array(z.string()).optional(),
			academic_answer: z.string(),
			natural_answer: z.string()
		})
	)
});

export type IELTSEvaluationAIOutput = z.infer<typeof ieltsEvaluationZodSchema>;
