import { DIMENSION_LABELS, DIMENSIONS, type AsoAudit, type CompetitorSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  audit: AsoAudit;
  competitors: CompetitorSummary[];
}

export function CompetitorTable({ audit, competitors }: Props): JSX.Element {
  const ownScores = Object.fromEntries(audit.scoreCard.map((row) => [row.dimension, row.score]));

  return (
    <section className="rounded-2xl border border-border bg-panel shadow-panel overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Competitor comparison</h3>
        <span className="text-xs text-muted">Apple Search, same country &amp; category</span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-elevated/40 text-left text-xs uppercase tracking-widest text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Dimension</th>
              <th className="px-3 py-3 font-medium text-accent">{audit.appName}</th>
              {audit.competitors.map((competitor) => (
                <th key={competitor.name} className="px-3 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <CompetitorIcon name={competitor.name} competitors={competitors} />
                    <span className="truncate">{competitor.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DIMENSIONS.map((dimension) => (
              <tr key={dimension}>
                <td className="px-5 py-3 text-muted">{DIMENSION_LABELS[dimension]}</td>
                <td className="px-3 py-3 text-accent text-mono tabular-nums">
                  {formatScore(ownScores[dimension])}
                </td>
                {audit.competitors.map((competitor) => (
                  <td key={competitor.name} className="px-3 py-3 text-ink/90 text-mono tabular-nums">
                    {formatScore(competitor.scores[dimension])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-border">
        {competitors.map((competitor) => (
          <li key={competitor.name} className="flex items-center gap-3 rounded-xl border border-border bg-elevated px-3 py-2">
            {competitor.iconUrl ? (
              <img src={competitor.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-panel" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{competitor.name}</p>
              <p className="truncate text-xs text-muted">
                {competitor.rating ? `${competitor.rating.toFixed(1)}★` : "—"}{" "}
                {competitor.ratingCount ? `(${formatCount(competitor.ratingCount)})` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompetitorIcon({
  name,
  competitors
}: {
  name: string;
  competitors: CompetitorSummary[];
}): JSX.Element {
  const url = competitors.find((c) => c.name === name)?.iconUrl;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-md border border-border bg-elevated"
      )}
    >
      {url ? <img src={url} alt="" className="h-full w-full rounded-md" /> : null}
    </span>
  );
}

function formatScore(value: number | undefined): string {
  return typeof value === "number" ? value.toFixed(1) : "—";
}

function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
