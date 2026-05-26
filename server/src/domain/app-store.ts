import { z } from "zod";

const appStoreLookupResultSchema = z.object({
  trackId: z.number(),
  trackName: z.string(),
  trackCensoredName: z.string().optional(),
  sellerName: z.string().optional(),
  artistName: z.string().optional(),
  artworkUrl512: z.string().url().optional(),
  artworkUrl100: z.string().url().optional(),
  primaryGenreName: z.string().optional(),
  genres: z.array(z.string()).optional(),
  genreIds: z.array(z.string()).optional(),
  trackViewUrl: z.string().url(),
  description: z.string().optional(),
  releaseNotes: z.string().optional(),
  averageUserRating: z.number().optional(),
  userRatingCount: z.number().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
  ipadScreenshotUrls: z.array(z.string().url()).optional(),
  appletvScreenshotUrls: z.array(z.string().url()).optional(),
  previewUrls: z.array(z.string().url()).optional(),
  version: z.string().optional(),
  currentVersionReleaseDate: z.string().optional(),
  contentAdvisoryRating: z.string().optional(),
  languageCodesISO2A: z.array(z.string()).optional(),
  price: z.number().optional(),
  formattedPrice: z.string().optional(),
  minimumOsVersion: z.string().optional()
});

const appStoreLookupResponseSchema = z.object({
  resultCount: z.number(),
  results: z.array(appStoreLookupResultSchema)
});

export type AppStoreLookupResult = z.infer<typeof appStoreLookupResultSchema>;

export interface AppStoreListing extends AppStoreLookupResult {
  country: string;
  appStoreUrl: string;
  htmlSubtitle?: string | undefined;
  htmlDescription?: string | undefined;
}

export interface SurfaceMetadata {
  appName: string;
  developer: string;
  iconUrl?: string | undefined;
  category: string;
  country: string;
  appId: number;
}

export interface ParsedAppStoreUrl {
  appId: number;
  country: string;
  url: string;
}

export function parseAppStoreUrl(input: string): ParsedAppStoreUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Please paste a valid Apple App Store URL.");
  }

  if (url.hostname !== "apps.apple.com") {
    throw new Error("The URL must be from apps.apple.com.");
  }

  const idMatch = url.pathname.match(/\/id(\d+)/);
  if (!idMatch?.[1]) {
    throw new Error("Could not find an Apple app id in that URL.");
  }

  const country = url.pathname.split("/").filter(Boolean)[0] ?? "us";

  return {
    appId: Number(idMatch[1]),
    country: country.toLowerCase(),
    url: url.toString()
  };
}

export function toSurfaceMetadata(listing: AppStoreListing): SurfaceMetadata {
  const metadata: SurfaceMetadata = {
    appName: listing.trackName,
    developer: listing.sellerName ?? listing.artistName ?? "Unknown developer",
    category: listing.primaryGenreName ?? listing.genres?.[0] ?? "Unknown category",
    country: listing.country.toUpperCase(),
    appId: listing.trackId
  };

  const iconUrl = listing.artworkUrl512 ?? listing.artworkUrl100;
  if (iconUrl) metadata.iconUrl = iconUrl;

  return metadata;
}

export function parseLookupResponse(payload: unknown): AppStoreLookupResult {
  const parsed = appStoreLookupResponseSchema.parse(payload);
  const result = parsed.results[0];

  if (!result) {
    throw new Error("Apple returned no listing for this app id/country.");
  }

  return result;
}
