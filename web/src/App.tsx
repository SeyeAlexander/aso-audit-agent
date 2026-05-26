import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchListing, runAudit } from "./lib/api";
import type { AuditResponse, ListingResponse } from "./lib/types";
import { UrlPrompt } from "./components/UrlPrompt";
import { AppPreviewCard } from "./components/AppPreviewCard";
import { ScoreCard } from "./components/ScoreCard";
import { RecommendationSection } from "./components/RecommendationSection";
import { CompetitorTable } from "./components/CompetitorTable";

type Stage =
  | { kind: "idle" }
  | { kind: "fetching-listing"; url: string }
  | { kind: "awaiting-confirmation"; url: string; listing: ListingResponse }
  | { kind: "auditing"; url: string; listing: ListingResponse }
  | { kind: "done"; url: string; audit: AuditResponse }
  | { kind: "error"; url: string; message: string };

export function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  const handleUrlSubmit = useCallback(async (url: string) => {
    setStage({ kind: "fetching-listing", url });
    try {
      const listing = await fetchListing(url);
      setStage({ kind: "awaiting-confirmation", url, listing });
    } catch (error) {
      setStage({ kind: "error", url, message: messageOf(error) });
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (stage.kind !== "awaiting-confirmation") return;
    const url = stage.url;
    setStage({ kind: "auditing", url, listing: stage.listing });
    try {
      const audit = await runAudit(url);
      setStage({ kind: "done", url, audit });
    } catch (error) {
      setStage({ kind: "error", url, message: messageOf(error) });
    }
  }, [stage]);

  const reset = useCallback(() => setStage({ kind: "idle" }), []);

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-10 sm:py-16">
      <Header onReset={reset} active={stage.kind !== "idle"} />

      <main className="mt-12 w-full max-w-5xl flex flex-col items-center gap-8">
        {(stage.kind === "idle" ||
          stage.kind === "fetching-listing" ||
          stage.kind === "error") && (
          <>
            <Pitch />
            <UrlPrompt
              onSubmit={handleUrlSubmit}
              loading={stage.kind === "fetching-listing"}
              error={stage.kind === "error" ? stage.message : null}
            />
            <FootHint />
          </>
        )}

        {stage.kind === "awaiting-confirmation" && (
          <>
            <Pitch compact />
            <AppPreviewCard
              metadata={stage.listing.surfaceMetadata}
              onConfirm={handleConfirm}
              onReset={reset}
              confirming={false}
            />
          </>
        )}

        {stage.kind === "auditing" && (
          <>
            <AppPreviewCard
              metadata={stage.listing.surfaceMetadata}
              onConfirm={() => undefined}
              onReset={() => undefined}
              confirming
            />
            <LoadingPanel />
          </>
        )}

        {stage.kind === "done" && (
          <>
            <ScoreCard
              audit={stage.audit.audit}
              metadata={stage.audit.surfaceMetadata}
              usedLlmRefinement={stage.audit.usedLlmRefinement}
            />
            <RecommendationSection
              title="Quick wins"
              tagline="Ship today"
              items={stage.audit.audit.quickWins}
              tone="accent"
            />
            <RecommendationSection
              title="High-impact changes"
              tagline="Real effort, real lift"
              items={stage.audit.audit.highImpactChanges}
              tone="warning"
            />
            <RecommendationSection
              title="Strategic recommendations"
              tagline="Long-term direction"
              items={stage.audit.audit.strategicRecommendations}
              tone="muted"
            />
            <CompetitorTable audit={stage.audit.audit} competitors={stage.audit.competitors} />
            <Evidence url={stage.audit.trackViewUrl} />
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-sm text-muted hover:text-ink underline-offset-4 hover:underline"
            >
              Audit another app
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function Header({ onReset, active }: { onReset: () => void; active: boolean }): JSX.Element {
  return (
    <header className="w-full max-w-5xl flex items-center justify-between">
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2.5 group"
      >
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent group-hover:bg-accent-soft" />
        <span className="text-mono text-sm font-medium tracking-tight">aso-audit-agent</span>
      </button>
      {active ? (
        <span className="text-xs text-muted hidden sm:inline">
          Powered by Mastra · Apple public API
        </span>
      ) : null}
    </header>
  );
}

function Pitch({ compact = false }: { compact?: boolean }): JSX.Element {
  if (compact) {
    return (
      <p className="text-sm text-muted">
        We pulled the surface metadata. Confirm and we&apos;ll run the full audit.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-2xl">
      <span className="rounded-full border border-border bg-panel px-3 py-1 text-[10px] uppercase tracking-widest text-muted">
        App Store Optimization · 10-dimension audit
      </span>
      <h1 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
        Paste an App Store URL. Get a senior ASO review back in seconds.
      </h1>
      <p className="text-muted text-base">
        We fetch the listing, find category competitors, score every dimension that moves
        installs, and write concrete before / after copy you can ship.
      </p>
    </div>
  );
}

function FootHint(): JSX.Element {
  return (
    <div className="text-xs text-muted flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <span>Try:</span>
      <ExampleChip url="https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281">
        Notion
      </ExampleChip>
      <ExampleChip url="https://apps.apple.com/us/app/things-3/id904237743">Things 3</ExampleChip>
      <ExampleChip url="https://apps.apple.com/us/app/duolingo-language-lessons/id570060128">
        Duolingo
      </ExampleChip>
    </div>
  );
}

function ExampleChip({ url, children }: { url: string; children: React.ReactNode }): JSX.Element {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-border bg-panel px-2 py-1 hover:border-muted/60 hover:text-ink transition-colors"
    >
      {children}
    </a>
  );
}

function LoadingPanel(): JSX.Element {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-panel p-6 flex items-center gap-3 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      Fetching listing, finding competitors, scoring ten dimensions…
    </div>
  );
}

function Evidence({ url }: { url: string }): JSX.Element {
  return (
    <p className="text-xs text-muted/80 text-center max-w-2xl">
      Source:{" "}
      <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
        {url}
      </a>
      <br />
      Apple&apos;s private keyword field and screenshot creative aren&apos;t public — those scores
      are inferred from visible metadata.
    </p>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
