import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn("rounded-xl border border-border bg-surface", className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 sm:gap-4 border-b border-border px-4 sm:px-6 py-3 sm:py-4",
        className
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>): JSX.Element {
  return <h2 className={cn("text-[16px] font-semibold tracking-tight", className)} {...rest} />;
}

export function CardSubtle({ className, ...rest }: HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span className={cn("text-[12px] text-muted", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn("px-6 py-5", className)} {...rest} />;
}
