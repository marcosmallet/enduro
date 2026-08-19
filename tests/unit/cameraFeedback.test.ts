import { beforeEach, describe, expect, it } from 'vitest';
import { createGameState } from '../../src/game/state';
import { deriveCameraFeedback } from '../../src/rendering/cameraFeedback';

describe('camera presentation feedback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays near neutral at rest and does not mutate gameplay state', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 11 });
    const before = structuredClone(state);
    const neutral = deriveCameraFeedback(state, 0, false);

    expect(Math.abs(neutral.worldRollRadians)).toBeLessThan(0.001);
    expect(neutral.worldOffsetY).toBeCloseTo(0, 6);
    expect(neutral.playerRollRadians).toBeCloseTo(0, 6);
    expect(neutral.playerOffsetX).toBeCloseTo(0, 6);
    expect(neutral.playerOffsetY).toBeCloseTo(0, 6);
    expect(state).toEqual(before);
  });

  it('responds to speed, steering and collision while respecting hard bounds', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 12 });
    state.speedKph = 228;
    state.distanceMeters = 1234;
    state.lateralVelocity = 1.2;
    state.collisionFlash = 0.42;

    const feedback = deriveCameraFeedback(state, 1.234, false);

    expect(Math.abs(feedback.worldRollRadians)).toBeGreaterThan(0.001);
    expect(Math.abs(feedback.playerRollRadians)).toBeGreaterThan(0.005);
    expect(Math.abs(feedback.playerOffsetX)).toBeGreaterThan(0.1);
    expect(Math.abs(feedback.worldRollRadians)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(feedback.worldOffsetY)).toBeLessThanOrEqual(4);
    expect(Math.abs(feedback.playerRollRadians)).toBeLessThanOrEqual(0.045);
    expect(Math.abs(feedback.playerOffsetX)).toBeLessThanOrEqual(4);
    expect(Math.abs(feedback.playerOffsetY)).toBeLessThanOrEqual(3);
  });

  it('materially reduces camera motion for reduced-motion users', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 13 });
    state.speedKph = 210;
    state.distanceMeters = 900;
    state.lateralVelocity = -0.9;
    state.collisionFlash = 0.42;

    const regular = deriveCameraFeedback(state, 2.345, false);
    const reduced = deriveCameraFeedback(state, 2.345, true);

    expect(reduced.motionScale).toBeCloseTo(0.18, 6);
    expect(Math.abs(reduced.worldRollRadians)).toBeLessThan(Math.abs(regular.worldRollRadians));
    expect(Math.abs(reduced.worldOffsetY)).toBeLessThan(Math.abs(regular.worldOffsetY));
    expect(Math.abs(reduced.playerRollRadians)).toBeLessThan(Math.abs(regular.playerRollRadians));
    expect(Math.abs(reduced.playerOffsetX)).toBeLessThan(Math.abs(regular.playerOffsetX));
  });
});
