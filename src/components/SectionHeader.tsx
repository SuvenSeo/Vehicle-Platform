import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
      <div className="max-w-2xl space-y-2.5 animate-fade-up">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h2 className={cn("font-display text-[1.5rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]", titleClassName)}>
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="shrink-0 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
