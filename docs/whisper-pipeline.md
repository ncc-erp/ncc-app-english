# Whisper Pipeline — Thay thế Browser STT bằng Check-File + Whisper cho IELTS Speaking

> **Trạng thái:** Đề xuất đã duyệt (2026-09-25) — sẵn sàng implement
> **Scope:** `components/ielts/AudioRecorder.tsx` · `lib/ielts/*` · `app/api/ielts/*` · `types/ielts.ts` · `.env.example`

---

## 1. Proposal — Vì sao cần làm

### 1.1 Vấn đề hiện tại

| Nhánh | Thực trạng | Hệ quả |
|-------|-----------|--------|
| Live STT (Web Speech API / Deepgram WS) trong `AudioRecorder.tsx` | Tự sửa chính tả, xóa filler (`um, uh, erm`), chuẩn hóa ngữ pháp | LLM mất dữ liệu thô để chấm **FC** và **GRA** |
| Prompt `OFFICIAL_IELTS_EXAMINER_PROMPT` | Yêu cầu LLM tự "nghe" fluency qua audio + STT đã làm sạch | Chấm nới tay, band thiếu nhất quán |
| Không có telemetry | Không có WPM, pause, phonation ratio | Không có bằng chứng định lượng cho FC |

### 1.2 Mục tiêu

Thay nguồn transcript dùng để **chấm điểm** từ Browser STT sang pipeline server-side:

```
[Browser MediaRecorder .webm] → [Pre-flight Check] → [Transcode wav 16kHz mono]
→ [Whisper word-level, giữ filler] → [Feature Extraction: WPM, pause, phonation, filler]
→ [Prompt Builder: rubric + Whisper verbatim + telemetry + audio gốc]
→ [Multimodal LLM] → [Score Card FC/LR/GRA/PR]
```

- Live STT **giữ lại** làm feedback UI (preview), không còn là ground truth cho evaluator.
- Audio gốc vẫn gửi cho LLM để chấm **PR** (intonation, stress, phoneme).
- Telemetry là **số cứng** tính từ word timestamps, LLM không tự đoán.

### 1.3 Kết quả kỳ vọng

- Band FC/GRA sát examiner thực tế, triệt tiêu chấm nới tay.
- Có số liệu khách quan (WPM, pause >1.5s, phonation ratio) trong prompt và có thể hiển thị cho học viên.
- Không tốn token cho file lỗi (pre-flight chặn sớm).

### 1.4 Ngoài phạm vi (v1)

Self-host `faster-whisper`, on-device WASM Whisper, Silero VAD native — để dành v2.

---

## 2. Bối cảnh kỹ thuật (đã khảo sát 2026-09-25)

### 2.1 Luồng hiện tại

```
AudioRecorder (MediaRecorder webm/opus + Web Speech desktop / Deepgram WS mobile)
  → POST /api/ielts/upload-audio (R2: {userId}/{attemptId}/{questionId}.webm, 1B–10MB)
  → onAudioRecorded(url, transcript, duration) → state in-memory
  → POST /api/ielts/submit {responses, part2Notes} → pgDb.saveIELTSResponse
     → status='submitted' (chưa chấm)
  → POST /api/ielts/rescore → fetchAllQuestionItems (download R2 → base64)
     → buildUserContent (prompt + STT 80 chars + audio file part) → generateText(Output.object(zod))
     → mapToScoreResult → pgDb.updateIELTSAttemptStatus(score_result)
```

Chi tiết: `lib/ielts/audio-loader.ts`, `lib/ielts/ai-evaluator.ts:buildUserContent`, `lib/ielts/evaluation-guards.ts`, `lib/ielts/evaluation-mapper.ts`, `lib/storage/r2.ts`, `types/ielts.ts`.

### 2.2 Ràng buộc

- Next.js 15 + Vercel functions — không có binary Whisper sẵn.
- Chưa có dep Whisper/ffmpeg (`ai@7`, `@ai-sdk/openai-compatible@3`, `pg`, R2 S3).
- Storage R2 S3-compatible, `audio_storage_path` là canonical.
- DB `ielts_speaking_responses` dạng jsonb — thêm key mới không cần migration DDL.

---

## 3. Technical Spec

### 3.1 Quyết định kiến trúc

| Quyết định | Lựa chọn v1 | Lý do | Thay thế |
|-----------|-------------|-------|----------|
| Whisper provider | API ngoài: OpenAI `whisper-1` hoặc Groq `whisper-large-v3-turbo` (`verbose_json` + `timestamp_granularities: ["word"]`, `temperature=0`, `initial_prompt` giữ filler) | Không cần infra, word timestamps sẵn | Self-host faster-whisper (v2) |
| Transcode | Gửi webm trực tiếp trước (provider chấp nhận webm); chỉ thêm ffmpeg nếu timestamp sai lệch | Gọn bundle Vercel | Bắt buộc wav 16kHz mono |
| VAD / Noise | RMS đơn giản + duration check; chi tiết do Whisper VAD lo | Tránh `onnxruntime-node` native | Silero VAD |
| Telemetry | Tính server-side từ `words[].start/end` | Không để LLM đoán | LLM tự đếm pause |

Env mới:

```env
WHISPER_API_KEY=
WHISPER_ENDPOINT=https://api.openai.com/v1   # hoặc https://api.groq.com/openai/v1
WHISPER_MODEL=whisper-1                      # hoặc whisper-large-v3-turbo
```

### 3.2 Schema & types

Mở rộng `IELTSSpeakingResponse` trong `types/ielts.ts`:

```ts
whisper_transcript?: string;
whisper_words?: Array<{ word: string; start: number; end: number }>;
whisper_metrics?: {
  wpm: number;
  phonation_ratio: number;
  pause_count: number;
  longest_pause_s: number;
  filler_count: number;
  filler_freq: Record<string, number>;
  mid_clause_pause_count?: number;
};
whisper_status?: 'pending' | 'done' | 'failed';
whisper_version?: string;
```

Không cần `ALTER TABLE` — jsonb chấp nhận key mới. Thêm helper `pgDb.updateWhisperResult` để không overwrite `audio_url`.

### 3.3 Module mới

#### `lib/ielts/whisper-client.ts`

Nhận `Buffer` + `mimeType` + `filename`, build `FormData` (`file`, `model`, `response_format=verbose_json`, `temperature=0`, `timestamp_granularities[]=word`, `initial_prompt="Um, uh, well, you know, actually... I think, erm..."`). Xử lý `WHISPER_ENDPOINT` cả dạng `.../v1` và `.../v1/audio/transcriptions`; retry 2, timeout 60s. Trả về `{ text, words, duration }`. Trừu tượng để đổi OpenAI/Groq chỉ bằng env.

#### `lib/ielts/audio-preflight.ts`

Input `Buffer` + `duration_seconds` + `size`. Check `size==0 || >10MB`, `duration < 1s` → 422; RMS sơ bộ (`< -30 dBFS` hoặc silence >50% → cảnh báo). Không cắt silence ở v1; chỉ trả `{ ok, reason }`.

#### `lib/ielts/telemetry.ts`

Từ `words` + `totalDuration`:

- `phonationTime = sum(word.end - word.start)`
- `WPM = words.length / phonationTime * 60`
- `pauses = words[i+1].start - words[i].end`; `pause_count = gaps > 1.5s`, `longest_pause = max(gaps)`
- `phonation_ratio = phonationTime / totalDuration` (lý tưởng 70–85%)
- `filler_freq` đếm `um, uh, erm, ah, like, you know, well, actually`
- `mid_clause_pause_count`: pause mà từ trước không kết thúc bằng `.!?`

#### `app/api/ielts/transcribe/route.ts`

```
POST { attemptId, questionId }
  auth + ownership → resolve storagePath → downloadAudioBuffer
  → preflight → whisper-client → telemetry → pgDb.updateWhisperResult
  → { success, transcript, words, metrics }
```

`maxDuration = 60`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. 422 cho pre-flight fail, idempotent theo `audio_storage_path`.

### 3.4 Orchestration — khi nào chạy transcription

1. **Eager (mặc định):** Ngay sau `upload-audio` success, client `POST /api/ielts/transcribe` per question, chạy nền, UI badge "Transcribing...".
2. **Lazy (fallback):** `POST /api/ielts/submit` và `POST /api/ielts/rescore` kiểm tra `whisper_transcript` thiếu → chạy pipeline inline (`Promise.all`, concurrency 3) trước khi build LLM prompt. `submit` vẫn ack nhanh; chỉ `rescore` block chờ whisper.

### 3.5 Làm giàu prompt evaluator

- `lib/ielts/audio-loader.ts`: thêm `whisper_*` vào `QuestionItem`.
- `lib/ielts/ai-evaluator.ts:buildUserContent` — thay dòng STT đơn bằng block:

```
[Question ID: p1-q1 | Part 1]  Prompt: "…"
Duration: 42s (phonation 31s)
Whisper verbatim (fillers preserved): "Well um I think uh …"
Telemetry: WPM=132 | pauses>1.5s: 3 (longest 2.4s) | phonation_ratio 74% | fillers: um×2, uh×1
(Browser live STT, reference only, may be cleaned): "I think …"
```

Thêm chỉ dẫn đầu prompt: "Use Whisper verbatim + telemetry as ground truth for FC/GRA. Do NOT infer fluency from cleaned browser STT."

- `lib/ielts/prompts/examiner.ts` — thêm section:

```
TELEMETRY (computed from Whisper word timestamps, do NOT recompute):
- Use WPM, pause counts, phonation ratio, filler frequency as evidence for FC.
- Mid-clause pauses and filler bursts penalize FC more than end-of-sentence pauses.
```

### 3.6 Frontend

- `components/ielts/AudioRecorder.tsx`: giữ live STT nhưng đổi label "Live preview (may be cleaned)"; sau upload gọi `transcribe` nền; 422 → inline warning; success → collapsible "Whisper verbatim".
- Test page `app/ielts-speaking/test/[attemptId]/page.tsx`: thêm `whisper_status` per question; nút Submit luôn enabled — lazy path lo phần thiếu.
- i18n: thêm key `ielts.audioRecorder.transcribing`, `preflight.silent`, `preflight.noise`.

### 3.7 Sơ đồ pipeline hoàn chỉnh

```
[Browser: MediaRecorder .webm]
        ↓
[Pre-flight Check] ──(mic lỗi / >50% silence / < -30dBFS)──► Báo lỗi, không bill Whisper
        ↓ (hợp lệ)
[Whisper STT word-level, temp=0, initial_prompt filler] ──► [Feature Extraction]
        │                                                      WPM, pause>1.5s, phonation ratio, filler freq
        │ (transcript verbatim)                                │
        └──────────────────────┬───────────────────────────────┘
                               ↓
              [Prompt Builder: rubric + transcript + metrics + audio file]
                               ↓
              [Multimodal LLM (Gemini Flash / GPT via AI_ENDPOINT)]
                               ↓
              [Score Card: FC, LR, GRA, PR + per-question feedback]
```

### 3.8 Env & deploy

Không thêm native binary ở v1; nếu cần wav thì cân nhắc `ffmpeg-static` hoặc chấp nhận webm.

---

## 4. Phương án đã cân nhắc (không chọn v1)

- **faster-whisper / whisper.cpp WASM on-device:** bundle 30–80 MB, cold start nặng.
- **Self-host faster-whisper service:** kiểm soát tốt nhất nhưng thêm infra — phù hợp v2.
- **Silero VAD Node (`onnxruntime-node`):** VAD chính xác nhưng native addon dễ gãy trên Vercel.

---

## 5. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|--------|-----------|
| Whisper hallucination trên silence | `temperature=0`, pre-flight chặn silence |
| webm non-seekable, thiếu duration | Dùng `duration_seconds` client đã đo |
| Cost (~$0.006/phút OpenAI) | ~5 phút/attempt ≈ cents; cap concurrency, skip re-transcribe nếu `audio_storage_path` không đổi |
| Latency rescore | Eager song song + lazy `Promise.all` (concurrency 3) |
| Vercel limits | `transcribe 60s`, `rescore 300s` |

---

## 6. Kế hoạch thực thi (thứ tự)

1. Types + `whisper-client` + `telemetry` (test được với fixture JSON, chưa cần UI).
2. `audio-preflight` + `POST /api/ielts/transcribe` + `pgDb.updateWhisperResult`.
3. Nối eager trigger từ test page + trạng thái UI AudioRecorder.
4. Làm giàu `audio-loader` + `ai-evaluator` + `examiner.ts` prompt.
5. Lazy fallback trong `submit`/`rescore` + i18n + `.env.example`.
6. Verify: `npx tsc --noEmit` + `npm run build` + E2E thủ công.

---

## 7. Tiêu chí nghiệm thu

- [ ] `npx tsc --noEmit` pass.
- [ ] `npm run build` không tăng bundle do ffmpeg/onnx.
- [ ] E2E với `GET /api/auth/login?mock=true`:
  - Ghi câu có filler "um, uh, well..." → `/transcribe` trả verbatim giữ `um/uh` + metrics.
  - Submit → rescore → `responses[qId].whisper_*` có đủ, `criterion_feedback.fluency` có nhắc filler/pause.
  - Ghi im lặng (mute mic / tap 2s) → pre-flight 422, không gọi Whisper.
  - Ghi lại cùng câu hỏi → whisper result ghi đè, metrics mới.
- [ ] Log `[AI Evaluator] Sending request...` chứa block telemetry + whisper transcript.
- [ ] `curl POST /api/ielts/transcribe` kiểm tra 401/404 và idempotency.

---

## 8. File thay đổi

- **Sửa:** `types/ielts.ts`, `lib/db/postgres.ts`, `lib/ielts/audio-loader.ts`, `lib/ielts/ai-evaluator.ts`, `lib/ielts/prompts/examiner.ts`, `components/ielts/AudioRecorder.tsx`, `app/ielts-speaking/test/[attemptId]/page.tsx`, `.env.example`, `lib/i18n/*`.
- **Tạo mới:** `lib/ielts/whisper-client.ts`, `lib/ielts/audio-preflight.ts`, `lib/ielts/telemetry.ts`, `app/api/ielts/transcribe/route.ts`.
- **Không đụng v1:** `lib/db/postgres.ts:ensureDbInitialized` DDL, `db/schema.sql`, `lib/storage/r2.ts`.

---

## 9. Phụ lục: Telemetry spec

| Chỉ số | Công thức từ word timestamps | Ý nghĩa IELTS |
|--------|------------------------------|---------------|
| Speech Rate (WPM) | `words.length / phonationTime * 60` | 110–140 ≈ Band 6–7; <90 quá chậm |
| Pause Count & Duration | gaps `words[i+1].start - words[i].end > 1.5s` | Phân biệt ngập ngừng tìm từ (mid-clause) vs ngắt câu tự nhiên |
| Phonation Ratio | `phonationTime / totalDuration` | Fluency tổng thể; lý tưởng 70–85% |
| Repetition / Fillers | đếm `um, uh, erm, ah, like, you know…` | Bằng chứng trực tiếp cho FC |
