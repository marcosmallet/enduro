import { describe, expect, it } from 'vitest';
import { VISUAL_ASSET_MANIFEST } from '../../src/rendering/AssetLibrary';

describe('milestone 4 visual asset manifest', () => {
  it('contains the seven optimized, uniquely addressed WebP assets', () => {
    const assets = Object.values(VISUAL_ASSET_MANIFEST);
    const paths = assets.map((asset) => asset.path);

    expect(assets).toHaveLength(7);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.endsWith('.webp'))).toBe(true);
    expect(paths.filter((path) => path.startsWith('assets/vehicles/'))).toHaveLength(5);
    expect(paths.filter((path) => path.startsWith('assets/landscape/'))).toHaveLength(1);
    expect(paths.filter((path) => path.startsWith('assets/textures/'))).toHaveLength(1);
  });

  it('keeps each encoded asset and the complete visual set inside the POC budget', () => {
    const sizes = Object.values(VISUAL_ASSET_MANIFEST).map((asset) => asset.bytes);

    expect(Math.max(...sizes)).toBeLessThan(100 * 1024);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThan(350 * 1024);
  });
});
