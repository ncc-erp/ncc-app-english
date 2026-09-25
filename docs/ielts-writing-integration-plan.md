# Phương án tích hợp ielts-marking-skill — AI Agent tự chấm Writing

> Đính chính: skill trong `docs/ielts-marking-skill/` tuy ghi "không phải máy tự chấm" trong tài liệu gốc (MANIFEST `auto_grading: false` — để tránh hiểu nhầm gói portable tự thay giáo viên), nhưng **mục đích tích hợp vào ncc-app-english là để AI Agent tự chấm** — tương tự `lib/ielts/ai-evaluator.ts` đang tự chấm Speaking. Tài liệu skill chính là **spec + rubric + validator** cho AI làm theo.

## 1. Bản chất skill khi dùng cho AI

| Thành phần | Vai trò với AI |
|---|---|
| `TEMPLATE_SPEC.md` + `CURRENT_UPDATE.md` | Quy định bố cục 12 trang Dual / 6-8 trang Single, thứ tự trang, typography SF Pro + Didot Italic, 4 màu highlight, heading `#D51F18`, PDF ≤6MB trần 8MB |
| `SCORING_INPUTS.md` + `scoring_inputs/sl_ielts_2026_09_14/SCORING_POLICY.md` | 2 đầu vào bắt buộc AI phải tuân: (1) IELTS Public Band Descriptors (May 2023), (2) corpus SL — 55 DOCX + `corpus.json` 30MB + `decision_anchors.json` + `inventory.json` |
| `scoring_inputs/sl_ielts_2026_09_14/official/ielts-writing-band-descriptors-user-supplied.pdf` + `official/source.json` | Source of truth cho band — AI phải trích `quote` trong bài gốc làm bằng chứng, nêu `strength_vi / limitation_vi / why_band_vi / why_not_next_vi` cho từng tiêu chí |
| `standard.py` | Validator duy nhất: `half_down`, `criterion_keys`, `task_score`, `score_summary` (Task=(TA/TR+CC+LR+GRA)/4, Dual=(T1+2*T2)/3, floor 0.5), `page_plan`, `vocabulary_stats`, `validate_review`, `validate_coverage` |
| `components.py` + `highlight_policy.py` + `learning_extension.py` + `theme.css` | Renderer HTML → PDF: `vocabulary_panel` (mỗi CEFR 1 thanh ngang, chung thang 0-100%, màu LEVEL_COLORS cố định), `score_panel`, `correction_card` (`! đỏ → giải thích VI`), `learning_page_body`/`exercise_page_body` |
| `pdf_export.py` + `review_input.blank.json` | Xuất PDF vector searchable + schema input JSON cho AI điền |

AI phải **không** suy band từ số lỗi/tỷ lệ C1-C2/số từ nối, không sao điểm Kiên 7/7/7/8 sang học viên khác, không tự bịa hạn chế, giữ nguyên điểm lẻ/khoảng/ô trống của SL.

## 2. Đối chiếu với Speaking hiện tại

```
Speaking:  AudioRecorder → R2 → POST /api/ielts/submit (lưu) → POST /api/ielts/rescore
           → lib/ielts/ai-evaluator.ts (fetchAllQuestionItems + audioBase64)
           → OFFICIAL_IELTS_EXAMINER_PROMPT + ieltsEvaluationZodSchema → mapToScoreResult → score_result JSONB

Writing:   TextEditor (+ ảnh đề/biểu đồ) → R2 → POST /api/writing/submit (lưu) → POST /api/writing/evaluate
           → lib/writing/ai-evaluator.ts (load prompt + paragraphs + scoring anchors)
           → WRITING_EXAMINER_PROMPT (port từ SCORING_POLICY + descriptors) + writingEvaluationZodSchema
           → validate_review() → score_summary → payload JSONB + render 12 trang
```

Tái dùng: `getSession()` 401 guard, `pgDb` + `ensureDbInitialized()`, R2 `uploadAudio`/`download*`/`createSignedUrl`, `getIeltsModel()` (AI_API_KEY/AI_ENDPOINT/AI_MODEL, `maxDuration 60`), Vercel AI SDK `generateText` + `Output.object(zodSchema)`.

Khác biệt: Writing không có audio, transcript là `original_paragraphs` nguyên văn; AI phải tự sinh `source_segments`, `corrections[]`, `vocabulary[]`, `learning_extension`, `models[]` — khối lượng output lớn hơn Speaking (~8k tokens → cần 12-16k).

## 3. Kiến trúc đề xuất (port TS, không spawn Python trên Vercel)

```
lib/writing/
├── standard.ts              # port từ standard.py (~313 dòng, thuần logic)
├── highlight-policy.ts      # port từ highlight_policy.py
├── learning-extension.ts    # port từ learning_extension.py
├── components.ts            # port từ components.py (escape HTML, vocabulary_panel…)
├── pdf-export.ts            # port từ pdf_export.py (pdf-lib, check_size 6/8 MB)
├── prompts/
│   └── writing-examiner.ts  # system prompt: SCORING_POLICY + descriptors + decision anchors tóm tắt
├── schemas/
│   └── evaluation-zod-schema.ts  # zod mirror của review_input.blank.json
├── ai-model.ts              # reuse getIeltsModel() hoặc tách getWritingModel()
├── ai-evaluator.ts          # evaluateWritingAttemptWithAI()
└── evaluation-mapper.ts     # map AI output → payload chuẩn validate_review

app/api/writing/
├── submit/route.ts          # POST {task1:{prompt, paragraphs}, task2:{…}, images?} → draft
├── evaluate/route.ts        # POST {reviewId} → gọi AI, validate, lưu payload + score_summary
├── render/route.ts          # GET ?id= → HTML 12 trang (components.document)
└── export/route.ts          # POST {reviewId} → PDF (pdf-lib), upload R2, trả pdf_url

app/(writing)/ielts-writing/
├── page.tsx                 # list reviews
├── submit/page.tsx          # form nộp bài (2 Task, đếm từ, upload ảnh đề)
├── result/[id]/page.tsx     # dashboard + 4 tiêu chí/Task + corrections + vocab matrix + exercises + models
└── report/[id]/page.tsx     # preview 12 trang + nút Export PDF

types/writing.ts             # WritingReview, WritingTaskPayload, WritingScoreSummary…
public/fonts/EBGaramond-*.ttf # copy từ skill assets/fonts/
```

DB — thêm vào `lib/db/postgres.ts` `ensureDbInitialized()` (không sửa `db/schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS ielts_writing_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | evaluating | reviewed | exported
  payload JSONB NOT NULL,               -- full review_input (student, review_date, tasks, vocabulary, learning_extension…)
  score_summary JSONB,                   -- {task1:{raw,overall}, task2:{…}, dual:{…}}
  pdf_url TEXT,
  pdf_storage_path TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_writing_reviews_user ON ielts_writing_reviews(user_id);
```

R2: `writing/{reviewId}/prompt-image.png`, `writing/{reviewId}/report.pdf`.

## 4. AI Evaluator — chi tiết

### 4.1 Prompt (`lib/writing/prompts/writing-examiner.ts`)

Tương tự `OFFICIAL_IELTS_EXAMINER_PROMPT`, nhưng nguồn là Writing:

- Role: `You are a certified senior IELTS Writing Examiner (Steven Lee standard, 14/09/2026).`
- Nhúng tóm tắt `SCORING_POLICY.md` §1-4: 2 nguồn bắt buộc, không phối trộn 50/50, giữ nguyên điểm lẻ/khoảng SL, không suy band từ đếm lỗi.
- Nhúng `official/source.json` (descriptors text theo trang: Task1 band 9/8/7 tr.3, 6/5 tr.4, 4-0 tr.5; Task2 tương ứng tr.7-9).
- Nhúng `decision_anchors.json` rút gọn (top 10-15 anchors theo Task/dạng đề) — hoặc RAG: indexer `corpus.json` 30MB không nhúng hết, chỉ chọn 3-5 SL cases tương đồng nhất theo prompt embedding.
- Quy tắc output: 4 tiêu chí Task1=TA/CC/LR/GRA, Task2=TR/CC/LR/GRA, band nguyên 0-9, mỗi tiêu chí bắt buộc `quote` (phải xuất hiện nguyên văn trong `original_paragraphs`), `strength_vi/limitation_vi/why_band_vi/why_not_next_vi` tiếng Việt, `corrections[]` với `error_spans` xuất hiện đúng 1 lần + `criteria` + `references` cho LR/GRA, `vocabulary[]` với `level_basis` + `quote`, `learning_extension` (2-3 priorities, structure_bank ≥2, exercises ≥2 MCQ + ≥2 open).

### 4.2 Zod schema (`lib/writing/schemas/evaluation-zod-schema.ts`)

Mirror `review_input.blank.json`:

```ts
writingEvaluationZodSchema = z.object({
  student: z.object({ name: z.string(), class: z.string() }),
  review_date: z.string(), // ISO date
  pages: z.number().int().min(6).max(12),
  quick_comments: z.array(z.string()).length(4),
  tasks: z.object({
    "1": writingTaskSchema, // prompt, prompt_summary, original_paragraphs, criteria{TA,CC,LR,GRA}, source_segments, corrections, models[1], fastest_boost_vi, roadmap_vi
    "2": writingTaskSchema, // TR thay TA
  }).partial(), // 1 hoặc 2 task
  vocabulary: z.array(vocabItemSchema), // term, level A1-C2, task 1|2, quote, level_basis
  learning_extension: learningExtensionSchema, // selfcheck_pt 7.5-8, priorities 2-3, structure_bank ≥2, exercises ≥2 MCQ+≥2 open
});
```

Kế thừa `ieltsEvaluationZodSchema` pattern: `Output.object(schema)` trong `generateText`.

### 4.3 Evaluator (`lib/writing/ai-evaluator.ts`)

```ts
export async function evaluateWritingAttemptWithAI(reviewId: string): Promise<WritingPayload | null> {
  const review = await pgDb.getWritingReview(reviewId);
  const userContent = buildWritingUserContent(review); // prompt + original_paragraphs + ảnh đề (nếu có, dạng file part)
  const { output } = await generateText({
    model: getIeltsModel().model, // reuse AI_API_KEY/ENDPOINT/MODEL, hoặc WHISPER_* tách riêng
    output: Output.object({ schema: writingEvaluationZodSchema }),
    system: WRITING_EXAMINER_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxOutputTokens: 16384, // lớn hơn Speaking (8192) do corrections + vocab + exercises
    maxRetries: 2,
  });
  const mapped = mapToWritingPayload(output, review);
  const validation = validateReview(mapped); // port standard.py
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  return mapped;
}
```

Tái dùng `callAIWithRetry` + `TIMEOUT_MS 300s` + `filterOversizedImage` (tương tự `filterOversizedAudio` 3MB) cho ảnh đề.

### 4.4 Mapper (`lib/writing/evaluation-mapper.ts`)

- `clampBand`, `criterionKeys(task)` giữ nguyên `standard.ts`.
- Tính `score_summary = scoreSummary(t1Scores, t2Scores)` để fill `payload.score_summary` (không để AI tự tính Dual).
- `wordSimilarity`/`match` không cần (Writing không có STT vs AI transcript).

## 5. Luồng end-to-end

1. Học viên `POST /api/writing/submit` (auth `getSession()`) với `original_paragraphs` + `prompt` + ảnh đề (upload R2) → `pgDb.saveWritingReview({status:'submitted', payload: draft})`.
2. `POST /api/writing/evaluate` (auth + ownership, `maxDuration 60` hoặc 300 nếu output dài) → `evaluateWritingAttemptWithAI` → `validateReview` → `pgDb.updateWritingReview(id, {payload, score_summary, status:'reviewed'})`. Fail → `status:'error'` + `error` message, cho phép Re-evaluate.
3. `GET /api/writing/render?id=` → `components.document(pages, 'theme.css')` + subset Didot nếu có `IELTS_DIDOT_ITALIC`, thiếu thì fallback EB Garamond + warning.
4. `POST /api/writing/export` → `pdf-lib` render 12 `article.page`, `compress_content_streams`, `checkSize()` ≤8MB, upload R2, `pdf_url`.
5. Frontend `result/[id]/page.tsx` hiển thị dashboard (score badges, `score_formula`, CEFR matrix, `quick_comments`), trang 2 criterion evidence, corrections, learning pages, models — tái dùng layout `ielts-speaking/result/[id]/details`.

## 6. Xử lý corpus lớn (30MB)

Không bundle `corpus.json` vào Vercel function. Hai lựa chọn:

- **A. Tóm tắt anchors (MVP):** Chỉ nhúng `decision_anchors.json` (139KB) + `decision_audit.md` (28KB) + `official/source.json` (26KB) vào prompt (~40KB context). Đủ để AI tuân thủ mà không vượt token.
- **B. RAG (nâng cao):** Index `corpus.json` vào vector DB (pgvector trong chính Postgres), khi evaluate thì retrieval top 3-5 SL cases tương đồng prompt/dạng đề → nhúng vào `userContent`. Chi phí thêm nhưng chính xác hơn.

Khuyến nghị: **A cho v1**, B khi cần tăng độ chính xác so sánh SL.

## 7. Lộ trình

| Tuần | Việc | Gate |
|---|---|---|
| 1 | Port `standard.py` + `highlight_policy.py` + `learning_extension.py` → `lib/writing/*.ts`, `npx tsc --noEmit` pass, thêm bảng `ielts_writing_reviews`, `POST /api/writing/submit` draft | tsc pass |
| 2 | `schemas/evaluation-zod-schema.ts` + `prompts/writing-examiner.ts` + `ai-evaluator.ts` + `POST /api/writing/evaluate` (reuse getIeltsModel) | Evaluate 1 bài Dual mẫu, `validateReview` pass |
| 3 | `components.ts` + `pdf-export.ts` + `GET /api/writing/render` + `POST /api/writing/export` + UI `result/[id]` | Render HTML 12 trang đúng spec, PDF ≤6MB |
| 4 | RAG anchors (optional), phân quyền teacher/student, import `review_input.blank.json`, visual checklist `validateCoverage` | E2E: submit → evaluate → render → export |

## 8. Rủi ro & lưu ý

- **Token/output lớn:** Writing sinh nhiều hơn Speaking (corrections + vocab + exercises). Đặt `maxOutputTokens 16384`, `maxDuration 300` cho `/evaluate` (như `/rescore` Speaking đã 300).
- **Corpus privacy:** `corpus.json` chứa dữ liệu học viên — không public, không bundle client, chỉ server-side RAG.
- **Font licensing:** SF Pro/Didot không commit. Thiếu thì báo rõ, fallback EB Garamond.
- **Không sao dữ liệu Kiên:** `example_kien/` (7/7/7/8, Writing 5.5) là tham chiếu riêng — prompt phải cấm copy sang học viên khác.
- **IF NOT EXISTS:** Sửa cột sau cần `ALTER` thủ công (như CLAUDE.md cảnh báo).
- **Song song Speaking Whisper pipeline (`docs/speaking-improvement.md`):** 2 pipeline tách biệt — Speaking = Whisper+telemetry+LLM audio, Writing = text+anchors+LLM. Không trộn prompt.
