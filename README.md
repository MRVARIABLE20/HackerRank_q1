# Enterprise RAG Intelligence Platform

Production-grade Retrieval-Augmented Generation (RAG) system with FastAPI backend and React TypeScript frontend.

---

## ✅ Prerequisites Checklist

Before starting the app, make sure **every item below** is in place.

### 1. Required Software

| Tool | Minimum Version | Check Command | Download |
|------|----------------|---------------|----------|
| Python | 3.13+ | `python --version` | [python.org](https://www.python.org/downloads/) or [Anaconda](https://www.anaconda.com/) |
| pip | 24+ | `pip --version` | comes with Python |
| Node.js | 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | `npm --version` | comes with Node.js |
| Git | 2.x | `git --version` | [git-scm.com](https://git-scm.com/) |

> **Windows users:** PowerShell 5.1+ is recommended (already installed on Windows 10/11).

### 2. Required API Key — OpenRouter

You **must** have an OpenRouter API key before starting the backend. Without it, embeddings and chat will fail.

**How to get your key (3 steps):**

1. **Create account** → Visit [openrouter.ai](https://openrouter.ai) → Sign in with Google / GitHub / Email
2. **Generate key** → Go to [openrouter.ai/keys](https://openrouter.ai/keys) → Click **"Create Key"** → Name it (e.g. `RAG Dev`) → Copy the key — it starts with `sk-or-v1-...`
3. **Add credits** → Go to [openrouter.ai/credits](https://openrouter.ai/credits) → Add **$5–10** via card — typical cost is ~$0.02 per 1 000 queries

> ⚠️ **Never commit your API key to Git.** The `.env` files are in `.gitignore` by default.

### 3. Required Environment Files

You must create **two `.env` files** manually (they are git-ignored and never committed):

| File | Must Exist Before | Contains |
|------|------------------|----------|
| `backend/.env` | Starting the backend | OpenRouter key, JWT secret, DB path, CORS |
| `frontend/.env` | Starting the frontend | Backend API URL |

Templates are shown in the Quick Start section below.

### 4. Port Availability

Ensure these ports are free before starting:

| Service | Default Port | Check (PowerShell) |
|---------|-------------|-------------------|
| Backend (FastAPI) | **8001** | `netstat -ano \| findstr :8001` |
| Frontend (Vite) | **5173** | `netstat -ano \| findstr :5173` |

> Vite will auto-increment to 5174, 5175… if 5173 is taken. Update `CORS_ORIGINS` in `backend/.env` to match.

### 5. Python Dependencies

All backend packages install from `backend/requirements.txt`. Key packages:

| Package | Purpose |
|---------|---------|
| `fastapi` + `uvicorn` | Web framework + ASGI server |
| `sqlalchemy` | ORM for SQLite |
| `pydantic-settings` | Load config from `.env` |
| `python-jose` | JWT signing/verification |
| `bcrypt` + `passlib` | Password hashing |
| `httpx` | Async HTTP client (OpenRouter calls) |

Install with: `pip install -r backend/requirements.txt`

---

## 🚀 Quick Start

### Step 1 — Clone the Repository

```powershell
git clone https://github.com/MRVARIABLE20/HackerRank_q1.git
cd HackerRank_q1
```

### Step 2 — Backend Setup

#### 2a. Create a Python virtual environment (recommended)

Using a virtual environment keeps dependencies isolated and avoids conflicts with other Python projects.

```powershell
# From the HackerRank_q1/ root directory
python -m venv venv

# Activate it (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# You should now see (venv) at the start of your prompt:
# (venv) PS C:\...\HackerRank_q1>
```

> **Anaconda users:** Use `conda create -n rag python=3.13` then `conda activate rag` instead.

> ⚠️ **If you see a scripts execution error on Windows**, run this once:  
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

#### 2b. Install Python dependencies
```powershell
cd backend
pip install -r requirements.txt
```

> This installs ~15 packages including FastAPI, SQLAlchemy, bcrypt, and httpx. Takes 1–2 minutes.

#### 2c. Create `backend/.env`

Create a new file at `backend/.env` with this exact content:

> **How to create a `.env` file on Windows:**  
> In PowerShell: `New-Item backend\.env -ItemType File`  
> Then open it: `notepad backend\.env`  
> Or right-click in File Explorer → New → Text Document → rename to `.env` (remove the `.txt`)

```env
# Database — SQLite (default, no setup needed)
DATABASE_URL_OVERRIDE=sqlite:///./rag.db

# CORS — add any port Vite uses
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176

# Auth
JWT_SECRET=dev-secret-change-in-prod
JWT_EXP_MINUTES=480

# OpenRouter — REPLACE this with your real key
OPENROUTER_API_KEY=sk-or-v1-YOUR-KEY-HERE
OPENROUTER_MODEL=openai/gpt-4o-mini
```

> ⚠️ Replace `sk-or-v1-YOUR-KEY-HERE` with the key you created at [openrouter.ai/keys](https://openrouter.ai/keys)

#### 2d. Start the backend
```powershell
# Run from the backend/ directory
python -m uvicorn app.main:app --port 8001 --reload
```

**You should see:**
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

✅ **Admin user is auto-created on first start:**
- Email: `admin@gmail.com`
- Password: `admin123`

### Step 3 — Frontend Setup

> 🪟 **Open a NEW terminal window for the frontend.** The backend must keep running in its own terminal. Do not close it.

#### 3a. Install Node dependencies
```powershell
# In your NEW terminal window:
cd frontend
npm install
```

> This installs React, Vite, TypeScript and their dependencies (~150 MB in `node_modules/`). Takes 1–2 minutes.

#### 3b. Create `frontend/.env`

Create a new file at `frontend/.env`:

```env
VITE_API_URL=http://localhost:8001
```

#### 3c. Start the frontend
```powershell
# From the frontend/ directory
npm run dev
```

**You should see:**
```
  VITE v7.x.x  ready in 300 ms
  ➜  Local:   http://localhost:5173/
```

**Frontend runs on:** http://localhost:5173

### Step 4 — Verify Everything is Working

Open http://localhost:5173 in your browser:
1. The login page should load
2. Log in with `admin@gmail.com` / `admin123`
3. Dashboard should show (KB Docs: 0, no errors)
4. Navigate to **Chat** and ask: `"Hello, are you working?"`
5. You should get a response (confidence may be low until docs are added)

If the chat responds → your setup is complete ✅

---

## 🔑 Getting Your OpenRouter API Key

_(Full guide in Prerequisites section above — quick reference here)_

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to [Keys page](https://openrouter.ai/keys) → **Create Key** → copy `sk-or-v1-...`
3. Add $5–10 credits at [openrouter.ai/credits](https://openrouter.ai/credits)
4. Paste key into `backend/.env` as `OPENROUTER_API_KEY=sk-or-v1-...`

⚠️ **Keep your API key secure** - never commit it to git!

---

## 📚 Seeding Knowledge Base Documents

The `/seeding_data` folder contains 13 pre-made documents across 6 categories. Add these documents through the admin UI:

### Step-by-Step: Adding Documents via UI

1. **Login as admin:**
   - Navigate to http://localhost:5173
   - Email: `admin@gmail.com`
   - Password: `admin123`

2. **Navigate to Knowledge Base:**
   - Click "Knowledge Base" button from Dashboard
   - Or use the navigation menu

3. **Add each document:**
   
   **For text files (.txt):**
   - Select matching category from dropdown (e.g., "technical" for files in `seeding_data/technical/`)
   - Enter title (e.g., "API Reference V1")
   - Open the file in notepad, copy all content
   - Paste into the large text area
   - Click "Add Document"
   
   **For CSV files (.csv):**
   - Select "sql_csv" category
   - Enter title (e.g., "Customer Database")
   - Open CSV in notepad/Excel, copy all rows
   - Paste into text area (keep CSV format)
   - Click "Add Document"
   
   **For JSON files (.json):**
   - Select "json_logs" category
   - Enter title (e.g., "App Performance Q1 2026")
   - Open JSON file, copy entire content
   - Paste into text area
   - Click "Add Document"

4. **Verify documents:**
   - After adding all 13 documents, scroll down
   - You should see your documents listed in the table
   - Total: 13 documents across 6 categories

### Category Mapping Guide

| Folder in seeding_data | Category in UI |
|------------------------|----------------|
| `pdfs/` | pdfs |
| `sql_csv/` | sql_csv |
| `json_logs/` | json_logs |
| `technical/` | technical |
| `compliance/` | compliance |
| `operational/` | operational |

### Documents to Add (13 total)

✅ **pdfs/** (3 documents)
- fine_tuning_flan_t5_rl.txt
- genai_notes.txt
- ai_compliance_research.txt

✅ **sql_csv/** (2 documents)
- customer_database.csv
- sales_q1_2026.csv

✅ **json_logs/** (2 documents)
- app_performance_q1_2026.json
- security_audit_april_2026.json

✅ **technical/** (2 documents)
- api_reference_v1.txt
- rag_architecture_v2.1.txt

✅ **compliance/** (2 documents)
- gdpr_data_retention_policy.txt
- iso27001_soc2_status_fy2026.txt

✅ **operational/** (2 documents)
- incident_response_runbook.txt
- infrastructure_health_may_2026.csv

💡 **Tip:** See `seeding_data/README.txt` for example questions to ask after seeding!

---

## 🧪 Testing RAG Queries

### Via UI
1. Login as admin
2. Click "Open Chat" from Dashboard
3. Ask questions like:
   - "What is our GDPR data retention policy?"
   - "Summarize Q1 2026 sales performance"
   - "What is the architecture of our RAG system?"
   - "Show me the incident response procedure"

### Via API (curl)
```powershell
# Login and get token
$token = (curl -s -X POST http://localhost:8001/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@gmail.com","password":"admin123"}' | ConvertFrom-Json).access_token

# Query the RAG system
curl -X POST http://localhost:8001/chat `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"query":"What are the ISO 27001 compliance gaps?"}' | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 🏗️ Architecture Overview

This platform is a **4-tier production-grade RAG system**. Below are three diagrams explaining the full picture: overall structure, how data flows at runtime, and what happens inside the RAG pipeline.

---

### Diagram 1 — Full System Architecture (4 Tiers)

```
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║                          TIER 1 — CLIENT                                    ║
 ║  Any browser or HTTP client (curl, Postman, automated scripts)               ║
 ║                                                                              ║
 ║   [User]  ──────  opens http://localhost:5173  ──────►  React SPA           ║
 ║   [Admin] ──────  same URL, different role menu ──────►  React SPA           ║
 ║   [Dev]   ──────  curl / Postman  ────────────────────►  REST API directly   ║
 ╚══════════════════╤══════════════════════════════════════════════════════════╝
                    │
      ┌─────────────┴──────────────────────────────────────┐
      │  HTTP GET/POST   (pages, assets, hot-reload)        │  (Vite dev server)
      ▼                                                     ▼
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║                    TIER 2 — FRONTEND  (localhost:5173)                       ║
 ║              React 18  ·  TypeScript 5  ·  Vite 7  ·  CSS Variables         ║
 ║                                                                              ║
 ║  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐    ║
 ║  │  Auth Pages       │   │  Dashboard.tsx    │   │  Chat.tsx             │   ║
 ║  │  ─────────────── │   │  ────────────── ─ │   │  ──────────────────── │   ║
 ║  │  Login.tsx        │   │  • Doc count      │   │  • Type query         │   ║
 ║  │  Signup.tsx       │   │  • Avg confidence │   │  • See cited answer   │   ║
 ║  │                   │   │  • Token expiry   │   │  • "Why This Answer?" │   ║
 ║  │  On success:      │   │  • Embed model    │   │    → top-6 source     │   ║
 ║  │  store JWT in     │   │  • Nav to Chat/KB │   │    snippets + scores  │   ║
 ║  │  localStorage     │   └──────────────────┘   └──────────────────────┘   ║
 ║  └──────────────────┘                                                        ║
 ║  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐    ║
 ║  │  KnowledgeBase    │   │  AdminPortal.tsx  │   │  api.ts               │   ║
 ║  │  .tsx / KBPage    │   │  ────────────── ─ │   │  ──────────────────── │   ║
 ║  │  ─────────────── │   │  • View audit log │   │  Typed Fetch wrapper  │   ║
 ║  │  • List all docs  │   │  • Query history  │   │  Attaches Bearer JWT  │   ║
 ║  │  • Add document   │   │  • Confidence     │   │  to every request     │   ║
 ║  │  • Delete doc     │   │  • User emails    │   │                       │   ║
 ║  └──────────────────┘   └──────────────────┘   └──────────────────────┘   ║
 ╚══════════════════╤══════════════════════════════════════════════════════════╝
                    │
                    │  REST JSON over HTTP
                    │  Authorization: Bearer <JWT token>
                    │  Content-Type: application/json
                    │
                    ▼
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║                    TIER 3 — BACKEND  (localhost:8001)                        ║
 ║            FastAPI 0.115  ·  Uvicorn ASGI  ·  Python 3.13                   ║
 ║                                                                              ║
 ║  ┌─────────────────────────────────────────────────────────────────────┐    ║
 ║  │  MIDDLEWARE                                                          │    ║
 ║  │  • CORS — allows requests from localhost:5173/5174/5175/5176         │    ║
 ║  │  • JWT guard — verifies Bearer token on protected routes             │    ║
 ║  └─────────────────────────────────────────────────────────────────────┘    ║
 ║                                                                              ║
 ║  ┌─────────────────────────────────────────────────────────────────────┐    ║
 ║  │  API ROUTERS                                                         │    ║
 ║  │                                                                      │    ║
 ║  │  POST  /auth/login       →  routers/auth.py                          │    ║
 ║  │        validate email+password, return signed JWT (HS256, 480 min)  │    ║
 ║  │                                                                      │    ║
 ║  │  POST  /auth/signup      →  routers/auth.py                          │    ║
 ║  │        hash password with bcrypt, insert user row, assign role       │    ║
 ║  │                                                                      │    ║
 ║  │  POST  /chat             →  routers/chat.py  ★ CORE RAG PIPELINE ★   │    ║
 ║  │        embed → search → rank → prompt → LLM → log → respond         │    ║
 ║  │                                                                      │    ║
 ║  │  GET   /kb/docs          →  routers/kb_docs.py                       │    ║
 ║  │        return all KB documents (any authenticated user)              │    ║
 ║  │                                                                      │    ║
 ║  │  POST  /kb/docs          →  routers/kb_docs.py                       │    ║
 ║  │        insert new document, invalidate embedding cache entry         │    ║
 ║  │                                                                      │    ║
 ║  │  DELETE /kb/docs/{id}    →  routers/kb_docs.py                       │    ║
 ║  │        delete own doc (admin can delete any doc)                     │    ║
 ║  │                                                                      │    ║
 ║  │  GET|POST /admin/docs    →  routers/admin_docs.py  [admin only]      │    ║
 ║  │  PATCH /admin/docs/{id}  →  routers/admin_docs.py  [admin only]      │    ║
 ║  │                                                                      │    ║
 ║  │  GET  /admin/audit-log   →  routers/audit.py  [admin only]           │    ║
 ║  │        return all queries with user, timestamp, confidence           │    ║
 ║  └─────────────────────────────────────────────────────────────────────┘    ║
 ║                                                                              ║
 ║  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐     ║
 ║  │  app/auth.py      │  │  app/seed.py      │  │  app/config.py        │     ║
 ║  │  ─────────────── │  │  ──────────────── │  │  ──────────────────── │     ║
 ║  │  create_token()   │  │  seed_if_empty()  │  │  BaseSettings loads   │     ║
 ║  │  verify_token()   │  │  called on every  │  │  OPENROUTER_API_KEY   │     ║
 ║  │  hash_password()  │  │  startup; creates │  │  JWT_SECRET           │     ║
 ║  │  verify_password()│  │  admin@gmail.com  │  │  CORS_ORIGINS         │     ║
 ║  │  (bcrypt rounds)  │  │  if DB is empty   │  │  from backend/.env    │     ║
 ║  └──────────────────┘  └──────────────────┘  └───────────────────────┘     ║
 ╚═══════╤══════════════════════════════════════════════════╤═══════════════════╝
         │                                                  │
         │  SQLAlchemy 2 ORM (sync)                         │  HTTPS REST
         │  reads/writes on every request                   │  called only
         ▼                                                  │  during /chat
 ╔══════════════════════════════╗                           ▼
 ║  TIER 4a — DATABASE           ║           ╔══════════════════════════════════╗
 ║  SQLite  ·  backend/rag.db    ║           ║  TIER 4b — OPENROUTER AI API     ║
 ║                               ║           ║  https://openrouter.ai/api/v1    ║
 ║  Table: users                 ║           ║                                  ║
 ║  ┌──────────────────────────┐ ║           ║  Endpoint 1: /embeddings         ║
 ║  │ id  │ email │ pwd_hash   │ ║           ║  Model: text-embedding-3-small   ║
 ║  │  1  │ admin │ $2b$12$... │ ║           ║  Input:  text string             ║
 ║  └──────────────────────────┘ ║           ║  Output: float[1536]             ║
 ║                               ║           ║  Used:   embed query + new docs  ║
 ║  Table: roles                 ║           ║                                  ║
 ║  ┌───────────────────────────┐ ║           ║  Endpoint 2: /chat/completions   ║
 ║  │ id  │ name               │ ║           ║  Model: gpt-4o-mini              ║
 ║  │  1  │ admin              │ ║           ║  Input:  system prompt +         ║
 ║  │  2  │ intern             │ ║           ║          6 doc contexts +        ║
 ║  └───────────────────────────┘ ║           ║          user query             ║
 ║                               ║           ║  Output: cited answer text       ║
 ║  Table: kb_documents          ║           ║                                  ║
 ║  ┌──────────────────────────┐ ║           ║  Auth:   sk-or-v1-... API key    ║
 ║  │ id    │ title            │ ║           ║  Cost:   ~$0.02 per 1K queries   ║
 ║  │ owner │ category         │ ║           ╚══════════════════════════════════╝
 ║  │ content (full text)      │ ║
 ║  └──────────────────────────┘ ║
 ║                               ║
 ║  Table: audit_logs            ║
 ║  ┌──────────────────────────┐ ║
 ║  │ id         │ user_id     │ ║
 ║  │ query_text │ timestamp   │ ║
 ║  │ confidence │ source_ids  │ ║
 ║  └──────────────────────────┘ ║
 ╚══════════════════════════════╝
```

---

### Diagram 2 — End-to-End Request Flow (Two Scenarios)

#### Scenario A: User Logs In

```
  Browser                  Frontend (React)            Backend (FastAPI)         SQLite DB
     │                           │                           │                       │
     │── enter email+password ──►│                           │                       │
     │                           │── POST /auth/login ──────►│                       │
     │                           │   {email, password}       │                       │
     │                           │                           │── SELECT user WHERE ──►│
     │                           │                           │   email = ?            │
     │                           │                           │◄─ {id, pwd_hash, role}─│
     │                           │                           │                       │
     │                           │                           │  bcrypt.verify(        │
     │                           │                           │    password, hash)     │
     │                           │                           │  → True / raise 401    │
     │                           │                           │                       │
     │                           │                           │  jwt.encode({          │
     │                           │                           │    sub: user_id,       │
     │                           │                           │    role: "admin",      │
     │                           │                           │    exp: now+480min     │
     │                           │                           │  }, JWT_SECRET)        │
     │                           │                           │                       │
     │                           │◄── 200 {access_token} ───│                       │
     │                           │                           │                       │
     │                           │  localStorage.setItem(    │                       │
     │                           │    "token", access_token) │                       │
     │                           │  navigate("/dashboard")   │                       │
     │◄── render Dashboard ──────│                           │                       │
```

#### Scenario B: User Sends a RAG Chat Query

```
  Browser           Frontend          Backend/chat.py      SQLite DB        OpenRouter API
     │                  │                    │                  │                  │
     │─ type query ────►│                    │                  │                  │
     │  "GDPR policy?"  │                    │                  │                  │
     │                  │─ POST /chat ───────►                  │                  │
     │                  │  Bearer <JWT>       │                  │                  │
     │                  │  {query:"GDPR..."}  │                  │                  │
     │                  │                    │                  │                  │
     │                  │              [1] Validate JWT         │                  │
     │                  │              decode → user_id, role   │                  │
     │                  │                    │                  │                  │
     │                  │              [2] Embed query ─────────────────────────►│
     │                  │                    │   POST /embeddings                 │
     │                  │                    │   model: text-embedding-3-small    │
     │                  │                    │◄────────── float[1536] ────────────│
     │                  │                    │                  │                  │
     │                  │              [3] Load KB docs ────────►                  │
     │                  │                    │   SELECT * FROM kb_documents        │
     │                  │                    │◄──── rows[] ─────│                  │
     │                  │                    │                  │                  │
     │                  │              [4] Check embed cache (_embed_cache dict)   │
     │                  │                    │  if doc.id NOT in cache:            │
     │                  │                    │    embed(doc.content) ─────────────►│
     │                  │                    │◄───────────────── float[1536] ─────│
     │                  │                    │    cache[doc.id] = vector           │
     │                  │                    │                  │                  │
     │                  │              [5] Rank all docs by cosine similarity      │
     │                  │                    │                  │                  │
     │                  │                    │  for each doc:                      │
     │                  │                    │    score = dot(q_vec, d_vec)        │
     │                  │                    │            ─────────────────        │
     │                  │                    │            |q_vec| × |d_vec|        │
     │                  │                    │                  │                  │
     │                  │                    │  sort by score DESC                 │
     │                  │                    │  take top 6 docs                    │
     │                  │                    │                  │                  │
     │                  │              [6] Build LLM prompt                        │
     │                  │                    │                  │                  │
     │                  │                    │  System: "You are a RAG assistant.  │
     │                  │                    │   Answer using ONLY these docs."    │
     │                  │                    │                  │                  │
     │                  │                    │  Context:                           │
     │                  │                    │   [DOC-1] GDPR Retention Policy     │
     │                  │                    │   "Data must be deleted after..."   │
     │                  │                    │   [DOC-2] ISO27001 Status FY2026    │
     │                  │                    │   "Audit completed, gap in..."      │
     │                  │                    │   ... (× 6 docs total)              │
     │                  │                    │                  │                  │
     │                  │                    │  User: "What is our GDPR policy?"   │
     │                  │                    │                  │                  │
     │                  │              [7] Call LLM ─────────────────────────────►│
     │                  │                    │   POST /chat/completions            │
     │                  │                    │   model: gpt-4o-mini                │
     │                  │                    │◄──── "Based on [DOC-1], data ──────│
     │                  │                    │       must be retained for 7 years  │
     │                  │                    │       per Article 5(1)(e)..."       │
     │                  │                    │                  │                  │
     │                  │              [8] Save to audit log ───►                  │
     │                  │                    │   INSERT audit_logs(                │
     │                  │                    │     user_id, query, answer,         │
     │                  │                    │     confidence=0.89, sources=[1,4]) │
     │                  │                    │◄── OK ───────────│                  │
     │                  │                    │                  │                  │
     │                  │◄── 200 OK ─────────│                  │                  │
     │                  │  {                 │                  │                  │
     │                  │    answer: "...",  │                  │                  │
     │                  │    sources: [      │                  │                  │
     │                  │      {id:1,        │                  │                  │
     │                  │       title:"GDPR",│                  │                  │
     │                  │       snippet:"...",                  │                  │
     │                  │       score:0.89}, │                  │                  │
     │                  │      {id:4,...}],  │                  │                  │
     │                  │    confidence:0.89 │                  │                  │
     │                  │  }                 │                  │                  │
     │                  │                    │                  │                  │
     │◄── render answer │                    │                  │                  │
     │    + citations   │                    │                  │                  │
     │    + "Why This   │                    │                  │                  │
     │     Answer?" ───│                    │                  │                  │
```

---

### Diagram 3 — Application Startup Sequence

```
  Developer                  Terminal                  FastAPI (main.py)        SQLite
      │                          │                            │                    │
      │── python -m uvicorn ────►│                            │                    │
      │   app.main:app --port 8001                            │                    │
      │                          │                            │                    │
      │                          │── import app ─────────────►│                    │
      │                          │                            │  load config.py    │
      │                          │                            │  read backend/.env │
      │                          │                            │  OPENROUTER_API_KEY│
      │                          │                            │  JWT_SECRET, etc.  │
      │                          │                            │                    │
      │                          │                            │── init_db() ───────►│
      │                          │                            │  CREATE TABLE IF   │
      │                          │                            │  NOT EXISTS ...    │
      │                          │                            │◄── tables ready ───│
      │                          │                            │                    │
      │                          │                            │── seed_if_empty() ─►│
      │                          │                            │  SELECT COUNT(*)   │
      │                          │                            │  FROM users        │
      │                          │                            │◄── count = 0 ──────│
      │                          │                            │                    │
      │                          │                            │  (first run only)  │
      │                          │                            │── INSERT user ─────►│
      │                          │                            │  admin@gmail.com   │
      │                          │                            │  bcrypt(admin123)  │
      │                          │                            │  role: admin       │
      │                          │                            │◄── OK ─────────────│
      │                          │                            │                    │
      │                          │◄── "Application startup    │                    │
      │                          │     complete" log          │                    │
      │                          │                            │                    │
      │                          │  Uvicorn listening on      │                    │
      │◄── ready ────────────────│  http://0.0.0.0:8001       │                    │
```

---

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend framework | React + TypeScript | 18 / 5 | SPA, component rendering |
| Build tool | Vite | 7 | Dev server (HMR), production bundle |
| Styling | CSS Custom Properties | — | Golden/amber theme, no CSS framework |
| HTTP client | Fetch API | browser native | JWT-attached REST calls |
| Backend framework | FastAPI + Uvicorn | 0.115 | ASGI, auto OpenAPI docs |
| Language | Python | 3.13 | Backend runtime |
| ORM | SQLAlchemy | 2 | DB models, session management |
| Database | SQLite | 3 | File-based DB (`backend/rag.db`) |
| Auth | JWT HS256 + bcrypt | — | Stateless tokens, 480 min expiry |
| Embedding model | text-embedding-3-small | — | 1536-dim semantic vectors |
| LLM | gpt-4o-mini | — | Cited answer generation, 128K ctx |
| AI gateway | OpenRouter | — | Unified API for LLM + embeddings |
| Similarity search | Cosine (in-process) | — | Pure Python, no vector DB needed |
| Embed cache | Python `dict` | — | Skip re-embedding unchanged docs |

### Key Features

| Feature | How It Works |
|---------|-------------|
| 🔍 Semantic Search | Query and docs both embedded to 1536-dim vectors; cosine distance used — not keyword matching |
| 📎 Cited Answers | GPT-4o-mini receives doc IDs in prompt; response references `[DOC-N]` labels |
| 📊 Confidence Score | Top document's cosine similarity score (0.0–1.0) returned with every response |
| 🔎 Why This Answer? | UI panel shows all 6 retrieved docs, their titles, snippets, and individual scores |
| 🛡️ JWT Auth | HS256 signed token; each API request validated server-side; 401 on expiry |
| 👥 Role-Based UI | Admin sees audit log + manage-all-docs; intern sees chat + own docs only |
| 📝 Audit Log | Every `/chat` call stored with user, query, answer, confidence, and source IDs |
| ⚡ Embedding Cache | `_embed_cache: dict[int, list[float]]` in `chat.py`; cleared on backend restart |
| 🌱 Auto-Seed Admin | `seed_if_empty()` runs at startup; idempotent — safe to restart multiple times |

---

## 📁 Project Structure

```
HackerRank_q1/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entrypoint
│   │   ├── config.py         # Environment config
│   │   ├── db.py             # SQLAlchemy session + init
│   │   ├── models.py         # DB models (User, KBDocument, AuditLog, etc.)
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── auth.py           # JWT + bcrypt utilities
│   │   ├── seed.py           # Auto-seed admin user
│   │   └── routers/
│   │       ├── auth.py       # /auth/login, /auth/signup
│   │       ├── chat.py       # /chat (main RAG endpoint)
│   │       ├── kb_docs.py    # /kb/docs (user KB CRUD)
│   │       ├── admin_docs.py # /admin/docs (admin KB CRUD)
│   │       └── audit.py      # /admin/audit-log
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Environment variables (create this)
│   └── rag.db                # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main router
│   │   ├── Login.tsx         # Login/Signup page
│   │   ├── Dashboard.tsx     # Dashboard with stats
│   │   ├── Chat.tsx          # Chat interface with RAG
│   │   ├── KBPage.tsx        # Knowledge Base management
│   │   ├── api.ts            # API client + TypeScript types
│   │   └── index.css         # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env                  # Frontend env vars (create this)
│   └── node_modules/         # npm dependencies (auto-created)
├── seeding_data/             # Pre-made KB documents (add via UI)
│   ├── pdfs/                 # 3 AI/ML research documents
│   ├── sql_csv/              # 2 CSV datasets (customers, sales)
│   ├── json_logs/            # 2 JSON logs (performance, security)
│   ├── technical/            # 2 technical docs (API ref, architecture)
│   ├── compliance/           # 2 compliance docs (GDPR, ISO/SOC2)
│   ├── operational/          # 2 operational docs (runbook, health)
│   └── README.txt            # Seeding guide & example queries
└── README.md                 # This file
```

---

## 🔑 Default Credentials

### Admin User (auto-created on backend startup)
- **Email:** `admin@gmail.com`
- **Password:** `admin123`
- **Role:** `admin`
- **Permissions:** Full access to all endpoints + audit log

### Regular Users
Create via Signup page (http://localhost:5173) or `/auth/signup` API endpoint.
- Default role: `intern` (upgradable by admin)
- Can: chat, view/add/delete own KB docs
- Cannot: access audit log, manage all KB docs

---

## 🛠️ Common Commands

### Backend
```powershell
# Start backend (from backend/ directory)
python -m uvicorn app.main:app --port 8001 --reload

# Check if backend is running
curl http://localhost:8001/health

# View logs
# (stdout in terminal where uvicorn is running)
```

### Frontend
```powershell
# Start frontend (from frontend/ directory)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database
```powershell
# Delete database (reset everything)
Remove-Item backend\rag.db

# View database (install sqlite-tools first)
sqlite3 backend\rag.db
sqlite> .tables
sqlite> SELECT * FROM users;
sqlite> .quit
```

---

## 📊 API Endpoints

### Authentication
- `POST /auth/login` - Login (returns JWT token)
- `POST /auth/signup` - Create new user

### Chat
- `POST /chat` - Ask RAG question (requires JWT)

### Knowledge Base (User)
- `GET /kb/docs` - List all KB documents
- `POST /kb/docs` - Add new document
- `DELETE /kb/docs/{id}` - Delete own document (admin: any)

### Admin Only
- `GET /admin/docs` - List all KB docs (admin view)
- `POST /admin/docs` - Create KB document
- `PATCH /admin/docs/{id}` - Update KB document
- `DELETE /admin/docs/{id}` - Delete any KB document
- `GET /admin/audit-log` - View all chat queries + confidence scores

---

## 🐛 Troubleshooting

### ❌ `ModuleNotFoundError: No module named 'fastapi'`
- You forgot to activate the virtual environment, or installed into the wrong Python
- Fix: `.\.\venv\Scripts\Activate.ps1` then `pip install -r backend/requirements.txt`
- Verify: `pip show fastapi` should print version info

### ❌ `python --version` shows 3.11 or lower
- The wrong Python is on your PATH
- Fix (Anaconda): `conda create -n rag python=3.13 -y` then `conda activate rag`
- Fix (standard): Download Python 3.13 from [python.org](https://www.python.org/downloads/), check "Add to PATH" during install

### ❌ Backend won't start — port already in use
```powershell
# Find what's using port 8001
netstat -ano | findstr :8001
# Kill that process (replace 12345 with the PID shown)
Stop-Process -Id 12345 -Force
```

### ❌ `[Errno 2] No such file or directory: 'backend/.env'` or `OPENROUTER_API_KEY is empty`
- You haven't created `backend/.env` yet
- Fix: `New-Item backend\.env -ItemType File` then open with `notepad backend\.env` and paste the template from Step 2c above

### ❌ `401 Unauthorized` when calling the API
- JWT token is missing, expired, or wrong
- Fix: Log out and log back in — a new token will be issued (valid 480 min)
- Make sure `frontend/.env` has `VITE_API_URL=http://localhost:8001` (no trailing slash)

### ❌ CORS error in browser console (`Access-Control-Allow-Origin`)
- Vite is running on a port not listed in `CORS_ORIGINS` in `backend/.env`
- Fix: Check which port Vite actually started on (look at terminal output), then add it to `CORS_ORIGINS`
- Example: if Vite is on 5174, add `http://localhost:5174` to the comma-separated list, then restart the backend

### ❌ Frontend blank page or `Failed to fetch`
- Backend is not running or `VITE_API_URL` is wrong
- Fix: Confirm backend is running (`curl http://localhost:8001/health` should return `{"status":"ok"}`)
- Fix: Check `frontend/.env` — value must be `http://localhost:8001` with no trailing slash

### ❌ Chat returns empty answer or very low confidence (< 0.2)
- No KB documents have been added yet
- Fix: Follow the **Seeding Knowledge Base Documents** section — add at least a few docs first, then try chat again
- After adding docs, confidence >0.5 means a relevant document was found

### ❌ `scripts cannot be loaded because running scripts is disabled` (PowerShell)
- Windows execution policy is blocking the venv activation script
- Fix (run once as the current user, no admin needed):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ `npm: command not found` or `node: command not found`
- Node.js is not installed or not on PATH
- Fix: Download from [nodejs.org](https://nodejs.org/) (LTS version), restart PowerShell after installing

---

## 📝 Notes

- **Database:** SQLite file stored at `backend/rag.db` (auto-created on first run)
- **Embedding Cache:** Cleared on backend restart (in-process Python dict)
- **RBAC:** Role-based access control UI elements present but NOT enforced on documents (all users see all docs)
- **Production:** For production use, switch to PostgreSQL, use proper JWT secret, enable HTTPS, deploy with Docker/K8s

---

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [React TypeScript Docs](https://react-typescript-cheatsheet.netlify.app/)
- [SQLAlchemy 2.0 Docs](https://docs.sqlalchemy.org/)

---

## 📄 License

Internal use only - Enterprise Intelligence Ltd
