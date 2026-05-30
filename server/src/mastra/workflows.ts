import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  fetchAppStoreListingTool,
  findAppStoreCompetitorsTool,
  scoreAsoAuditTool
} from "./tools.js";
import { auditResultSchema, scoredAuditSchema, urlInputSchema } from "./schemas.js";
import {
  asoAuditSchema,
  calculateOverallScore,
  dimensions,
  dimensionLabels,
  normalizeScore,
  type AsoAudit,
  type DimensionScore,
  type Recommendation
} from "../domain/aso.js";
import { hasConfiguredModel } from "./model.js";
import type { AppStoreListing } from "../domain/app-store.js";

// ===========================================================================
// Step 4 — the agent-led audit.
//
// Steps 1-3 (fetch → competitors → score) gather the FACTS: the listing, its
// category competitors, and a deterministic measurement of every dimension
// (character counts, screenshot slots used, rating numbers, competitor
// coverage). Those are measurements, not judgments.
//
// This step hands those facts to the ASO Strategist agent, which applies the
// methodology skill to do the actual auditing: it assigns each dimension's
// 0-10 score with a rationale and writes the prioritized recommendations.
//
// The deterministic engine stays on for two jobs:
//   • guardrail — we clamp the agent's scores to 0-10 and recompute the
//     weighted /100 ourselves (we never trust the model's arithmetic), and
//     re-validate the whole shape with Zod;
//   • fallback  — if no model is configured, or the agent fails / returns
//     something invalid, we return the deterministic audit so an answer
//     always comes back (this keeps the app working on any URL).
// ===========================================================================

// Scoring pass — the agent assigns each dimension's 0-10 score with a short
// rationale and evidence. This is the audit's headline judgment.
const agentDimensionScoreSchema = z.object({
  dimension: z.enum(dimensions),
  score: z.number().min(0).max(10),
  rationale: z.string().min(10).max(280),
  evidence: z.array(z.string().min(3)).min(1).max(3)
});

const agentScoringSchema = z.object({
  dimensions: z.array(agentDimensionScoreSchema).min(1).max(dimensions.length)
});

// Recommendation pass — the agent rewrites the deterministic draft
// recommendations in place, keyed by their original array index. Rewriting
// (rather than authoring from scratch) keeps the bucket structure and, crucially,
// preserves the deterministic before/after values (current title → proposed
// rewrite) whenever the model omits them — so text changes always show a
// concrete before/after.
const refinedRecommendationSchema = z.object({
  index: z.number().int().nonnegative(),
  title: z.string().min(4).max(120),
  recommendation: z.string().min(10).max(500),
  before: z.string().max(280).optional(),
  after: z.string().max(280).optional()
});

const refinementSchema = z.object({
  quickWins: z.array(refinedRecommendationSchema),
  highImpactChanges: z.array(refinedRecommendationSchema),
  strategicRecommendations: z.array(refinedRecommendationSchema)
});

type AgentScoring = z.infer<typeof agentScoringSchema>;
type RefinementResult = z.infer<typeof refinementSchema>;

const agentAuditStep = createStep({
  id: "agent-audit",
  description:
    "Hand the gathered facts to the ASO Strategist agent, which scores all 10 dimensions and writes the recommendations using the methodology skill. Two LLM passes run in parallel (scoring + recommendations). The deterministic audit clamps/validates the result and is the fallback when no LLM is configured.",
  inputSchema: scoredAuditSchema,
  outputSchema: auditResultSchema,
  execute: async ({ inputData, mastra }) => {
    const { listing, competitors, audit: deterministic } = inputData;

    // No model configured → ship the deterministic audit as a graceful fallback.
    if (!hasConfiguredModel()) {
      return { listing, competitors, audit: deterministic, agentLed: false };
    }

    const agent = mastra.getAgent("asoStrategist");

    // Scoring and recommendations are independent reads of the same facts, so
    // we run them in parallel to halve total LLM latency.
    const scoringPromise = agent
      .generate(buildScoringPrompt(listing, deterministic), {
        structuredOutput: { schema: agentScoringSchema }
      })
      .then((result) => result.object)
      .catch((error) => {
        console.error("[agent-audit/scoring] failed:", errMessage(error));
        return null;
      });

    const refinementPromise = agent
      .generate(buildRecommendationsPrompt(listing, deterministic), {
        structuredOutput: { schema: refinementSchema }
      })
      .then((result) => result.object)
      .catch((error) => {
        console.error("[agent-audit/recommendations] failed:", errMessage(error));
        return null;
      });

    const [scoring, refinement] = await Promise.all([scoringPromise, refinementPromise]);

    // Both passes failed → fall back to the deterministic audit entirely.
    if (!scoring && !refinement) {
      return { listing, competitors, audit: deterministic, agentLed: false };
    }

    try {
      const audit = assembleAuditFromAgent(deterministic, scoring, refinement);
      return { listing, competitors, audit, agentLed: true };
    } catch (error) {
      // Agent output failed final validation → deterministic audit is the net.
      console.error("[agent-audit/assemble] invalid agent output, using deterministic:", errMessage(error));
      return { listing, competitors, audit: deterministic, agentLed: false };
    }
  }
});

export const asoAuditWorkflow = createWorkflow({
  id: "aso-audit-workflow",
  description:
    "Fetch an Apple App Store listing, find category competitors, measure every ASO dimension, then have the ASO Strategist agent score the listing and write recommendations using the methodology skill. Falls back to deterministic scoring when no LLM is configured.",
  inputSchema: urlInputSchema,
  outputSchema: auditResultSchema
})
  .then(createStep(fetchAppStoreListingTool))
  .then(createStep(findAppStoreCompetitorsTool))
  .then(createStep(scoreAsoAuditTool))
  .then(agentAuditStep)
  .commit();

// -- Assembly + guardrails --------------------------------------------------

/**
 * Combine the agent's judgment with deterministic guardrails into the final,
 * schema-valid audit. Throws if the result is invalid so the caller can fall
 * back to the deterministic audit.
 */
function assembleAuditFromAgent(
  deterministic: AsoAudit,
  scoring: AgentScoring | null,
  refinement: RefinementResult | null
): AsoAudit {
  // Score card: take the agent's score per dimension, clamp to 0-10, and fall
  // back to the deterministic measurement for any dimension the agent omitted.
  const agentByDimension = new Map((scoring?.dimensions ?? []).map((row) => [row.dimension, row]));
  const scoreCard: DimensionScore[] = deterministic.scoreCard.map((base) => {
    const agentRow = agentByDimension.get(base.dimension);
    if (!agentRow) return base;
    return {
      dimension: base.dimension,
      score: normalizeScore(agentRow.score),
      rationale: agentRow.rationale,
      evidence: agentRow.evidence
    };
  });

  // Never trust the model's arithmetic — recompute the weighted /100 ourselves.
  const overallScore = calculateOverallScore(scoreCard);

  // Recommendations: apply the agent's in-place rewrites, falling back to the
  // deterministic draft (and its before/after) per item when the agent omits one.
  const quickWins = refinement
    ? applyRefinement(deterministic.quickWins, refinement.quickWins)
    : deterministic.quickWins;
  const highImpactChanges = refinement
    ? applyRefinement(deterministic.highImpactChanges, refinement.highImpactChanges)
    : deterministic.highImpactChanges;
  const strategicRecommendations = refinement
    ? applyRefinement(deterministic.strategicRecommendations, refinement.strategicRecommendations)
    : deterministic.strategicRecommendations;

  // Competitor scoring stays deterministic — we don't ask the model to invent
  // numbers for apps it cannot measure; it references them in prose instead.
  return asoAuditSchema.parse({
    appName: deterministic.appName,
    overallScore,
    scoreCard,
    quickWins,
    highImpactChanges,
    strategicRecommendations,
    competitors: deterministic.competitors
  });
}

// -- Prompts ----------------------------------------------------------------

const KEY_CHECKS: Record<(typeof dimensions)[number], string> = {
  title:
    "Primary keyword present? Character utilization vs 30-char limit? Brand vs keyword balance? Natural reading, not stuffed?",
  subtitle:
    "Distinct secondary keywords (not repeating title)? Benefit-driven? Full 30-char utilization?",
  keywordField:
    "Would the visible vocabulary suggest duplicates, generic words ('app', category names), or wasted 100-char budget?",
  description:
    "Does the first 170 chars hook above the '...more' cutoff? Features benefit-framed? Social proof? Clear CTA? Natural keyword integration?",
  screenshots:
    "All 10 slots used? First 2-3 communicate value? Likely readable on-image text? Cohesive design language?",
  appPreviewVideo:
    "Exists? Hook in first 3 seconds? 15-30 seconds? Works without sound?",
  ratingsReviews:
    "Average rating? Recent trend? Themes in praise and complaints? Does the developer respond to negatives?",
  icon:
    "Distinctive at small sizes? Category-appropriate? Avoids unreadable text? Stands out in search rows?",
  conversionSignals:
    "Promotional text used? 'What's New' informative? In-App Events? Custom Product Pages?",
  competitivePosition:
    "Keyword coverage vs top competitors in the same category? Visual style? Rating gap?"
};

function buildScoringPrompt(listing: AppStoreListing, deterministic: AsoAudit): string {
  const lines: string[] = [
    `App: ${listing.trackName} (${listing.primaryGenreName ?? "Unknown category"})`,
    `Developer: ${listing.sellerName ?? listing.artistName ?? "unknown"}`,
    `Rating: ${listing.averageUserRating ?? "unknown"} from ${listing.userRatingCount ?? 0} ratings`,
    listing.subtitle ? `Subtitle: "${listing.subtitle}"` : "Subtitle: not found",
    listing.promotionalText
      ? `Promotional text: "${truncatePrompt(listing.promotionalText)}"`
      : "Promotional text: not visible",
    listing.whatsNew ? `What's New: "${truncatePrompt(listing.whatsNew)}"` : "What's New: not visible",
    listing.description
      ? `Description (excerpt): "${truncatePrompt(listing.description)}"`
      : "Description: not provided",
    "",
    "Score ALL 10 dimensions below on a 0-10 scale by applying the methodology to the measured facts.",
    "For each dimension return: the score, a one-sentence rationale, and 1-4 evidence bullets that cite the actual data points. Do not invent facts that are not listed. Do not compute an overall score — that is handled separately.",
    "",
    ...deterministic.scoreCard.map(
      (row) =>
        `- ${row.dimension} (${dimensionLabels[row.dimension]}). Key checks: ${KEY_CHECKS[row.dimension]} Measured facts: ${row.evidence.join(" | ")}`
    ),
    "",
    `Return ONLY JSON matching the schema. Use exact dimension keys (e.g. "title", "keywordField", "competitivePosition").`
  ];
  return lines.join("\n");
}

function buildRecommendationsPrompt(listing: AppStoreListing, deterministic: AsoAudit): string {
  return [
    `App: ${deterministic.appName} (${listing.primaryGenreName ?? "Unknown category"})`,
    `Current title: "${listing.trackName}"`,
    listing.subtitle ? `Current subtitle: "${listing.subtitle}"` : "Current subtitle: none found",
    "",
    "Below are the audit's draft recommendations in three buckets. Keep the structure, the cited evidence, and the number of items in each bucket.",
    'Rewrite each item\'s title, recommendation, before, and after to read like a senior ASO consultant — concrete and specific to THIS app, respecting Apple\'s limits (title ≤30 chars, subtitle ≤30). Keep a before/after for any text change. Be specific — "rewrite X to Y because Z" beats "improve X". Never invent private fields.',
    "",
    "Quick wins:",
    formatList(deterministic.quickWins),
    "",
    "High-impact changes:",
    formatList(deterministic.highImpactChanges),
    "",
    "Strategic recommendations:",
    formatList(deterministic.strategicRecommendations),
    "",
    "Return JSON matching the schema. Use the original 0-based array index for each item so the rewrite merges back deterministically."
  ].join("\n");
}

/**
 * Merge the agent's in-place rewrites back onto the deterministic drafts by
 * index. When the agent omits a before/after, the deterministic value is kept —
 * this is what guarantees text-change recommendations always carry a concrete
 * before/after even if the model leaves them out.
 */
function applyRefinement(
  originals: Recommendation[],
  refinements: RefinementResult["quickWins"]
): Recommendation[] {
  const byIndex = new Map(refinements.map((item) => [item.index, item]));
  return originals.map((original, index) => {
    const patch = byIndex.get(index);
    if (!patch) return original;
    return {
      ...original,
      title: patch.title,
      recommendation: patch.recommendation,
      before: patch.before ?? original.before,
      after: patch.after ?? original.after
    };
  });
}

function formatList(items: Recommendation[]): string {
  return items
    .map((item, index) => {
      const lines = [`  [${index}] ${item.title}`, `      evidence: ${item.evidence}`, `      move: ${item.recommendation}`];
      if (item.before) lines.push(`      before: ${item.before}`);
      if (item.after) lines.push(`      after: ${item.after}`);
      return lines.join("\n");
    })
    .join("\n");
}

function truncatePrompt(value: string, max = 600): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
