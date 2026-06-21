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
    <div className={cn("mb-6 flex flex-col justify-between gap-4 sm:mb-8 md:flex-row md:items-end", className)}>
      <div className="max-w-2xl space-y-2 animate-fade-up">
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        <h2 className={cn("headline-display text-[1.65rem] sm:text-[1.85rem]", titleClassName)}>{title}</h2>
        {description ? <p className="text-lead">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0 animate-fade-up" style={{ animationDelay: "80ms" }}>{actions}</div> : null}
    </div>
  );
}
