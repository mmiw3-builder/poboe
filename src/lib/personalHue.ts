/**
 * Deterministic personal hue: the same person (memorial id) always maps to
 * the same color, everywhere it appears.
 */
export function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export function tileGradientCss(id: string): string {
  const h = hueOf(id);
  return `linear-gradient(140deg, hsl(${h} 30% 46%), hsl(${(h + 24) % 360} 34% 24%))`;
}
