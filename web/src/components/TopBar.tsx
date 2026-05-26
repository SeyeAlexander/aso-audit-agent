import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface Props {
  onHome: () => void;
}

export function TopBar({ onHome }: Props): JSX.Element {
  return (
    <header className="sticky top-0 z-30 w-full glass border-b border-border">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 h-14">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2.5 group"
          aria-label="ASO Audit Agent — home"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-logo group-hover:bg-logo/80 transition-colors" />
          <span className="text-mono text-[13px] font-medium tracking-tight text-ink">
            aso-audit-agent
          </span>
        </button>
        <div className="flex items-center gap-3">
          <a
            href="https://mastra.ai"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline text-[12px] text-muted hover:text-ink"
          >
            Powered by Mastra
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
