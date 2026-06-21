import { ReactNode, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

interface RevealSectionProps extends ComponentPropsWithoutRef<"section"> {
  children: ReactNode;
  delay?: number;
}

export function RevealSection({ children, className = "", delay = 0, ...sectionProps }: RevealSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      {...sectionProps}
      className={cn("reveal-section", visible && "reveal-section--visible", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </section>
  );
}
