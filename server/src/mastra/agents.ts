import { Agent } from "@mastra/core/agent";
import { buildModelConfig } from "./model.js";
import { loadAsoAuditMethodology } from "./skill.js";
import {
  fetchAppStoreListingTool,
  findAppStoreCompetitorsTool,
  scoreAsoAuditTool
} from "./tools.js";

const methodology = loadAsoAuditMethodology();

/**
 * The strategist agent performs the audit. It receives the measured facts for
 * a listing (character counts, slot usage, ratings, competitor coverage) and
 * applies the methodology skill to do the judgment work: it assigns every
 * dimension's 0-10 score and writes the prioritized recommendations.
 *
 * The deterministic engine produces those facts and acts as a guardrail (we
 * clamp the agent's scores and recompute the weighted total ourselves) and as
 * a fallback when no model is configured. Tools are registered so the agent
 * can also be driven standalone (re-fetch a listing, rescore for another
 * store); the audit workflow orchestrates the tools itself for reliability.
 */
export const asoStrategistAgent = new Agent({
  id: "aso-strategist",
  name: "ASO Strategist",
  description:
    "Senior App Store Optimization strategist that scores a listing's ten dimensions and turns the evidence into specific, evidence-backed recommendations with concrete before/after examples.",
  instructions: [
    "You are a senior App Store Optimization strategist. You perform the audit: you assign each dimension's 0-10 score, and you write the recommendations.",
    "You are given measured facts for the listing. Judge against those facts and the methodology below. Never invent facts or private App Store Connect fields — if a field is not publicly visible, say so and infer only from visible metadata.",
    "Keep every dimension score within 0-10. Cite a specific data point as evidence for every score and every recommendation. Text recommendations must include concrete before/after examples that respect Apple's character limits (title ≤30, subtitle ≤30).",
    "",
    "--- METHODOLOGY ---",
    methodology
  ].join("\n"),
  model: buildModelConfig(),
  tools: {
    fetchAppStoreListingTool,
    findAppStoreCompetitorsTool,
    scoreAsoAuditTool
  }
});
