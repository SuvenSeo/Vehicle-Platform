import { useEffect, useRef } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Surface } from "@/components/Surface";

type LoaderProps = {
  onEnter?: () => void;
};

export const Loader = ({ onEnter }: LoaderProps) => {
  const enteredRef = useRef(false);

  useEffect(() => {
    if (!onEnter) return;

    const timer = window.setTimeout(() => {
      if (enteredRef.current) return;
      enteredRef.current = true;
      onEnter();
    }, 320);

    return () => window.clearTimeout(timer);
  }, [onEnter]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background px-6"
      role="status"
      aria-label="Loading AutoLens LK"
    >
      <AmbientBackground variant="hero" className="fixed inset-0" />
      <Surface variant="glass" className="relative w-full max-w-sm animate-fade-up p-8 text-center">
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card">
          <img src="/logo.svg" alt="AutoLens LK logo" className="h-8 w-8 object-contain" />
          <span className="absolute -inset-px rounded-2xl border border-primary/30 border-t-transparent animate-spin" />
        </div>
        <div className="mt-5 text-center">
          <p className="headline-display text-lg text-foreground">
            AutoLens <span className="text-muted-foreground">LK</span>
          </p>
          <p className="section-eyebrow mt-2 normal-case tracking-normal">Preparing your market view</p>
        </div>
        <div className="mt-6 grid gap-2">
          {["Sources", "Pricing index", "Dashboard"].map((item, index) => (
            <div key={item} className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-all duration-700 ease-out"
                style={{ width: `${55 + index * 18}%` }}
              />
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
};
