import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AmbientBackground } from "@/components/AmbientBackground";

type PageCanvasProps = {
  children: ReactNode;
  className?: string;
  ambient?: "default" | "hero" | "subtle";
};

export function PageCanvas({ children, className, ambient = "default" }: PageCanvasProps) {
  return (
    <div className={cn("page-canvas", className)}>
      <AmbientBackground variant={ambient} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
