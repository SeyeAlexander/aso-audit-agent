import { ArrowRight } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardSubtle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface Props {
  title: string;
  tagline: string;
  items: Recommendation[];
}

export function RecommendationSection({ title, tagline, items }: Props): JSX.Element {
  const displayItems = items.length > 0 ? items : buildFallbackRecommendations(title);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardSubtle>{tagline}</CardSubtle>
      </CardHeader>
      <ol className="flex flex-col divide-y divide-border">
        {displayItems.map((item, index) => (
          <li key={index} className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-mono text-[12px] text-muted w-5 shrink-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="text-[14px] font-semibold leading-snug text-ink min-w-0">{item.title}</h4>
            </div>
            <p className="text-[14px] text-ink-soft leading-relaxed pl-0 sm:pl-8">{item.recommendation}</p>
            {item.evidence ? (
              <p className="text-[12px] text-muted pl-0 sm:pl-8">
                <span className="uppercase tracking-widest text-[12px] text-muted/80">Evidence · </span>
                {item.evidence}
              </p>
            ) : null}
            {item.before || item.after ? (
              <div className="mt-1 pl-0 sm:pl-8 grid gap-2 sm:grid-cols-2">
                {item.before ? <BeforeAfter label="Before" value={item.before} /> : null}
                {item.after ? <BeforeAfter label="After" value={item.after} accent /> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function buildFallbackRecommendations(title: string): Recommendation[] {
  const group = title.toLowerCase();
  if (group.includes("quick")) {
    return [
      {
        title: "Tighten subtitle intent",
        recommendation:
          "State the target use-case and user outcome in plain language so searchers instantly understand fit.",
        evidence: "No auto-generated recommendation was available for this pass."
      },
      {
        title: "Refresh first screenshot copy",
        recommendation:
          "Use a single benefit-focused headline on the first screenshot to improve first-impression conversion.",
        evidence: "Fallback baseline for empty recommendation output."
      }
    ];
  }
  if (group.includes("high-impact")) {
    return [
      {
        title: "Rework metadata around top jobs-to-be-done",
        recommendation:
          "Prioritize title/subtitle phrasing around one high-intent use-case cluster and align description headings.",
        evidence: "No high-impact items were generated for this run."
      },
      {
        title: "Improve social proof density",
        recommendation:
          "Drive recent reviews and surface strong quotes in creatives to raise conversion confidence.",
        evidence: "Fallback baseline for empty recommendation output."
      }
    ];
  }
  return [
    {
      title: "Define a 6-8 week ASO experiment plan",
      recommendation:
        "Schedule controlled metadata + creative iterations with tracked hypotheses and baseline conversion metrics.",
      evidence: "No long-term recommendations were generated for this run."
    },
    {
      title: "Instrument retention-informed messaging",
      recommendation:
        "Use cohort insights to align App Store positioning with the behaviors of retained users.",
      evidence: "Fallback baseline for empty recommendation output."
    }
  ];
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
        "rounded-lg border bg-elevated px-3 py-2.5",
        accent ? "border-accent-green/45" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-widest">
        <span className={accent ? "text-ink" : "text-muted"}>{label}</span>
        {accent ? <ArrowRight className="h-3 w-3 text-ink-soft" /> : null}
      </div>
      <p className={cn("mt-1 text-[14px]", accent ? "text-ink" : "text-ink-soft")}>{value}</p>
    </div>
  );
}
