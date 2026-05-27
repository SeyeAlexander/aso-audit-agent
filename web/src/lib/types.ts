export const DIMENSIONS = [
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

export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
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

export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
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

export interface SurfaceMetadata {
  appName: string;
  developer: string;
  iconUrl?: string;
  category: string;
  country: string;
  appId: number;
}

export interface ListingHighlights {
  subtitle: string | null;
  promotionalText: string | null;
  whatsNew: string | null;
  averageUserRating: number | null;
  userRatingCount: number | null;
  formattedPrice: string | null;
  contentAdvisoryRating: string | null;
  currentVersionReleaseDate: string | null;
  version: string | null;
}

export interface Capabilities {
  llm: boolean;
  firecrawl: boolean;
}

export interface Recommendation {
  title: string;
  evidence: string;
  recommendation: string;
  before?: string;
  after?: string;
}

export interface DimensionScore {
  dimension: Dimension;
  score: number;
  rationale: string;
  evidence: string[];
}

export interface CompetitorScore {
  name: string;
  scores: Record<Dimension, number>;
  note: string;
}

export interface AsoAudit {
  appName: string;
  overallScore: number;
  scoreCard: DimensionScore[];
  quickWins: Recommendation[];
  highImpactChanges: Recommendation[];
  strategicRecommendations: Recommendation[];
  competitors: CompetitorScore[];
}

export interface ListingResponse {
  surfaceMetadata: SurfaceMetadata;
  highlights: ListingHighlights;
  trackViewUrl: string;
  capabilities: Capabilities;
}

export interface CompetitorSummary {
  name: string;
  iconUrl?: string;
  rating?: number;
  ratingCount?: number;
  url: string;
}

export interface AuditResponse {
  surfaceMetadata: SurfaceMetadata;
  highlights: ListingHighlights;
  trackViewUrl: string;
  audit: AsoAudit;
  competitors: CompetitorSummary[];
  agentLed: boolean;
  capabilities: Capabilities;
}
