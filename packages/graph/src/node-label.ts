/** Visual truncation belongs to the graph contribution, never the document name. */
export function truncateNodeLabel(raw: string, shape?: string): string {
  const max = shape?.includes("diamond")
    ? 10
    : shape?.includes("circle")
      ? /^[\u0000-\u007f]*$/.test(raw)
        ? 8
        : 4
      : 12;
  let width = 0;
  for (const ch of raw) width += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  if (width <= max) return raw;
  let current = 0,
    end = 0;
  for (const ch of raw) {
    const size = ch.charCodeAt(0) > 0x7f ? 2 : 1;
    if (current + size > max - 1) break;
    current += size;
    end++;
  }
  return raw.slice(0, end) + "…";
}
