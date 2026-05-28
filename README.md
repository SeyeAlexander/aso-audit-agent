# ASO Audit Agent

A Mastra-powered App Store Optimization auditor. Paste an Apple App Store URL into the
chat-style composer, confirm the app, and get a structured, evidence-backed ASO audit:
a weighted 0–100 score card, effort-bucketed recommendations with before/after examples,
and a top-3 competitor comparison.

> **Live demo:** _add the Vercel URL here once deployed._
> Frontend on Vercel, backend on Render — a Mastra agent does the scoring + recommendations
> using a workspace skill, with a deterministic TypeScript engine as the guardrail and fallback.

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

The audit is **agent-led**: a Mastra agent applies the ASO methodology skill to score the
listing and write the recommendations. A deterministic engine measures the facts the agent
reasons over, validates its output (clamps scores, recomputes the weighted total), and
stands in as a fallback. Both provider keys are free tiers and switch on automatically; the
app degrades gracefully if either is missing.

| Layer | Key | What it does |
| --- | --- | --- |
| **The agent** (set this) | `NVIDIA_API_KEY` (or any OpenAI-compatible host) | The ASO Strategist agent scores all 10 dimensions and writes the recommendations using the methodology skill. This is the real audit. |
| **Firecrawl** (recommended) | `FIRECRAWL_API_KEY` | Recovers fields Apple's Lookup API hides — subtitle, promotional text, "What's New", review snippets — so the agent has more evidence to work with. |
| **Fallback** (no keys) | none | A deterministic engine produces a complete 10-dimension audit from Apple's public endpoints. Used automatically when no LLM key is set, or if the agent call fails. |

```bash
# LLM refinement (NVIDIA NIM has a free tier; any OpenAI-compatible host works)
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-8b-instruct

# App Store page scraping (Firecrawl has a free tier)
FIRECRAWL_API_KEY=...
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v1
```

To use a different LLM host (OpenAI, Together, Groq, etc.), set the `OPENAI_COMPATIBLE_*`
vars in `.env.example` — they take precedence over NVIDIA when present.

## User flow

1. **Paste** an Apple App Store URL into the composer.
2. **Confirm** — the app fetches surface metadata (name, developer, icon, category,
   country) within ~300ms and asks _"Is this the app you want audited?"_
3. **Run** — on confirmation, the Mastra workflow fetches the full listing, finds 2–3
   same-category competitors, measures every dimension, then the ASO Strategist agent
   scores all ten dimensions and writes the recommendations. (With no model key it falls
   back to deterministic scoring.)
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
the workflow owns orchestration, the agent owns the audit (scoring + recommendations), and
the workspace skill owns the methodology the agent follows.

- `server/src/mastra/tools.ts` — Mastra tools: `fetchAppStoreListingTool`,
  `findAppStoreCompetitorsTool`, `scoreAsoAuditTool` (the last measures the facts and
  produces the deterministic fallback).
- `server/src/mastra/workflows.ts` — the end-to-end workflow: fetch → competitors →
  measure → the agent-audit step (two parallel LLM passes: scoring + recommendations),
  with deterministic guardrails and fallback.
- `server/src/mastra/agents.ts` — the ASO Strategist agent (model + methodology skill +
  tools); it scores the listing and writes the recommendations.
- `skills/aso-audit-methodology/SKILL.md` — workspace skill: the methodology the agent
  applies to score and recommend.
- `server/src/services/app-store-client.ts` — Apple public API client (iTunes
  Lookup/Search) plus lightweight page-hint and Firecrawl enrichment.
- `server/src/services/audit-engine.ts` — deterministic ASO engine: measures the facts the
  agent reasons over and serves as the validated fallback.
- `web/src` — React + Tailwind UI (chat-style input → confirm → progress → report).

## Decisions I made (where the brief left it to me)

**Chat-style input, structured report.** The brief frames a chat app; I kept the
conversational _entry point_ (a composer you paste into, then a confirm prompt) but
present the audit as a structured report rather than chat turns. A score card, three
recommendation buckets, and a competitor table are made to be _scanned and compared_ —
the brief itself asks to "present the recommendations in a way that's actually nice to
look at," and a chat transcript buries earlier sections behind scroll. The required
touchpoints (paste → confirm "is this the app?" → audit) are all preserved.

**The agent performs the audit; the deterministic engine is its guardrail and fallback.**
The brief's rubric reads as an agent's instructions ("You are an expert in ASO…") and asks
for idiomatic agents + skills — so the ASO Strategist agent does the judging: it scores all
ten dimensions and writes the recommendations using the methodology skill. The deterministic
engine plays three supporting roles: it **measures** the facts the agent reasons over; it
**guards** the output (clamps every score to 0–10 and recomputes the weighted /100 itself —
the model's arithmetic is never trusted) and re-validates the shape through Zod; and it is
the **fallback** — with no LLM key, or if the agent call fails, it returns a complete audit
so the app still works on any URL.

**Apple public endpoints are the backbone; Firecrawl enriches.** The iTunes Lookup API
needs no auth and works on any listing, so it's the data backbone. Firecrawl recovers
fields Apple hides (subtitle, promo text, "What's New", reviews) so the agent has more
evidence — but it's optional, and its absence degrades gracefully with an explicit note in
the affected dimensions rather than an error.

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
