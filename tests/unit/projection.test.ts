import { describe, expect, it } from 'vitest';
import { projectRoadPoint, roadCurve } from '../../src/rendering/projection';

describe('pseudo-3D road projection', () => {
  it('converges toward the horizon and widens near the player', () => {
    const far = projectRoadPoint(270);
    const middle = projectRoadPoint(140);
    const near = projectRoadPoint(10);

    expect(far.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(near.y);
    expect(far.roadHalfWidth).toBeLessThan(middle.roadHalfWidth);
    expect(middle.roadHalfWidth).toBeLessThan(near.roadHalfWidth);
  });

  it('projects lateral positions around the same road center', () => {
    const left = projectRoadPoint(90, -0.5, 300);
    const center = projectRoadPoint(90, 0, 300);
    const right = projectRoadPoint(90, 0.5, 300);

    expect(left.x).toBeLessThan(center.x);
    expect(center.x).toBeLessThan(right.x);
    expect(center.x - left.x).toBeCloseTo(right.x - center.x, 5);
  });

  it('keeps the road center finite through long distances', () => {
    for (let distance = 0; distance < 1_000_000; distance += 7919) {
      expect(Number.isFinite(roadCurve(distance, 180))).toBe(true);
    }
  });
});
