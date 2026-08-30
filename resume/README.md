# Resume — Version Control

Source of truth for Chenshuhao (Cody) Qin's English resume (LaTeX, one page).

## Files

| File | Purpose |
|---|---|
| `Chenshuhao_Qin_Resume.tex` | LaTeX source (latest) |
| `Chenshuhao_Qin_Resume.pdf` | Compiled output (latest) |

## Versioning convention

- Each revision = one commit; each release = one annotated tag `vYYYY.MM` (e.g. `v2026.08`)
- Browse any past version: `git tag` → `git show v2026.08:resume/Chenshuhao_Qin_Resume.tex`
- Download a past PDF: open the tag on GitHub → `resume/Chenshuhao_Qin_Resume.pdf`

## Changelog

### v2026.08.3 (2026-08-29)
- Email switched to chenshuh@usc.edu (school email only)
- ChatDKU: ROUGE/BLEU replaced with deployment outcome (deployed at DKU, recognized by multiple offices, documented as Signature Work)
- Merged Projects + Publications into one "Projects & Publications" section

### v2026.08.1 (2026-08-29)
- Filled the page for visual balance (bottom gap 9% → 5%)
- **ATS keywords**: RAG spelled out, Prompt Engineering, Model Serving (vLLM), Embeddings & Vector Search (Milvus), REST APIs, Object Storage (OSS/S3), PyTest, SQL (MySQL/PostgreSQL); Skills split into 4 lines
- Alibaba Cloud company line now reads "(Top-4 Global Cloud Provider)"
- Split Alibaba bullet 4 into workspace / open-source bullets; restored "enhancement proposal adopted by maintainers" + PyTest/CI note
- ChatDKU: added SSO deployment; Tsinghua: (PyTorch); Blueberry: Milvus vector search spelled out

### v2026.08 (2026-08-29)
- **Added** Alibaba Cloud internship (AI Engineer Intern, Jun–Aug 2026): Tongyi Lab collaboration, Data-Juicer Agents productization for the Qwen ecosystem, Ray distributed execution (2,793 records / 16 operators / ~5 min), three-layer context control (−82% payload), full-stack React/FastAPI/MySQL workspace, 5 merged PRs to the 7k★ Data-Juicer ecosystem
- **Added** Blueberry AI internship (AI Engineer Intern, Remote — Burlingame, CA, Nov–Dec 2025): Milvus + MySQL 200K+ image vector indexing, DINOv3/Qwen-VL/BGE-VL benchmarking, multimodal retrieval POC
- **Cut** Agricultural Bank of China (2024) to keep the strict one-page format
- **Compressed** Tsinghua Sichuan, Leiting Games, ChatDKU into paragraph-style entries (≤3 lines each)
- **Demoted** ACM SenSys 2024 demo paper to a one-line Publications entry (second author noted)
- **Skills** refresh: +Ray, Kubernetes, Docker, FastAPI, React, MySQL, AgentScope, LoRA; −RPA, Vue.js
- Layout rebuilt with overlap-safe spacing (verified via word-coordinate collision checks)

### v2026.03
- Previous version (before Alibaba Cloud & Blueberry AI; included ABC internship)

## How to update

```bash
# 1. Edit the .tex, then compile
pdflatex Chenshuhao_Qin_Resume.tex   # verify "(1 page" in output

# 2. Commit and tag
git add resume/ && git commit -m "docs(resume): <what changed>"
git tag -a vYYYY.MM -m "resume release vYYYY.MM"
git push origin main --tags
```

## Sync to Overleaf

Open the Overleaf project → select all → paste the full content of `Chenshuhao_Qin_Resume.tex` → recompile. (Git access on Overleaf requires Premium; paste-sync is the free path.)
