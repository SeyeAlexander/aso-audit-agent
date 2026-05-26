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
import {
  asoAuditSchema,
  dimensions,
  dimensionLabels,
  type AsoAudit,
  type DimensionScore,
  type Recommendation
} from "../domain/aso.js";
import { hasConfiguredModel } from "./model.js";
import type { AppStoreListing } from "../domain/app-store.js";

// -- Step 4: qualitative analysis --------------------------------------------
//
// Deterministic scores answer "how big is the gap?". This step adds a senior
// consultant's qualitative read against the brief's per-dimension key checks
// (e.g. "title reads naturally?", "description first-3-lines hook?"). The
// notes are appended to each dimension's evidence array — scores stay frozen so
// the deterministic engine remains the source of truth.
//
// Qualitative analysis and recommendation refinement read the SAME input
// (the scored audit) and write disjoint parts of the output (per-dimension
// evidence vs. recommendation prose). Running them with Promise.all halves
// total LLM latency without losing the conceptual separation of concerns.
const refineAuditStep = createStep({
  id: "refine-audit",
  description:
    "Run two LLM passes in parallel against the deterministic audit: qualitative per-dimension notes + recommendation prose rewrites. Pass-through when no LLM key is configured.",
  inputSchema: scoredAuditSchema,
  outputSchema: refinedAuditSchema,
  execute: async ({ inputData, mastra }) => {
    if (!hasConfiguredModel()) {
      return { ...inputData, usedLlmRefinement: false };
    }

    const agent = mastra.getAgent("asoStrategist");

    const qualitativePromise = agent
      .generate(buildQualitativePrompt(inputData.listing, inputData.audit), {
        structuredOutput: { schema: qualitativeAnalysisSchema }
      })
      .then((result) => result.object)
      .catch((error) => {
        console.error(
          "[refine-audit/qualitative] failed:",
          error instanceof Error ? error.message : error
        );
        return null;
      });

    const refinementPromise = agent
      .generate(buildRefinementPrompt(inputData.audit), {
        structuredOutput: { schema: refinementSchema }
      })
      .then((result) => result.object)
      .catch((error) => {
        console.error(
          "[refine-audit/recommendations] failed:",
          error instanceof Error ? error.message : error
        );
        return null;
      });

    const [qualitative, refinement] = await Promise.all([qualitativePromise, refinementPromise]);

    let audit = inputData.audit;
    if (qualitative) audit = applyQualitative(audit, qualitative);
    if (refinement) audit = mergeRefinement(audit, refinement);

    return {
      ...inputData,
      audit,
      usedLlmRefinement: Boolean(qualitative || refinement)
    };
  }
});

export const asoAuditWorkflow = createWorkflow({
  id: "aso-audit-workflow",
  description:
    "Fetch an Apple App Store listing, identify category competitors, score 10 ASO dimensions, and refine the audit with parallel LLM passes.",
  inputSchema: urlInputSchema,
  outputSchema: refinedAuditSchema
})
  .then(createStep(fetchAppStoreListingTool))
  .then(createStep(findAppStoreCompetitorsTool))
  .then(createStep(scoreAsoAuditTool))
  .then(refineAuditStep)
  .commit();

// -- Schemas ----------------------------------------------------------------

const qualitativeDimensionSchema = z.object({
  dimension: z.enum(dimensions),
  note: z
    .string()
    .min(20)
    .max(320)
    .describe("One or two sentences of senior-ASO judgment grounded in the listing evidence.")
});

const qualitativeAnalysisSchema = z.object({
  dimensions: z.array(qualitativeDimensionSchema).min(1).max(dimensions.length)
});

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

type QualitativeAnalysisResult = z.infer<typeof qualitativeAnalysisSchema>;
type RefinementResult = z.infer<typeof refinementSchema>;

// -- Qualitative prompt + merge ---------------------------------------------

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

function buildQualitativePrompt(listing: AppStoreListing, audit: AsoAudit): string {
  const lines: string[] = [
    `App: ${listing.trackName} (${listing.primaryGenreName ?? "Unknown category"})`,
    `Developer: ${listing.sellerName ?? listing.artistName ?? "unknown"}`,
    `Rating: ${listing.averageUserRating ?? "unknown"} from ${listing.userRatingCount ?? 0} ratings`,
    listing.subtitle ? `Subtitle (scraped): "${listing.subtitle}"` : "Subtitle: not found",
    listing.promotionalText ? `Promotional text: "${truncatePrompt(listing.promotionalText)}"` : "Promotional text: not visible",
    listing.whatsNew ? `What's New: "${truncatePrompt(listing.whatsNew)}"` : "What's New: not visible",
    listing.description ? `Description (excerpt): "${truncatePrompt(listing.description)}"` : "Description: not provided",
    "",
    "For each of the 10 dimensions below, write ONE qualitative note (1-2 sentences) that judges the listing against the listed key checks.",
    "Cite specific evidence already collected — do not invent new facts. Do not propose scores.",
    "",
    ...audit.scoreCard.map(
      (row) =>
        `- ${row.dimension} (${dimensionLabels[row.dimension]}): deterministic score ${row.score.toFixed(1)}/10. Key checks: ${KEY_CHECKS[row.dimension]} Existing evidence: ${row.evidence.join(" | ")}`
    ),
    "",
    `Return ONLY a JSON object matching the schema. Use exact dimension keys (e.g. "title", "subtitle", "keywordField").`
  ];
  return lines.join("\n");
}

function applyQualitative(audit: AsoAudit, result: QualitativeAnalysisResult): AsoAudit {
  const noteByDimension = new Map(result.dimensions.map((d) => [d.dimension, d.note]));
  const scoreCard: DimensionScore[] = audit.scoreCard.map((row) => {
    const note = noteByDimension.get(row.dimension);
    if (!note) return row;
    return { ...row, evidence: [...row.evidence, `Strategist note: ${note}`] };
  });
  return asoAuditSchema.parse({ ...audit, scoreCard });
}

// -- Refinement prompt + merge ----------------------------------------------

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

function truncatePrompt(value: string, max = 600): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}
