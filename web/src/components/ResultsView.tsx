import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import type { AuditResponse } from "@/lib/types";
import { ScoreCard } from "./ScoreCard";
import { RecommendationSection } from "./RecommendationSection";
import { CompetitorTable } from "./CompetitorTable";
import { Card, CardHeader, CardTitle, CardSubtle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";

interface Props {
  data: AuditResponse;
  onAuditUrl: (url: string) => void;
  onAuditAnother: () => void;
}

interface Section {
  id: string;
  label: string;
  meta?: string;
}

export function ResultsView({ data, onAuditUrl, onAuditAnother }: Props): JSX.Element {
  const sections: Section[] = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "score-card", label: "Score card", meta: `${data.audit.overallScore}/100` },
      { id: "quick-wins", label: "Quick wins", meta: `${data.audit.quickWins.length}` },
      { id: "high-impact", label: "High-impact", meta: `${data.audit.highImpactChanges.length}` },
      { id: "long-term", label: "Long-term", meta: `${data.audit.strategicRecommendations.length}` },
      { id: "competitors", label: "Competitors", meta: `${data.competitors.length}` },
      { id: "evidence", label: "Source & caveats" }
    ],
    [data]
  );

  const activeId = useActiveSection(sections.map((s) => s.id));

  return (
    <div className="w-full max-w-6xl grid gap-6 lg:gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-3">
          <span className="text-[12px] uppercase tracking-[0.18em] text-muted">On this page</span>
          <nav className="flex flex-col gap-0.5">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3 py-2 text-[14px]",
                  "transition-colors",
                  activeId === section.id
                    ? "bg-elevated text-ink"
                    : "text-muted hover:text-ink hover:bg-elevated/60"
                )}
              >
                <span className="truncate">{section.label}</span>
                {section.meta ? (
                  <span className="text-mono text-[12px] text-muted shrink-0 ml-2">
                    {section.meta}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={onAuditAnother}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface",
              "px-3 h-9 text-[14px] text-ink-soft hover:text-ink hover:bg-elevated hover:border-accent-green/50 transition-colors"
            )}
          >
            <Plus className="h-3.5 w-3.5 text-accent-green/90" />
            Audit another app
          </button>
        </div>
      </aside>

      <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
        <section id="overview" className="anchor-offset">
          <OverviewCard data={data} />
        </section>

        <section id="score-card" className="anchor-offset">
          <ScoreCard
            audit={data.audit}
            metadata={data.surfaceMetadata}
            agentLed={data.agentLed}
          />
        </section>

        <section id="quick-wins" className="anchor-offset">
          <RecommendationSection
            title="Quick wins"
            tagline="Ship today"
            items={data.audit.quickWins}
          />
        </section>

        <section id="high-impact" className="anchor-offset">
          <RecommendationSection
            title="High-impact changes"
            tagline="Real effort, real lift"
            items={data.audit.highImpactChanges}
          />
        </section>

        <section id="long-term" className="anchor-offset">
          <RecommendationSection
            title="Long-term recommendations"
            tagline="Long-term direction"
            items={data.audit.strategicRecommendations}
          />
        </section>

        <section id="competitors" className="anchor-offset">
          <CompetitorTable
            audit={data.audit}
            competitors={data.competitors}
            onAuditUrl={onAuditUrl}
          />
        </section>

        <section id="evidence" className="anchor-offset">
          <EvidenceFooter data={data} />
        </section>
      </div>
    </div>
  );
}

function OverviewCard({ data }: { data: AuditResponse }): JSX.Element {
  const sm = data.surfaceMetadata;
  const h = data.highlights;
  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
        {sm.iconUrl ? (
          <img
            src={sm.iconUrl}
            alt=""
            className="h-20 w-20 rounded-xl border border-border bg-elevated shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl border border-border bg-elevated shrink-0" />
        )}
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight tracking-tight truncate">
                {sm.appName}
              </h2>
              {h.subtitle ? <p className="text-sm text-ink-soft">{h.subtitle}</p> : null}
              <p className="text-sm text-muted">{sm.developer}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Pill tone="accent">{Math.round(data.audit.overallScore)}/100</Pill>
              <Pill tone={data.agentLed ? "accent" : "default"}>
                {data.agentLed ? "Agent-led" : "Deterministic"}
              </Pill>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill>{sm.category}</Pill>
            <Pill>{sm.country}</Pill>
            {h.formattedPrice ? <Pill>{h.formattedPrice}</Pill> : null}
            {typeof h.averageUserRating === "number" ? (
              <Pill>{h.averageUserRating.toFixed(2)}★</Pill>
            ) : null}
            <Pill tone="mono">#{sm.appId}</Pill>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EvidenceFooter({ data }: { data: AuditResponse }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Source &amp; caveats</CardTitle>
        <CardSubtle>How this audit was produced</CardSubtle>
      </CardHeader>
      <div className="px-5 py-4 flex flex-col gap-3 text-[14px] text-ink-soft leading-relaxed">
        <p>
          Source listing:{" "}
          <a
            href={data.trackViewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-ink underline-offset-4 hover:underline"
          >
            {data.trackViewUrl.replace("https://", "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <p className="text-muted">
          {data.agentLed
            ? "The ASO Strategist agent scored all ten dimensions and wrote the recommendations, applying the methodology skill to facts measured from Apple's iTunes Lookup API"
            : "Scores come from the deterministic ASO engine reading Apple's iTunes Lookup API"}
          {data.capabilities.firecrawl ? ", augmented with Firecrawl page scraping for subtitle, promotional text, and What's New" : ""}.
          {data.agentLed
            ? " A deterministic engine measured those facts, clamped the agent's scores to 0–10, and recomputed the weighted score out of 100 as a guardrail."
            : " No LLM key was configured, so the agent layer was skipped and this is the deterministic baseline."}
        </p>
        <p className="text-muted">
          Apple's private 100-character keyword field is App Store Connect–only, so that dimension
          estimates coverage from visible metadata. Icon distinctiveness, screenshot creative, and
          preview-video pacing require a manual review pass.
        </p>
      </div>
    </Card>
  );
}

/** IntersectionObserver-driven active section, sticky TOC highlight. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const ratiosRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const map = ratiosRef.current;
    map.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          map.set(entry.target.id, entry.intersectionRatio);
        }
        let best: { id: string; ratio: number } | null = null;
        for (const [id, ratio] of map) {
          if (!best || ratio > best.ratio) best = { id, ratio };
        }
        if (best && best.ratio > 0) setActive(best.id);
      },
      {
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
