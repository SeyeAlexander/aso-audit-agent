import { ArrowRight } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  title: string;
  tagline: string;
  items: Recommendation[];
  tone?: "accent" | "warning" | "muted";
}

export function RecommendationSection({ title, tagline, items, tone = "accent" }: Props): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-panel shadow-panel">
      <header className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className={cn("text-xs", toneToText(tone))}>{tagline}</span>
      </header>
      <ol className="flex flex-col divide-y divide-border">
        {items.map((item, index) => (
          <li key={index} className="px-5 py-4 flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className={cn("text-mono text-xs", toneToText(tone))}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="text-sm font-medium text-ink">{item.title}</h4>
            </div>
            <p className="text-sm text-muted">{item.recommendation}</p>
            {item.evidence ? (
              <p className="text-xs text-muted/80">
                <span className="text-muted">Evidence:</span> {item.evidence}
              </p>
            ) : null}
            {item.before || item.after ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {item.before ? <BeforeAfter label="Before" value={item.before} /> : null}
                {item.after ? <BeforeAfter label="After" value={item.after} accent /> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function BeforeAfter({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-xl border bg-elevated px-3 py-2",
        accent ? "border-accent/30" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
        <span className={accent ? "text-accent" : "text-muted"}>{label}</span>
        {accent ? <ArrowRight className="h-3 w-3 text-accent" /> : null}
      </div>
      <p className={cn("mt-1 text-sm", accent ? "text-ink" : "text-muted")}>{value}</p>
    </div>
  );
}

function toneToText(tone: "accent" | "warning" | "muted"): string {
  if (tone === "accent") return "text-accent";
  if (tone === "warning") return "text-warning";
  return "text-muted";
}
