/** Only same-origin relative paths are allowed as post-login redirects. */
export function sanitizeSignInRedirect(pathname: unknown): string {
  if (typeof pathname !== "string") return "/pro";
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/pro";
  return pathname;
}
