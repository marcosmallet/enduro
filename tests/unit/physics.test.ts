import { describe, expect, it } from 'vitest';
import { GAME_RULES } from '../../src/config/game';
import { applyCollisionPenalty, updatePlayer } from '../../src/game/physics';
import { createGameState } from '../../src/game/state';

describe('arcade car physics', () => {
  it('accelerates, brakes and respects maximum speed', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1 });
    for (let index = 0; index < 500; index += 1) {
      updatePlayer(state, { accelerate: true, brake: false, steer: 0 }, 1 / 60);
    }
    expect(state.speedKph).toBe(GAME_RULES.maxSpeedKph);

    const beforeBrake = state.speedKph;
    updatePlayer(state, { accelerate: false, brake: true, steer: 0 }, 0.5);
    expect(state.speedKph).toBeLessThan(beforeBrake);
  });

  it('moves laterally with small inertia and keeps the car on the road', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.speedKph = 180;
    for (let index = 0; index < 120; index += 1) {
      updatePlayer(state, { accelerate: false, brake: false, steer: 1 }, 1 / 60);
    }
    expect(state.playerX).toBeGreaterThan(0.25);
    expect(state.playerX).toBeLessThanOrEqual(GAME_RULES.playerRoadLimit);
  });

  it('applies the configured abrupt collision penalty', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.speedKph = 200;
    applyCollisionPenalty(state);
    expect(state.speedKph).toBeCloseTo(200 * GAME_RULES.collisionSpeedMultiplier);
    expect(state.collisionCount).toBe(1);
    expect(state.collisionCooldown).toBeGreaterThan(0);
  });
});
