import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

interface LazyMapMountProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  placeholder?: ReactNode;
}

/** Mount map children only once the container is near the viewport. */
export function LazyMapMount({ children, className, style, placeholder }: LazyMapMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px", threshold: 0.02 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {ready
        ? children
        : placeholder ?? (
            <div
              className="flex h-full w-full items-center justify-center bg-surface"
              aria-hidden
            >
              <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          )}
    </div>
  );
}
