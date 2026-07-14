# RAG Atlas

Production-grade Retrieval-Augmented Generation (RAG) system featuring **14 distinct RAG strategies**, a FastAPI backend, and a React TypeScript frontend. All 48 knowledge-base documents across 14 categories are seeded automatically on first startup — no manual steps required.

---

## Demo Video

A full walkthrough — login and both roles, the Knowledge Base, the Pipelines page,
and live Chat across all 14 RAG strategies.

<video src="https://github.com/MRVARIABLE20/HackerRank_q1/raw/main/RAG%20Demo/RAG-Atlas-14-RAG-Strategies-One-App.mp4" controls muted width="100%"></video>

▶ **[Watch the demo video](RAG%20Demo/RAG-Atlas-14-RAG-Strategies-One-App.mp4)** &nbsp;(if the player above doesn't load inline, this link opens it on GitHub)

<!--
  NOTE ON INLINE PLAYBACK:
  The <video> tag above points at the committed file's raw URL, which plays inline
  on most GitHub README renders. For GUARANTEED inline playback (the way GitHub
  officially supports video), open this README in GitHub's web editor, drag the
  RAG Demo/RAG-Atlas-14-RAG-Strategies-One-App.mp4 file into the editor — GitHub
  uploads it and replaces it with a https://github.com/user-attachments/assets/<id>
  URL. Paste that URL as the <video src="..."> above. That method never depends on
  the file staying in the repo.
-->

---

## Prerequisites

### 1. Required Software

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Python | 3.11+ | `python --version` |
| pip | 23+ | `pip --version` |
| Node.js | **20.19+ or 22.12+** | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.x | `git --version` |

> **Windows users:** PowerShell 5.1+ is recommended (pre-installed on Windows 10/11).

> **Node.js version matters here.** Vite 8, React Router 7, and ESLint 10 in `frontend/package.json` all require Node 20.19+ or 22.12+ — older Node 18.x installs will fail with `ReferenceError: CustomEvent is not defined` when running `npm run dev`. Check your version with `node --version` before running `npm install`, and upgrade via [nodejs.org](https://nodejs.org) (or `nvm install 22`) if it's below 20.19.

### 2. Required API Key — OpenRouter

You **must** have an OpenRouter API key. Without it, embeddings and chat will not work.

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) → **Create Key** → copy the `sk-or-v1-...` key
3. Add $5–10 credits at [openrouter.ai/credits](https://openrouter.ai/credits) (~$0.02 per 1 000 queries)

> Never commit your API key to git. The `backend/.env` file is git-ignored.

### 3. Optional API Keys

| Key | Purpose | Where to Get |
|-----|---------|-------------|
| `TAVILY_API_KEY` | Web search fallback for Corrective RAG (05) and Agentic RAG (10) | [app.tavily.com](https://app.tavily.com) |
| `SERPER_API_KEY` | Alternative web search provider | [serper.dev](https://serper.dev) |

Both are optional. If left blank, those two RAG strategies fall back to KB-only retrieval.

### 4. Port Availability

| Service | Default Port |
|---------|-------------|
| Backend (FastAPI) | **8001** |
| Frontend (Vite) | **5173** |

> Vite auto-increments to 5174, 5175… if 5173 is taken. Add the actual port to `CORS_ORIGINS` in `backend/.env`.

---

## Quick Start

### Step 1 — Clone the Repository

```powershell
git clone https://github.com/MRVARIABLE20/HackerRank_q1.git
cd HackerRank_q1
```

### Step 2 — Backend Setup

#### 2a. Create a virtual environment (recommended)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

> **Anaconda users:** `conda create -n rag python=3.13 -y && conda activate rag`
>
> **If activation is blocked:** Run once: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

#### 2b. Install Python dependencies

```powershell
cd backend
pip install -r requirements.txt
```

> Takes 2–4 minutes. Installs FastAPI, SQLAlchemy, DuckDB, PyMuPDF, rank-bm25, Tavily, and more.

#### 2c. Create `backend/.env`

Copy the example and fill in your key:

```powershell
Copy-Item .env.example .env
notepad .env
```

Minimum required content:

```env
# Required — get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-YOUR-KEY-HERE
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Optional — for Corrective RAG (05) and Agentic RAG (10) web search
TAVILY_API_KEY=
SERPER_API_KEY=

# Auth
JWT_SECRET=change-me-in-prod-please-use-a-long-random-string
JWT_EXP_MINUTES=480

# App
APP_ENV=dev
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174

# Database — leave blank to use SQLite (default: backend/rag.db)
DATABASE_URL_OVERRIDE=
```

#### 2d. Start the backend

```powershell
python -m uvicorn app.main:app --port 8001 --reload
```

**Expected output:**

```
INFO  Seed: created role 'admin'
INFO  Seed: created admin user admin@gmail.com
INFO  Seed: synced seed documents (48 now present)
INFO  Application startup complete.
INFO  Uvicorn running on http://127.0.0.1:8001
```

The backend auto-creates the SQLite database and seeds all 48 KB documents on first run. No manual seeding needed.

### Step 3 — Frontend Setup

> Open a **new terminal** for the frontend. Keep the backend terminal running.

#### 3a. Install Node dependencies

```powershell
cd frontend
npm install
```

#### 3b. Create `frontend/.env`

```powershell
Copy-Item .env.example .env
```

The example already contains the correct value:

```env
VITE_API_URL=http://127.0.0.1:8001
```

> Use `127.0.0.1`, not `localhost` — on some Windows/VPN network setups, resolving the
> hostname `localhost` adds a multi-second delay to every single API call. `127.0.0.1`
> needs no DNS lookup at all and is always fast.
>
> Avoid `echo ... > .env` in PowerShell — it writes a UTF-16 file that Vite can misread.
> Copying the example (a plain UTF-8 file) sidesteps that.

#### 3c. Start the frontend

```powershell
npm run dev
```

**Expected output:**

```
  VITE v7.x.x  ready in ~300 ms
  ➜  Local:   http://localhost:5173/
```

### Step 4 — Open the App

Navigate to **http://localhost:5173** and log in:

- **Email:** `admin@gmail.com`
- **Password:** `admin123`

The dashboard will show 48 KB documents already loaded. Go to **Chat**, select any RAG strategy, and start querying.

---

## Auto-Seeding

On every backend startup, `seed_if_empty()` runs automatically and:

1. Creates the `admin` role and `admin@gmail.com` user if they don't exist
2. Scans the `seeding_data/` folder and inserts any missing documents into the KB
3. Skips documents that are already present (idempotent — safe to restart)

To **reset to a clean state**, delete the database and restart the backend:

```powershell
Remove-Item backend\rag.db
# restart backend — all 48 docs are re-seeded automatically
```

To **add new seed documents**, drop files into `seeding_data/<category-folder>/` and restart the backend. The seeder picks them up on the next startup.

---

## 14 RAG Strategies

Each strategy has its own KB category, its own seeded documents, and its own retrieval pipeline. Confidence shown in the UI is a 0–100% cosine-similarity (or RRF-normalized) score — not an LLM self-rating.

| # | Strategy | Key Technique | Accepted Doc Types |
|---|----------|--------------|-------------------|
| 01 | **Naive RAG** | Direct vector cosine-similarity search | `.txt` `.pdf` `.md` |
| 02 | **BM25 RAG** | Keyword-based BM25 ranking (no vectors) | `.txt` `.csv` `.json` |
| 03 | **Hybrid RAG** | BM25 + vector score fusion via Reciprocal Rank Fusion | `.txt` `.csv` `.json` |
| 04 | **Self-RAG** | Model first decides RETRIEVE vs NO_RETRIEVE, then grades each doc (relevant/supported/useful) before answering | `.txt` `.pdf` `.md` |
| 05 | **Corrective RAG** | Grades the top KB doc CORRECT/AMBIGUOUS/INCORRECT; falls back to live Tavily web search when the KB doesn't clearly answer | `.txt` `.pdf` `.md` |
| 06 | **Graph RAG** | Extracts entities from the query, traverses relationships across documents | `.txt` `.md` `.pdf` |
| 07 | **Speculative RAG** | Drafts a fast answer from the top doc, then verifies/confirms it against full context | `.txt` `.pdf` `.md` |
| 08 | **RAG-Fusion** | Generates multiple query rephrasings, fuses results with Reciprocal Rank Fusion | `.txt` `.pdf` `.md` |
| 09 | **Adaptive RAG** | Classifies query complexity, routes to the right sub-strategy (direct LLM vs hybrid retrieval) | `.txt` `.pdf` `.csv` `.md` `.json` |
| 10 | **Agentic RAG** | ReAct loop (up to 8 steps) with `kb_search` / `web_search` / `calculator` / `get_current_date` tools | `.txt` `.pdf` `.csv` `.json` |
| 11 | **Multi-hop RAG** | Chains retrieval across multiple hops to answer questions that need more than one document | `.txt` `.pdf` `.md` |
| 12 | **SQL RAG** | LLM writes a real SQL query, executed live against DuckDB tables built from CSV/TSV files | `.csv` `.tsv` `.txt` |
| 13 | **Multimodal RAG** | Vision model reads images directly; videos are transcribed (faster-whisper) and sampled frames are captioned — both indexed for retrieval by actual visual/audio content, not just filename | `.pdf` `.txt` `.png` `.jpg` `.mp4` `.webm` `.mov` |
| 14 | **Modular RAG** | LLM classifies query type (numerical/visual/relational/current/factual) and routes to the matching sub-RAG (12/13/06/05/03); falls back to its own KB if that sub-RAG comes back empty | `.txt` `.pdf` `.csv` `.json` |

**Notes on strategies 05, 10, and 12–14** (verified, not just described):

- **Corrective (05) & Agentic (10)** — web search requires `TAVILY_API_KEY` in `backend/.env` (see [Optional API Keys](#3-optional-api-keys)). Without it, both strategies answer from the KB only.
- **SQL RAG (12)** — documents added to the "12 SQL RAG" category through the Knowledge Base page (not just the pre-seeded CSVs) are automatically mirrored to disk so DuckDB can query them for real, including on tables you add after the app is already running.
- **Multimodal RAG (13)** — images and videos added via the Knowledge Base page are usable immediately: an uploaded video is stored in the database (not the filesystem) and transcribed/captioned on first use.
- **Modular RAG (14)** — if the sub-strategy the classifier picks returns no answer (e.g. a numeric-looking question about a document that actually lives in Modular's own KB, not the SQL one), it automatically retries against Modular's own documents before giving up.

### Seeded Documents per Category (48 total)

Titles are auto-generated from the filename (underscores → spaces, title-cased); non-text formats get a `(FORMAT)` suffix to disambiguate. See `seeding_data/<folder>/` for the source files.

| Category | Documents |
|----------|-----------|
| 01 Naive RAG | Arxiv 2005.11401 Rag Original (PDF), Gutenberg Pride And Prejudice (TXT), Huggingface Transformers Readme (MD) |
| 02 BM25 RAG | Gutenberg Sherlock Holmes (TXT), Seaborn Titanic (CSV), Vega Movies (JSON) |
| 03 Hybrid RAG | Gutenberg Huckleberry Finn (TXT), Seaborn Mpg (CSV), Vega Cars (JSON) |
| 04 Self-RAG | Arxiv 2310.11511 Self Rag (PDF), Gutenberg Frankenstein (TXT), Pytorch Readme (MD) |
| 05 Corrective RAG | Arxiv 2401.15884 Corrective Rag (PDF), Gutenberg Tale Of Two Cities (TXT), Pandas Readme (MD) |
| 06 Graph RAG | Arxiv 2404.16130 Graph Rag (PDF), D3 Readme (MD), Gutenberg War And Peace (TXT) |
| 07 Speculative RAG | Arxiv 2201.11903 Chain Of Thought (PDF), Gutenberg Moby Dick (TXT), Numpy Readme (MD) |
| 08 RAG-Fusion | Arxiv 2004.04906 Dense Passage Retrieval (PDF), Fastapi Readme (MD), Gutenberg Dracula (TXT) |
| 09 Adaptive RAG | Arxiv 2403.14403 Adaptive Rag (PDF), Flask Readme (MD), Gutenberg Alice In Wonderland (TXT), Vega Population (JSON), Vega Seattle Weather (CSV) |
| 10 Agentic RAG | Arxiv 2210.03629 React (PDF), Gutenberg The Prince (TXT), Seaborn Diamonds (CSV), Vega Flights 5K (JSON) |
| 11 Multi-hop RAG | Arxiv 2005.14165 Gpt3 Fewshot (PDF), Gutenberg Crime And Punishment (TXT), Nodejs Readme (MD) |
| 12 SQL RAG | Gutenberg A Modest Proposal (TXT), Seaborn Penguins (CSV), Seaborn Penguins (TSV) |
| 13 Multimodal RAG | Arxiv 2103.00020 Clip (PDF), Google Io Multimodal Rag (MP4), Gutenberg Picture Of Dorian Gray (TXT), Matplotlib Grace Hopper (JPG), Vega Ffox (PNG) |
| 14 Modular RAG | Arxiv 1706.03762 Attention Is All You Need (PDF), Gutenberg Jane Eyre (TXT), Vega Flare (JSON), Vega Stocks (CSV) |

---

## Architecture

### System Overview

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                         TIER 1 — CLIENT                                   │
 │  Browser → http://localhost:5173    or    curl → http://localhost:8001    │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                    TIER 2 — FRONTEND  (Vite :5173)                         │
 │  React 18 · TypeScript 5 · Vite 7 · CSS Custom Properties                 │
 │                                                                            │
 │  Login / Signup        Dashboard (stats, nav)      Chat (strategy picker) │
 │  KBPage (14 RAG cats)  AdminPortal (audit log)     RAG Pipelines viewer   │
 └───────────────────────────────┬────────────────────────────────────────────┘
                                 │  REST JSON · Authorization: Bearer <JWT>
                                 ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                    TIER 3 — BACKEND  (FastAPI :8001)                       │
 │  Python 3.11+ · Uvicorn ASGI · SQLAlchemy 2                               │
 │                                                                            │
 │  ┌──────────────────────────────────────────────────────────────────────┐  │
 │  │  POST /chat  →  routers/chat.py                                      │  │
 │  │                                                                      │  │
 │  │  1. Validate JWT           5. Call strategy-specific RAG module      │  │
 │  │  2. Embed query (OpenRouter)  ┌─ naive / bm25 / hybrid / self_rag   │  │
 │  │  3. Load category docs     │  ├─ corrective / graph / speculative    │  │
 │  │  4. STRATEGY_CATEGORY map  └─►├─ rag_fusion / adaptive / agentic    │  │
 │  │                               ├─ multihop / sql / multimodal         │  │
 │  │                               └─ modular                             │  │
 │  │  6. Build LLM prompt (context + query)                               │  │
 │  │  7. Call OpenRouter LLM                                              │  │
 │  │  8. Log to audit table                                               │  │
 │  │  9. Return {answer, citations, confidence, meta}                     │  │
 │  └──────────────────────────────────────────────────────────────────────┘  │
 │                                                                            │
 │  /auth/login · /auth/signup · /kb/docs · /admin/* · /seed-files/ · /uploads/video │
 └──────────────┬────────────────────────────────────────┬───────────────────┘
                │                                        │
                ▼                                        ▼
 ┌───────────────────────────┐            ┌──────────────────────────────────┐
 │  TIER 4a — SQLite DB       │            │  TIER 4b — OpenRouter API        │
 │  backend/rag.db            │            │  https://openrouter.ai/api/v1    │
 │                            │            │                                  │
 │  users · roles             │            │  /embeddings                     │
 │  user_roles                │            │    model: text-embedding-3-small │
 │  kb_documents              │            │    output: float[1536]           │
 │  audit_logs                │            │                                  │
 │                            │            │  /chat/completions               │
 │  Auto-created + seeded     │            │    model: gpt-4o-mini            │
 │  on first startup          │            │    output: cited answer text     │
 └───────────────────────────┘            └──────────────────────────────────┘
```

### Chat Request Flow

```
Browser          Frontend             Backend/chat.py          OpenRouter
   │                │                       │                       │
   │─ type query ──►│                       │                       │
   │  select RAG    │─ POST /chat ─────────►│                       │
   │  strategy      │  {query, strategy}    │                       │
   │                │                       │─ POST /embeddings ───►│
   │                │                       │◄── float[1536] ───────│
   │                │                       │                       │
   │                │                       │  Load KB docs for     │
   │                │                       │  this strategy's      │
   │                │                       │  category             │
   │                │                       │                       │
   │                │                       │  Run strategy module  │
   │                │                       │  (vector / BM25 /     │
   │                │                       │   SQL / multimodal…)  │
   │                │                       │                       │
   │                │                       │─ POST /chat/completions►│
   │                │                       │  prompt + top docs    │
   │                │                       │◄── answer text ───────│
   │                │                       │                       │
   │                │◄── 200 OK ────────────│                       │
   │                │  {answer, citations,  │                       │
   │                │   confidence, meta}   │                       │
   │◄─ render ──────│                       │                       │
```

### Application Startup Sequence

```
uvicorn app.main:app
        │
        ├─► init_db()          — CREATE TABLE IF NOT EXISTS (users, roles, kb_documents, audit_logs)
        │
        └─► seed_if_empty()
                │
                ├─► Create admin role + admin@gmail.com user  (if not present)
                │
                ├─► Scan seeding_data/ (14 folders, 48 files)
                │
                └─► Insert missing docs tagged with created_by="system@seed"
                    (idempotent — existing docs are skipped)
```

---

## Project Structure

```
HackerRank_q1/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app, startup hooks
│   │   ├── config.py             # Pydantic settings (loads backend/.env)
│   │   ├── db.py                 # SQLAlchemy engine + session factory
│   │   ├── models.py             # ORM models: User, Role, KBDocument, AuditLog
│   │   ├── schemas.py            # Pydantic schemas + KB_CATEGORIES list
│   │   ├── auth.py               # JWT create/verify + bcrypt helpers
│   │   ├── seed.py               # Auto-seeder (runs on every startup)
│   │   ├── rbac.py               # Role-based access control helpers
│   │   ├── routers/
│   │   │   ├── auth.py           # POST /auth/login  POST /auth/signup
│   │   │   ├── chat.py           # POST /chat  (strategy-aware RAG pipeline)
│   │   │   ├── kb_docs.py        # GET/POST/DELETE /kb/docs
│   │   │   ├── admin_docs.py     # GET/POST/PATCH/DELETE /admin/docs  [admin]
│   │   │   ├── audit.py          # GET /admin/audit-log  [admin]
│   │   │   ├── seed_files.py     # GET /seed-files/{path}  (serve seeding_data/)
│   │   │   └── upload.py         # POST /uploads/video  (video → seeding_data/)
│   │   └── rag/
│   │       ├── core.py           # Shared helpers: embed, cosine rank, LLM call
│   │       ├── naive.py          # 01 — vector similarity
│   │       ├── bm25.py           # 02 — BM25 keyword ranking
│   │       ├── hybrid.py         # 03 — BM25 + vector fusion
│   │       ├── self_rag.py       # 04 — retrieve-or-skip decision
│   │       ├── corrective.py     # 05 — web search fallback (Tavily)
│   │       ├── graph.py          # 06 — entity-relationship graph
│   │       ├── speculative.py    # 07 — draft → verify
│   │       ├── rag_fusion.py     # 08 — multi-query reciprocal rank fusion
│   │       ├── adaptive.py       # 09 — content-type router
│   │       ├── agentic.py        # 10 — agent loop with tool use
│   │       ├── multihop.py       # 11 — multi-step chained retrieval
│   │       ├── sql.py            # 12 — DuckDB SQL on CSV/TSV files
│   │       ├── multimodal.py     # 13 — text + PDF + image + video
│   │       └── modular.py        # 14 — plugin router to sub-RAGs
│   ├── requirements.txt
│   ├── .env                      # Your secrets (git-ignored — create from .env.example)
│   └── .env.example              # Template for new contributors
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Route/state root
│   │   ├── Login.tsx             # Login page
│   │   ├── Signup.tsx            # Sign-up page
│   │   ├── Dashboard.tsx         # Stats + navigation hub
│   │   ├── Chat.tsx              # Chat interface (strategy picker + citations panel)
│   │   ├── KBPage.tsx            # Knowledge Base (14 category tabs, upload, delete)
│   │   ├── AdminPortal.tsx       # Audit log viewer [admin]
│   │   ├── KnowledgeBase.tsx     # Alternative KB view
│   │   ├── api.ts                # Typed Fetch wrapper (attaches Bearer JWT)
│   │   ├── index.css             # Global styles + CSS variables (dark amber theme)
│   │   └── pipelines/            # Per-strategy metadata shown in RAG Pipelines page
│   │       ├── 01_naive.ts … 14_modular.ts
│   │       └── index.ts          # Exports all 14 pipeline configs
│   ├── public/
│   │   └── logo.png              # App logo
│   ├── package.json
│   └── vite.config.ts
├── seeding_data/                 # Source files — auto-seeded into DB on first run
│   ├── 01_naive_rag/
│   ├── 02_bm25_rag/
│   ├── 03_hybrid_rag/
│   ├── 04_self_rag/
│   ├── 05_corrective_rag/
│   ├── 06_graph_rag/
│   ├── 07_speculative_rag/
│   ├── 08_rag_fusion/
│   ├── 09_adaptive_rag/
│   ├── 10_agentic_rag/
│   ├── 11_multihop_rag/
│   ├── 12_sql_rag/
│   ├── 13_multimodal_rag/
│   ├── 14_modular_rag/
│   └── README.txt
├── tests/
│   └── test_all_rags.py          # 69 integration tests (all 14 RAGs + isolation)
├── rag_reference/
│   └── rag_comparison/           # Reference docs comparing all 14 strategies
├── .gitignore
└── README.md
```

---

## Default Credentials

| Role | Email | Password | Capabilities |
|------|-------|----------|-------------|
| Admin | `admin@gmail.com` | `admin123` | Full access: chat, KB management (all docs), audit log, admin portal |
| User | _(sign up via UI)_ | _(set at signup)_ | Chat + own KB docs only; no audit log |

> Change the admin password before any production deployment.

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Returns signed JWT (valid 480 min) |
| POST | `/auth/signup` | Creates new user (default role: intern) |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | RAG query — body: `{query, rag_strategy, asked_questions?}` — returns `{answer, citations, confidence, router_decision, followup_questions, warning?}` |

### Knowledge Base
| Method | Path | Description |
|--------|------|-------------|
| GET | `/kb/docs` | List all KB documents (auth required) |
| POST | `/kb/docs` | Add text/CSV/JSON/PDF document |
| DELETE | `/kb/docs/{id}` | Delete own doc (admin: any doc) |

### File Serving
| Method | Path | Description |
|--------|------|-------------|
| GET | `/seed-files/{path}` | Serve any file from `seeding_data/` (PDFs, images, videos) |
| POST | `/uploads/video` | Upload a video — saved to `seeding_data/<category>/` [admin] |

### Admin Only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/docs` | List all KB docs |
| POST | `/admin/docs` | Create KB document |
| PATCH | `/admin/docs/{id}` | Update KB document |
| DELETE | `/admin/docs/{id}` | Delete any KB document |
| GET | `/admin/audit-log` | All chat queries with user, timestamp, confidence, sources |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok", "env": "dev"}` |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript 5 | SPA, component rendering |
| Build tool | Vite 7 | Dev server (HMR), production bundle |
| Styling | CSS Custom Properties | Dark amber theme, no CSS framework |
| HTTP client | Fetch API | JWT-attached REST calls |
| Backend | FastAPI + Uvicorn | ASGI server, auto OpenAPI docs at `/docs` |
| Language | Python 3.11+ | Backend runtime |
| ORM | SQLAlchemy 2 | DB models, session management |
| Database | SQLite (`rag.db`) | Auto-created on first startup |
| Auth | JWT HS256 + bcrypt | Stateless tokens, 480 min expiry |
| Embedding | text-embedding-3-small (via OpenRouter) | 1536-dim semantic vectors |
| LLM | gpt-4o-mini (via OpenRouter) | Cited answer generation |
| BM25 | `rank-bm25` | Keyword ranking for RAG 02 + 03 |
| SQL engine | DuckDB | In-process SQL on CSV/TSV for RAG 12 |
| PDF extraction | PyMuPDF (`fitz`) | Text extraction for PDF seeding |
| Web search | Tavily | Search fallback for RAG 05 + 10 |
| Image handling | Pillow | Image encoding for RAG 13 |

---

## Common Commands

### Backend

```powershell
# Start (from backend/ directory)
python -m uvicorn app.main:app --port 8001 --reload

# Health check
curl http://localhost:8001/health

# Interactive API docs (browser)
start http://localhost:8001/docs

# Reset DB — all data wiped, re-seeded on next start
Remove-Item backend\rag.db
```

### Frontend

```powershell
# Start dev server (from frontend/ directory)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

### Testing

```powershell
# Run all 69 RAG integration tests (backend must be running on :8001)
cd tests
pytest test_all_rags.py -v
```

### Database (sqlite3 CLI)

```powershell
sqlite3 backend\rag.db
.tables
SELECT count(*), category FROM kb_documents GROUP BY category;
SELECT email, created_at FROM users;
.quit
```

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'fastapi'`
Virtual environment is not activated or packages were installed into the wrong Python.
```powershell
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### Backend starts but shows 0 KB docs seeded
The `seeding_data/` folder is missing or empty. Verify it exists:
```powershell
ls seeding_data/
```
If it's there and the DB was already created before the folder existed, reset and restart:
```powershell
Remove-Item backend\rag.db
python -m uvicorn app.main:app --port 8001
```

### Port 8001 already in use
```powershell
netstat -ano | findstr :8001
Stop-Process -Id <PID> -Force
```

### `401 Unauthorized`
JWT token is missing or expired. Log out and log back in (tokens are valid 480 minutes by default). Check that `frontend/.env` has no trailing slash in `VITE_API_URL`.

### CORS error in browser console
Vite is running on a port not listed in `CORS_ORIGINS` in `backend/.env`. Check the terminal for which port Vite actually started on, add it to `CORS_ORIGINS`, then restart the backend.

### `Failed to fetch` / blank frontend
Backend is not running. Confirm:
```powershell
curl http://localhost:8001/health
# Expected: {"status":"ok","env":"dev"}
```

### Chat always returns low confidence (< 0.2)
The wrong RAG strategy is selected for the question, or you are querying a category with no relevant documents. Make sure the strategy matches the topic — e.g., use **SQL RAG** for CSV data questions, **Multimodal RAG** for image/video questions.

### Corrective RAG or Agentic RAG never does web search
`TAVILY_API_KEY` is empty in `backend/.env`. Add a valid key from [app.tavily.com](https://app.tavily.com) and restart the backend.

### PowerShell script execution blocked
Run once (no admin needed):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### `node: command not found`
Install Node.js LTS from [nodejs.org](https://nodejs.org) and restart the terminal.

---

## Notes

- **Database** — SQLite file at `backend/rag.db`, auto-created on first startup, git-ignored
- **Embedding cache** — In-process Python dict, cleared on backend restart
- **Video uploads** — Stored entirely in the database as base64 (`kb_documents.content`), capped at 25 MB; only admins can upload videos. Seed videos from `seeding_data/` remain file-based and are served via `/seed-files/`
- **Production hardening** — Switch to PostgreSQL (`DATABASE_URL_OVERRIDE`), use a strong random `JWT_SECRET`, enable HTTPS, and deploy with Docker or a process manager
- **OpenAPI docs** — Available at `http://localhost:8001/docs` while the backend is running

---

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [SQLAlchemy 2.0 Docs](https://docs.sqlalchemy.org/)
- [DuckDB Docs](https://duckdb.org/docs/)
- [rank-bm25](https://github.com/dorianbrown/rank_bm25)

---

## License

Internal use only — RAG Atlas
