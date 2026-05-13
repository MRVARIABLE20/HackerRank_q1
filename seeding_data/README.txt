SEEDING DATA — Enterprise Knowledge Base Documents
===================================================

This folder contains 13 pre-made documents across 6 categories for seeding
the Knowledge Base. These documents provide realistic enterprise content for
testing the RAG system.

CATEGORIES & FILES
------------------

📚 pdfs/ (Research & Internal Documents)
  - fine_tuning_flan_t5_rl.txt      — AI/ML research: Fine-tuning Flan-T5 with RL
  - genai_notes.txt                  — GenAI study guide: LLMs, RAG, embeddings
  - ai_compliance_research.txt       — Research paper: AI in compliance monitoring

📊 sql_csv/ (Structured Data)
  - customer_database.csv            — 25 customers with ARR, tier, health scores
  - sales_q1_2026.csv                — Q1 2026 sales deals by region & rep

📋 json_logs/ (Application Logs)
  - app_performance_q1_2026.json     — Q1 performance metrics: latency, errors, SLOs
  - security_audit_april_2026.json   — April security audit: events, vulnerabilities

🔧 technical/ (Engineering Documentation)
  - api_reference_v1.txt             — REST API reference for the platform
  - rag_architecture_v2.1.txt        — RAG system architecture overview

📜 compliance/ (Policies & Standards)
  - gdpr_data_retention_policy.txt   — GDPR-compliant data retention rules
  - iso27001_soc2_status_fy2026.txt  — ISO 27001 & SOC 2 compliance status

⚙️ operational/ (Ops & Infrastructure)
  - incident_response_runbook.txt    — SEV-1/2/3/4 incident response procedures
  - infrastructure_health_may_2026.csv — May 2026 infrastructure health metrics

SEEDING METHODS
---------------

Option 1: Automated (Recommended)
  Run the seed_kb.py script from project root:
    cd C:\Users\aayan\Downloads\HackerRank_q1
    python seed_kb.py

Option 2: Manual Upload
  1. Login as admin (admin@gmail.com / admin123)
  2. Navigate to Knowledge Base page
  3. Select category, paste title + content, click Add Document
  4. Repeat for all 13 files

QUERY EXAMPLES
--------------
Once seeded, try these questions in the Chat interface:

From compliance/:
  - "What is our GDPR data retention policy?"
  - "What are the ISO 27001 compliance gaps?"
  - "When is our next SOC 2 audit?"

From sql_csv/:
  - "Which customers have high churn risk?"
  - "Summarize Q1 2026 sales performance"
  - "Show me enterprise customers in APAC"

From json_logs/:
  - "What was the API error rate in Q1 2026?"
  - "Were there any critical security events in April?"
  - "What are the SLO targets and actual performance?"

From technical/:
  - "How does the RAG architecture work?"
  - "What embedding model do we use?"
  - "Show me the /chat endpoint documentation"

From operational/:
  - "What is the SEV-1 incident response procedure?"
  - "What was our platform availability in May 2026?"
  - "What is the RTO and RPO for disaster recovery?"

From pdfs/:
  - "Explain fine-tuning Flan-T5 with RLHF"
  - "What are the different types of LLM architectures?"
  - "How does AI help with AML compliance monitoring?"

NOTES
-----
- All files are .txt format (even "PDFs") for simplicity
- Content limits: 50,000 characters per document
- CSV/JSON files can be uploaded as-is or formatted
- Total corpus size: ~85KB across 13 documents
- Expected seed time: 5-10 seconds via script
    security_audit_april_2026.json → Category: JSON / Log Data     (upload JSON file)
    app_performance_q1_2026.json   → Category: JSON / Log Data     (upload JSON file)

  technical/
    rag_architecture_v2.1.txt      → Category: Technical Docs      (paste content)
    api_reference_v1.txt           → Category: Technical Docs      (paste content)

  compliance/
    gdpr_data_retention_policy.txt → Category: Compliance & Legal  (paste content)
    iso27001_soc2_status_fy2026.txt→ Category: Compliance & Legal  (paste content)

  operational/
    infrastructure_health_may_2026.csv → Category: Operational Data (upload CSV file)
    incident_response_runbook.txt      → Category: Operational Data (paste content)

NOTES
  - CSV files (sql_csv/ and operational/) can be uploaded directly via the
    table builder's "Upload CSV" button — the UI parses them automatically.
  - JSON files (json_logs/) can be uploaded via the KV builder's "Upload JSON"
    button — top-level keys become searchable fields.
  - TXT files can be pasted into the textarea OR uploaded via the upload zone.
  - Once uploaded, ask the chatbot: "What is our remote work policy?" or
    "Show me Q1 sales results" to verify retrieval is working.
