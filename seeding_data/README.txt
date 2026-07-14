SEEDING DATA — RAG Atlas Knowledge Base
========================================

This folder contains 48 documents across 14 RAG strategy categories.
All documents are seeded automatically on first backend startup —
no manual steps required.

To reset and re-seed: delete backend/rag.db and restart the backend.
To add new documents: drop files into the matching folder and restart.


SUPPORTED FILE TYPES
--------------------
  .txt  .md   — plain text / markdown (stored as-is)
  .csv  .tsv  — tabular data (BM25/SQL indexed)
  .json        — structured JSON (stored as formatted text)
  .pdf         — PDF (text extracted via PyMuPDF, embedded viewer in KB)
  .png  .jpg  — images (stored as base64, rendered as <img> in KB)
  .mp4  .webm .mov — videos (served from /seed-files/, rendered as <video>)


CATEGORIES & FILES (48 total)
------------------------------

01_naive_rag/  →  "01 Naive RAG"
  Classic vector similarity search — embed query and docs, rank by cosine distance.
  Files:
    gutenberg_pride_and_prejudice.txt    — Jane Austen novel (Project Gutenberg)
    huggingface_transformers_readme.md   — HuggingFace Transformers library README
    arxiv_2005.11401_rag_original.pdf    — Original RAG paper (Lewis et al., 2020)

02_bm25_rag/  →  "02 BM25 RAG"
  Keyword-based BM25 ranking (no vectors). Best for exact-match and term-frequency queries.
  Files:
    gutenberg_sherlock_holmes.txt        — The Adventures of Sherlock Holmes (Gutenberg)
    seaborn_titanic.csv                  — Titanic passenger survival dataset (891 rows)
    vega_movies.json                     — Movie metadata dataset (Vega sample)

03_hybrid_rag/  →  "03 Hybrid RAG"
  BM25 score + cosine vector score fused for best-of-both-worlds retrieval.
  Files:
    gutenberg_huckleberry_finn.txt       — Adventures of Huckleberry Finn (Gutenberg)
    seaborn_mpg.csv                      — Car fuel efficiency dataset (mpg, cylinders, horsepower)
    vega_cars.json                       — Car specifications dataset (Vega sample)

04_self_rag/  →  "04 Self-RAG"
  Model decides whether retrieval is needed before answering.
  Files:
    gutenberg_frankenstein.txt           — Frankenstein by Mary Shelley (Gutenberg)
    pytorch_readme.md                    — PyTorch deep learning framework README
    arxiv_2310.11511_self_rag.pdf        — Self-RAG paper (Asai et al., 2023)

05_corrective_rag/  →  "05 Corrective RAG"
  Falls back to Tavily web search when KB docs score below the relevance threshold.
  Files:
    gutenberg_tale_of_two_cities.txt     — A Tale of Two Cities by Dickens (Gutenberg)
    pandas_readme.md                     — Pandas data analysis library README
    arxiv_2401.15884_corrective_rag.pdf  — Corrective RAG paper (Yan et al., 2024)

06_graph_rag/  →  "06 Graph RAG"
  Builds an entity-relationship graph from docs; traverses it for multi-entity queries.
  Files:
    gutenberg_war_and_peace.txt          — War and Peace by Tolstoy (Gutenberg)
    d3_readme.md                         — D3.js data visualisation library README
    arxiv_2404.16130_graph_rag.pdf       — Graph RAG paper (Edge et al., 2024)

07_speculative_rag/  →  "07 Speculative RAG"
  Drafts a speculative answer first, then verifies and refines it with retrieved docs.
  Files:
    gutenberg_moby_dick.txt              — Moby-Dick by Herman Melville (Gutenberg)
    numpy_readme.md                      — NumPy numerical computing library README
    arxiv_2201.11903_chain_of_thought.pdf — Chain-of-Thought Prompting paper (Wei et al., 2022)

08_rag_fusion/  →  "08 RAG-Fusion"
  Generates multiple query variants, retrieves for each, fuses with reciprocal rank fusion.
  Files:
    gutenberg_dracula.txt                — Dracula by Bram Stoker (Gutenberg)
    fastapi_readme.md                    — FastAPI web framework README
    arxiv_2004.04906_dense_passage_retrieval.pdf — DPR paper (Karpukhin et al., 2020)

09_adaptive_rag/  →  "09 Adaptive RAG"
  Detects content type (text / tabular / mixed) and routes to the best retrieval method.
  Files:
    gutenberg_alice_in_wonderland.txt    — Alice's Adventures in Wonderland (Gutenberg)
    flask_readme.md                      — Flask web framework README
    vega_seattle_weather.csv             — Seattle daily weather data (temp, wind, precipitation)
    vega_population.json                 — World population by country/year (Vega sample)
    arxiv_2403.14403_adaptive_rag.pdf    — Adaptive RAG paper (Jeong et al., 2024)

10_agentic_rag/  →  "10 Agentic RAG"
  Multi-step agent loop with tool use; falls back to Tavily web search for fresh info.
  Files:
    gutenberg_the_prince.txt             — The Prince by Machiavelli (Gutenberg)
    seaborn_diamonds.csv                 — Diamond prices dataset (carat, cut, price, ~54k rows)
    vega_flights_5k.json                 — Flight delay/distance dataset (5 000 flights, Vega)
    arxiv_2210.03629_react.pdf           — ReAct paper (Yao et al., 2022)

11_multihop_rag/  →  "11 Multi-hop RAG"
  Chains multiple retrieval steps to answer questions that require crossing several docs.
  Files:
    gutenberg_crime_and_punishment.txt   — Crime and Punishment by Dostoevsky (Gutenberg)
    nodejs_readme.md                     — Node.js runtime README
    arxiv_2005.14165_gpt3_fewshot.pdf    — GPT-3 few-shot learners paper (Brown et al., 2020)

12_sql_rag/  →  "12 SQL RAG"
  Runs DuckDB SQL queries directly on CSV/TSV files — bypasses the vector store entirely.
  Files:
    gutenberg_a_modest_proposal.txt      — A Modest Proposal by Jonathan Swift (Gutenberg)
    seaborn_penguins.csv                 — Palmer Penguins dataset (species, island, measurements)
    seaborn_penguins.tsv                 — Same dataset in TSV format (tab-separated)

13_multimodal_rag/  →  "13 Multimodal RAG"
  Handles all content types: plain text, PDFs, images (PNG/JPG), and videos (MP4).
  Files:
    gutenberg_picture_of_dorian_gray.txt — The Picture of Dorian Gray by Oscar Wilde (Gutenberg)
    vega_ffox.png                        — Firefox logo (PNG image sample)
    matplotlib_grace_hopper.jpg          — Grace Hopper portrait (JPG image sample)
    arxiv_2103.00020_clip.pdf            — CLIP paper (Radford et al., 2021) — PDF with text
    google_io_multimodal_rag.mp4         — Google I/O multimodal RAG demo video

14_modular_rag/  →  "14 Modular RAG"
  Plugin architecture — inspects the query and routes it to the most suitable sub-RAG.
  Files:
    gutenberg_jane_eyre.txt              — Jane Eyre by Charlotte Bronte (Gutenberg)
    vega_stocks.csv                      — Stock closing prices over time (Vega sample)
    vega_flare.json                      — Hierarchical software package data (Vega sample)
    arxiv_1706.03762_attention_is_all_you_need.pdf — Transformer paper (Vaswani et al., 2017)


EXAMPLE QUERIES PER STRATEGY
-----------------------------
Use these in the Chat page after selecting the matching strategy.

01 Naive RAG
  "What happens at the Netherfield ball in Pride and Prejudice?"
  "What is the HuggingFace Transformers pipeline API?"
  "How does the original RAG model combine retrieval and generation?"

02 BM25 RAG
  "Did Rose survive the Titanic? What was the passenger class distribution?"
  "Which Sherlock Holmes story involves a speckled band?"
  "What are the top-rated movies in the dataset?"

03 Hybrid RAG
  "What is the average horsepower for 8-cylinder cars in the MPG dataset?"
  "Describe Huck Finn's raft journey down the Mississippi."
  "Which cars have the best fuel efficiency?"

04 Self-RAG
  "What motivates Victor Frankenstein to create the creature?"
  "How does PyTorch's autograd system work?"
  "What are the four types of special tokens in Self-RAG?"

05 Corrective RAG
  "Summarise the Corrective RAG paper's main contribution."
  "What is the opening scene of A Tale of Two Cities?"
  "What are the key features of the Pandas library?"

06 Graph RAG
  "What are the relationships between Natasha, Pierre, and Andrei in War and Peace?"
  "How does the D3.js data join pattern work?"
  "How does Graph RAG build a community hierarchy from documents?"

07 Speculative RAG
  "What is Captain Ahab's obsession in Moby Dick?"
  "Explain the chain-of-thought prompting technique from the paper."
  "What are NumPy's broadcasting rules?"

08 RAG-Fusion
  "Summarise the DPR paper's approach to open-domain question answering."
  "What is the plot of Dracula?"
  "How does FastAPI handle dependency injection?"

09 Adaptive RAG
  "What is the average rainfall in Seattle in January?"
  "What country has the highest population growth in the dataset?"
  "Describe Alice's first encounter with the White Rabbit."

10 Agentic RAG
  "What is the average price of Ideal-cut diamonds over 1 carat?"
  "Which flights in the dataset have delays over 2 hours?"
  "What are Machiavelli's main principles of political power in The Prince?"

11 Multi-hop RAG
  "How does the GPT-3 paper relate to few-shot learning, and how does Node.js use similar ideas?"
  "What crime does Raskolnikov commit and what drives him to confess?"
  "Compare the architecture described in the GPT-3 paper with Node.js's event loop."

12 SQL RAG
  "How many Adelie penguins are in the dataset and what is their average flipper length?"
  "What is the sex breakdown of Chinstrap penguins on Dream Island?"
  "Which penguin species has the heaviest body mass on average?"

13 Multimodal RAG
  "What does the CLIP paper say about zero-shot image classification?"
  "What visual content is available in the knowledge base?"
  "Describe the picture of Dorian Gray's portrait and its significance."

14 Modular RAG
  "What was the closing price of AAPL stock on the most recent date in the dataset?"
  "Explain the attention mechanism from the 'Attention Is All You Need' paper."
  "What is the largest software package in the Flare hierarchy dataset?"


HOW SEEDING WORKS
-----------------
On every backend startup, backend/app/seed.py runs seed_if_empty():

  1. Creates the admin role and admin@gmail.com / admin123 user (first run only)
  2. Scans each folder in seeding_data/ and maps it to its KB category
  3. Reads each supported file and stores its content in the SQLite DB
  4. Tags every inserted doc with created_by="system@seed"
  5. Skips docs whose title is already present (idempotent)

Content storage by type:
  .txt / .md / .csv / .tsv / .json  — raw text stored directly
  .pdf   — text extracted by PyMuPDF; stored as __PDF__:<path>\n\n<text>
  .png / .jpg  — stored as base64 data URL (rendered as <img> in KB page)
  .mp4 / .webm — stored as __VIDEO__:<folder>/<file>  (served via /seed-files/)

To add your own documents:
  1. Drop the file into the matching seeding_data/<folder>/
  2. Restart the backend (python -m uvicorn app.main:app --port 8001 --reload)
  3. The new doc appears automatically in the KB under the right category

To reset everything:
  Remove-Item backend\rag.db
  (then restart — all 48 docs are re-seeded from scratch)
