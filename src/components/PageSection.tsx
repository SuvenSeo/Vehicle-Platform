import { ReactNode } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { cn } from "@/lib/utils";

interface PageSectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function PageSection({ id, title, subtitle, eyebrow, children, className = "", delay = 0 }: PageSectionProps) {
  void delay;

  return (
    <section id={id} className={cn("page-section scroll-mt-16", className)}>
      {(title || subtitle) && (
        <SectionHeader eyebrow={eyebrow} title={title ?? ""} description={subtitle} />
      )}
      {children}
    </section>
  );
}
