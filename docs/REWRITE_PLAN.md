# Kế hoạch viết lại ncc-app-english (v2)

> **Trạng thái:** Draft để bàn · 2026-09-25 · Owner: Duong
> **Hướng đã chốt:** Repo mới, port dần từng module · Giữ Next.js + Postgres · Deploy VPS Docker + Traefik
> **Nguồn khảo sát:** code hiện tại (`lib/`, `app/`, `components/`, `docs/`, `CLAUDE.md`)

---

## 1. Vì sao viết lại

App hiện tại chạy được và đã có user, nhưng các vấn đề dưới đây nằm ở cấu trúc — sửa từng chỗ sẽ chậm hơn dựng lại nền.

| #  | Vấn đề                                                                                                                                                                                                                                                                                              | Bằng chứng trong code                                                                    | Hệ quả                                                                                |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1  | **Không có migration** — schema tự tạo bằng `CREATE TABLE IF NOT EXISTS` + `ALTER ... IF NOT EXISTS` trong `ensureDbInitialized()`, gọi ở *mọi* query                                                                                                                           | `lib/db/postgres.ts`; `db/schema.sql` chỉ là bản copy lệch                         | Không biết prod đang ở schema nào; đổi kiểu cột phải ALTER tay                |
| 2  | **God object `pgDb`** ~1.100 dòng, trộn exam / speaking / admin / stats                                                                                                                                                                                                                      | `lib/db/postgres.ts`                                                                     | Khó test, khó thêm Writing                                                           |
| 3  | **ID người dùng mập mờ** — `attempts.user_id` là TEXT, không FK; ownership check phải so cả `user_id` lẫn `mezon_id`                                                                                                                                                            | `rescore/route.ts`, `membership/verify/route.ts`                                       | Lỗ hổng phân quyền tiềm ẩn, dữ liệu mồ côi                                    |
| 4  | **Chấm AI đồng bộ trong HTTP request** (tới 300s), trang kết quả tự gọi `/rescore`, dedupe bằng `Map` in-memory                                                                                                                                                                    | `app/api/ielts/rescore/route.ts`                                                         | Mất kết quả khi restart/timeout; nhiều instance là chấm trùng; không retry nền |
| 5  | **Bot + scheduler chạy chung process Next.js** qua `instrumentation.ts`                                                                                                                                                                                                                       | `instrumentation.ts`, `lib/bot/bot-service.ts`, `lib/scheduler.ts`                   | Bot websocket reconnect ảnh hưởng web; scale web = nhân đôi bot                   |
| 6  | **Tắt hết hàng rào chất lượng** — `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`, không có test                                                                                                                                                           | `next.config.mjs`, `CLAUDE.md`                                                         | Lỗi type lọt lên prod                                                                |
| 7  | **Toàn bộ page là `'use client'`**, page 20–35 KB                                                                                                                                                                                                                                          | `app/admin/topics/page.tsx` (34 KB), `app/page.tsx`, `AudioRecorder.tsx` (850 dòng) | Bundle nặng, logic nghiệp vụ lẫn UI                                                 |
| 8  | **Cấu hình & bí mật** — secret mặc định hardcode (`SESSION_SECRET`, DB password `123qwer`), bot token thật nằm trong `.env.example`, clan/channel ID hardcode trong `scheduler.ts`                                                                                             | `lib/auth/session.ts`, `lib/db/postgres.ts`, `.env.example`, `lib/scheduler.ts`    | Rủi ro bảo mật; quên set env vẫn chạy "được"                                   |
| 9  | **Build phụ thuộc máy dev** — `"mezon-english-exam-app": "file:../mezon-app-sample"`, `postinstall` patch thẳng `node_modules/@ai-sdk/openai-compatible`                                                                                                                              | `package.json`, `scripts/patch-openai-compatible-audio.cjs`                            | CI/Docker build dễ vỡ; nâng version AI SDK là mất patch                            |
| 10 | **Code chết & tài liệu lệch** — `lib/supabase/storage.ts` (shim), `scripts/migrate-supabase-to-r2.ts`; `ARCHITECTURE.md`/`PRD.md` mô tả Supabase; `CLAUDE.md` còn nhắc mock-db (đã không còn), SSE + `repairTruncatedJson` (đã chuyển sang AI SDK `Output.object`) | nhiều nơi                                                                                | Người mới (và AI agent) đọc sai                                                   |
| 11 | **Scheduler theo giờ server** — `setHours(20)` chạy theo TZ container (UTC) → 03:00 giờ VN                                                                                                                                                                                                | `lib/scheduler.ts`                                                                       | Nhắc việc sai giờ (cần xác nhận TZ container)                                     |
| 12 | **Cookie `SameSite=lax`** trong khi app chạy trong iframe Mezon                                                                                                                                                                                                                               | `lib/auth/session.ts`                                                                    | Cần kiểm tra — iframe cross-site thường cần`SameSite=None; Secure`              |

**Việc nên làm ngay, không chờ rewrite:** rotate `MEZON_BOT_TOKEN` (đang nằm trong `.env.example` đã commit) và xóa khỏi file mẫu.

## 2. Mục tiêu & ngoài phạm vi

**Mục tiêu**

- Parity 100% tính năng đang chạy (xem Phụ lục A), không mất dữ liệu user/attempt/audio.
- Nền sẵn cho IELTS Writing và Whisper pipeline mà không phải vá thêm.
- Chấm điểm AI chạy nền, idempotent, retry được, có audit (model, prompt version, latency, token).
- Build xanh = đúng: typecheck + lint + test bắt buộc trong CI.
- Tách rõ 3 tiến trình: web, worker, bot.

**Ngoài phạm vi v2.0**

- Đổi UI/UX lớn (giữ flow hiện tại, chỉ dọn component).
- Leaderboard, share report card, PDF export (Phase 3 của PRD — làm sau cutover).
- Self-host Whisper.

## 3. Kiến trúc đích

### 3.1 Tổng quan

```
                    Traefik (english.mrdnd.dev)
                              │
                   ┌──────────▼──────────┐
                   │  web  (Next.js 15)  │  RSC + route handlers, không chạy AI dài
                   └───┬────────────┬────┘
        enqueue job    │            │  internal HTTP (membership, admin check)
                       ▼            ▼
   ┌───────────────┐  Postgres  ┌───────────────┐
   │ worker        │◄──(pg-boss)─►│ bot           │  Mezon websocket, lệnh chat,
   │ scoring, STT, │            │ (mezon-sdk)   │  gửi thông báo, cron nhắc việc
   │ notify, cron  │            └───────────────┘
   └──────┬────────┘
          ▼
   LLM proxy / Whisper API / R2
```

- **Một image, ba lệnh chạy** (`web`, `worker`, `bot`) trong cùng `docker-compose` — đơn giản hơn 3 image, vẫn tách process.
- **Queue: pg-boss** (chạy trên Postgres sẵn có, không cần Redis). Job: `speaking.transcribe`, `speaking.score`, `writing.score`, `notify.result`, `cron.daily-summary`.
- **Bot chỉ giữ kết nối Mezon**; web hỏi bot qua HTTP nội bộ (`internal_network`, shared secret) cho membership/admin check; thông báo đi qua queue.

### 3.2 Cấu trúc repo (pnpm workspace + Turborepo)

```
ncc-english/
├── apps/
│   ├── web/            # Next.js: pages, route handlers mỏng
│   ├── worker/         # pg-boss consumers + cron
│   └── bot/            # Mezon client, lệnh *result/*history/*testing, internal HTTP
├── packages/
│   ├── db/             # Drizzle schema, migrations, repositories theo domain
│   ├── core/           # nghiệp vụ thuần: CEFR, band calc, gating, telemetry — có unit test
│   ├── ai/             # provider abstraction, prompts có version, zod schemas, evaluators
│   ├── mezon/          # OAuth, WebAppData hash verify, SDK wrapper (thay sdk-patch)
│   ├── storage/        # R2 client, presigned upload
│   ├── config/         # env schema (zod) — thiếu biến là fail ngay lúc boot
│   └── ui/             # shadcn/ui components dùng chung
└── tooling/            # eslint, tsconfig, prettier dùng chung
```

Quy tắc phụ thuộc: `apps/*` → `packages/*`; `core` không import `db`/`ai`/Next; route handler chỉ validate input → gọi service → trả response.

### 3.3 Lựa chọn công nghệ

| Mảng            | Hiện tại                    | v2                                                                               | Lý do                                               |
| ---------------- | ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| ORM / migration  | raw`pg` + DDL tự chạy     | **Drizzle + drizzle-kit**                                                  | Type-safe, SQL-gần-gũi, migration file rõ ràng   |
| Queue            | không có                    | **pg-boss**                                                                | Dùng Postgres sẵn có, retry/backoff/singleton key |
| Validate         | thủ công                    | **zod** cho input route, env, AI output                                    | Một nguồn schema                                   |
| Auth             | iron-session                  | **giữ iron-session**, thêm `withAuth()`/`withAdmin()` wrapper        | Đã chạy tốt, chỉ cần chuẩn hóa               |
| Data fetching FE | `fetch` trong `useEffect` | **RSC cho đọc**, TanStack Query cho polling/mutation                     | Ít JS, trạng thái chấm điểm rõ ràng          |
| i18n             | context tự viết             | **next-intl**                                                              | Chuẩn, hỗ trợ RSC                                 |
| AI               | `ai@7` + patch node_modules | **`ai` SDK**, viết custom provider/adapter thay vì patch               | Bỏ`postinstall` hack                              |
| Log              | `console.log` dày đặc    | **pino** JSON + request id                                                 | Grep được trên VPS                               |
| Test             | không có                    | **Vitest** (core, api), **Playwright** (E2E, mock login)             |                                                      |
| CI               | script build tay              | GitHub Actions: typecheck → lint → test → build → push`registry.mrdnd.dev` |                                                      |

### 3.4 Mô hình dữ liệu v2

Nguyên tắc: `users.id` (UUID) là khóa duy nhất cho mọi FK; `mezon_id` chỉ là thuộc tính. Status dùng enum. Mọi thay đổi qua migration.

```
users (id uuid PK, mezon_id unique, username, display_name, avatar_url, role, clan_member, clan_checked_at, ...)

assessment_attempts            -- bảng chung cho mọi loại bài
  id, user_id FK, kind ('mcq' | 'speaking' | 'writing'),
  status ('in_progress' | 'submitted' | 'cancelled'),
  scoring_status ('pending' | 'processing' | 'done' | 'failed'),
  overall_score numeric, level text, unlocked bool, unlocked_at,
  started_at, submitted_at, legacy_id text   -- map về ID cũ khi migrate

mcq_questions, mcq_answers(attempt_id FK, question_id FK, ...)
speaking_topics, speaking_responses(attempt_id FK, question_id, part, audio_key,
    live_transcript, duration_s, whisper_transcript, whisper_words jsonb, telemetry jsonb, stt_status)
speaking_details(attempt_id PK/FK, topic_id FK, part2_notes)
writing_topics, writing_submissions(attempt_id FK, task, text, word_count)

ai_evaluations                  -- audit mọi lần chấm
  id, attempt_id FK, kind, model, prompt_version, input_hash,
  status, latency_ms, input_tokens, output_tokens, raw_output jsonb, error, created_at
  -- kết quả "hiện hành" = bản done mới nhất; rescore = thêm dòng mới, không ghi đè

clan_membership_cache, launch_tokens (giữ nguyên ý nghĩa)
```

Lợi ích: gating unlock (`/membership/verify`) viết **một lần** cho mọi `kind` thay vì đoán loại qua prefix `ielts-att-`; Writing chỉ thêm bảng chi tiết; lịch sử chấm lại giữ nguyên để so prompt.

> Lưu ý: `docs/whisper-pipeline.md` cho rằng responses là jsonb nên "không cần migration" — thực tế đang là bảng `ielts_speaking_responses`, nên các cột whisper cần migration. v2 đã đưa vào schema ở trên.

### 3.5 Luồng chấm Speaking v2

```
Browser ghi âm ──presigned PUT──► R2
   │  POST /api/speaking/responses (audio_key, duration, live_transcript)
   │        └─ enqueue speaking.transcribe (eager, per câu)
   │  POST /api/speaking/attempts/:id/submit  → status=submitted, scoring_status=pending
   │        └─ enqueue speaking.score (singletonKey = attemptId)
   ▼
worker: đợi đủ transcript (thiếu thì tự transcribe) → gọi LLM → validate zod
        → ghi ai_evaluations + cập nhật attempt → enqueue notify.result
   ▼
Trang kết quả: RSC render nếu done; nếu pending → poll GET /status (hoặc SSE)
```

- Nút "chấm lại" = enqueue job mới, không block request.
- Trang kết quả **không bao giờ** kích hoạt chấm.
- Giữ nguyên nguyên tắc hiện tại: không có điểm fallback rule-based; band 0 khi không có tiếng nói.

### 3.6 Bảo mật & cấu hình

- `packages/config`: zod schema cho env, không có default cho secret; thiếu là crash lúc boot.
- Admin: role trong DB + xác minh clan admin qua bot (giữ nguyên nguyên tắc "không cache quyền lâu"), gói trong `withAdmin()`.
- Cookie session: đánh giá `SameSite=None; Secure; Partitioned` cho iframe Mezon.
- Rate limit các route tốn tiền (submit, rescore, upload) theo user.
- Answer key & scoring MCQ vẫn server-only (giữ nguyên quy tắc hiện tại).

### 3.7 Job queue: retry và rerun

Mọi việc chậm (STT, chấm AI, thông báo) chạy qua pg-boss với retry có backoff; hết retry thì vào dead letter và có thể rerun bằng tay hoặc hàng loạt.

**Chính sách theo loại job**

| Job                     | Timeout | Retry | Backoff            | Khóa chống trùng                       | Hết retry thì                                                                                             |
| ----------------------- | ------- | ----- | ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `speaking.transcribe` | 90s     | 3     | mũ, từ 10s       | `attemptId:questionId:audioKey`         | `stt_status=failed`; job chấm vẫn chạy bằng audio + live STT, gắn cờ `transcript_source=live_stt` |
| `speaking.score`      | 300s    | 3     | mũ, từ 30s       | `attemptId` (1 job đang chạy/attempt) | `scoring_status=failed`, vào dead letter, báo admin                                                     |
| `writing.score`       | 180s    | 3     | mũ, từ 30s       | `attemptId`                             | như trên                                                                                                  |
| `notify.result`       | 30s     | 5     | mũ, từ 60s       | `attemptId:evaluationId`                | ghi log, không chặn gì                                                                                   |
| `cron.daily-summary`  | 120s    | 2     | cố định 5 phút | ngày (Asia/Ho_Chi_Minh)                  | báo admin                                                                                                  |

**Phân loại lỗi:** chỉ retry lỗi tạm thời (timeout, 429, 5xx, mất mạng, output không qua zod). Lỗi vĩnh viễn thì fail ngay, không tốn lượt: 400 do audio hỏng, 401 do sai key, audio không có trên R2, attempt đã cancel. Code hiện tại retry hai lớp (vòng `MAX_RETRIES` + `maxRetries: 2` của SDK, tới 9 lần gọi); v2 tắt retry của SDK, chỉ queue retry.

```
pending ──worker nhận──► processing ──ok──► done
   ▲                         │ lỗi tạm thời, còn lượt → pending
   │                         └ hết lượt / lỗi vĩnh viễn → failed
   └──────────── rerun ◄──────────── failed | done
```

Khi rerun một attempt đã done, kết quả cũ vẫn hiển thị cho tới khi bản mới xong.

**Các kiểu rerun**

| Kiểu               | Ai bấm            | Phạm vi                                                                                 | Giới hạn                                                                     |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Chấm lại          | Học viên         | 1 attempt của mình, khi failed hoặc done                                              | 1 lần/attempt/24h                                                             |
| Retry job           | Admin              | 1 job trong dead letter                                                                  | không                                                                         |
| Rerun theo bộ lọc | Admin              | Theo status (failed), khoảng ngày,`prompt_version`, model; thay `batch-scoring.ts` | Xem số lượng + xác nhận trước; tối đa 3 job song song                 |
| Shadow rerun        | Admin              | Chấm lại bằng prompt/model mới để so với golden set                               | Ghi`ai_evaluations` có cờ `is_shadow`, không đổi kết quả user thấy |
| Transcribe lại     | Tự động / admin | Khi ghi âm lại (audio_key mới) hoặc admin ép chạy                                  | theo khóa chống trùng                                                       |

**Chống mất và chống trùng**

- Enqueue trong cùng transaction với submit — không có attempt "đã nộp mà không có job".
- Worker ghi `ai_evaluations` và cập nhật attempt trong một transaction; `job_id` unique nên chạy lại sau crash không tạo hai kết quả.
- Worker chết giữa chừng: job hết hạn theo timeout và được retry tự động.
- Reconciler 10 phút/lần: attempt submitted quá 15 phút mà vẫn pending/processing và không có job đang sống thì enqueue lại.
- Giới hạn chi phí: trần số lần gọi AI mỗi ngày; vượt trần thì job chờ sang ngày sau và báo admin.

**Hiển thị**

- Học viên: "Đang chấm" khi pending/processing; failed thì báo lỗi kèm nút "Chấm lại".
- Admin có trang Jobs: số job theo trạng thái, danh sách failed kèm lỗi, nút Retry / Rerun; báo vào kênh admin Mezon khi có job vào dead letter hoặc tỉ lệ fail vượt 10%/giờ.

## 4. Lộ trình

Ước lượng cho **1 dev full-time + AI agent hỗ trợ**; có 2 dev thì các phase 3–4 chạy song song được.

| Phase                                    | Nội dung                                                                                                                                                                                                                  | Thời lượng | Đầu ra / tiêu chí xong                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **0. Chuẩn bị**                  | Rotate bot token; freeze tính năng app cũ (chỉ hotfix); chốt quyết định mục 6; dump schema prod thật (`pg_dump --schema-only`); thu **golden set** 20–30 attempt speaking đã chấm để so điểm     | 3–4 ngày    | Schema prod thực tế, golden set, danh sách quyết định                                                               |
| **1. Nền móng**                  | Monorepo, tooling,`config`, `db` + migration đầu, `core` (port CEFR/band calc + unit test), CI, Dockerfile 1 image/3 lệnh, compose staging `english-v2.mrdnd.dev`                                               | 1,5–2 tuần  | CI xanh, deploy staging trống chạy được                                                                              |
| **2. Auth + MCQ exam**             | OAuth + WebAppData hash + mock login, session wrapper, users; port exam MCQ (start/answer/submit/result) + gating unlock chung                                                                                             | 1,5 tuần     | E2E: login mock → làm bài → xem teaser → unlock                                                                      |
| **3. Speaking + worker**           | Presigned upload, recorder tách hook/component, worker pg-boss,`ai` package (prompt versioned), `speaking.score`, trang kết quả/history/details. **Whisper pipeline** làm ở đây (`speaking.transcribe`) | 2,5–3 tuần  | Chấm golden set: lệch ≤ 0,5 band so với bản cũ ở ≥ 80% mẫu (hoặc lệch có chủ đích nhờ Whisper — ghi rõ) |
| **4. Bot + Admin**                 | `apps/bot` (lệnh chat, thông báo kết quả, daily summary đúng TZ Asia/Ho_Chi_Minh), internal HTTP; admin: students, classes, topics CRUD, audio, batch scoring                                                     | 1,5–2 tuần  | Parity checklist phần bot/admin tick hết                                                                                |
| **5. Migrate dữ liệu + cutover** | Script ETL cũ → mới (idempotent, chạy lại được,`legacy_id`), dry-run trên bản copy prod, đối soát số lượng; cutover bằng `MAINTENANCE_MODE` → ETL delta → đổi route Traefik                       | 1 tuần       | Đối soát khớp, rollback plan đã tập dượt                                                                         |
| **6. IELTS Writing**               | Làm trên nền v2 theo`docs/ielts-writing-integration-plan.md`                                                                                                                                                          | 2–3 tuần    | Tính năng mới, sau cutover                                                                                             |

**Tổng tới cutover: ~8–10 tuần.** Writing cộng thêm 2–3 tuần.

**Rollback:** giữ app cũ + DB cũ nguyên vẹn (read-only) 2 tuần sau cutover; ETL không ghi vào DB cũ nên chuyển lại route Traefik là rollback.

## 5. Rủi ro

| Rủi ro                                                                                    | Mức        | Giảm thiểu                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Điểm AI thay đổi sau khi port (prompt, cách ghép audio) → user thấy điểm "nhảy" | Cao         | Golden set + so sánh tự động; prompt v1 port nguyên văn trước, mọi thay đổi prompt là version mới |
| Hai codebase song song kéo dài, app cũ vẫn phải sửa                                  | Trung bình | Freeze tính năng; hotfix ghi vào backlog port                                                               |
| Schema prod khác`db/schema.sql` / DDL trong code                                        | Trung bình | Dump schema thật ở Phase 0; ETL dựa trên dump đó                                                         |
| Mezon SDK cần patch (`sdk-patch.ts`)                                                    | Trung bình | Gói vào`packages/mezon`, pin version, test smoke kết nối                                                 |
| Iframe Mezon + cookie session                                                              | Trung bình | Test sớm ở Phase 2 trên Mezon thật, không chỉ web                                                        |
| Chi phí LLM/Whisper khi chấm lại hàng loạt                                            | Thấp       | Singleton job, rate limit, audit token trong`ai_evaluations`                                                 |

## 6. Quyết định cần chốt

1. **Whisper pipeline:** ✅ Đã chốt — chờ v2, làm trong Phase 3 (job `speaking.transcribe`); app cũ không làm Whisper.
2. **Writing:** ✅ Đã chốt — làm sau khi refactor xong (sau cutover, Phase 6).
3. **DB:** ✅ Đã chốt — database mới `ncc_app_english_v2` trên cùng instance; DB cũ giữ nguyên để rollback.
4. **ID cũ** (`ielts-att-...`) trong link bot đã gửi: ✅ Đã chốt — redirect qua `legacy_id` sang ID mới.
5. **Realtime kết quả:** ✅ Đã chốt — polling 3s, chưa làm SSE.
6. **Nhân sự:** ✅ Đã chốt — không thêm người; 1 dev + AI agent, giữ lộ trình 8–10 tuần, Phase 3 và 4 chạy tuần tự.

## 7. Definition of Done (cutover)

- [ ] Parity checklist (Phụ lục A) tick hết trên staging
- [ ] CI: typecheck, lint, unit, E2E xanh; không còn `ignoreBuildErrors`
- [ ] Golden set đạt ngưỡng ở Phase 3
- [ ] ETL dry-run khớp số lượng users / attempts / responses / audio keys
- [ ] Bot chạy process riêng, restart web không ảnh hưởng bot
- [ ] Không secret nào có default trong code; `.env.example` sạch
- [ ] `CLAUDE.md` + `docs/ARCHITECTURE.md` mới phản ánh đúng v2; tài liệu cũ chuyển vào `docs/legacy/`
- [ ] Rollback đã tập dượt một lần

---

## Phụ lục A — Parity checklist (từ code hiện tại)

**Auth**

- [ ] OAuth2 Mezon: `/api/auth/login`, `/callback`, mock login khi thiếu `MEZON_CLIENT_ID`
- [ ] Mezon iframe WebAppData (`?data=`) → `/api/auth/mezon-hash`
- [ ] Admin password login (`/api/auth/login-password`), logout, `/me`
- [ ] Launch token một lần dùng từ bot (`/api/ielts/launch`, `launch_tokens`)

**MCQ exam (CEFR)**

- [ ] Landing, `/exam`, `/exam/[attemptId]`, `/exam/[attemptId]/result`
- [ ] start / answer (autosave) / submit, timer, chấm server-side, CEFR mapping
- [ ] Teaser → unlock qua clan membership (`/api/membership/verify`)

**IELTS Speaking**

- [ ] Chọn topic, test 3 part, prep timer Part 2, ghi chú Part 2
- [ ] Ghi âm + live STT (Web Speech desktop / Deepgram mobile qua `/deepgram-token`)
- [ ] Upload audio R2, cancel attempt
- [ ] Chấm AI (audio + transcript), band 0 guard, audio oversize filter
- [ ] Result / details / history, audio reviewer, teaser vs full, rescore thủ công

**Admin**

- [ ] Dashboard, danh sách học viên theo class (clan channels), chi tiết attempt học viên
- [ ] CRUD topics, quản lý audio, batch scoring attempt chưa chấm

**Bot & jobs**

- [ ] Lệnh chat: `*testingnow` (`*testnow`, `*thi`), `*result [id]` (`*ketqua`), `*history` (`*lichsu`), `*help`
- [ ] Thông báo kết quả (`/api/bot/notify-result`), DM/channel message
- [ ] Daily summary 20:00 (sửa theo giờ VN)

**Khác**

- [ ] Maintenance mode (middleware), robots, sitemap, OG image
- [ ] i18n vi/en, language toggle

## Phụ lục B — Mapping module cũ → mới

| Cũ                                                                                                                                                 | Mới                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `lib/db/postgres.ts`                                                                                                                              | `packages/db` (schema + repositories: users, mcq, speaking, admin-stats)       |
| `lib/exam/score-calculator.ts`, `lib/ielts/score-calculator.ts`                                                                                 | `packages/core` (+ unit test)                                                  |
| `lib/ielts/ai-evaluator.ts`, `prompts/`, `schemas/`, `evaluation-*`                                                                         | `packages/ai/speaking` + `apps/worker/jobs/speaking-score`                   |
| `lib/mezon/*`                                                                                                                                     | `packages/mezon`                                                               |
| `lib/bot/*`, `lib/scheduler.ts`, `scripts/bot-server.ts`, `instrumentation.ts`                                                              | `apps/bot` + cron trong `apps/worker`                                        |
| `lib/admin/clan-data-service.ts`, `batch-scoring.ts`                                                                                            | `apps/bot` (dữ liệu clan) + `packages/db` (stats) + job `speaking.score` |
| `lib/storage/r2.ts`                                                                                                                               | `packages/storage` (thêm presigned PUT)                                       |
| `lib/i18n/*`                                                                                                                                      | `next-intl` messages                                                           |
| `components/ielts/AudioRecorder.tsx`                                                                                                              | `useRecorder` hook + `useLiveTranscript` hook + component UI mỏng           |
| `lib/supabase/storage.ts`, `scripts/migrate-supabase-to-r2.ts`, dep `file:../mezon-app-sample`, `scripts/patch-openai-compatible-audio.cjs` | **Bỏ**                                                                    |
