/**
 * Greedy fit: how many leading nav tabs fit inside `availableWidth`.
 * `tabWidths` are the tabs' natural (unwrapped) widths; `gap` is the px gap
 * applied between tabs. Always keeps at least one tab visible so the bar
 * never empties out entirely.
 */
export function computeVisibleTabCount(tabWidths: number[], availableWidth: number, gap = 0): number {
  let used = 0;
  let count = 0;
  for (let i = 0; i < tabWidths.length; i++) {
    const width = tabWidths[i] + (i > 0 ? gap : 0);
    if (used + width <= availableWidth || count === 0) {
      used += width;
      count += 1;
    } else {
      break;
    }
  }
  return count;
}
