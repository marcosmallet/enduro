import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/game/state';
import { plannedAdjacentLane, populateTraffic, updateTraffic } from '../../src/game/traffic';
import { SeededRandom } from '../../src/game/random';
import type { GameState, TrafficVehicle } from '../../src/game/types';

const LANES = [-0.68, -0.23, 0.23, 0.68] as const;

function configureMover(state: GameState, vehicle: TrafficVehicle): number {
  state.speedKph = 116;
  state.playerX = 0.68;
  vehicle.z = 92;
  vehicle.previousZ = 92;
  vehicle.speedKph = 80;
  vehicle.preferredLane = -0.23;
  vehicle.lateral = -0.23;
  vehicle.maneuverPhase = 'IDLE';
  vehicle.maneuverAttempt = 0;
  vehicle.maneuverCooldownSeconds = 0;
  vehicle.maneuverTargetLane = undefined;
  vehicle.maneuverProgress = 0;
  vehicle.maneuverTimerSeconds = 0;
  const target = plannedAdjacentLane(state.seed, vehicle);
  if (target === undefined) throw new Error('Expected an adjacent target lane.');
  return target;
}

function nonTargetLane(target: number, source: number): number {
  const lane = LANES.find(
    (candidate) => Math.abs(candidate - target) > 0.2 && Math.abs(candidate - source) > 0.2,
  );
  if (lane === undefined) throw new Error('Expected a lane outside the maneuver corridor.');
  return lane;
}

function stepTraffic(state: GameState, seed: number, frames = 1): void {
  const random = new SeededRandom(seed);
  for (let frame = 0; frame < frames; frame += 1) updateTraffic(state, 1 / 60, random);
}

describe('traffic fairness invariants', () => {
  it('isolates destination-corridor reservation outside the cluster threshold', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4101 });
    populateTraffic(state, 2);
    const mover = state.traffic[0];
    const blocker = state.traffic[1];
    if (!mover || !blocker) throw new Error('Expected two traffic vehicles.');
    const target = configureMover(state, mover);
    blocker.z = mover.z + 10;
    blocker.previousZ = blocker.z;
    blocker.speedKph = mover.speedKph;
    blocker.preferredLane = target;
    blocker.lateral = target;
    blocker.maneuverPhase = 'IDLE';
    blocker.maneuverCooldownSeconds = 99;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('IDLE');
    expect(mover.maneuverTargetLane).toBeUndefined();
    expect(mover.maneuverCooldownSeconds).toBeGreaterThan(0);
    expect(Math.abs(blocker.z - mover.z)).toBeGreaterThanOrEqual(8);
    expect(Math.abs(blocker.z - mover.z)).toBeLessThan(15);
  });

  it('independently keeps clustered traffic from beginning a maneuver', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4102 });
    populateTraffic(state, 2);
    const mover = state.traffic[0];
    const neighbor = state.traffic[1];
    if (!mover || !neighbor) throw new Error('Expected two traffic vehicles.');
    const target = configureMover(state, mover);
    neighbor.z = mover.z + 6;
    neighbor.previousZ = neighbor.z;
    neighbor.speedKph = mover.speedKph;
    const safeLane = nonTargetLane(target, mover.preferredLane);
    neighbor.preferredLane = safeLane;
    neighbor.lateral = safeLane;
    neighbor.maneuverPhase = 'IDLE';
    neighbor.maneuverCooldownSeconds = 99;
    stepTraffic(state, state.seed);
    expect(Math.abs(neighbor.z - mover.z)).toBeLessThan(8);
    expect(Math.abs(neighbor.lateral - target)).toBeGreaterThan(0.2);
    expect(mover.maneuverPhase).toBe('IDLE');
    expect(mover.maneuverTargetLane).toBeUndefined();
  });

  it('cancels a telegraphed maneuver when the target corridor becomes unsafe before commitment', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4103 });
    populateTraffic(state, 2);
    const mover = state.traffic[0];
    const blocker = state.traffic[1];
    if (!mover || !blocker) throw new Error('Expected two traffic vehicles.');
    const target = configureMover(state, mover);
    blocker.z = 145;
    blocker.previousZ = blocker.z;
    blocker.speedKph = mover.speedKph;
    blocker.maneuverCooldownSeconds = 99;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('TELEGRAPH');
    expect(mover.maneuverTargetLane).toBe(target);
    const telegraphStart = mover.lateral;
    stepTraffic(state, state.seed, 18);
    expect(mover.maneuverPhase).toBe('TELEGRAPH');
    const cueIntrusion = Math.abs(mover.lateral - telegraphStart);
    expect(cueIntrusion).toBeGreaterThan(0);
    expect(cueIntrusion).toBeLessThan(0.08);
    blocker.z = mover.z + 10;
    blocker.previousZ = blocker.z;
    blocker.preferredLane = target;
    blocker.lateral = target;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('IDLE');
    expect(mover.maneuverTargetLane).toBeUndefined();
    expect(Math.abs(mover.lateral - telegraphStart)).toBeLessThanOrEqual(0.08);
  });

  it('does not add a collision in a deterministic passable lane-change scenario', () => {
    const build = (allowManeuver: boolean) => {
      const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4104 });
      populateTraffic(state, 1);
      const mover = state.traffic[0];
      if (!mover) throw new Error('Expected traffic.');
      configureMover(state, mover);
      state.playerX = 0.68;
      mover.maneuverCooldownSeconds = allowManeuver ? 0 : 999;
      return state;
    };
    const active = build(true);
    const staticBaseline = build(false);
    stepTraffic(active, active.seed, 150);
    stepTraffic(staticBaseline, staticBaseline.seed, 150);
    expect(active.collisionCount).toBeLessThanOrEqual(staticBaseline.collisionCount);
    expect(active.collisionCount).toBe(0);
  });
});
