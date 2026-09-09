import { IELTSScoreResult } from "@/types/ielts";

/**
 * Teaser view of a report for candidates who have not verified clan membership.
 * The detailed breakdown, per-question transcripts and audio never leave the
 * server while the attempt is locked -- blurring it in the UI is not a gate.
 */
export function toTeaserResult(result: IELTSScoreResult) {
  return {
    attempt_id: result.attempt_id,
    topic_title: result.topic_title,
    overall_band: result.overall_band,
    status_title: result.status_title,
    summary_feedback: result.summary_feedback,
    estimated_band_reason: result.estimated_band_reason,
    unlocked: false,
  };
}
