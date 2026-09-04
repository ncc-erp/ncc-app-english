import {
  IELTSSpeakingAttempt,
  IELTSSpeakingTopic,
  IELTSScoreResult,
  IELTSPerQuestionAnalysis,
} from "@/types/ielts";
import { getIELTSStatusTitle } from "./score-calculator";
import { downloadAudioAsBase64 } from "@/lib/supabase/storage";

export const OFFICIAL_IELTS_EXAMINER_PROMPT = `# ROLE

You are a certified, senior IELTS Speaking Examiner.

Your task is to score the candidate's IELTS Speaking performance as closely as possible to an official IELTS examiner.
You have been provided with the candidate's actual audio recordings (and question prompts) for each question.

Do NOT be generous or harsh. Be objective, evidence-based, and consistent.

--------------------------------------------------
MULTIMODAL AUDIO EVALUATION INSTRUCTIONS
--------------------------------------------------
1. AUDIO-BASED PRONUNCIATION (PR):
   - Listen directly to the attached audio clips.
   - Evaluate phonological features: individual sound/phoneme clarity, word stress, sentence stress, rhythm, intonation patterns, and connected speech (linking, elision, assimilation).
   - Local or non-native accent does NOT penalize the score if speech remains clear and intelligible.
   - Explicitly note any mispronounced words, lost final sounds, or flat intonation in "pronunciation" key observations and feedback.

2. AUDIO-BASED FLUENCY & COHERENCE (FC):
   - Listen to the flow of speech, natural rhythm, and speaking rate (words per minute).
   - Differentiate between natural pauses (content thinking) vs. unnatural language search hesitations, repetitions, and self-corrections.
   - Count and note filler words (e.g., "uh", "um", "like", "you know") and quantify their impact.

3. 100% FAITHFUL AUDIO TRANSCRIPT ("ai_generated_transcript"):
   - Listen to the audio and transcribe EXACTLY what the candidate actually uttered.
   - Correct Speech-to-Text (STT) mishearings, acoustic glitches, and add correct punctuation/capitalization.
   - STRICTLY FORBIDDEN: DO NOT ADD, INVENT, OR EXTEND ANY EXTRA SENTENCES OR CLAUSES THAT THE CANDIDATE DID NOT SPEAK.
   - If the candidate spoke only 1 short sentence, the transcript MUST BE EXACTLY THAT 1 SENTENCE.
   - STRICTLY FORBIDDEN: DO NOT OMIT, CUT OFF, OR SHORTEN WORDS SPOKEN BY THE CANDIDATE.
   - "match_percentage": Calculate the similarity (0-100%) between the raw Browser STT text snippet and the actual spoken audio transcript.

4. LEXICAL RESOURCE (LR) & GRAMMATICAL RANGE & ACCURACY (GRA):
   - Score LR based on vocabulary precision, collocations, idiomatic expressions, and topic flexibility heard in the audio.
   - Score GRA based on sentence structure variety (complex vs simple clauses), tense consistency, and error density.

--------------------------------------------------
SCORING CRITERIA (HALF-BAND INCREMENTS: 0.0 - 9.0)
--------------------------------------------------
The IELTS Speaking test consists of four equally weighted criteria:
1. Fluency and Coherence (FC)
2. Lexical Resource (LR)
3. Grammatical Range and Accuracy (GRA)
4. Pronunciation (PR)

Each criterion is scored independently using half-band increments:
0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9

The overall score is (FC + LR + GRA + PR) / 4
Then round using official IELTS rules:
- Average 6.00–6.24 → 6.0
- Average 6.25–6.74 → 6.5
- Average 6.75–7.00 → 7.0

--------------------------------------------------
OUTPUT FORMAT (STRICT JSON ONLY)
--------------------------------------------------
Return ONLY valid JSON matching this exact structure:

{
  "overall_band": 6.5,
  "estimated_band_reason": "Detailed rationale explaining why this overall band score was awarded based on official IELTS criteria and audio observations.",
  "fluency_coherence": 6.5,
  "lexical_resource": 6.5,
  "grammatical_range_accuracy": 6.0,
  "pronunciation": 7.0,
  "overall_feedback": "Summary assessment of performance.",
  "criterion_feedback": {
    "fluency": "Detailed fluency feedback based on speaking rhythm, pauses, and flow...",
    "vocabulary": "Detailed vocabulary feedback...",
    "grammar": "Detailed grammar feedback...",
    "pronunciation": "Detailed pronunciation feedback based on acoustic clarity, stress, and intonation..."
  },
  "criterion_key_observations": {
    "fluency": ["Observation 1", "Observation 2"],
    "vocabulary": ["Observation 1", "Observation 2"],
    "grammar": ["Observation 1", "Observation 2"],
    "pronunciation": ["Observation 1", "Observation 2"]
  },
  "filler_words": [
    {"word": "like", "count": 4, "impact": "moderate"}
  ],
  "vocab_upgrades": [
    {"original": "good", "upgrade": "beneficial", "context_example": "It is beneficial for students."}
  ],
  "strengths": ["Clear pronunciation of consonant clusters", "Good topic extension in Part 2"],
  "weaknesses": ["Frequent self-correction in Part 3", "Limited complex grammar structures"],
  "per_question_items": [
    {
      "question_id": "p1_q1",
      "live_stt_transcript": "Raw Browser STT snippet (may be truncated or have typos)",
      "ai_generated_transcript": "EXACT transcript of what candidate actually spoke in the audio.",
      "match_percentage": 80,
      "feedback": "Concise 1-2 sentence examiner assessment of candidate's pronunciation, fluency, vocabulary, and grammar for this answer.",
      "grammar_corrections": [
        "Incorrect: 'I live in city' → Correct: 'I live in a big city'",
        "Word choice: Replace 'good' with 'vibrant'"
      ],
      "improved_version": "Concise Band 8.5+ model answer (2-3 sentences max for Part 1/3, 4-5 sentences max for Part 2)."
    }
  ]
}

DO NOT include any text outside the JSON object.
`;
function computeWordSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/).filter(Boolean);
  const words2 = text2.toLowerCase().split(/\s+/).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return 0;
  const set1 = new Set(words1);
  const common = words2.filter((w) => set1.has(w)).length;
  return Math.round((common / Math.max(words1.length, words2.length)) * 100);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAiJson(jsonStr: string): any {
  let str = jsonStr.trim();
  const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    str = codeBlockMatch[1].trim();
  }
  const firstBrace = str.indexOf("{");
  if (firstBrace > 0) {
    str = str.substring(firstBrace).trim();
  }
  return JSON.parse(str);
}

export async function evaluateIELTSAttemptWithAI(
  attempt: IELTSSpeakingAttempt,
  topic: IELTSSpeakingTopic,
): Promise<IELTSScoreResult | null> {
  const apiKey = process.env.AI_API_KEY || "";
  const endpoint =
    process.env.AI_ENDPOINT || "https://llm.mrdnd.dev/v1/chat/completions";
  const model = process.env.AI_MODEL || "gemini-3.7-flash-high";

  if (!apiKey) {
    console.warn("[AI Evaluator Warning] Missing AI_API_KEY.");
    return null;
  }

  // Helper fetch audio qua Supabase Storage hoặc Direct URL
  const fetchAudioForResponse = async (qId: string) => {
    const resp = attempt.responses?.[qId];
    if (!resp) return null;

    let storagePath = resp.audio_storage_path;
    if (!storagePath && resp.audio_url) {
      const match = resp.audio_url.match(
        /(?:ielts-recordings|ielts-speaking-recordings)\/([^?#]+)/,
      );
      if (match?.[1]) storagePath = decodeURIComponent(match[1]);
    }

    if (storagePath) {
      const downloaded = await downloadAudioAsBase64(storagePath);
      if (downloaded) return downloaded;
    }

    if (resp.audio_url) {
      try {
        const audioRes = await fetch(resp.audio_url);
        if (audioRes.ok) {
          const arr = await audioRes.arrayBuffer();
          const cType = audioRes.headers.get("content-type") || "audio/webm";
          return {
            base64: Buffer.from(arr).toString("base64"),
            mimeType: cType.split(";")[0].trim(),
          };
        }
      } catch (err) {
        console.warn(`[AI Evaluator] Failed to fetch audio for ${qId}:`, err);
      }
    }
    return null;
  };

  // Gom toàn bộ câu hỏi
  const allQuestions = [
    ...topic.part1_questions.map((q) => ({
      id: q.id,
      part: "Part 1",
      questionText: q.question_text,
    })),
    ...(topic.part2_cue_card
      ? [
          {
            id: topic.part2_cue_card.id,
            part: "Part 2 Cue Card",
            questionText: `${topic.part2_cue_card.prompt_lead} Points: ${topic.part2_cue_card.bullet_points.join(", ")}`,
          },
        ]
      : []),
    ...topic.part3_questions.map((q) => ({
      id: q.id,
      part: "Part 3",
      questionText: q.question_text,
    })),
  ];

  // Tải file audio song song
  const questionItems = await Promise.all(
    allQuestions.map(async (q) => {
      const resp = attempt.responses?.[q.id];
      const audioData = await fetchAudioForResponse(q.id);
      return {
        id: q.id,
        part: q.part,
        questionText: q.questionText,
        liveTranscript: resp?.transcript || "",
        duration: resp?.duration_seconds || 0,
        audioBase64: audioData?.base64,
        audioMimeType: audioData?.mimeType,
      };
    }),
  );

  // Kiểm tra nếu không có transcript nào
  const hasSpokenContent = questionItems.some(
    (item) =>
      Boolean(item.liveTranscript) && item.liveTranscript.trim().length > 2,
  );

  if (!hasSpokenContent) {
    console.log("[AI Evaluator] No assessable speech detected. Return Band 0.");
    const zeroPerQuestionRecord: Record<string, IELTSPerQuestionAnalysis> = {};
    questionItems.forEach((qItem) => {
      zeroPerQuestionRecord[qItem.id] = {
        question_id: qItem.id,
        live_stt_transcript: "No transcript recorded",
        ai_generated_transcript: "No spoken response recorded in audio",
        match_percentage: 100,
        feedback: "No audio or spoken response was recorded for this question.",
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
      overall_band: 0.0,
      status_title: getIELTSStatusTitle(0.0),
      summary_feedback:
        "No spoken response detected. Please check microphone settings.",
      criteria_scores: [
        {
          code: "FC",
          name: "Fluency & Coherence",
          score: 0.0,
          summary: "No speech produced.",
          key_observations: [],
        },
        {
          code: "LR",
          name: "Lexical Resource",
          score: 0.0,
          summary: "No vocabulary produced.",
          key_observations: [],
        },
        {
          code: "GRA",
          name: "Grammatical Range & Accuracy",
          score: 0.0,
          summary: "No grammar produced.",
          key_observations: [],
        },
        {
          code: "PR",
          name: "Pronunciation",
          score: 0.0,
          summary: "No audio available.",
          key_observations: [],
        },
      ],
      filler_words: [],
      vocab_upgrades: [],
      strengths: [],
      areas_for_improvement: ["Provide spoken answers to each prompt."],
      criterion_feedback: {
        fluency: "No speech detected.",
        vocabulary: "No speech detected.",
        grammar: "No speech detected.",
        pronunciation: "No speech detected.",
      },
      estimated_band_reason:
        "Band 0 is awarded when no assessable language is produced.",
      per_question_analysis: zeroPerQuestionRecord,
    };
  }

  const audioCount = questionItems.filter((item) =>
    Boolean(item.audioBase64),
  ).length;
  if (audioCount === 0) {
    console.warn("[AI Evaluator] Cannot evaluate: no audio files downloaded.");
    return null;
  }

  // Chuẩn bị payload OpenAI multimodal (input_audio)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [
    {
      type: "text",
      text: `Exam Topic: "${topic.title}" (Category: ${topic.category})\nPart 2 Preparation Notes: "${attempt.part2_notes || "None"}"\n\nListen to each audio attached below and evaluate:`,
    },
  ];

  questionItems.forEach((item) => {
    const isSilent =
      !item.liveTranscript || item.liveTranscript.trim().length === 0;
    const sttNote = isSilent
      ? "\n🔇 Browser STT was empty."
      : `\n📝 STT reference: "${item.liveTranscript.trim().slice(0, 80)}"`;

    contentParts.push({
      type: "text",
      text: `\n---\n[Question ID: ${item.id} | ${item.part}]\nPrompt: "${item.questionText}"\nDuration: ${item.duration}s${sttNote}`,
    });

    if (item.audioBase64 && item.audioMimeType) {
      const format = item.audioMimeType.split("/")[1]?.split(";")[0] || "webm";
      contentParts.push({
        type: "input_audio",
        input_audio: {
          data: item.audioBase64,
          format: format === "mpeg" ? "mp3" : format,
        },
      });
    }
  });

  contentParts.push({
    type: "text",
    text: "\nOutput ONLY valid JSON matching the system instructions. Do not include markdown code ticks outside the response.",
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: "system", content: OFFICIAL_IELTS_EXAMINER_PROMPT },
          { role: "user", content: contentParts },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        `[AI Evaluator Warning] API status ${res.status}: ${await res.text()}`,
      );
      return null;
    }

    const resJson = await res.json();
    const rawContent = resJson.choices?.[0]?.message?.content || "";
    if (!rawContent) return null;

    const parsed = parseAiJson(rawContent);

    const parseScore = (val: unknown) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0.0 && num <= 9.0 ? num : 0.0;
    };

    const fcScore = parseScore(parsed.fluency_coherence);
    const lrScore = parseScore(parsed.lexical_resource);
    const graScore = parseScore(parsed.grammatical_range_accuracy);
    const prScore = parseScore(parsed.pronunciation);

    const rawOverall = Number(parsed.overall_band);
    const overallBand =
      !isNaN(rawOverall) && rawOverall >= 0.0 && rawOverall <= 9.0
        ? rawOverall
        : Math.round(((fcScore + lrScore + graScore + prScore) / 4) * 2) / 2;

    const parsedItems = Array.isArray(parsed.per_question_items)
      ? parsed.per_question_items
      : [];

    const perQuestionRecord: Record<string, IELTSPerQuestionAnalysis> = {};
    questionItems.forEach((qItem, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matched =
        parsedItems.find((item: any) => item.question_id === qItem.id) ||
        parsedItems[idx];

      const liveStt =
        attempt.responses?.[qItem.id]?.transcript ||
        matched?.live_stt_transcript ||
        qItem.liveTranscript ||
        "";
      const aiTranscript =
        matched?.ai_generated_transcript || liveStt || "Audio analyzed";

      perQuestionRecord[qItem.id] = {
        question_id: qItem.id,
        live_stt_transcript: liveStt,
        ai_generated_transcript: aiTranscript,
        match_percentage:
          matched?.match_percentage ??
          (liveStt ? computeWordSimilarity(liveStt, aiTranscript) : 100),
        feedback: matched?.feedback || "Evaluated.",
        improved_version: matched?.improved_version,
        grammar_corrections: matched?.grammar_corrections,
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
      summary_feedback: parsed.overall_feedback || "AI evaluation complete.",
      criteria_scores: [
        {
          code: "FC",
          name: "Fluency & Coherence",
          score: fcScore,
          summary: parsed.criterion_feedback?.fluency || "",
          key_observations: parsed.criterion_key_observations?.fluency || [],
        },
        {
          code: "LR",
          name: "Lexical Resource",
          score: lrScore,
          summary: parsed.criterion_feedback?.vocabulary || "",
          key_observations: parsed.criterion_key_observations?.vocabulary || [],
        },
        {
          code: "GRA",
          name: "Grammatical Range & Accuracy",
          score: graScore,
          summary: parsed.criterion_feedback?.grammar || "",
          key_observations: parsed.criterion_key_observations?.grammar || [],
        },
        {
          code: "PR",
          name: "Pronunciation",
          score: prScore,
          summary: parsed.criterion_feedback?.pronunciation || "",
          key_observations:
            parsed.criterion_key_observations?.pronunciation || [],
        },
      ],
      filler_words: parsed.filler_words || [],
      vocab_upgrades: parsed.vocab_upgrades || [],
      strengths: parsed.strengths || [],
      areas_for_improvement: parsed.weaknesses || [],
      criterion_feedback: parsed.criterion_feedback,
      estimated_band_reason: parsed.estimated_band_reason,
      per_question_analysis: perQuestionRecord,
    };
  } catch (err) {
    console.error("[AI Evaluator Error]:", err);
    return null;
  }
}
