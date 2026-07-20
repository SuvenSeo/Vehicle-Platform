import { motion } from "framer-motion";
import { AmbientBackground } from "@/components/AmbientBackground";
import { revealContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PageCanvasProps = {
  children: React.ReactNode;
  className?: string;
  ambient?: "default" | "hero" | "subtle";
};

export function PageCanvas({ children, className, ambient = "default" }: PageCanvasProps) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={revealContainer}
      className={cn("page-canvas relative min-h-screen overflow-hidden -mt-16", className)}
    >
      <AmbientBackground variant={ambient} />
      <div className="page-canvas__content relative z-[1] pt-16">{children}</div>
    </motion.div>
  );
}
