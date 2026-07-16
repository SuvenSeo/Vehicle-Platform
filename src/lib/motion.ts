/** True when the user asks the OS for reduced motion — gate all JS-driven
 * smooth scrolling and non-essential animation on this (WCAG 2.3.3). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Scroll behavior that respects the user's motion preference. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
