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
    expect(mover.maneuverPhase).toBe('IDLE');
  });

  it('cancels an unsafe telegraph and can attempt another maneuver later', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4103 });
    populateTraffic(state, 2);
    const mover = state.traffic[0];
    const blocker = state.traffic[1];
    if (!mover || !blocker) throw new Error('Expected two traffic vehicles.');
    const firstTarget = configureMover(state, mover);
    blocker.z = 145;
    blocker.previousZ = blocker.z;
    blocker.speedKph = mover.speedKph;
    blocker.maneuverCooldownSeconds = 99;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('TELEGRAPH');
    blocker.z = mover.z + 10;
    blocker.previousZ = blocker.z;
    blocker.preferredLane = firstTarget;
    blocker.lateral = firstTarget;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('IDLE');
    const attemptAfterCancel = mover.maneuverAttempt ?? 0;
    expect(attemptAfterCancel).toBeGreaterThan(0);

    blocker.z = 180;
    blocker.previousZ = 180;
    mover.z = 100;
    mover.previousZ = 100;
    mover.maneuverCooldownSeconds = 0;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('TELEGRAPH');
    expect(mover.maneuverAttempt).toBe(attemptAfterCancel);
  });

  it('rejects a sub-0.9s target-lane cut-in through the real collision envelope', () => {
    const build = (allowManeuver: boolean) => {
      const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4104 });
      populateTraffic(state, 1);
      const mover = state.traffic[0];
      if (!mover) throw new Error('Expected traffic.');
      const target = configureMover(state, mover);
      state.speedKph = 152;
      state.playerX = target;
      mover.z = 30;
      mover.previousZ = 30;
      mover.speedKph = 80;
      mover.maneuverCooldownSeconds = allowManeuver ? 0 : 999;
      return { state, mover };
    };

    const active = build(true);
    const staticBaseline = build(false);
    stepTraffic(active.state, active.state.seed);
    expect(active.mover.maneuverPhase).toBe('IDLE');
    expect(active.mover.maneuverTargetLane).toBeUndefined();

    let crossedCollisionEnvelope = false;
    const activeRandom = new SeededRandom(active.state.seed);
    const staticRandom = new SeededRandom(staticBaseline.state.seed);
    for (let frame = 0; frame < 90; frame += 1) {
      updateTraffic(active.state, 1 / 60, activeRandom);
      updateTraffic(staticBaseline.state, 1 / 60, staticRandom);
      if (active.mover.z <= 13 && active.mover.z >= 2) crossedCollisionEnvelope = true;
    }
    expect(crossedCollisionEnvelope).toBe(true);
    expect(active.state.collisionCount).toBeLessThanOrEqual(staticBaseline.state.collisionCount);
    expect(active.state.collisionCount).toBe(0);
  });

  it('allows a maneuver just above the reaction-window threshold', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 4105 });
    populateTraffic(state, 1);
    const mover = state.traffic[0];
    if (!mover) throw new Error('Expected traffic.');
    const target = configureMover(state, mover);
    state.speedKph = 152;
    state.playerX = target;
    mover.z = 32;
    mover.previousZ = 32;
    mover.speedKph = 80;
    mover.maneuverCooldownSeconds = 0;
    stepTraffic(state, state.seed);
    expect(mover.maneuverPhase).toBe('TELEGRAPH');
    expect(mover.maneuverTargetLane).toBe(target);
  });
});
