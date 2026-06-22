import { useEffect, useRef } from "react";

const INTERACTIVE = 'a, button, [role="button"], label, select, input, textarea, [tabindex="0"]';

/**
 * A precision gold cursor: a crisp dot that tracks the pointer 1:1 and a larger
 * ring that follows with easing and expands over interactive elements.
 * Disabled on coarse pointers and when the user prefers reduced motion.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add("cursor-custom-active");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = 0;
    let running = false;
    const LERP = 0.16;

    // Self-parking loop: animates only while the ring is catching up to the
    // pointer, then stops so the page can reach idle (no perpetual rAF).
    const tick = () => {
      ringX += (mouseX - ringX) * LERP;
      ringY += (mouseY - ringY) * LERP;
      dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      ring.style.transform = `translate(${ringX}px, ${ringY}px)`;
      if (Math.abs(mouseX - ringX) < 0.3 && Math.abs(mouseY - ringY) < 0.3) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const ensureRunning = () => {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; ensureRunning(); };
    const onDown = () => ring.classList.add("is-down");
    const onUp = () => ring.classList.remove("is-down");
    const onOver = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest?.(INTERACTIVE)) ring.classList.add("is-hovering");
    };
    const onOut = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest?.(INTERACTIVE)) {
        const related = e.relatedTarget as Element | null;
        if (!related?.closest?.(INTERACTIVE)) ring.classList.remove("is-hovering");
      }
    };
    const onLeave = () => { dot.style.opacity = "0"; ring.style.opacity = "0"; };
    const onEnter = () => { dot.style.opacity = ""; ring.style.opacity = ""; };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mousedown", onDown, { passive: true });
    document.addEventListener("mouseup", onUp, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      document.body.classList.remove("cursor-custom-active");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
