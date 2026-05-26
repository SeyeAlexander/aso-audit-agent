# ASO Audit Agent

A Mastra-powered App Store Optimization auditor. Paste an Apple App Store URL into the
chat-style composer, confirm the app, and get a structured, evidence-backed ASO audit:
a weighted 0–100 score card, effort-bucketed recommendations with before/after examples,
and a top-3 competitor comparison.

## Prerequisites

- **Node ≥ 20** (`node -v`) — the build relies on modern type-stripping.
- Ports **5173** (web) and **5174** (API) free.

## Setup

```bash
npm install
cp .env.example .env   # add keys to unlock enrichment — see Configuration
npm run dev
```

`npm run dev` starts both processes together (via `concurrently`):

- API server on `http://localhost:5174`
- Web UI on `http://localhost:5173`

Open the web UI and paste any `apps.apple.com` listing URL.

## Configuration

The app is built as **progressive enhancement**: a complete audit with no setup, plus two
provider integrations that are fully wired in and switch on automatically when their keys
are present. Each layer degrades gracefully — a missing or failing provider never breaks
an audit, it just narrows the evidence (and the report says so).

| Tier | Keys needed | What you get |
|---|---|---|
| **Baseline** (default) | none | Full deterministic 10-dimension audit, competitor comparison, and recommendations with before/after — straight from Apple's public iTunes endpoints, no auth. |
| **+ LLM refinement** | `NVIDIA_API_KEY` *(or any `OPENAI_COMPATIBLE_*`)* | The ASO strategist agent rewrites recommendation prose and adds per-dimension qualitative notes in a senior-consultant voice. Deterministic scores stay frozen. |
| **+ Firecrawl** | `FIRECRAWL_API_KEY` | Recovers fields Apple hides from the Lookup API — real subtitle, promotional text, "What's New", and review snippets — enriching the dimensions that depend on them. |

```bash
# LLM refinement (NVIDIA NIM has a free tier; any OpenAI-compatible host works)
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-70b-instruct

# App Store page scraping (Firecrawl has a free tier)
FIRECRAWL_API_KEY=...
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v1
```

To use a different LLM host (OpenAI, Together, Groq, etc.), set the `OPENAI_COMPATIBLE_*`
vars in `.env.example` — they take precedence over NVIDIA when present.

## User flow

1. **Paste** an Apple App Store URL into the composer.
2. **Confirm** — the app fetches surface metadata (name, developer, icon, category,
   country) within ~300ms and asks *"Is this the app you want audited?"*
3. **Run** — on confirmation, the Mastra workflow fetches full listing evidence, finds
   2–3 same-category competitors, scores all ten ASO dimensions, and (if a model key is
   set) refines the prose.
4. **Review** — a structured report: score card, Quick Wins, High-Impact Changes,
   Strategic Recommendations, and a competitor comparison table. Your last five audits
   are kept in `localStorage` and re-open instantly from the home screen.

## The audit

Implements the brief's 10-dimension framework (title, subtitle, keyword field,
description, screenshots, app preview video, ratings & reviews, icon, conversion signals,
competitive position) with the specified weights, normalized to a 0–100 overall score.
Output matches the requested format:

- **Score card** — per-dimension 0–10 scores with progress bars and one overall score; each
  row expands to show the evidence that produced it.
- **Quick Wins / High-Impact / Strategic** — 3–5 recommendations each, every one citing a
  concrete data point and including before/after examples for text changes.
- **Competitor comparison** — dimension-by-dimension table against the top 3 category
  competitors, plus one-click "audit this competitor".

## Architecture

Mastra is used as application architecture, not decoration — tools own external actions,
the workflow owns orchestration, the agent owns recommendation refinement, and the
workspace skill owns audit methodology.

- `server/src/mastra/tools.ts` — Mastra tools: `fetchAppStoreListingTool`,
  `findAppStoreCompetitorsTool`, `scoreAsoAuditTool`.
- `server/src/mastra/workflows.ts` — the end-to-end workflow composing the tools and the
  optional parallel agent-refinement step.
- `server/src/mastra/agents.ts` — the ASO strategist agent; uses a model only when
  provider credentials are configured.
- `skills/aso-audit-methodology/SKILL.md` — workspace skill documenting the scoring rules
  and recommendation standards.
- `server/src/services/app-store-client.ts` — Apple public API client (iTunes
  Lookup/Search) plus lightweight page-hint and Firecrawl enrichment.
- `server/src/services/audit-engine.ts` — deterministic, typed ASO scoring and
  recommendation engine.
- `web/src` — React + Tailwind UI (chat-style input → confirm → progress → report).

## Decisions I made (where the brief left it to me)

**Chat-style input, structured report.** The brief frames a chat app; I kept the
conversational *entry point* (a composer you paste into, then a confirm prompt) but
present the audit as a structured report rather than chat turns. A score card, three
recommendation buckets, and a competitor table are made to be *scanned and compared* —
the brief itself asks to "present the recommendations in a way that's actually nice to
look at," and a chat transcript buries earlier sections behind scroll. The required
touchpoints (paste → confirm "is this the app?" → audit) are all preserved.

**Deterministic engine is the source of truth; the LLM only refines prose.** Scores come
from a typed scoring engine, never from the model. The agent rewrites recommendation
wording and adds qualitative notes, then the result is re-validated through Zod so a
misbehaving model can't corrupt the report. This keeps audits reproducible across the
unseen apps the reviewers will run — and means the app produces a complete audit with no
LLM key at all.

**Apple public endpoints first; Firecrawl and the LLM are additive.** The iTunes Lookup
API needs no auth and works on any listing, so it's the backbone. Firecrawl recovers
fields Apple hides (subtitle, promo text, "What's New", reviews) and the LLM polishes
copy — but both are optional, and their absence degrades gracefully with an explicit note
in the affected dimensions rather than an error.

**The brief's weights sum to 110%.** I preserved the relative importance and normalized
the total to exactly 100 so the overall score can't exceed 100.

**The 100-char keyword field is private** (App Store Connect only). Rather than fabricate
a score, the audit says so and estimates coverage from visible metadata — and surfaces
that caveat in the report itself.

**No accounts or database.** Recent audits live in browser `localStorage` (last five) and
re-open from cache instantly; the server is fully stateless. The brief didn't ask for
persistence, so this stays lightweight.

**Upstream errors are sanitized.** Apple/Firecrawl/LLM failures are logged server-side in
full but surface to the client as a generic "Server error" — no vendor internals leak
into the UI.
