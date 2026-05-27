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

/**
 * Apple's character ceilings (App Store Connect) — used as the denominator
 * for utilization metrics so evidence reads "27/30 characters used".
 */
const TITLE_LIMIT = 30;
const SUBTITLE_LIMIT = 30;
const SCREENSHOT_SLOTS = 10;
const DESCRIPTION_FOLD_CHARS = 170; // "...more" cutoff in App Store search results

function scoreTitle(listing: AppStoreListing): DimensionScore {
  const title = listing.trackName;
  const titleLength = title.length;
  const utilization = titleLength / TITLE_LIMIT;
  const utilizationScore = utilization >= 0.7 && utilization <= 1.0 ? 4 : utilization >= 0.5 ? 3 : 2;

  // Brand vs keyword balance — heuristic: brand is usually the first 1-2 words,
  // keywords come after a separator (": " "- " "—" or "|").
  const hasSeparator = /[:\-–—|]/.test(title);
  const balanceScore = hasSeparator ? 3 : 1.5;

  // Natural reading: penalize stuffing (consecutive ALL-CAPS words, runs of |/+/&)
  const stuffingPenalty = /[A-Z]{4,}\s+[A-Z]{4,}/.test(title) || /[|+&]{2,}/.test(title) ? 1.5 : 0;

  const keywordTerms = uniqueKeywords(`${title} ${listing.primaryGenreName ?? ""}`, 8);
  const keywordScore = Math.min(3, keywordTerms.length * 0.5);

  return makeScore("title", utilizationScore + balanceScore + keywordScore - stuffingPenalty, [
    `Title: "${title}" — ${titleLength}/${TITLE_LIMIT} characters (${Math.round(utilization * 100)}% utilization).`,
    hasSeparator
      ? "Title uses a separator, suggesting deliberate brand-vs-keyword structure."
      : "Title has no separator — brand and search terms are not visually distinguished.",
    stuffingPenalty > 0
      ? "Title shows signs of keyword stuffing (consecutive shouted words or symbol runs)."
      : "Title reads naturally — no shouting or symbol stuffing detected.",
    keywordTerms.length > 0
      ? `Search-relevant terms in title: ${keywordTerms.join(", ")}.`
      : "Title doesn't yet surface a search-relevant term — reserve space for one high-intent keyword."
  ]);
}

function scoreSubtitle(listing: AppStoreListing): DimensionScore {
  const subtitle = getSubtitle(listing);
  if (!subtitle) {
    return makeScore("subtitle", 3, [
      "No public subtitle was found in the iTunes Lookup response or the page meta tags.",
      "If a real subtitle exists, enable Firecrawl (FIRECRAWL_API_KEY) so it can be scraped from the page directly."
    ]);
  }

  const titleWords = new Set(words(listing.trackName));
  const subtitleWords = words(subtitle);
  const overlap = subtitleWords.filter((word) => titleWords.has(word)).length;
  const overlapRatio = subtitleWords.length > 0 ? overlap / subtitleWords.length : 0;

  const utilization = subtitle.length / SUBTITLE_LIMIT;
  const utilizationScore = utilization >= 0.7 && utilization <= 1.0 ? 3.5 : utilization >= 0.5 ? 2.5 : 1.5;
  const distinctnessScore = overlapRatio < 0.3 ? 3 : overlapRatio < 0.6 ? 1.5 : 0.5;
  const benefitScore = /\b(track|organize|build|learn|create|manage|find|plan|master|simplif|focus|grow|save)/i.test(subtitle) ? 2 : 1;

  return makeScore("subtitle", utilizationScore + distinctnessScore + benefitScore, [
    `Subtitle: "${truncate(subtitle, 80)}" — ${subtitle.length}/${SUBTITLE_LIMIT} characters (${Math.round(utilization * 100)}% utilization).`,
    overlapRatio < 0.3
      ? "Subtitle introduces distinct keywords from the title."
      : `Subtitle reuses ${Math.round(overlapRatio * 100)}% of title words — losing keyword surface area.`,
    benefitScore >= 2
      ? "Subtitle leads with a benefit verb."
      : "Subtitle does not lead with a benefit verb — feels feature-led."
  ]);
}

function scoreKeywordField(listing: AppStoreListing): DimensionScore {
  // The 100-char keyword field is private (App Store Connect only). We can't
  // grade it directly, so we (a) say so, (b) estimate coverage from visible
  // metadata, (c) flag obvious waste in the visible surface (categories,
  // generic words, brand-in-keyword-form).
  const visibleSurface = `${listing.trackName} ${getSubtitle(listing) ?? ""}`;
  const visibleKeywords = uniqueKeywords(visibleSurface, 8);
  const descriptionKeywords = uniqueKeywords(listing.description ?? "", 12);

  // Words that appear in BOTH visible surface and description are wasted in the
  // 100-char field (Apple indexes title/subtitle automatically — duplicating
  // there burns keyword-field characters).
  const visibleSet = new Set(visibleKeywords);
  const duplicates = descriptionKeywords.filter((word) => visibleSet.has(word));
  const uniqueDescriptionKeywords = descriptionKeywords.filter((word) => !visibleSet.has(word));

  const baseScore = 4;
  const coverageScore = Math.min(3, uniqueDescriptionKeywords.length / 3);
  const titleKeywordScore = Math.min(3, visibleKeywords.length * 0.4);

  return makeScore("keywordField", baseScore + coverageScore + titleKeywordScore, [
    "Apple's 100-char keyword field is private (App Store Connect only) — this score estimates coverage from visible metadata.",
    visibleKeywords.length > 0
      ? `Visible surface (title + subtitle) keywords: ${visibleKeywords.join(", ")}.`
      : "Visible surface (title + subtitle) carries no distinct keywords yet — consider adding one searchable term.",
    uniqueDescriptionKeywords.length > 0
      ? `Non-duplicate keyword candidates from description: ${uniqueDescriptionKeywords.slice(0, 6).join(", ")}.`
      : "Description vocabulary mostly overlaps with title/subtitle — broaden it with adjacent search intents the listing doesn't yet cover.",
    duplicates.length > 0
      ? `If repeated in the keyword field, these would be wasted (already indexed via title/subtitle): ${duplicates.slice(0, 5).join(", ")}.`
      : "No obvious duplication risk between visible surface and description vocabulary."
  ]);
}

function scoreDescription(listing: AppStoreListing): DimensionScore {
  const description = listing.description ?? listing.htmlDescription ?? "";
  if (!description) {
    return makeScore("description", 1.5, ["No public description was returned by Apple Lookup."]);
  }

  // The first ~170 characters appear above the "...more" cutoff in search
  // result cards. That's the actual hook.
  const aboveFold = description.slice(0, DESCRIPTION_FOLD_CHARS);
  const aboveFoldWords = words(aboveFold);

  const descriptionWords = words(description).length;
  const hasBullets = /[\n\r][\s•·\-*]/.test(description);
  const hasSocialProof = /\b(million|award|trusted|featured|rated|top\s+\d|loved by|fortune|featured in)/i.test(description);
  const hasCta = /\b(download|get started|try (it|now|today)|join|start|install)/i.test(aboveFold);
  const hookHasBenefit = /\b(track|organize|build|learn|create|manage|find|plan|master|simplif|focus|grow|save|faster|smarter|better)/i.test(aboveFold);

  const lengthScore = descriptionWords >= 200 ? 2.5 : descriptionWords >= 100 ? 1.8 : 1;
  const hookScore = hookHasBenefit ? 2.5 : 1;
  const structureScore = hasBullets ? 2 : 1;
  const proofScore = hasSocialProof ? 1.5 : 0.5;
  const ctaScore = hasCta ? 1.5 : 0.5;

  return makeScore("description", lengthScore + hookScore + structureScore + proofScore + ctaScore, [
    `Description length: ${descriptionWords} words (${description.length} chars).`,
    `Above-the-fold hook (first ${DESCRIPTION_FOLD_CHARS} chars, ${aboveFoldWords.length} words): "${truncate(aboveFold, 140)}".`,
    hookHasBenefit ? "Hook leads with a benefit verb." : "Hook does not surface a clear benefit in the first 170 characters.",
    hasBullets ? "Body uses scannable bullets or line breaks." : "Body reads as a single paragraph — harder to scan.",
    hasSocialProof ? "Description surfaces social proof (awards, scale, press, ratings)." : "No explicit social proof in the description copy.",
    hasCta ? "Above-the-fold copy contains an explicit call-to-action." : "No call-to-action in the above-the-fold copy."
  ]);
}

function scoreScreenshots(listing: AppStoreListing): DimensionScore {
  const iphoneCount = listing.screenshotUrls?.length ?? 0;
  const ipadCount = listing.ipadScreenshotUrls?.length ?? 0;

  // Apple allows up to 10 iPhone screenshots; that's the real budget the brief
  // is asking about.
  const iphoneUtilization = iphoneCount / SCREENSHOT_SLOTS;
  const utilizationScore = iphoneUtilization >= 0.8 ? 5 : iphoneUtilization >= 0.5 ? 4 : iphoneUtilization >= 0.3 ? 2.5 : 1;
  const ipadScore = ipadCount >= 3 ? 2.5 : ipadCount > 0 ? 1.5 : 0.5;
  const variantScore = listing.appletvScreenshotUrls?.length ? 1 : 0;

  return makeScore("screenshots", utilizationScore + ipadScore + variantScore + 1.5, [
    `iPhone slots used: ${iphoneCount}/${SCREENSHOT_SLOTS} (${Math.round(iphoneUtilization * 100)}%).`,
    `iPad screenshots: ${ipadCount}.${variantScore > 0 ? " Apple TV / additional variants also provided." : ""}`,
    iphoneUtilization >= 0.8
      ? "Visual real estate is fully exploited — there's room for a story arc."
      : "Empty screenshot slots leave conversion-driving real estate unused.",
    "On-image text (Apple OCR-indexes it) and design cohesion still require a visual review pass."
  ]);
}

function scorePreviewVideo(listing: AppStoreListing): DimensionScore {
  const count = listing.previewUrls?.length ?? 0;
  if (count === 0) {
    return makeScore("appPreviewVideo", 2, [
      "No app preview video URL was found in the Apple Lookup response.",
      "Adding even one well-crafted 15-30s preview is one of the highest-leverage moves in ASO."
    ]);
  }
  return makeScore("appPreviewVideo", count >= 3 ? 9 : count >= 2 ? 8.5 : 7.5, [
    `${count} app preview video(s) detected.`,
    "Duration, first-3-second hook, and silent-readability still need a manual review (video bytes are not analyzed)."
  ]);
}

function scoreRatingsReviews(listing: AppStoreListing, competitorMedianRating?: number): DimensionScore {
  const rating = listing.averageUserRating ?? 0;
  const count = listing.userRatingCount ?? 0;
  const ratingScore = rating >= 4.7 ? 3.5 : rating >= 4.4 ? 3 : rating >= 4 ? 2.5 : rating >= 3.5 ? 1.5 : 1;
  const volumeScore = count >= 100000 ? 3.5 : count >= 10000 ? 3 : count >= 1000 ? 2.5 : count >= 100 ? 1.5 : 1;
  const competitorBonus = competitorMedianRating && rating >= competitorMedianRating ? 1 : 0;

  // Review-themes / dev-response signals — only available when Firecrawl
  // succeeded. When present, the agent step gets actual snippets to reason over.
  const hasSnippets = (listing.reviewSnippets?.length ?? 0) > 0;
  const themesScore = hasSnippets ? 2 : 0.5;

  const evidence: string[] = [
    `Average rating: ${rating ? rating.toFixed(2) : "unknown"} from ${count.toLocaleString()} rating(s).`,
    competitorMedianRating
      ? `Category competitors average ${competitorMedianRating.toFixed(2)} stars (${rating >= competitorMedianRating ? "ahead" : "behind"}).`
      : "Competitor rating baseline was unavailable."
  ];
  if (hasSnippets) {
    evidence.push(`${listing.reviewSnippets?.length} review snippet(s) captured for theme analysis.`);
  } else {
    evidence.push("Review-theme and developer-response analysis requires Firecrawl scraping (FIRECRAWL_API_KEY).");
  }

  return makeScore("ratingsReviews", ratingScore + volumeScore + competitorBonus + themesScore, evidence);
}

function scoreIcon(listing: AppStoreListing): DimensionScore {
  // Without a visual model we can only verify the icon exists at high res.
  // Distinctiveness, category fit, and unreadable-text-at-small-sizes need
  // human or visual-model review and are flagged for the walkthrough.
  const hasHighResIcon = Boolean(listing.artworkUrl512);
  const baseScore = hasHighResIcon ? 6.5 : 3.5;

  return makeScore("icon", baseScore, [
    hasHighResIcon
      ? `High-resolution 512px icon present: ${listing.artworkUrl512}.`
      : "Only lower-resolution icon metadata was returned.",
    "Distinctiveness in search, legibility at 60px, and category-appropriate styling still require visual review."
  ]);
}

function scoreConversionSignals(listing: AppStoreListing): DimensionScore {
  // The four brief-mentioned conversion levers: promotional text, What's New
  // freshness, In-App Events / Custom Product Pages (not exposed via Lookup),
  // plus basic trust signals.
  const hasPromo = Boolean(listing.promotionalText);
  const hasWhatsNew = Boolean(listing.whatsNew);
  const releaseDate = listing.currentVersionReleaseDate ? new Date(listing.currentVersionReleaseDate) : undefined;
  const daysSinceRelease = releaseDate ? Math.floor((Date.now() - releaseDate.getTime()) / 86_400_000) : undefined;
  const fresh = typeof daysSinceRelease === "number" && daysSinceRelease <= 30;
  const stale = typeof daysSinceRelease === "number" && daysSinceRelease > 180;

  const promoScore = hasPromo ? 2 : 0.5;
  const whatsNewScore = hasWhatsNew ? 2 : 0.5;
  const freshnessScore = fresh ? 2 : stale ? 0.5 : 1.5;
  const trustScore = (listing.averageUserRating ?? 0) >= 4.5 && (listing.userRatingCount ?? 0) >= 1000 ? 1.5 : 0.5;
  const priceScore = listing.formattedPrice ? 1 : 0;

  const evidence: string[] = [];
  evidence.push(
    hasPromo
      ? `Promotional text in use: "${truncate(listing.promotionalText ?? "", 100)}".`
      : "No promotional text detected — a free conversion lever that can be updated without a release."
  );
  evidence.push(
    hasWhatsNew
      ? `"What's New" populated: "${truncate(listing.whatsNew ?? "", 100)}".`
      : '"What\'s New" copy is not visible — either missing or behind login.'
  );
  if (typeof daysSinceRelease === "number") {
    evidence.push(`Last release: ${daysSinceRelease} day(s) ago${fresh ? " — fresh." : stale ? " — stale." : "."}`);
  } else {
    evidence.push("Release-date freshness was not available from Apple Lookup.");
  }
  evidence.push(`Price: ${listing.formattedPrice ?? "unknown"}.`);
  evidence.push("In-App Events and Custom Product Pages are not exposed in the public Lookup response — flag for manual review.");

  return makeScore(
    "conversionSignals",
    promoScore + whatsNewScore + freshnessScore + trustScore + priceScore,
    evidence
  );
}

function scoreCompetitivePosition(listing: AppStoreListing, competitors: AppStoreListing[]): DimensionScore {
  if (competitors.length === 0) {
    return makeScore("competitivePosition", 4, ["No close competitors were returned by Apple Search for this query."]);
  }

  // Keyword overlap with each competitor's title — proxy for how directly the
  // app contests the same search intents.
  const ownTitleWords = new Set(words(listing.trackName));
  const overlaps = competitors.map((competitor) => {
    const competitorWords = words(competitor.trackName);
    const shared = competitorWords.filter((word) => ownTitleWords.has(word)).length;
    return { name: competitor.trackName, shared, total: competitorWords.length };
  });
  const avgOverlap =
    overlaps.length > 0
      ? overlaps.reduce((sum, c) => sum + (c.total > 0 ? c.shared / c.total : 0), 0) / overlaps.length
      : 0;

  const betterRated = competitors.filter((competitor) => {
    return (competitor.averageUserRating ?? 0) > (listing.averageUserRating ?? 0);
  }).length;

  // Rating gap vs the strongest competitor
  const topCompetitorRating = Math.max(0, ...competitors.map((c) => c.averageUserRating ?? 0));
  const ratingGap = (listing.averageUserRating ?? 0) - topCompetitorRating;

  const positionScore = 8 - betterRated * 1.5 + Math.min(1.5, competitors.length / 2);
  const overlapBonus = avgOverlap > 0.3 ? -1 : avgOverlap > 0.1 ? 0 : 1; // unique positioning is rewarded

  return makeScore("competitivePosition", positionScore + overlapBonus, [
    `${competitors.length} competitor(s) found in the same category/search set: ${competitors.map((c) => c.trackName).join(", ")}.`,
    `${betterRated} competitor(s) outrate this listing. Rating gap vs strongest competitor: ${ratingGap >= 0 ? "+" : ""}${ratingGap.toFixed(2)}.`,
    `Average title keyword overlap with competitors: ${Math.round(avgOverlap * 100)}% — ${avgOverlap > 0.3 ? "heavy direct contention." : "differentiated positioning."}`
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
  const descriptionBefore = truncate((listing.description ?? "").split("\n").find(Boolean) ?? "", 120);

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
      before: getSubtitle(listing),
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
      before: keywords.slice(0, 6).join(", ") || undefined,
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
  // Precedence: real subtitle from Firecrawl scrape, then opportunistic
  // HTML hint (og:description / json-ld). The HTML hint is a noisy signal,
  // so we filter Apple's boilerplate before trusting it.
  const candidate = listing.subtitle ?? listing.htmlSubtitle;
  if (!candidate) return undefined;

  const normalized = candidate.trim();
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
