import { downloadAudioAsBase64, extractAudioStoragePath } from '@/lib/storage';
import type { IELTSSpeakingAttempt, IELTSSpeakingTopic } from '@/types/ielts';

export type QuestionItem = {
	id: string;
	part: string;
	questionText: string;
	liveTranscript: string;
	duration: number;
	audioBase64?: string;
	audioMimeType?: string;
};

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

export async function fetchAllQuestionItems(attempt: IELTSSpeakingAttempt, topic: IELTSSpeakingTopic): Promise<QuestionItem[]> {
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
