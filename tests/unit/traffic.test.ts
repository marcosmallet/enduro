import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/game/state';
import { populateTraffic, registerOvertake } from '../../src/game/traffic';

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
});
