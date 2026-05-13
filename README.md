# Enterprise RAG Intelligence Platform

Production-grade Retrieval-Augmented Generation (RAG) system with FastAPI backend and React TypeScript frontend.

## 📋 Prerequisites

### Required Software
- **Python 3.13+** (Anaconda recommended)
- **Node.js 18+** and npm
- **Git** (for version control)

### Required API Keys
- **OpenRouter API Key** - Get from [openrouter.ai](https://openrouter.ai/keys)
  - Used for: GPT-4o-mini chat + text-embedding-3-small embeddings
  - Cost: ~$0.02 per 1K queries

---

## 🚀 Quick Start

### 1. Clone and Navigate
```powershell
cd C:\Users\aayan\Downloads\HackerRank_q1
```

### 2. Backend Setup

#### Install Dependencies
```powershell
cd backend
pip install -r requirements.txt
```

#### Configure Environment
Create `backend/.env` file:
```env
DATABASE_URL_OVERRIDE=sqlite:///./rag.db
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176
JWT_SECRET=dev-secret-change-in-prod
JWT_EXP_MINUTES=480
OPENROUTER_API_KEY=your-api-key-here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

⚠️ **Replace `your-api-key-here` with your actual OpenRouter API key**

#### Start Backend Server
```powershell
# From backend/ directory
python -m uvicorn app.main:app --port 8001 --reload
```

**Backend runs on:** http://localhost:8001

✅ **Admin user auto-created on first start:**
- Email: `admin@gmail.com`
- Password: `admin123`

### 3. Frontend Setup

#### Install Dependencies
```powershell
cd frontend
npm install
```

#### Configure Environment
Create `frontend/.env` file:
```env
VITE_API_URL=http://localhost:8001
```

#### Start Frontend Dev Server
```powershell
npm run dev
```

**Frontend runs on:** http://localhost:5173 (or next available port)

---

## 🔑 Getting Your OpenRouter API Key

Before starting the backend, you need an OpenRouter API key for embeddings and chat:

1. **Sign up at OpenRouter:**
   - Visit [openrouter.ai](https://openrouter.ai)
   - Click "Sign In" → Sign up with Google/GitHub/Email

2. **Generate API Key:**
   - Go to [Keys page](https://openrouter.ai/keys)
   - Click "Create Key"
   - Give it a name (e.g., "RAG Dev")
   - Copy the key (starts with `sk-or-v1-...`)

3. **Add $5-10 credits:**
   - Go to [Credits page](https://openrouter.ai/credits)
   - Add credits via card/crypto
   - Typical usage: ~$0.02 per 1K queries

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

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER / CLIENT                                   │
│                         (Web Browser / API Client)                          │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ HTTP/HTTPS
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                          FRONTEND LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              React 18 + TypeScript 5 + Vite 7                       │   │
│  │              Port: 5173 (dev) / 3000 (prod)                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Components:                                                         │   │
│  │  • Dashboard.tsx    → Stats, navigation, analytics                 │   │
│  │  • Chat.tsx         → RAG query interface + citations               │   │
│  │  • KnowledgeBase.tsx → Document management (add/edit/delete)        │   │
│  │  • Login.tsx        → Authentication form                           │   │
│  │  • AuditLog.tsx     → Admin query history viewer                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ REST API (JSON)
                                 │ Authorization: Bearer <JWT>
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                          BACKEND LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │           FastAPI 0.115 + Uvicorn ASGI Server                       │   │
│  │              Port: 8001 (dev) / 8000 (prod)                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  API Routers:                                                        │   │
│  │  • /auth/*         → Login, signup, JWT token generation            │   │
│  │  • /chat           → RAG query endpoint (semantic search + LLM)     │   │
│  │  • /kb/docs/*      → User KB document CRUD                          │   │
│  │  • /admin/docs/*   → Admin KB document management                   │   │
│  │  • /admin/audit/*  → Query history & analytics                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Core Services:                                                      │   │
│  │  • auth.py         → JWT HS256 + bcrypt password hashing            │   │
│  │  • seed.py         → Auto-create admin@gmail.com on startup         │   │
│  │  • config.py       → Environment settings loader                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────────────┬───────────────┘
           │                                                  │
           │ SQLAlchemy 2 ORM                                 │ HTTPS
           │                                                  │
┌──────────▼──────────────────────┐          ┌───────────────▼───────────────┐
│     DATABASE LAYER              │          │   EXTERNAL SERVICES            │
│  ┌──────────────────────────┐   │          │  ┌─────────────────────────┐  │
│  │   SQLite (rag.db)        │   │          │  │   OpenRouter API        │  │
│  │   Location: backend/     │   │          │  │   openrouter.ai         │  │
│  ├──────────────────────────┤   │          │  ├─────────────────────────┤  │
│  │  Tables:                 │   │          │  │  Models:                │  │
│  │  • users                 │   │          │  │  • gpt-4o-mini          │  │
│  │    (id, email, hash)     │   │          │  │    (Chat LLM)           │  │
│  │  • roles                 │   │          │  │  • text-embedding-      │  │
│  │    (id, name)            │   │          │  │    3-small              │  │
│  │  • user_roles            │   │          │  │    (1536-dim vectors)   │  │
│  │    (user_id, role_id)    │   │          │  │                         │  │
│  │  • kb_documents          │   │          │  │  Cost: ~$0.02/1K        │  │
│  │    (id, title, content,  │   │          │  │        queries          │  │
│  │     category, metadata)  │   │          │  └─────────────────────────┘  │
│  │  • audit_logs            │   │          └───────────────────────────────┘
│  │    (id, user, query,     │   │
│  │     timestamp)           │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       RAG PIPELINE FLOW (Detailed)                           │
└─────────────────────────────────────────────────────────────────────────────┘

    [1] User Query                    [2] Authentication
         ↓                                     ↓
    "What is our                      JWT token validation
     GDPR policy?"                    (backend/app/auth.py)
         ↓                                     ↓
         └─────────────────┬───────────────────┘
                          │
                [3] POST /chat
         ┌─────────────────▼─────────────────┐
         │  Embed User Query                 │
         │  → OpenRouter API                 │
         │  → text-embedding-3-small         │
         │  → Returns: [1536-dim vector]     │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  Load All KB Documents            │
         │  → Query: kb_documents table      │
         │  → Check embedding cache          │
         │  → Embed new docs if needed       │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  Semantic Search                  │
         │  → Compute cosine similarity      │
         │  → Between query & each doc       │
         │  → Rank all documents             │
         │  → Select top-6 matches           │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  Assemble Context Prompt          │
         │  → Template:                      │
         │    "Based on these docs:          │
         │     [DOC-1] <content>             │
         │     [DOC-2] <content>             │
         │     ...                           │
         │     Answer: <user query>"         │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  LLM Generation                   │
         │  → OpenRouter gpt-4o-mini         │
         │  → System: You are RAG assistant  │
         │  → Context: Top-6 doc snippets    │
         │  → Generate cited answer          │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  Log Query                        │
         │  → audit_logs table               │
         │  → (user, query, timestamp)       │
         └─────────────────┬─────────────────┘
                          │
         ┌─────────────────▼─────────────────┐
         │  Return Response                  │
         │  {                                │
         │    "answer": "...",               │
         │    "sources": [                   │
         │      {                            │
         │        "doc_id": 1,               │
         │        "title": "...",            │
         │        "snippet": "...",          │
         │        "score": 0.89              │
         │      }                            │
         │    ],                             │
         │    "confidence": 0.89             │
         │  }                                │
         └───────────────────────────────────┘
```

### Technology Stack

**Backend (FastAPI)**
- **Framework:** FastAPI 0.115 + Uvicorn ASGI server
- **Database:** SQLite (dev) with SQLAlchemy 2 ORM
- **Authentication:** JWT HS256 tokens (480 min expiry) + bcrypt password hashing
- **Embeddings:** OpenRouter `text-embedding-3-small` (1536-dim)
- **LLM:** OpenRouter `gpt-4o-mini`
- **Retrieval:** Semantic similarity (cosine) on embeddings, top-6 docs
- **Cache:** In-process embedding cache (invalidated on CRUD)

**Frontend (React + TypeScript)**
- **Framework:** Vite 7 + React 18 + TypeScript 5
- **Styling:** CSS variables with golden/amber theme
- **State:** React hooks (no external state management)
- **API Client:** Fetch API with TypeScript types

### Key Features
✅ Semantic retrieval with AI embeddings  
✅ Cited answers with source document references  
✅ Confidence scoring (0.0-1.0 cosine similarity)  
✅ "Why This Answer?" explainability panel  
✅ Admin audit log of all queries  
✅ User + Admin KB document management  
✅ JWT authentication with role-based UI  
✅ Auto-seeded admin user on startup  

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

### Backend won't start
- **Check Python version:** `python --version` (need 3.13+)
- **Check port 8001 availability:** `netstat -ano | findstr :8001`
- **Verify .env file exists:** `backend/.env` with OpenRouter API key
- **Check dependencies:** `pip install -r backend/requirements.txt`

### Frontend won't start
- **Check Node version:** `node --version` (need 18+)
- **Clear node_modules:** `Remove-Item -Recurse frontend\node_modules; cd frontend; npm install`
- **Check port availability:** Frontend will auto-increment (5173 → 5174 → ...)

### No KB documents / empty responses
- **Check if documents are seeded:** Login → KB page → should see 13 documents
- **Add documents via UI:** Follow the "Seeding Knowledge Base Documents" section above
- **Verify OpenRouter API key:** Check backend logs for embedding errors

### Low confidence scores
- **Expected for out-of-scope questions:** Confidence <0.4 is normal for unrelated queries
- **Good score range:** >0.5 indicates relevant document found
- **Check document content:** Ensure seeded docs match your query topics

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
docker compose -f infra/docker-compose.yml exec api python -m ingestion.run --path /app/data/corpus

# 3. Open the UI
start http://localhost:3000
```

### Demo accounts

| Email | Role | Clearance |
|---|---|---|
| `intern@corp.com` | intern | public |
| `analyst@corp.com` | analyst | internal |
| `manager@corp.com` | manager | confidential |
| `cfo@corp.com` | cfo | restricted |
| `admin@corp.com` | admin | restricted (+ audit access) |

Password for all demo accounts: `demo1234` (seeded only — do not use in prod).

## Evaluation

```powershell
docker compose -f infra/docker-compose.yml exec api python -m evals.run
```

Reports RAGAS metrics (faithfulness, context_precision, context_recall, answer_relevancy) plus the critical **rbac_violation_rate** which must be `0`.

## Tech choices

- **LangGraph** — explicit stateful DAG; each node = an auditable step (chosen over Semantic Kernel for Python/Gemini fit and ecosystem maturity).
- **Qdrant** — payload filters enforce RBAC *at the index*, not post-hoc; native dense + sparse hybrid.
- **Gemini 1.5 Pro / Flash** — Pro for generation, Flash for router/guard/verifier (cost + latency).
- **FastAPI + SSE** — streaming answers and trace events to the UI.
- **Next.js 14 + shadcn/ui** — polished chat with citation hover-cards and trace panel.
