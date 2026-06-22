import { useEffect, useRef } from "react";

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
    }, 280);
    return () => window.clearTimeout(timer);
  }, [onEnter]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(220,10%,3%)]"
      role="status"
      aria-label="Loading AutoLens LK"
    >
      <div className="flex flex-col items-center gap-5 animate-fade-up">
        <div className="relative">
          <div className="h-12 w-12 rounded-xl border border-white/[0.06] bg-white/[0.02] grid place-items-center">
            <img src="/logo.svg" alt="" className="h-7 w-7 object-contain" />
          </div>
          <div className="absolute -inset-1 rounded-xl border border-amber-400/20 animate-ping opacity-30" />
        </div>
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-white/[0.04]">
          <div className="h-full w-full origin-left animate-pulse bg-gradient-to-r from-amber-500/60 to-amber-400/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
