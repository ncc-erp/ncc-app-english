# Mezon English Platform — Product Requirements Document (PRD)

## 1. Product Vision & Goals

**Vision**: A comprehensive, AI-powered English proficiency assessment and practice ecosystem embedded inside Mezon. The platform delivers quick general level assessments as well as full-fledged IELTS mock tests (Speaking & Writing) that drive clan community growth through a proven "result-gating / value-unlock" mechanic.

**Growth Loop**:

```
User opens Channel App → Takes Assessment (General / Speaking / Writing)
    → Sees Teaser / Initial Score Card
    → Joins Clan to unlock Full Detailed Analysis & Personalized Learning
    → Participates in Clan Study Community & Practice Sessions
```

**Goals**:

- Provide quick, credible CEFR assessments (General English MCQ in 8–12 mins).
- Deliver high-fidelity IELTS Speaking (multimodal audio examiner) and **IELTS Writing (AI auto-graded by senior examiner standards)** with deep diagnostic feedback.
- Drive organic clan growth through tiered result unlocking.
- Provide actionable, personalized post-test learning (mistake corrections, grammar structure bank, interactive practice exercises, and band-level model answers).
- Zero-friction entry: instant authentication via Mezon Channel App WebAppData with standalone OAuth2 fallback.

---

## 2. User Personas

| Persona | Description | Motivation | Primary Module |
| :--- | :--- | :--- | :--- |
| **Curious Learner** | Mezon user who wants a quick snapshot of their English proficiency | Self-assessment, curiosity, bragging rights | General English Exam (30 MCQ) |
| **IELTS Candidate** | Student preparing for IELTS Academic/General test | Needs rigorous, evidence-based band scoring and detailed writing/speaking feedback | IELTS Speaking & IELTS Writing |
| **Community Member** | Active clan member seeking ongoing practice and discussion | Continuous skill improvement, peer learning | Practice Exercises & Model Essays |
| **Clan Admin / Teacher** | Wants to engage and grow their clan community | Member acquisition, hosting exam challenges, tracking member progress | Leaderboard & Assessment Reports |

---

## 3. User Journeys

### 3.1 Authentication & Entry Points

1. **Entry Point A (Embedded Mezon Channel App - Primary)**:
   - User opens the app within a Mezon channel iframe.
   - App receives signed `?data=...` parameter in the URL.
   - Auto-authenticates silently via `/api/auth/mezon-hash` (HMAC-SHA256 verification) → Session cookie set.
   - User lands directly on the Hub / Dashboard ready to select an exam.

2. **Entry Point B (Direct Web Access)**:
   - User navigates directly to the web URL.
   - Prominent **"Login with Mezon"** button initiates Mezon OAuth2 (`oauth2.mezon.ai/oauth2/auth`).
   - Callback to `/api/auth/callback` sets session cookie → Redirects to user dashboard.

---

### 3.2 Assessment Modules & User Flows

#### Flow 1: General English Assessment (MCQ)
1. **Welcome Screen**: Overview (30 questions across Grammar, Vocabulary, Reading, ~12 mins).
2. **Exam Interface**: 30 multiple-choice questions with autosave and countdown timer.
3. **Submit**: Server calculates weighted score and CEFR level (A1–C2).
4. **Result Teaser & Clan Unlock**: Free tier sees CEFR badge + score %; clan join unlocks detailed skill breakdown, radar charts, and weakness analysis.

#### Flow 2: IELTS Speaking Assessment
1. **Topic Selection**: Choose speaking topic from curated seed bank.
2. **Multimodal Recording**: Candidate records responses for Part 1, Part 2 (with prep notes), and Part 3.
3. **AI Speech Evaluation**: LLM processes audio inputs + STT transcripts, evaluating Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation.
4. **Speaking Result**: Band scores, per-question analysis, transcript corrections, and native audio feedback.

#### Flow 3: IELTS Writing Assessment (AI Auto-Graded) — *NEW*
1. **Task Selection**: Candidate chooses their assessment mode:
   - **Task 1**: Academic Report / Data Description (≥150 words, recommended 20 mins).
   - **Task 2**: Discursive Essay (≥250 words, recommended 40 mins).
   - **Dual Test**: Complete Writing test (Task 1 + Task 2, recommended 60 mins).
2. **Writing Room (Test Environment)**:
   - Prompt & visual stimulus display (charts, tables, diagrams for Task 1; prompt topic for Task 2).
   - Dedicated distraction-free text editor with real-time word counter and timer.
   - Autosave draft functionality to prevent data loss.
3. **Submission & AI Evaluation**:
   - Candidate clicks "Submit & Grade Essay".
   - Server triggers the **LLM Writing Evaluator** powered by the **IELTS Marking Skill**.
   - LLM reads the essay against two mandatory anchors:
     - **IELTS Public Band Descriptors (May 2023)**.
     - **Steven Lee's Marking Corpus & Decision Anchors**.
   - Structured JSON output is generated and validated against deterministic rules.
   - Band scores are computed using classroom standards (whole band criteria, 0.5 round-down).
4. **Interactive HTML Report Page**:
   - Candidate receives an extensive, interactive report (equivalent to the 12-page Dual / 6–8 page Single specification) styled with the dedicated `theme.css`.
   - **Dashboard**: Overall band medal SVG, score formula with classroom disclaimer, 4 concise summary comments in Vietnamese, CEFR vocabulary distribution ledger (0–100% horizontal bars).
   - **Criterion Breakdown**: Detailed justifications for TA/TR, CC, LR, and GRA citing exact quotes from the student's text.
   - **Sentence Correction Cards**: Color-coded highlights in original text linked to rewrite cards with `!` diagnosis and Vietnamese explanations (`! [Lỗi] → [Giải thích]`).
   - **Personalized Learning Extension**: Targeted priority areas, Sentence Structure Bank, interactive MCQ and open-rewrite exercises.
   - **Band-Level Model Essays**: Complete sample responses for each submitted task with key phrases highlighted.
   - *Note on Export*: The rich HTML display page with native browser print CSS (`@media print`) serves as the report format for this phase; backend PDF generation is intentionally deferred.

---

## 4. Functional Requirements

### 4.1 General English Exam
- [x] Mezon Channel App WebAppData authentication & OAuth2 fallback.
- [x] 30-question MCQ test across Grammar, Vocabulary, Reading.
- [x] Server-side adaptive scoring and CEFR mapping (A1–C2).
- [x] Clan membership verification via Mezon Bot SDK to unlock full analysis.
- [x] Mobile-responsive UI with autosave and anti-cheat timer.

### 4.2 IELTS Speaking Module
- [x] 3-part official IELTS Speaking format (Part 1 interview, Part 2 cue card, Part 3 discussion).
- [x] In-browser audio recording with live STT preview.
- [x] Multimodal audio evaluation via AI SDK (FC, LR, GRA, PR scoring).
- [x] Band zero detection (silence / off-topic / non-English audio).
- [x] Teaser vs. Full score breakdown with clan unlock mechanic.

### 4.3 IELTS Writing Module (AI Auto-Graded) — *NEW*

#### 1. Exam & Submission UI
- [ ] Task selection: Task 1, Task 2, or Dual Test.
- [ ] Prompt viewer with image display support (charts, graphs, maps, diagrams).
- [ ] Text editor with real-time word counting, minimum length indicators (150 / 250 words), and countdown timer.
- [ ] Auto-draft saving in browser/server.

#### 2. LLM Auto-Grading Engine (`ielts-marking-skill` Integration)
- [ ] **Dual Marking Anchors**:
  - System prompt grounded in official **IELTS Public Band Descriptors (May 2023)** for Task 1 and Task 2.
  - Qualitative calibration using **Steven Lee's historical marking decisions** (`scoring_inputs/sl_ielts_2026_09_14/`).
- [ ] **Evidence-Based Scoring**:
  - Whole-band scoring (0–9) across all 4 criteria: Task Achievement / Task Response (TA/TR), Coherence & Cohesion (CC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA).
  - Explicit quote requirement: Every criterion justification must cite authentic text from the candidate's submission.
  - Vietnamese justifications: Strengths (`strength_vi`), real limitations (`limitation_vi`), why this band was awarded (`why_band_vi`), and why the next band was not reached (`why_not_next_vi`).
- [ ] **Diagnostic Sentence Corrections**:
  - Sentence rewrite cards: original sentence → revised version.
  - Error classification into standard codes: `SP` (Spelling), `WF` (Word Form), `WC` (Word Choice), `GR` (Grammar), `PU` (Punctuation), `ST` (Style/Structure), `CO` (Cohesion).
  - Diagnostic formatting: `!` marker followed by natural Vietnamese explanation after `→`.
- [ ] **CEFR Vocabulary Distribution**:
  - Extraction and categorization of candidate vocabulary items into CEFR levels (A1 through C2).
  - Contextual quotes and rationale for each classified term.
  - Ledger representation: Independent 0–100% horizontal bars for each populated level (no circular/stacked charts; CEFR is for lexical illustration only, not converted directly to IELTS band).
- [ ] **Personalized Learning Extension**:
  - 2–3 prioritized improvement areas directly linked to candidate error patterns.
  - **Sentence Structure Bank**: Reusable syntactic templates with example sentences and Vietnamese usage notes.
  - **Interactive Exercises**: At least 2 Multiple Choice Questions (MCQ with choices, answer, and explanation) + at least 2 Open-ended sentence rewrite challenges with acceptance criteria.
- [ ] **Band-Level Model Answers**:
  - Complete, natural model essay for each submitted task (≥150 words for Task 1, ≥250 words for Task 2).
  - Highlighted key collocations and cohesive structures.

#### 3. Deterministic Validation & Score Calculation (`standard.ts`)
- [ ] Strict output validation:
  - Verify all quotes exist in candidate's original paragraphs.
  - Verify error spans and structure references.
- [ ] Classroom calculation formula:
  - $\text{Task}_{\text{raw}} = \frac{\text{Criterion}_1 + \text{Criterion}_2 + \text{Criterion}_3 + \text{Criterion}_4}{4}$
  - $\text{Task}_{\text{overall}} = \lfloor \text{Task}_{\text{raw}} \times 2 \rfloor / 2$ (rounded down to nearest 0.5).
  - $\text{Dual}_{\text{raw}} = \frac{\text{Task1}_{\text{overall}} + 2 \times \text{Task2}_{\text{overall}}}{3}$
  - $\text{Dual}_{\text{overall}} = \lfloor \text{Dual}_{\text{raw}} \times 2 \rfloor / 2$ (rounded down to nearest 0.5).
- [ ] Mandatory classroom disclaimer: *"Kết quả chỉ mang tính tham khảo theo chương trình lớp học."*

#### 4. HTML Display Result Page
- [ ] Web-native multi-page layout implementing `docs/ielts-marking-skill/theme.css`:
  - Page 1: Dashboard with SVG Score Medal, formula banner, 4 quick comments, and CEFR horizontal bar ledger.
  - Page 2: Criterion assessment cards with quotes and explanations.
  - Pages 3–8: Interactive essay view with color-coded highlight spans and paired correction cards.
  - Page 9: Breakdown & Boost, +1 Band Roadmap, Sentence Structure Bank.
  - Page 10: Interactive exercise practice block (candidate can select MCQ options and attempt rewrites directly on page).
  - Pages 11–12: Complete model essays for Task 1 and Task 2.
- [ ] Print stylesheet integration (`@media print`) enabling clean browser printing (Ctrl+P) without requiring server-side PDF generation.

---

## 5. IELTS Writing Assessment Specifications

### 5.1 Test Structure

| Task | Prompt Type | Min. Word Count | Recommended Time | Assessment Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Task 1** | Academic Data / Process / Map | 150 words | 20 minutes | TA, CC, LR, GRA |
| **Task 2** | Discursive Essay (Opinion, Discussion, Problem-Solution, Two-part) | 250 words | 40 minutes | TR, CC, LR, GRA |
| **Dual Test** | Both Task 1 and Task 2 | 400 words total | 60 minutes | Both tasks combined (Task 2 weighted 2x) |

### 5.2 Criteria & Scoring Matrix

1. **Task Achievement (Task 1) / Task Response (Task 2)**:
   - Task 1: Overview presence, accurate data reporting, key trend selection.
   - Task 2: Addressing all parts of prompt, clear position throughout, well-developed supporting ideas.
2. **Coherence & Cohesion (CC)**:
   - Logical paragraphing, clear central topic per paragraph, flexible use of cohesive devices without mechanical overuse.
3. **Lexical Resource (LR)**:
   - Range, precision, natural collocations, awareness of style, accuracy in spelling and word formation.
4. **Grammatical Range & Accuracy (GRA)**:
   - Mix of simple and complex sentence forms, accuracy of structures, punctuation management.

---

## 6. Result Display & Gating Strategy

### 6.1 General English Exam
- **Free Teaser**: CEFR level badge (e.g. "B2 - Upper Intermediate"), total score %, percentile rank.
- **Clan Locked**: Detailed skill breakdown, radar comparison, weakness diagnosis, study recommendations.

### 6.2 IELTS Speaking & Writing Modules
- **Free Teaser**:
  - Overall Band score medal (e.g. "6.5").
  - 4 quick summary comments.
  - CEFR vocabulary overview.
- **Full Report (Unlocked via Clan Join or Unlocked Attempt)**:
  - Full criterion evidence with authentic quotes and Vietnamese explanations.
  - Complete sentence-by-sentence correction cards.
  - Interactive personalized exercises (MCQ + open rewrites) with answers and explanations.
  - Band-level model essays with key phrase annotations.
  - Printable HTML report layout.

---

## 7. Data Model

### Core System Tables (PostgreSQL)

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  mezon_id TEXT UNIQUE,
  mezon_username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  clan_member BOOLEAN DEFAULT FALSE,
  clan_joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- General MCQ Questions & Attempts
questions (id, section, difficulty, question_text, reading_passage, options, correct_option_id, explanation, active);
attempts (id, user_id, started_at, submitted_at, raw_score, weighted_score, level, percentile, unlocked);
answers (id, attempt_id, question_id, selected_option_id, is_correct, answered_at);

-- IELTS Speaking Tables
ielts_speaking_topics (id, title, category, description, part1_questions, part2_cue_card, part3_questions, active);
ielts_speaking_attempts (id, user_id, topic_id, status, current_part, started_at, submitted_at, overall_band, score_result, unlocked);
ielts_speaking_responses (id, attempt_id, question_id, part, audio_url, audio_storage_path, transcript, duration_seconds);

-- IELTS Writing Tables (NEW)
ielts_writing_topics (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,           -- 'task1' | 'task2' | 'dual'
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_summary TEXT,
  image_url TEXT,                    -- stimulus image for Task 1
  category TEXT,
  time_limit_minutes INT DEFAULT 40,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ielts_writing_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic_id TEXT REFERENCES ielts_writing_topics(id),
  task_type TEXT NOT NULL,           -- 'task1' | 'task2' | 'dual'
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'graded' | 'error'
  payload JSONB NOT NULL,            -- full structured review_input JSON
  score_summary JSONB NOT NULL,      -- { task1, task2, dual, formula }
  overall_band NUMERIC(3, 1),        -- computed final band
  unlocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writing_reviews_user ON ielts_writing_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_reviews_status ON ielts_writing_reviews(status);
```

---

## 8. Technical Architecture & File Organization

```
app/
├── (exam)/exam/                     # General English MCQ Exam
├── ielts-speaking/                  # IELTS Speaking Module
├── ielts-writing/                   # IELTS Writing Module (NEW)
│   ├── page.tsx                     # Topic selection & test lobby
│   ├── test/[id]/page.tsx           # Writing exam room (editor, word counter, timer)
│   └── report/[id]/page.tsx         # Interactive HTML report (styled via theme.css)
│
app/api/
├── auth/                            # Mezon hash & OAuth2 callbacks
├── exam/                            # MCQ submit & question endpoints
├── ielts/speaking/                  # Audio upload, launch, rescore
└── ielts/writing/                   # IELTS Writing API (NEW)
    ├── topics/route.ts              # Fetch writing topics
    └── evaluate/route.ts            # Submit essay -> Run AI Evaluator -> Validate -> Store
│
lib/
├── db/postgres.ts                   # PostgreSQL pool & DDL initialization
├── ielts/
│   ├── ai-model.ts                  # Shared AI model provider (Vercel AI SDK)
│   ├── writing/                     # Writing Marking Core (NEW)
│   │   ├── prompts/
│   │   │   └── writing-examiner.ts  # LLM prompt with rubrics & Steven Lee anchors
│   │   ├── schemas/
│   │   │   └── review-schema.ts     # Zod schema matching review_input.blank.json
│   │   ├── standard.ts              # Ported score formulas, halfDown, validateReview
│   │   ├── highlight-policy.ts      # Error tag classifier (SP, WF, WC, GR, PU, ST, CO)
│   │   ├── learning-extension.ts    # Structure bank & exercise validator
│   │   └── evaluator.ts             # AI evaluation orchestrator
│
public/
├── fonts/EBGaramond-*.ttf           # Open-source serif font from skill
└── css/writing-theme.css            # Direct import of skill theme.css
```

---

## 9. Non-Functional Requirements

### Security & Integrity
- Essay submissions validated server-side for length, spam, and character encoding.
- AI evaluation pipeline uses structured output (`Output.object` with Zod) ensuring zero schema deviations.
- Strict deterministic verification: Quotes must exist within the submitted text to prevent AI hallucination of candidate mistakes.

### Performance & Scalability
- AI evaluation completed within 15–30 seconds for single tasks, under 45 seconds for dual tasks.
- Responsive HTML report renders instantly in browser with no backend headless browser cold-start delays.
- PostgreSQL JSONB indexing ensures fast retrieval of historical review payloads.

### Typography & Presentation
- Primary typography: Modern responsive sans-serif font stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif`).
- Subtitles & Classical accents: EB Garamond Italic (open-source, bundled in `public/fonts/`).
- Full responsive support: Fluid reading on desktop and tablets, clean stacking on mobile.
- Zero overflow print rules (`@media print`) matching A4 layout standards.

---

## 10. Phased Implementation Roadmap

### Phase 1: MVP (Completed)
- [x] Mezon Channel App WebAppData authentication & OAuth2.
- [x] 30 MCQ exam with CEFR mapping and clan-lock gate.
- [x] Basic user profile and membership verification via bot.

### Phase 2: IELTS Expansion (Current Phase)
- [x] IELTS Speaking module with multimodal audio AI evaluation.
- [ ] **IELTS Writing Core Integration**:
  - [ ] Port `standard.ts`, `highlight-policy.ts`, and Zod schema from `docs/ielts-marking-skill`.
  - [ ] Add `ielts_writing_topics` and `ielts_writing_reviews` tables to `lib/db/postgres.ts`.
  - [ ] Implement `writing-examiner.ts` prompt and `/api/ielts/writing/evaluate` route.
  - [ ] Build Writing Exam Room (`/ielts-writing/test/[id]`).
  - [ ] Build Interactive HTML Report Page (`/ielts-writing/report/[id]`) using `writing-theme.css`.
  - *(PDF export intentionally excluded for this phase).*

### Phase 3: Community & Growth (Upcoming)
- [ ] Clan leaderboard for General, Speaking, and Writing scores.
- [ ] Shareable report cards directly to Mezon channels.
- [ ] Admin panel for managing topic banks and reviewing member submissions.
- [ ] Headless PDF Export engine (optional upgrade if offline distribution is required).

---

## 11. Key Success Metrics

| Metric | Target | Measurement |
| :--- | :--- | :--- |
| **Exam Completion Rate** | >75% | Started vs. submitted attempts |
| **Writing Evaluation Success Rate** | >98% | Completed AI evaluations without schema/timeout errors |
| **Average Marking Latency** | <35 seconds | Time from submit to full interactive HTML report |
| **Clan Unlock Conversion** | >45% | Completers who join clan to view full diagnostic report |
| **Practice Engagement** | >30% | Users who interact with personalized exercises in the report |
