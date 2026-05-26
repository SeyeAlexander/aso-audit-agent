# ASO Audit Agent

A TypeScript CLI chat application that audits Apple App Store listings with Mastra agents, tools, workflows, and workspace skills.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

You can also run a non-interactive smoke test:

```bash
npm run dev -- https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281 --yes
```

LLM refinement is optional. Without a model key, the app still fetches the listing, confirms the app, runs the deterministic audit engine, and returns a complete report. To enable model-polished recommendations, add a NVIDIA NIM key to `.env`:

```bash
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-70b-instruct
```

## User Flow

1. Paste an Apple App Store URL.
2. The agent fetches surface metadata: app name, developer, icon URL, category, country, and app id.
3. Confirm the app with the `Is this the app you want audited?` prompt.
4. The Mastra workflow fetches the full listing evidence, finds 2-3 competitors, scores all ten ASO dimensions, and renders a structured report.

## Architecture

- `src/mastra/tools.ts`: focused Mastra tools for Apple lookup, competitor search, deterministic ASO scoring, and evidence summarization.
- `src/mastra/workflows.ts`: the end-to-end Mastra workflow that composes tools and optional agent refinement.
- `src/mastra/agents.ts`: the ASO recommendation agent. It uses a model only when provider credentials are configured.
- `skills/aso-audit-methodology/SKILL.md`: a Mastra workspace skill that documents the scoring rules and recommendation standards.
- `src/services/app-store-client.ts`: Apple public API client using iTunes Lookup/Search and lightweight App Store page hints.
- `src/services/audit-engine.ts`: deterministic, typed ASO scoring and recommendation engine.
- `src/ui`: branded terminal rendering inspired by Layers' public media-kit colors, without copying product code.

## Decisions And Rationale

The brief asks for Firecrawl but does not require it, so the first core version uses Apple public endpoints. That keeps unseen URLs reliable, avoids scraper billing, and lets the audit work even before API keys are added.

The scoring table in the brief totals 110%, while the required score is 0-100. The app preserves the provided relative weights but normalizes them internally so the maximum score is exactly 100.

The private Apple keyword field is not publicly visible. The audit says that explicitly and estimates keyword-field health from title, subtitle-like page hints, description language, and category terms.

The LLM is used as refinement, not as the source of truth. The deterministic audit always produces a complete report; NVIDIA NIM or another OpenAI-compatible model can improve wording and examples when credentials are available.

Mastra is used as application architecture, not decoration: tools own external actions, the workflow owns orchestration, the agent owns recommendation refinement, and the workspace skill owns audit methodology.

## Remaining Submission Tasks

- Create the private GitHub repo and add `@mikekhristo` as collaborator.
- Record the walkthrough video on an app other than Spotify.
- Submit the final repo/video link through the Google Form.
