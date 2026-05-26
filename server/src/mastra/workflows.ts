import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  fetchAppStoreListingTool,
  findAppStoreCompetitorsTool,
  scoreAsoAuditTool
} from "./tools.js";
import {
  refinedAuditSchema,
  scoredAuditSchema,
  urlInputSchema
} from "./schemas.js";
import { asoAuditSchema, type AsoAudit, type Recommendation } from "../domain/aso.js";
import { hasConfiguredModel } from "./model.js";

const refineRecommendationsStep = createStep({
  id: "refine-recommendations",
  description:
    "Optionally refine the deterministic audit's recommendation prose using the ASO Strategist agent. Pass-through when no model is configured.",
  inputSchema: scoredAuditSchema,
  outputSchema: refinedAuditSchema,
  execute: async ({ inputData, mastra }) => {
    if (!hasConfiguredModel()) {
      return { ...inputData, usedLlmRefinement: false };
    }

    const agent = mastra.getAgent("asoStrategist");
    const prompt = buildRefinementPrompt(inputData.audit);

    try {
      const result = await agent.generate(prompt, {
        structuredOutput: { schema: refinementSchema }
      });

      const merged = mergeRefinement(inputData.audit, result.object);
      return { ...inputData, audit: merged, usedLlmRefinement: true };
    } catch {
      return { ...inputData, usedLlmRefinement: false };
    }
  }
});

export const asoAuditWorkflow = createWorkflow({
  id: "aso-audit-workflow",
  description:
    "Fetch an Apple App Store listing, identify category competitors, score 10 ASO dimensions, and refine recommendations.",
  inputSchema: urlInputSchema,
  outputSchema: refinedAuditSchema
})
  .then(createStep(fetchAppStoreListingTool))
  .then(createStep(findAppStoreCompetitorsTool))
  .then(createStep(scoreAsoAuditTool))
  .then(refineRecommendationsStep)
  .commit();

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

type RefinementResult = z.infer<typeof refinementSchema>;

function buildRefinementPrompt(audit: AsoAudit): string {
  return [
    `App: ${audit.appName}`,
    `Overall ASO score (deterministic): ${audit.overallScore}/100`,
    "",
    "Below are the deterministic audit's recommendations. Keep the structure, evidence, and number of items.",
    "Your job: rewrite each `title`, `recommendation`, `before`, and `after` to sound like a senior ASO consultant — concrete, specific to this app, and respectful of Apple character limits (title ≤30, subtitle ≤30).",
    "Do not invent facts. Do not change scores.",
    "",
    "Quick wins:",
    formatList(audit.quickWins),
    "",
    "High-impact changes:",
    formatList(audit.highImpactChanges),
    "",
    "Strategic recommendations:",
    formatList(audit.strategicRecommendations),
    "",
    "Return a JSON object matching the provided schema. Use the original 0-based array index for each item so the output can be merged back deterministically."
  ].join("\n");
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

function mergeRefinement(original: AsoAudit, refinement: RefinementResult): AsoAudit {
  const merged: AsoAudit = {
    ...original,
    quickWins: applyRefinement(original.quickWins, refinement.quickWins),
    highImpactChanges: applyRefinement(original.highImpactChanges, refinement.highImpactChanges),
    strategicRecommendations: applyRefinement(
      original.strategicRecommendations,
      refinement.strategicRecommendations
    )
  };
  // Re-validate so a misbehaving model can never corrupt the audit shape.
  return asoAuditSchema.parse(merged);
}

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
