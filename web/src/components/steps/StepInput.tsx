import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  initialValue?: string;
  onSubmit: (url: string) => void;
  loading: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

const EXAMPLES = [
  { label: "Notion", url: "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281" },
  { label: "Things 3", url: "https://apps.apple.com/us/app/things-3/id904237743" },
  { label: "Duolingo", url: "https://apps.apple.com/us/app/duolingo-language-lessons/id570060128" },
  { label: "Linear", url: "https://apps.apple.com/us/app/linear-mobile/id1645587184" },
  { label: "Bear Notes", url: "https://apps.apple.com/us/app/bear-markdown-notes/id1016366447" }
];

export function StepInput({
  initialValue = "",
  onSubmit,
  loading,
  error,
  children
}: Props): JSX.Element {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialValue && initialValue !== value) setValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [value, autosize]);

  const submit = useCallback(
    (event?: FormEvent | KeyboardEvent): void => {
      if (event) event.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || loading) return;
      onSubmit(trimmed);
    },
    [value, loading, onSubmit]
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-7 sm:gap-10">
      <h1 className="text-center text-[28px] sm:text-[34px] font-semibold tracking-tight leading-tight">
        What app should we audit?
      </h1>

      <form onSubmit={submit} className="w-full">
        <div
          className={cn(
            "w-full rounded-2xl bg-ink/[0.04] dark:bg-ink/[0.06] p-2",
            "border border-transparent focus-within:border-accent-green/30 transition-colors"
          )}
        >
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            <Sparkles className="h-3.5 w-3.5 text-accent-green/90" />
            <span className="text-[12px] text-muted">Paste any apps.apple.com URL</span>
          </div>

          <div className="relative rounded-xl bg-surface">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://apps.apple.com/us/app/..."
              disabled={loading}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl bg-transparent",
                "px-4 pt-3 pb-12 outline-none",
                "text-[14px] text-ink placeholder:text-muted",
                "font-mono tracking-tight"
              )}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-2">
              <span className="hidden sm:inline text-[12px] text-muted">
                <kbd className="rounded border border-border bg-elevated px-1.5 py-0.5 text-mono">
                  ↵
                </kbd>{" "}
                to submit
              </span>
              <button
                type="submit"
                disabled={loading || !value.trim()}
                aria-label="Run audit"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-lg",
                  "bg-logo text-[rgb(23_23_25)]",
                  "hover:bg-logo/88 active:bg-logo/70",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-colors"
                )}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-[12px] text-danger-ink">{error}</p>
        ) : null}
      </form>

      <div className="flex flex-col items-center gap-3">
        <span className="text-[12px] text-muted">Try one</span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.url}
              type="button"
              onClick={() => {
                setValue(example.url);
                onSubmit(example.url);
              }}
              disabled={loading}
              className={cn(
                "rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]",
                "text-ink-soft hover:text-ink hover:border-ring hover:bg-elevated transition-colors",
                "disabled:opacity-50"
              )}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
