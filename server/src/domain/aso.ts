import { z } from "zod";

export const dimensions = [
  "title",
  "subtitle",
  "keywordField",
  "description",
  "screenshots",
  "appPreviewVideo",
  "ratingsReviews",
  "icon",
  "conversionSignals",
  "competitivePosition"
] as const;

export type Dimension = (typeof dimensions)[number];

export const dimensionLabels: Record<Dimension, string> = {
  title: "Title",
  subtitle: "Subtitle",
  keywordField: "Keyword field",
  description: "Description",
  screenshots: "Screenshots",
  appPreviewVideo: "App preview video",
  ratingsReviews: "Ratings & reviews",
  icon: "Icon",
  conversionSignals: "Conversion signals",
  competitivePosition: "Competitive position"
};

const rawWeights: Record<Dimension, number> = {
  title: 20,
  subtitle: 15,
  keywordField: 15,
  description: 10,
  screenshots: 15,
  appPreviewVideo: 5,
  ratingsReviews: 15,
  icon: 5,
  conversionSignals: 5,
  competitivePosition: 5
};

const totalRawWeight = Object.values(rawWeights).reduce((sum, weight) => sum + weight, 0);

export const dimensionWeights = Object.fromEntries(
  Object.entries(rawWeights).map(([dimension, weight]) => [dimension, weight / totalRawWeight])
) as Record<Dimension, number>;

export const rawDimensionWeights = rawWeights;

export const recommendationSchema = z.object({
  title: z.string(),
  evidence: z.string(),
  recommendation: z.string(),
  before: z.string().optional(),
  after: z.string().optional()
});

export const dimensionScoreSchema = z.object({
  dimension: z.enum(dimensions),
  score: z.number().min(0).max(10),
  rationale: z.string(),
  evidence: z.array(z.string()).min(1)
});

export const competitorScoreSchema = z.object({
  name: z.string(),
  scores: z.record(z.enum(dimensions), z.number().min(0).max(10)),
  note: z.string()
});

export const asoAuditSchema = z.object({
  appName: z.string(),
  overallScore: z.number().min(0).max(100),
  scoreCard: z.array(dimensionScoreSchema).length(dimensions.length),
  quickWins: z.array(recommendationSchema).min(3).max(5),
  highImpactChanges: z.array(recommendationSchema).min(3).max(5),
  strategicRecommendations: z.array(recommendationSchema).min(3).max(5),
  competitors: z.array(competitorScoreSchema).min(2).max(3)
});

export type Recommendation = z.infer<typeof recommendationSchema>;
export type DimensionScore = z.infer<typeof dimensionScoreSchema>;
export type CompetitorScore = z.infer<typeof competitorScoreSchema>;
export type AsoAudit = z.infer<typeof asoAuditSchema>;

export function calculateOverallScore(scoreCard: DimensionScore[]): number {
  const weighted = scoreCard.reduce((sum, item) => {
    return sum + item.score * 10 * dimensionWeights[item.dimension];
  }, 0);

  return Math.round(weighted);
}

export function normalizeScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}
