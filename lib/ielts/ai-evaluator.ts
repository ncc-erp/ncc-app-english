import {
  IELTSSpeakingAttempt,
  IELTSSpeakingTopic,
  IELTSScoreResult,
  IELTSPerQuestionAnalysis,
} from "@/types/ielts";
import { getIELTSStatusTitle } from "./score-calculator";
import { downloadAudioAsBase64 } from "@/lib/supabase/storage";

import { OFFICIAL_IELTS_EXAMINER_PROMPT } from "./prompts/examiner";

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
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    str = str.substring(firstBrace, lastBrace + 1).trim();
  } else if (firstBrace > 0) {
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

  const MAX_AUDIO_BASE64_BYTES = 3 * 1024 * 1024; // 3 MB
  const audioCount = questionItems.filter((item) => {
    if (!item.audioBase64) return false;
    if (item.audioBase64.length > MAX_AUDIO_BASE64_BYTES) {
      console.warn(
        `[AI Evaluator] Skipping oversized audio for ${item.id}: ${(item.audioBase64.length / 1024 / 1024).toFixed(1)} MB > 3 MB limit`,
      );
      item.audioBase64 = undefined;
      item.audioMimeType = undefined;
      return false;
    }
    return true;
  }).length;

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
    text: "\nOutput ONLY valid JSON strictly conforming to the JSON Schema. Do NOT include markdown code ticks or commentary outside the JSON object.",
  });

  const requestBody = JSON.stringify({
    model,
    max_tokens: 8192,
    messages: [
      { role: "system", content: OFFICIAL_IELTS_EXAMINER_PROMPT },
      { role: "user", content: contentParts },
    ],
    response_format: { type: "json_object" },
  });

  // Log payload size to help diagnose upstream rejections
  console.log(
    `[AI Evaluator] Sending request: ${audioCount} audio clip(s), payload size: ${(requestBody.length / 1024 / 1024).toFixed(2)} MB`,
  );

  // Retry helper: up to maxAttempts tries with exponential backoff on 499/503/timeout
  const MAX_RETRIES = 2;
  const callAIWithRetry = async () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 85000);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: requestBody,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Retry on transient gateway errors
        if (
          (res.status === 499 || res.status === 503) &&
          attempt < MAX_RETRIES
        ) {
          const bodyText = await res.text();
          console.warn(
            `[AI Evaluator Warning] API status ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${bodyText}. Retrying in ${(attempt + 1) * 3}s…`,
          );
          await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
          continue;
        }

        if (!res.ok) {
          console.warn(
            `[AI Evaluator Warning] API status ${res.status}: ${await res.text()}`,
          );
          return null;
        }
        return res;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const isTimeout =
          fetchErr instanceof Error && fetchErr.name === "AbortError";
        if (isTimeout && attempt < MAX_RETRIES) {
          console.warn(
            `[AI Evaluator Warning] Request timed out (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${(attempt + 1) * 3}s…`,
          );
          await new Promise((r) => setTimeout(r, (attempt + 1) * 3000));
          continue;
        }
        throw fetchErr;
      }
    }
    return null;
  };

  try {
    const res = await callAIWithRetry();
    if (!res) return null;

    const resJson = await res.json();
    const rawContent = resJson.choices?.[0]?.message?.content || "";
    if (!rawContent) return null;

    let parsed: any;
    try {
      parsed = parseAiJson(rawContent);
    } catch (parseErr) {
      console.error(
        "[AI Evaluator Error] Failed to parse model response as JSON. Raw snippet:",
        rawContent.slice(0, 500),
      );
      throw parseErr;
    }

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
