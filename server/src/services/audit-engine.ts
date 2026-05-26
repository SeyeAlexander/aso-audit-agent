import {
  calculateOverallScore,
  dimensions,
  type AsoAudit,
  type CompetitorScore,
  type Dimension,
  type DimensionScore,
  type Recommendation,
  normalizeScore
} from "../domain/aso.js";
import type { AppStoreListing } from "../domain/app-store.js";
import { sentenceCase, truncate, uniqueKeywords, words } from "../lib/text.js";

export interface AuditContext {
  listing: AppStoreListing;
  competitors: AppStoreListing[];
}

export function createDeterministicAudit({ listing, competitors }: AuditContext): AsoAudit {
  const scoreCard = scoreListing(listing, competitors);
  const usableCompetitors = competitors.slice(0, 3);

  return {
    appName: listing.trackName,
    overallScore: calculateOverallScore(scoreCard),
    scoreCard,
    quickWins: buildQuickWins(listing, scoreCard),
    highImpactChanges: buildHighImpactChanges(listing, scoreCard),
    strategicRecommendations: buildStrategicRecommendations(listing, usableCompetitors),
    competitors: usableCompetitors.map((competitor) => scoreCompetitor(competitor, listing))
  };
}

export function scoreListing(listing: AppStoreListing, competitors: AppStoreListing[] = []): DimensionScore[] {
  const competitorRatings = competitors
    .map((competitor) => competitor.averageUserRating)
    .filter((rating): rating is number => typeof rating === "number");
  const competitorMedianRating = median(competitorRatings);

  return dimensions.map((dimension) => {
    switch (dimension) {
      case "title":
        return scoreTitle(listing);
      case "subtitle":
        return scoreSubtitle(listing);
      case "keywordField":
        return scoreKeywordField(listing);
      case "description":
        return scoreDescription(listing);
      case "screenshots":
        return scoreScreenshots(listing);
      case "appPreviewVideo":
        return scorePreviewVideo(listing);
      case "ratingsReviews":
        return scoreRatingsReviews(listing, competitorMedianRating);
      case "icon":
        return scoreIcon(listing);
      case "conversionSignals":
        return scoreConversionSignals(listing);
      case "competitivePosition":
        return scoreCompetitivePosition(listing, competitors);
    }
  });
}

function scoreTitle(listing: AppStoreListing): DimensionScore {
  const titleLength = listing.trackName.length;
  const keywordCount = uniqueKeywords(`${listing.trackName} ${listing.primaryGenreName ?? ""}`, 8).length;
  const lengthScore = titleLength >= 18 && titleLength <= 30 ? 5 : titleLength >= 10 && titleLength <= 40 ? 3.5 : 2;
  const keywordScore = Math.min(5, keywordCount);

  return makeScore("title", lengthScore + keywordScore, [
    `Title is "${listing.trackName}" (${titleLength} characters).`,
    `Detected ${keywordCount} searchable keyword-style terms.`
  ]);
}

function scoreSubtitle(listing: AppStoreListing): DimensionScore {
  const subtitle = getSubtitle(listing);
  if (!subtitle) {
    return makeScore("subtitle", 3.5, [
      "Apple lookup does not expose a public subtitle for this listing.",
      "The audit treats the subtitle as missing unless it can be inferred from the page metadata."
    ]);
  }

  const lengthScore = subtitle.length >= 18 && subtitle.length <= 30 ? 5 : subtitle.length <= 45 ? 3.5 : 2;
  const specificityScore = uniqueKeywords(subtitle, 8).length >= 4 ? 4 : 2.5;
  return makeScore("subtitle", lengthScore + specificityScore, [`Subtitle-like text: "${truncate(subtitle, 80)}".`]);
}

function scoreKeywordField(listing: AppStoreListing): DimensionScore {
  const source = `${listing.trackName} ${getSubtitle(listing) ?? ""} ${listing.description ?? ""}`;
  const keywords = uniqueKeywords(source, 12);
  const titleKeywords = uniqueKeywords(listing.trackName, 8);
  const score = 4 + Math.min(3, keywords.length / 2) + Math.min(3, titleKeywords.length);

  return makeScore("keywordField", score, [
    "Apple's private keyword field is not public, so this score estimates keyword coverage from visible metadata.",
    `Visible keyword candidates: ${keywords.slice(0, 8).join(", ") || "none detected"}.`
  ]);
}

function scoreDescription(listing: AppStoreListing): DimensionScore {
  const description = listing.description ?? listing.htmlDescription ?? "";
  const descriptionWords = words(description).length;
  const hasBullets = /[\n\r][\s-]*[-*]/.test(description) || description.includes("\n");
  const hasSocialProof = /million|award|trusted|rating|review|download/i.test(description);
  const lengthScore = descriptionWords >= 150 ? 4 : descriptionWords >= 70 ? 3 : 1.5;
  const structureScore = hasBullets ? 2.5 : 1.5;
  const proofScore = hasSocialProof ? 2.5 : 1.5;

  return makeScore("description", lengthScore + structureScore + proofScore, [
    `Description is about ${descriptionWords} words.`,
    hasBullets ? "Description has scannable line breaks or bullet-like structure." : "Description appears mostly paragraph-led.",
    hasSocialProof ? "Description includes at least one social-proof signal." : "Description does not clearly surface social proof."
  ]);
}

function scoreScreenshots(listing: AppStoreListing): DimensionScore {
  const iphoneCount = listing.screenshotUrls?.length ?? 0;
  const ipadCount = listing.ipadScreenshotUrls?.length ?? 0;
  const total = iphoneCount + ipadCount;
  const score = total >= 8 ? 9 : total >= 6 ? 8 : total >= 4 ? 6.5 : total >= 2 ? 4.5 : 2;

  return makeScore("screenshots", score, [
    `${iphoneCount} iPhone screenshot(s), ${ipadCount} iPad screenshot(s) returned by Apple.`,
    total >= 6 ? "The listing uses a healthy amount of visual real estate." : "The listing leaves visual real estate unused."
  ]);
}

function scorePreviewVideo(listing: AppStoreListing): DimensionScore {
  const count = listing.previewUrls?.length ?? 0;
  return makeScore("appPreviewVideo", count > 0 ? 8.5 : 2, [
    count > 0 ? `${count} app preview video URL(s) found.` : "No app preview video URL was returned by Apple lookup."
  ]);
}

function scoreRatingsReviews(listing: AppStoreListing, competitorMedianRating?: number): DimensionScore {
  const rating = listing.averageUserRating ?? 0;
  const count = listing.userRatingCount ?? 0;
  const ratingScore = rating >= 4.7 ? 4.5 : rating >= 4.4 ? 4 : rating >= 4 ? 3 : rating >= 3.5 ? 2 : 1;
  const volumeScore = count >= 100000 ? 4.5 : count >= 10000 ? 4 : count >= 1000 ? 3 : count >= 100 ? 2 : 1;
  const competitorBonus = competitorMedianRating && rating >= competitorMedianRating ? 1 : 0;

  return makeScore("ratingsReviews", ratingScore + volumeScore + competitorBonus, [
    `Average rating is ${rating ? rating.toFixed(2) : "unknown"} from ${count.toLocaleString()} rating(s).`,
    competitorMedianRating ? `Comparable apps in this search set average around ${competitorMedianRating.toFixed(2)} stars.` : "Competitor rating baseline was unavailable."
  ]);
}

function scoreIcon(listing: AppStoreListing): DimensionScore {
  const hasHighResIcon = Boolean(listing.artworkUrl512);
  return makeScore("icon", hasHighResIcon ? 7.5 : 4, [
    hasHighResIcon ? "High-resolution 512px icon URL is present." : "Only lower-resolution icon metadata was found.",
    "Icon distinctiveness still needs visual review in the walkthrough."
  ]);
}

function scoreConversionSignals(listing: AppStoreListing): DimensionScore {
  const signals = [
    listing.averageUserRating && listing.averageUserRating >= 4.5,
    listing.userRatingCount && listing.userRatingCount >= 1000,
    listing.formattedPrice === "Free" || listing.price === 0,
    listing.contentAdvisoryRating,
    listing.currentVersionReleaseDate
  ].filter(Boolean).length;

  return makeScore("conversionSignals", 2 + signals * 1.5, [
    `${signals} conversion signal(s) found across rating, volume, price, age rating, and freshness.`,
    `Price shown by Apple: ${listing.formattedPrice ?? "unknown"}.`
  ]);
}

function scoreCompetitivePosition(listing: AppStoreListing, competitors: AppStoreListing[]): DimensionScore {
  if (competitors.length === 0) {
    return makeScore("competitivePosition", 4, ["No close competitors were returned by Apple Search for this query."]);
  }

  const betterRated = competitors.filter((competitor) => {
    return (competitor.averageUserRating ?? 0) > (listing.averageUserRating ?? 0);
  }).length;
  const score = 8 - betterRated * 1.5 + Math.min(1.5, competitors.length / 2);

  return makeScore("competitivePosition", score, [
    `${competitors.length} competitor(s) found in the same Apple search/category set.`,
    `${betterRated} competitor(s) have a higher visible rating.`
  ]);
}

function scoreCompetitor(competitor: AppStoreListing, reference: AppStoreListing): CompetitorScore {
  const scores = Object.fromEntries(
    scoreListing(competitor, [reference]).map((item) => [item.dimension, item.score])
  ) as CompetitorScore["scores"];

  return {
    name: competitor.trackName,
    scores,
    note: `${competitor.primaryGenreName ?? "Unknown category"} - ${(competitor.averageUserRating ?? 0).toFixed(1)} stars - ${(competitor.userRatingCount ?? 0).toLocaleString()} ratings`
  };
}

function buildQuickWins(listing: AppStoreListing, scoreCard: DimensionScore[]): Recommendation[] {
  const title = listing.trackName;
  const category = listing.primaryGenreName ?? "category";
  const keywords = uniqueKeywords(`${listing.description ?? ""} ${category}`, 6);
  const titleAfter = buildTitleRewrite(title, keywords);
  const subtitleAfter = buildSubtitleRewrite(listing, keywords);
  const descriptionBefore = truncate((listing.description ?? "").split("\n").find(Boolean) ?? "No clear opening line found.", 120);

  return [
    {
      title: "Tighten the title around the highest-intent query",
      evidence: findEvidence(scoreCard, "title"),
      recommendation: "Use the first 30 characters to combine brand recall with one clear searchable job-to-be-done.",
      before: title,
      after: titleAfter
    },
    {
      title: "Use the subtitle as a benefit promise",
      evidence: findEvidence(scoreCard, "subtitle"),
      recommendation: "Make the subtitle specific enough to rank and persuasive enough to earn the tap.",
      before: getSubtitle(listing) ?? "No public subtitle detected",
      after: subtitleAfter
    },
    {
      title: "Front-load the description",
      evidence: findEvidence(scoreCard, "description"),
      recommendation: "Replace a generic first line with a sentence that names the audience, use case, and outcome.",
      before: descriptionBefore,
      after: `${listing.trackName} helps ${category.toLowerCase()} users ${keywords.slice(0, 2).join(" and ") || "get value faster"} with fewer steps.`
    },
    {
      title: "Make screenshot captions do more selling",
      evidence: findEvidence(scoreCard, "screenshots"),
      recommendation: "Add short outcome-led captions to the first three screenshots so benefits are clear without reading the description."
    }
  ];
}

function buildHighImpactChanges(listing: AppStoreListing, scoreCard: DimensionScore[]): Recommendation[] {
  const keywords = uniqueKeywords(`${listing.trackName} ${listing.description ?? ""} ${listing.primaryGenreName ?? ""}`, 8);

  return [
    {
      title: "Run a keyword-field refresh",
      evidence: findEvidence(scoreCard, "keywordField"),
      recommendation: "Use App Store Connect keyword slots for non-duplicated, high-intent terms not already covered by the title/subtitle.",
      before: keywords.slice(0, 6).join(", ") || "No keyword set visible",
      after: keywords.concat(["tracker", "planner", "manager"]).slice(0, 10).join(", ")
    },
    {
      title: "Rebuild the screenshot story arc",
      evidence: findEvidence(scoreCard, "screenshots"),
      recommendation: "Use screenshots 1-5 as a conversion funnel: promise, core action, proof, differentiation, and retention moment."
    },
    {
      title: "Add or improve app preview video",
      evidence: findEvidence(scoreCard, "appPreviewVideo"),
      recommendation: "Create a 15-30 second preview that shows the aha moment in the first three seconds and mirrors the screenshot claims."
    },
    {
      title: "Operationalize review mining",
      evidence: findEvidence(scoreCard, "ratingsReviews"),
      recommendation: "Turn recent positive review language into screenshot captions and description copy, then address repeated objections in release notes."
    }
  ];
}

function buildStrategicRecommendations(listing: AppStoreListing, competitors: AppStoreListing[]): Recommendation[] {
  const competitorNames = competitors.map((competitor) => competitor.trackName).join(", ") || "the closest category competitors";
  const category = listing.primaryGenreName ?? "category";

  return [
    {
      title: "Own a narrower keyword beachhead",
      evidence: `${listing.trackName} sits in ${category} against ${competitorNames}.`,
      recommendation: "Pick one underserved search intent and make title, subtitle, screenshots, and description consistently reinforce that position."
    },
    {
      title: "Build a measurable creative testing loop",
      evidence: `Current visible assets include ${(listing.screenshotUrls?.length ?? 0).toString()} iPhone screenshot(s) and ${(listing.previewUrls?.length ?? 0).toString()} preview video(s).`,
      recommendation: "Create a monthly metadata test cadence that alternates keyword changes with screenshot narrative tests."
    },
    {
      title: "Turn retention moments into acquisition proof",
      evidence: listing.releaseNotes ? `Latest release notes mention: "${truncate(listing.releaseNotes, 120)}".` : "Release-note evidence was limited in the Apple lookup response.",
      recommendation: "Use release notes, review prompts, and lifecycle messaging to make existing user love visible to new App Store visitors."
    }
  ];
}

function makeScore(dimension: Dimension, score: number, evidence: string[]): DimensionScore {
  return {
    dimension,
    score: normalizeScore(score),
    rationale: sentenceCase(evidence[0] ?? "No rationale available."),
    evidence
  };
}

function getSubtitle(listing: AppStoreListing): string | undefined {
  const subtitle = listing.htmlSubtitle;
  if (!subtitle) return undefined;

  const normalized = subtitle.trim();
  if (!normalized || normalized === listing.trackName || normalized === listing.description) return undefined;
  if (/^download\s/i.test(normalized) || /see screenshots, ratings and reviews/i.test(normalized)) return undefined;
  return normalized;
}

function buildTitleRewrite(title: string, keywords: string[]): string {
  const keyword = keywords.find((term) => !title.toLowerCase().includes(term.toLowerCase()));
  if (!keyword) return truncate(title, 30);
  return truncate(`${title}: ${sentenceCase(keyword)}`, 30);
}

function buildSubtitleRewrite(listing: AppStoreListing, keywords: string[]): string {
  const primary = keywords[0] ? sentenceCase(keywords[0]) : "Smarter";
  const secondary = keywords[1] ?? (listing.primaryGenreName ?? "workflow").toLowerCase();
  return truncate(`${primary} ${secondary}, faster`, 30);
}

function findEvidence(scoreCard: DimensionScore[], dimension: Dimension): string {
  return scoreCard.find((item) => item.dimension === dimension)?.evidence.join(" ") ?? "No evidence captured.";
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1];
    const right = sorted[middle];
    return left !== undefined && right !== undefined ? (left + right) / 2 : undefined;
  }

  return sorted[middle];
}
