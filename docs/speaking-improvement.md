
 Plan: Replace Browser STT with Check-File + Whisper Pipeline for IELTS Speaking

 Context

 Browser STT (Web Speech API + Deepgram streaming in AudioRecorder.tsx) auto-corrects spelling, strips fillers (um/ah/erm), and normalizes grammar. The examiner prompt (OFFICIAL_IELTS_EXAMINER_PROMPT) then asks the LLM to score FC (Fluency & Coherence) and GRA (Grammatical Range & Accuracy) from audio + a cleaned transcript — so the LLM loses the disfluencies it needs to penalize. Result: inflated, unreliable bands.

 The requested pipeline replaces live STT as the scoring source with a server-side path: Pre-flight check -> Transcode -> Whisper (word-level, disfluency-preserving) -> Telemetry extraction -> Enriched LLM prompt. Live STT can remain as UI feedback, but is no longer fed to the evaluator as ground truth.

 Outcome: LLM receives (a) verbatim transcript with fillers/repetitions, (b) hard telemetry (WPM, pause counts, phonation ratio), and (c) original audio for PR, yielding examiner-accurate scoring.

---

 Exploration Summary

 Current flow traced:

- components/ielts/AudioRecorder.tsx — MediaRecorder (webm/opus) + dual live STT (Web Speech desktop / Deepgram WS mobile via /api/ielts/deepgram-token). On stop, uploads blob to POST /api/ielts/upload-audio (R2 via lib/storage/r2.ts), calls onAudioRecorded(url, transcript, duration).
- Test page collects responses: Record<qId, {audio_url, audio_storage_path, transcript, duration}> and POST /api/ielts/submit persists via pgDb.saveIELTSResponse (jsonb responses on ielts_speaking_attempts) and sets status submitted.
- Evaluation deferred: POST /api/ielts/rescore -> lib/ielts/ai-evaluator.ts:evaluateIELTSAttemptWithAI -> audio-loader.ts:fetchAllQuestionItems (downloads R2 audio as base64) -> buildUserContent (one text part per question with liveTranscript snippet + audio file part) -> generateText with Output.object(ieltsEvaluationZodSchema) -> evaluation-mapper.ts.
- Prompt: lib/ielts/prompts/examiner.ts (Vietnamese feedback, English quotes). No telemetry block today; FC/GRA are judged purely from audio + cleaned STT.
- Storage: R2 (lib/storage/r2.ts), Postgres pgDb (lib/db/postgres.ts:ensureDbInitialized). No Whisper, no ffmpeg, no audio analysis deps in package.json. ai SDK 7 + @ai-sdk/openai-compatible 3.

 Key constraint: Next.js on Vercel — no native Whisper binary in the function image. Whisper must be an external API call (OpenAI whisper-1 / Groq whisper-large-v3 / self-hosted faster-whisper endpoint). Pre-flight VAD/noise likewise must avoid heavy native deps or run as a lightweight JS/WASM check plus API-side handling.

---

 Recommended Approach

 Phase 0 — Decisions to lock before coding

- Whisper provider: OpenAI POST https://api.openai.com/v1/audio/transcriptions with response_format=verbose_json, timestamp_granularities[]=word, temperature=0. Accepts initial_prompt to force filler retention. Alternative Groq (whisper-large-v3-turbo) is faster/cheaper and also returns word timestamps — abstract behind one interface so either works via WHISPER_* env.
- Transcode: Keep on server inside the transcribe route using ffmpeg static binary (Vercel includes it in some runtimes) or ffmpeg.wasm fallback; target 16 kHz mono wav. If procurement of a binary is blocked, skip transcode and send webm/opus directly — OpenAI/Groq accept webm — but document that timestamp accuracy improves with wav.
- Telemetry stays server-computed from Whisper word timestamps, not LLM-guessed.

 Phase 1 — Types & DB

 Files: types/ielts.ts, lib/db/postgres.ts

- Extend IELTSSpeakingResponse with optional whisper fields:
  whisper_transcript?: string;
  whisper_words?: Array<{ word: string; start: number; end: number }>;
  whisper_metrics?: { wpm: number; phonation_ratio: number; pause_count: number; longest_pause_s: number; filler_count: number; filler_freq: Record<string,number> };
  whisper_status?: 'pending'|'done'|'failed';
- No schema migration needed — responses is jsonb, so additive keys are backward compatible. ensureDbInitialized unchanged. Optionally add whisper_version for traceability.

 Phase 2 — Server: Whisper transcription service

 New files:

- lib/ielts/whisper-client.ts — provider-agnostic client. Env: WHISPER_API_KEY, WHISPER_ENDPOINT (default https://api.openai.com/v1), WHISPER_MODEL (default whisper-1). Handles FormData upload, initial_prompt="Um, uh, well, you know, actually... I think, erm...", temperature=0, timestamp_granularities: ["word"], retry + timeout.
- lib/ielts/audio-preflight.ts — pure-JS pre-flight using ArrayBuffer + Web Audio-style analysis without native deps:
  - Decode header to estimate duration (from duration_seconds already captured + blob size fallback); reject 0-length/ >10 MB (already enforced in upload route) and flag silent clips (RMS < -30 dBFS via PCM sampling of first N KB, or via ffprobe if available). Return { ok, reason, trimSuggestion? }.
  - Trim silence at edges (optional, via ffmpeg -af silenceremove if binary present; otherwise skip and let Whisper's VAD handle it).
- lib/ielts/telemetry.ts — from whisper_words compute: WPM = words / phonationTime * 60, pause_count (gaps >1.5 s), phonation_ratio = phonationTime / totalDuration, filler_count (+ per-token frequency for um/uh/erm/like/you know etc.), longest_pause. Also detect midClausePause heuristic: pauses not at sentence boundaries (word before pause not sentence-ending punctuation).
- app/api/ielts/transcribe/route.ts — POST { attemptId, questionId } (auth + ownership check). Flow: downloadAudioBuffer(storagePath) -> audio-preflight (early 422 with user-facing message if silent/noise) -> (transcode if needed) -> whisper-client -> telemetry -> pgDb.saveIELTSResponse merge (or new pgDb.updateWhisperResult helper). Returns { success, transcript, words, metrics }.maxDuration = 60.
- Extend lib/storage/r2.ts if transcode produces a derived wav — upload as .../whisper/<id></id>.wav or just keep in memory; no need to persist transcode output unless debugging.

 Reuse: downloadAudioBuffer, getIELTSAttempt, saveIELTSResponse already exist; prefer a thin updateWhisperResult to avoid overwriting audio_url.

 Phase 3 — Orchestration: when transcription runs

 Two triggers, same service:

1. Eager (recommended default): Call POST /api/ielts/transcribe from the client immediately after each upload-audio success, per question. Gives fast feedback and parallelizes Whisper work before submit. AudioRecorder fires onAudioRecorded -> test page calls transcribe in background; UI can show a small "Transcribing..." badge.
2. Lazy (fallback/guard): POST /api/ielts/submit and POST /api/ielts/rescore check responses[qId].whisper_transcript; for any missing, run the transcribe pipeline inline (sequential or Promise.all with concurrency limit 3) before building LLM content. This guarantees coverage even if eager calls failed.

 Keep the existing POST /api/ielts/submit immediate-ack behavior (no AI yet). Only block rescore on whisper completion; submit stays fast.

 Phase 4 — Evaluator prompt enrichment

 Files: lib/ielts/ai-evaluator.ts, lib/ielts/prompts/examiner.ts, lib/ielts/audio-loader.ts

- audio-loader.ts: include whisper_transcript, whisper_words, whisper_metrics in QuestionItem.
- ai-evaluator.ts:buildUserContent: replace the single STT reference line with:
  [Question ID: ... | Part 1]
  Prompt: "..."
  Duration: 42s (phonation 31s)
  Whisper verbatim (fillers preserved): "... um ... well ... uh ..."
  Telemetry: WPM=132 | pauses>1.5s: 3 (longest 2.4s) | phonation_ratio: 74% | fillers: um×2, uh×1
  (Browser live STT, for reference only, may be cleaned): "..."
  Add a top-level instruction: "Use Whisper verbatim + telemetry as ground truth for FC/GRA. Do NOT infer fluency from the cleaned browser STT."
- prompts/examiner.ts: add a short section before the criteria:
  TELEMETRY (computed from Whisper word timestamps, do NOT recompute):
- Use WPM, pause counts, phonation ratio, filler frequency as evidence for FC.
- Mid-clause pauses and filler bursts are stronger FC penalties than end-of-sentence pauses.
  Keep the repairTruncatedJson note if still relevant; with Output.object it is mostly retired but harmless.
- Optionally include word timestamps as a compact appendix when token budget allows (words: [{w,start,end}] truncated), otherwise metrics alone suffice.

 Phase 5 — Frontend: AudioRecorder & test page

 Files: components/ielts/AudioRecorder.tsx, app/ielts-speaking/test/[id]/page.tsx (path may be app/ielts-speaking/[id]/page.tsx — verify), lib/i18n/* for strings

- AudioRecorder:
  - Keep live STT for UX (typing indicator), but label it "Live preview (may be cleaned)" so users don't treat it as final.
  - After upload-audio success, fire POST /api/ielts/transcribe; on 422 (silent/noise) surface an inline warning with retry guidance. On success, show whisper transcript below the player(collapsible) for user confidence.
  - Capture MediaRecorder.mimeType explicitly; prefer audio/webm;codecs=opus and pass it through so server knows the container.
- Test page: no major redesign. Add per-question whisper_status to local responses state; submit button remains enabled even if some whispers still pending — server-side lazy path covers it.

 Phase 6 — Env & deploy

 Files: .env.example, Vercel env

- Add:
  WHISPER_API_KEY=
  WHISPER_ENDPOINT=https://api.openai.com/v1   # or https://api.groq.com/openai/v1
  WHISPER_MODEL=whisper-1                        # or whisper-large-v3-turbo on Groq
- No new native binary in the image by default. If ffmpeg transcode is desired, add ffmpeg-static or @ffmpeg/ffmpeg (wasm) — evaluate bundle size; prefer provider that accepts webm to avoid it in v1.

---

 Alternatives Considered (not chosen)

- On-device faster-whisper / whisper.cpp WASM: best for privacy/latency but bundle is ~30–80 MB, cold start heavy, and word-timestamps in WASM builds are less mature. Revisit if API cost/latencybecomes an issue.
- Full self-hosted faster-whisper service: most control over VAD + filler retention, but adds infra to operate. Worth it as v2 if the product needs offline/air-gapped scoring.
- Server-side Silero VAD in Node: accurate VAD but requires onnxruntime-node native addon — fragile on Vercel. Lightweight RMS + provider VAD is sufficient for v1.

---

 Risks & Mitigations

- Whisper hallucination on silence: mitigated by temperature=0, condition_on_previous_text=false equivalent (OpenAI prompt + no prior context), and pre-flight silent rejection.
- Non-seekable webm duration metadata: read duration from duration_seconds captured client-side (recordingTimeRef) and pass it as totalDuration to telemetry; don't rely on container metadata alone.
- Cost: ~$0.006/min on OpenAI, cheaper on Groq. With ~7 questions × ~40 s avg ≈ 5 min/attempt, cost is cents. Add per-attempt concurrency cap and skip re-transcribing unchanged audio (key by audio_storage_path hash).
- Latency on rescore: parallelize transcriptions; eager path already hides latency before the user hits Submit.
- Vercel function limits: keep transcribe at maxDuration 60, rescore at 300; add dynamic = 'force-dynamic' already present.

---

 Verification

1. npx tsc --noEmit — gate (no test suite per CLAUDE.md).
2. npm run build — ensure no bundle blow-up from ffmpeg/onnx deps (should be none in v1).
3. Manual end-to-end (use GET /api/auth/login?mock=true for local auth):
   - Record a short answer with fillers ("um, uh, well...") on desktop and on a mobile UA (Deepgram path). Confirm upload succeeds, /api/ielts/transcribe returns verbatim with um/uh preserved and metrics (WPM, pause_count).
   - Submit -> rescore -> inspect DB responses[qId].whisper_* and final score_result criterion_feedback. FC description should mention filler/pause evidence from telemetry, not just generic fluency.
   - Silent recording (mute mic or 2 s tap): pre-flight returns 422 with user-facing message, no Whisper call billed.
   - Re-record same question: whisper result updates, old metrics overwritten.
4. Inspect LLM prompt in Vercel logs ([AI Evaluator] Sending request...) to confirm telemetry block and whisper transcript are present and browser STT is demoted to reference.
5. Optional: hit /api/ielts/transcribe directly with curl + attemptId/questionId to verify 401/404 guards and idempotency.

---

 Files to Modify / Create

- Modify: types/ielts.ts, lib/db/postgres.ts (or just response jsonb helper), lib/ielts/audio-loader.ts, lib/ielts/ai-evaluator.ts, lib/ielts/prompts/examiner.ts, components/ielts/AudioRecorder.tsx, test page app/ielts-speaking/**/page.tsx, .env.example, lib/i18n locale files.
- Create: lib/ielts/whisper-client.ts, lib/ielts/audio-preflight.ts, lib/ielts/telemetry.ts, app/api/ielts/transcribe/route.ts.
- Not in scope v1: lib/db/postgres.ts:ensureDbInitialized DDL, db/schema.sql (jsonb needs no migration), lib/storage/r2.ts (only if persisting transcode output).

 Execution Order

1. Types + whisper-client + telemetry (no UI, unit-testable with fixture json).
2. audio-preflight + POST /api/ielts/transcribe + DB helper.
3. Wire eager trigger from test page + AudioRecorder UX states.
4. Enrich audio-loader + ai-evaluator + examiner prompt.
5. Lazy fallback in submit/rescore + i18n strings + .env.example.
6. Manual verification + tsc --noEmit + next build.
