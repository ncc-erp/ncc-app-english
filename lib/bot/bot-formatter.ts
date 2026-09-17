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
  detailsUrl?: string,
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
  // PART 1: Overall Band, Strengths & Link to Detailed Report
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
  msg1 += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // Strengths & Areas for Improvement

  if (detailsUrl) {
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg1 += `🌐 **Interactive Detailed Report & Audio Playback:**\n`;
    msg1 += `👉 ${detailsUrl}\n`;
    msg1 += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;
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
