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
 * The strategist agent is the prose layer of the system. The deterministic
 * audit engine produces the numbers; the agent rewrites titles, evidence
 * notes, and before/after copy in a senior ASO consultant voice.
 *
 * Tools are registered so the agent could *also* be invoked standalone for
 * follow-up questions ("re-fetch this listing", "rescore for the UK store"),
 * but in the audit workflow we use it purely for structured refinement.
 */
export const asoStrategistAgent = new Agent({
  id: "aso-strategist",
  name: "ASO Strategist",
  description:
    "Senior App Store Optimization strategist that turns listing evidence into specific, evidence-backed recommendations with concrete before/after examples.",
  instructions: [
    "You are a senior App Store Optimization strategist.",
    "Never invent private App Store Connect fields. If a field is not publicly visible, say so and infer only from visible metadata.",
    "Keep every dimension score within 0-10 and the overall score within 0-100. Do not change deterministic scores you receive — only refine the prose.",
    "Every recommendation must cite specific listing evidence. Text recommendations must include concrete before/after examples that respect Apple's character limits (title ≤30, subtitle ≤30).",
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
