import { IELTSSpeakingAttempt } from "@/types/ielts";

function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 3) + "...";
}

export function formatIELTSResult(
  attempt: IELTSSpeakingAttempt,
  targetUserName?: string,
): string {
  const result = attempt.score_result;
  const overallBand = attempt.band_score ?? result?.overall_band ?? 0;
  const topicTitle =
    attempt.topic_title || result?.topic_title || "IELTS Speaking Assessment";
  const dateStr = attempt.submitted_at
    ? new Date(attempt.submitted_at).toLocaleString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Just now";

  const userGreeting = targetUserName ? ` FOR ${targetUserName}` : "";

  // -------------------------------------------------------------
  // PART 1: Overall Band, 4 Criteria In-Depth Feedback & Strengths
  // -------------------------------------------------------------
  let msg1 = `🎯 **IELTS SPEAKING MOCK TEST REPORT${userGreeting}**\n`;
  msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg1 += `📋 **Topic:** ${topicTitle}\n`;
  msg1 += `📅 **Date:** ${dateStr}\n`;
  msg1 += `🆔 **Attempt ID:** \`${attempt.id}\`\n\n`;
  msg1 += `🏆 **OVERALL BAND: ${overallBand.toFixed(1)}**`;
  if (result?.status_title) {
    msg1 += ` — *${result.status_title}*`;
  }
  msg1 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 1. Criteria Breakdown & In-Depth Diagnostic Feedback
  if (result?.criteria_scores && result.criteria_scores.length > 0) {
    msg1 += `📊 **4 IELTS Criteria Breakdown & Feedback:**\n`;
    for (const crit of result.criteria_scores) {
      msg1 += `• **[${crit.code}] ${crit.name}:** ${crit.score.toFixed(1)}\n`;
      const feedback =
        crit.summary ||
        (result.criterion_feedback
          ? (result.criterion_feedback as Record<string, string>)[
              crit.name.toLowerCase().split(" ")[0]
            ]
          : "");
      if (feedback) {
        msg1 += `  💬 ${truncate(feedback, 500)}\n`;
      }
      if (crit.key_observations && crit.key_observations.length > 0) {
        for (const obs of crit.key_observations.slice(0, 2)) {
          msg1 += `  - ${truncate(obs, 120)}\n`;
        }
      }
      msg1 += `\n`;
    }
  }

  // Strengths & Areas for Improvement
  if (result?.strengths && result.strengths.length > 0) {
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg1 += `💪 **Key Strengths:**\n`;
    for (const s of result.strengths.slice(0, 3)) {
      msg1 += `  ✅ ${truncate(s, 110)}\n`;
    }
    msg1 += `\n`;
  }

  if (
    result?.areas_for_improvement &&
    result.areas_for_improvement.length > 0
  ) {
    msg1 += `⚡ **Areas for Improvement:**\n`;
    for (const a of result.areas_for_improvement.slice(0, 3)) {
      msg1 += `  ⚠️ ${truncate(a, 110)}\n`;
    }
    msg1 += `\n`;
  }

  if (result?.filler_words && result.filler_words.length > 0) {
    const totalFillers = result.filler_words.reduce(
      (sum, f) => sum + f.count,
      0,
    );
    const topFillers = result.filler_words
      .slice(0, 3)
      .map((f) => `"${f.word}" (${f.count}x)`)
      .join(", ");
    msg1 += `🗣️ **Filler Words Count:** ${totalFillers} (${topFillers})\n`;
  }

  // -------------------------------------------------------------
  // PART 2: Per-Question Detailed Analysis & Corrections
  // -------------------------------------------------------------
  interface QuestionItem {
    id: string;
    part: string;
    title: string;
    questionText?: string;
    transcript?: string;
    feedback?: string;
    corrections?: string[];
  }

  const questions: QuestionItem[] = [];

  if (result?.part1_questions && Array.isArray(result.part1_questions)) {
    result.part1_questions.forEach((q, idx) => {
      const analysis = result.per_question_analysis?.[q.id];
      const resp = attempt.responses?.[q.id] || result.responses?.[q.id];
      questions.push({
        id: q.id,
        part: "Part 1",
        title: `Part 1 • Q${idx + 1}`,
        questionText: q.question_text,
        transcript:
          analysis?.ai_generated_transcript ||
          analysis?.live_stt_transcript ||
          resp?.transcript,
        feedback: analysis?.feedback,
        corrections: analysis?.grammar_corrections,
      });
    });
  }

  if (result?.part2_cue_card) {
    const card = result.part2_cue_card;
    const analysis = result.per_question_analysis?.[card.id];
    const resp = attempt.responses?.[card.id] || result.responses?.[card.id];
    questions.push({
      id: card.id,
      part: "Part 2",
      title: "Part 2 • Cue Card",
      questionText:
        card.cue_card_title || card.topic_title || "Topic Discussion",
      transcript:
        analysis?.ai_generated_transcript ||
        analysis?.live_stt_transcript ||
        resp?.transcript,
      feedback: analysis?.feedback,
      corrections: analysis?.grammar_corrections,
    });
  }

  if (result?.part3_questions && Array.isArray(result.part3_questions)) {
    result.part3_questions.forEach((q, idx) => {
      const analysis = result.per_question_analysis?.[q.id];
      const resp = attempt.responses?.[q.id] || result.responses?.[q.id];
      questions.push({
        id: q.id,
        part: "Part 3",
        title: `Part 3 • Discussion ${idx + 1}`,
        questionText: q.question_text,
        transcript:
          analysis?.ai_generated_transcript ||
          analysis?.live_stt_transcript ||
          resp?.transcript,
        feedback: analysis?.feedback,
        corrections: analysis?.grammar_corrections,
      });
    });
  }

  // Fallback: if part question arrays were empty, iterate per_question_analysis
  if (questions.length === 0 && result?.per_question_analysis) {
    Object.entries(result.per_question_analysis).forEach(
      ([qId, analysis], idx) => {
        const resp = attempt.responses?.[qId] || result.responses?.[qId];
        questions.push({
          id: qId,
          part: resp?.part
            ? `Part ${resp.part.replace("part", "")}`
            : "Question",
          title: `Question ${idx + 1}`,
          questionText: analysis.question_text,
          transcript:
            analysis.ai_generated_transcript ||
            analysis.live_stt_transcript ||
            resp?.transcript,
          feedback: analysis.feedback,
          corrections: analysis.grammar_corrections,
        });
      },
    );
  }

  let msg2 = "";
  if (questions.length > 0) {
    msg2 += `📝 **PER-QUESTION DETAILED FEEDBACK & CORRECTIONS**\n`;
    msg2 += `📋 **Topic:** ${topicTitle} | 🆔 \`${attempt.id}\`\n`;
    msg2 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    questions.forEach((q) => {
      msg2 += `🔹 **${q.title}**`;
      if (q.questionText) {
        msg2 += `: *"${truncate(q.questionText, 150)}"*`;
      }
      msg2 += `\n`;

      if (q.feedback && q.feedback !== "Evaluated.") {
        msg2 += `  💡 *Feedback:* ${truncate(q.feedback, 300)}\n`;
      }

      if (q.corrections && q.corrections.length > 0) {
        msg2 += `  ✏️ *Correction:* ${truncate(q.corrections[0], 115)}\n`;
      }

      msg2 += `\n`;
    });
  }

  if (msg2) {
    return `${msg1.trim()}\n\n===SPLIT_MESSAGE===\n\n${msg2.trim()}`;
  }

  return msg1.trim();
}

export function formatIELTSTestHistory(
  attempts: IELTSSpeakingAttempt[],
  userName?: string,
): string {
  if (!attempts || attempts.length === 0) {
    return `ℹ️ You have no recorded IELTS Speaking attempts yet. Visit the web app to take your first test!`;
  }

  let msg = `📋 **IELTS SPEAKING TEST HISTORY${userName ? ` FOR ${userName}` : ""}**\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  attempts.forEach((att, index) => {
    const band = att.band_score ?? att.score_result?.overall_band;
    const bandStr =
      band !== undefined ? `Band ${band.toFixed(1)}` : "Grading...";
    const dateStr = att.submitted_at
      ? new Date(att.submitted_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "Pending";

    msg += `${index + 1}. \`${att.id}\` | **${att.topic_title}** | **${bandStr}** | ${dateStr}\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 **Tip:** Type \`*result <attempt_id>\` (e.g. \`*result ${attempts[0].id}\`) to view the detailed breakdown of any test!`;

  return msg;
}
