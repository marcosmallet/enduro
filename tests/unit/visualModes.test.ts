import { describe, expect, it } from 'vitest';
import { hyperRevealProgress, legacyRenderSize } from '../../src/rendering/visualModes';

describe('legacy to hyper presentation', () => {
  it('moves from a 320x180 pixel buffer to the full logical resolution', () => {
    expect(legacyRenderSize(1)).toEqual({ width: 320, height: 180 });
    expect(legacyRenderSize(0)).toEqual({ width: 1280, height: 720 });
    expect(legacyRenderSize(0.5)).toEqual({ width: 800, height: 450 });
  });

  it('uses a bounded smooth reveal over 4.2 seconds', () => {
    expect(hyperRevealProgress(-100)).toBe(0);
    expect(hyperRevealProgress(2_100)).toBeCloseTo(0.5);
    expect(hyperRevealProgress(4_200)).toBe(1);
    expect(hyperRevealProgress(8_000)).toBe(1);
  });
});
