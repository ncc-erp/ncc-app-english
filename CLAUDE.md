# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # next dev on :3000
npm run build    # next build
npm run start    # serve the production build
npx tsc --noEmit # type check — the real gate, since there is no test suite
```

`npm run lint` maps to `next lint`, but ESLint is not installed and there is no config, so it drops into an interactive setup prompt. Use `tsc --noEmit` instead.

Postgres must be reachable before any route works — copy `.env.example` to `.env.local` and set `DB_*` (defaults point at `127.0.0.1:8104`, db `ncc_app_english`). No migration step: the schema is created on first query (see below).

## Architecture

Next.js 15 App Router, React 19, Tailwind, strict TS, `@/*` → repo root. Every page under `app/` is `'use client'` and talks to `app/api/*` over `fetch`; there are no server components doing data access.

**Two products share one shell.** A CEFR multiple-choice placement exam (`/exam`, `lib/exam/*`, `app/api/exam/*`) and an IELTS Speaking mock test (`/ielts-speaking`, `lib/ielts/*`, `app/api/ielts/*`). They share the session, the connection pool, and `components/Navbar.tsx`, and nothing else.

**Data layer is `lib/db/postgres.ts` alone.** `pgDb` holds every query used by the app; `getPool()` picks a connection three ways in order — a `DATABASE_URL`/`POSTGRES_URL*` connection string, a remote `POSTGRES_HOST`/`DB_HOST` with SSL, or local `DB_*` defaults — and caches the pool on `global` to survive hot reload. Each `pgDb` method calls `ensureDbInitialized()`, which runs `CREATE TABLE IF NOT EXISTS` DDL and seeds questions/topics from `SEED_QUESTIONS` (`lib/exam/questions.ts`) and `SEED_IELTS_TOPICS` (`lib/ielts/questions.ts`).

Consequence worth remembering: `db/schema.sql` is a _copy_ of that DDL, not the thing that runs. A schema change must be made in `ensureDbInitialized()` — editing only `db/schema.sql` changes nothing. `IF NOT EXISTS` also means altering an existing column requires a manual `ALTER` against the dev database.

`lib/supabase/mock-db.ts` is a leftover in-memory store still wired into `/api/auth/mezon-hash` only. Everything else uses `pgDb`; don't extend the mock.

**Dual auth, one session.** Both paths end by writing `session.user` into the iron-session cookie `mezon_exam_session` (`lib/auth/session.ts`, `getSession()`):

- OAuth2: `/api/auth/login` → Mezon consent → `/api/auth/callback` exchanges the code (`lib/mezon/oauth.ts`) and upserts the user. `/api/auth/login?mock=true` — or any unset/placeholder `MEZON_CLIENT_ID` — skips Mezon entirely and redirects to `callback?code=mock_dev_code`, seeding a `dev_user_1001` account. That is the intended local login.
- Mezon iframe: `app/page.tsx` reads `?data=` and POSTs it to `/api/auth/mezon-hash`, verified by the MD5→HMAC-SHA256 `WebAppData` scheme in `lib/mezon/hash-verifier.ts`.

**The exam's result gate is server-side and must stay that way.** `/api/exam/start` strips `correct_option_id`/`explanation` before returning questions, and `/api/exam/submit` returns only CEFR level and percentage unless `attempt.unlocked`. Unlocking happens in `/api/membership/verify`, which asks the Mezon bot (`lib/mezon/bot-client.ts`) whether the user joined the target clan. Never move scoring or answer keys client-side.

**IELTS scoring is deliberately two-phase.** The test page records audio via `MediaRecorder` and captures a live transcript via the browser `SpeechRecognition` API (`components/ielts/AudioRecorder.tsx`). `/api/ielts/submit` persists responses and returns immediately — no AI call. The result page sees `score_result === null`, then calls `/api/ielts/rescore`, which runs `evaluateIELTSAttemptWithAI` and stores the result in `ielts_speaking_attempts.score_result`. Same route backs the manual "re-score" button. Both AI routes set `maxDuration = 60`.

`lib/ielts/ai-evaluator.ts` sends one large system prompt (`OFFICIAL_IELTS_EXAMINER_PROMPT`) and picks the request shape from the endpoint: a URL containing `/chat/completions` gets the OpenAI message shape, anything else the Anthropic shape. It always requests `stream: true` and aggregates SSE deltas, then `repairTruncatedJson` salvages responses cut off mid-JSON. Config resolves `AI_API_KEY`/`AI_ENDPOINT`/`AI_MODEL` first, falling back to `ANTHROPIC_*`, `GEMINI_API_KEY`, `OPENAI_API_KEY`. It returns `null` on any failure and the UI shows a pending state — there is intentionally no rule-based fallback score, so don't add one. Transcript faithfulness rules in that prompt were tuned over several commits; treat edits to it as behavior changes.

## Conventions

- Every route handler opens with `getSession()` and 401s when `!session.user`.
- Responses are `{ success: true, ... }` / `{ success: false, error }`; the client checks `data.success`, not just `res.ok`, and guards against non-JSON bodies.
- Next 15 dynamic params are Promises: `await params` in route handlers, `use(params)` in client pages.
- `cn()` and `formatTime()` live in `lib/utils.ts`.

## Stale docs

`docs/ARCHITECTURE.md` and `docs/PRD.md` describe the original Supabase design with UUID ids and a `mezon-app-sample` layout. The app now uses raw `pg` with TEXT ids and has since grown the whole IELTS feature. Read them for product intent only; trust the code for anything structural.
