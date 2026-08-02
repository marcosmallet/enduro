export type VisualMode = 'HYPER' | 'CINEMATIC' | 'LEGACY';

export interface LegacyRenderSize {
  width: number;
  height: number;
}

export function legacyRenderSize(amount: number): LegacyRenderSize {
  const normalized = Math.max(0, Math.min(1, amount));
  const width = Math.round(1280 - 960 * normalized);
  return { width, height: Math.round(width * (9 / 16)) };
}

export function hyperRevealProgress(elapsedMilliseconds: number): number {
  const normalized = Math.max(0, Math.min(1, elapsedMilliseconds / 4_200));
  return normalized * normalized * (3 - 2 * normalized);
}
