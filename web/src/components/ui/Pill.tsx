import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "accent" | "warning" | "danger" | "mono";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  default: "border-border bg-elevated text-muted",
  accent: "border-accent-green/45 bg-accent-green/15 text-ink",
  warning: "border-warning/40 bg-warning/10 text-ink",
  danger: "border-danger/40 bg-danger/10 text-danger-ink",
  mono: "border-border bg-elevated text-ink-soft font-mono"
};

export function Pill({ className, tone = "default", ...rest }: Props): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px]",
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}
