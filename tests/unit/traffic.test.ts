import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/game/state';
import {
  plannedAdjacentLane,
  populateTraffic,
  registerOvertake,
  updateTraffic,
} from '../../src/game/traffic';
import { SeededRandom } from '../../src/game/random';

function advanceTraffic(
  state: ReturnType<typeof createGameState>,
  seconds: number,
  seed = 1983,
): void {
  const random = new SeededRandom(seed);
  const steps = Math.ceil(seconds / (1 / 60));
  for (let index = 0; index < steps; index += 1) {
    updateTraffic(state, 1 / 60, random);
  }
}

describe('traffic and overtakes', () => {
  it('counts a completely passed vehicle only once', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983, targetOverride: 3 });
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    expect(vehicle).toBeDefined();
    if (!vehicle) return;
    vehicle.z = -9;

    expect(registerOvertake(state, vehicle)).toBe(true);
    expect(registerOvertake(state, vehicle)).toBe(false);
    expect(state.overtakes).toBe(1);
    expect(state.totalOvertakes).toBe(1);
    expect(state.carsLeft).toBe(2);
  });

  it('rejects recycled or not-yet-passed vehicles', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1, targetOverride: 2 });
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.z = -9;
    vehicle.recycledDuringPass = true;
    expect(registerOvertake(state, vehicle)).toBe(false);
    vehicle.recycledDuringPass = false;
    vehicle.z = 1;
    expect(registerOvertake(state, vehicle)).toBe(false);
  });

  it('marks the quick-race target as victory', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1, targetOverride: 1 });
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.z = -9;
    registerOvertake(state, vehicle);
    expect(state.carsLeft).toBe(0);
    expect(state.goalReached).toBe(true);
    expect(state.screen).toBe('VICTORY');
  });

  it('keeps the collision footprint aligned with the smaller player car', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983 });
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.kind = 'SEDAN';
    vehicle.z = 7;
    vehicle.previousZ = 7;
    vehicle.speedKph = state.speedKph;
    vehicle.lateral = 0.205;
    vehicle.preferredLane = 0.205;
    vehicle.maneuverCooldownSeconds = 99;

    updateTraffic(state, 1 / 60, new SeededRandom(1983));
    expect(state.collisionCount).toBe(0);

    vehicle.z = 7;
    vehicle.previousZ = 7;
    vehicle.lateral = 0.195;
    vehicle.preferredLane = 0.195;
    updateTraffic(state, 1 / 60, new SeededRandom(1983));
    expect(state.collisionCount).toBe(1);
  });

  it('telegraphs an adjacent-lane change before committing and moves continuously', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 77 });
    state.speedKph = 118;
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.z = 96;
    vehicle.speedKph = 82;
    vehicle.preferredLane = -0.23;
    vehicle.lateral = -0.23;
    vehicle.maneuverAttempt = 0;
    vehicle.maneuverCooldownSeconds = 0;

    const target = plannedAdjacentLane(state.seed, vehicle);
    expect(target).toBeDefined();
    updateTraffic(state, 1 / 60, new SeededRandom(77));
    expect(vehicle.maneuverPhase).toBe('TELEGRAPH');
    expect(vehicle.maneuverTargetLane).toBe(target);

    const source = vehicle.lateral;
    advanceTraffic(state, 0.45, 77);
    expect(vehicle.maneuverPhase).toBe('TELEGRAPH');
    expect(Math.abs(vehicle.lateral - source)).toBeGreaterThan(0.001);
    expect(Math.abs(vehicle.lateral - source)).toBeLessThan(0.08);

    advanceTraffic(state, 1.7, 77);
    expect(vehicle.maneuverPhase).toBe('IDLE');
    expect(vehicle.preferredLane).toBe(target);
    expect(vehicle.lateral).toBeCloseTo(target ?? 0, 5);
  });

  it('delays a maneuver when the destination corridor is occupied', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 101 });
    state.speedKph = 115;
    populateTraffic(state, 2);
    const mover = state.traffic[0];
    const blocker = state.traffic[1];
    if (!mover || !blocker) throw new Error('Expected two traffic vehicles.');

    mover.z = 92;
    mover.speedKph = 78;
    mover.preferredLane = -0.23;
    mover.lateral = -0.23;
    mover.maneuverAttempt = 0;
    mover.maneuverCooldownSeconds = 0;
    const target = plannedAdjacentLane(state.seed, mover);
    if (target === undefined) throw new Error('Expected an adjacent target lane.');

    blocker.z = 97;
    blocker.preferredLane = target;
    blocker.lateral = target;
    blocker.maneuverCooldownSeconds = 99;

    updateTraffic(state, 1 / 60, new SeededRandom(101));
    expect(mover.maneuverPhase).toBe('IDLE');
    expect(mover.maneuverTargetLane).toBeUndefined();
    expect(mover.maneuverCooldownSeconds).toBeGreaterThan(0);
  });

  it('rejects short-notice cut-ins near the player', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 303 });
    state.speedKph = 210;
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.z = 30;
    vehicle.speedKph = 58;
    vehicle.preferredLane = 0.23;
    vehicle.lateral = 0.23;
    vehicle.maneuverCooldownSeconds = 0;

    updateTraffic(state, 1 / 60, new SeededRandom(303));
    expect(vehicle.maneuverPhase).toBe('IDLE');
    expect(vehicle.maneuverTargetLane).toBeUndefined();
  });

  it('keeps maneuver timing and paths deterministic for the same seed', () => {
    const buildState = () => {
      const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 909 });
      state.speedKph = 124;
      populateTraffic(state, 3);
      const first = state.traffic[0];
      if (!first) throw new Error('Expected traffic.');
      first.z = 105;
      first.speedKph = 86;
      first.maneuverCooldownSeconds = 0;
      for (const vehicle of state.traffic.slice(1)) vehicle.maneuverCooldownSeconds = 99;
      return state;
    };

    const left = buildState();
    const right = buildState();
    const leftRandom = new SeededRandom(909);
    const rightRandom = new SeededRandom(909);

    for (let index = 0; index < 150; index += 1) {
      updateTraffic(left, 1 / 60, leftRandom);
      updateTraffic(right, 1 / 60, rightRandom);
    }

    expect(
      left.traffic.map((vehicle) => ({
        z: vehicle.z,
        lateral: vehicle.lateral,
        preferredLane: vehicle.preferredLane,
        maneuverPhase: vehicle.maneuverPhase,
        maneuverTargetLane: vehicle.maneuverTargetLane,
        maneuverAttempt: vehicle.maneuverAttempt,
      })),
    ).toEqual(
      right.traffic.map((vehicle) => ({
        z: vehicle.z,
        lateral: vehicle.lateral,
        preferredLane: vehicle.preferredLane,
        maneuverPhase: vehicle.maneuverPhase,
        maneuverTargetLane: vehicle.maneuverTargetLane,
        maneuverAttempt: vehicle.maneuverAttempt,
      })),
    );
  });
});
