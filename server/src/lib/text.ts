export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export function uniqueKeywords(text: string, limit = 12): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "your",
    "you",
    "app",
    "apps",
    "ios",
    "iphone",
    "ipad",
    "music",
    "free"
  ]);

  const counts = new Map<string, number>();
  for (const word of words(text)) {
    if (stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function sentenceCase(value: string): string {
  if (!value) return value;
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
