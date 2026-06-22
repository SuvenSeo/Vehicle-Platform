/** Fixed full-viewport analog film grain. Sits above content, ignores pointer events. */
export function NoiseOverlay() {
  return <div className="film-grain" aria-hidden="true" />;
}
