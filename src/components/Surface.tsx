import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: "default" | "elevated" | "glass";
  interactive?: boolean;
};

export function Surface({
  children,
  className,
  variant = "default",
  interactive = false,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "surface",
        variant === "elevated" && "surface--elevated",
        variant === "glass" && "surface--glass",
        interactive && "surface--interactive",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
