import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
  error?: string | null;
}

export function UrlPrompt({ onSubmit, loading, error }: Props): JSX.Element {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-panel px-2 py-2",
          "shadow-panel focus-within:border-accent/40 transition-colors"
        )}
      >
        <input
          type="url"
          inputMode="url"
          autoFocus
          required
          disabled={loading}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://apps.apple.com/us/app/..."
          className={cn(
            "flex-1 bg-transparent px-3 py-2 outline-none text-ink placeholder:text-muted/70",
            "font-mono text-sm tracking-tight"
          )}
        />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-surface",
            "hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Audit
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
