import { beforeEach, describe, expect, it } from 'vitest';
import { createGameState, targetForDay } from '../../src/game/state';
import { Simulation } from '../../src/game/simulation';
import { populateTraffic } from '../../src/game/traffic';

const NO_INPUT = { accelerate: false, brake: false, steer: 0 } as const;

function finishAuthenticDay(state: ReturnType<typeof createGameState>): void {
  state.dayElapsedSeconds = state.dayDurationSeconds - 0.01;
  new Simulation(state).update(NO_INPUT, 0.02);
}

describe('endurance rules contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses 200 cars on authentic day one and 300 afterwards', () => {
    expect(targetForDay('AUTHENTIC_ENDURANCE', 1)).toBe(200);
    expect(targetForDay('AUTHENTIC_ENDURANCE', 2)).toBe(300);
    expect(targetForDay('AUTHENTIC_ENDURANCE', 99)).toBe(300);
  });

  it('ends a quick race when time expires without the target', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1 });
    state.remainingSeconds = 0.01;
    new Simulation(state).update(NO_INPUT, 0.02);
    expect(state.screen).toBe('GAME_OVER');
    expect(state.failureReason).toBe('QUICK_TIME_EXPIRED');
  });

  it('does not count an overtake after the quick-race timer reaches zero', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1, targetOverride: 1 });
    populateTraffic(state, 1);
    const vehicle = state.traffic[0];
    if (!vehicle) throw new Error('Expected one test vehicle.');
    vehicle.z = -9;
    state.remainingSeconds = 0.01;

    new Simulation(state).update(NO_INPUT, 0.02);

    expect(state.screen).toBe('GAME_OVER');
    expect(state.overtakes).toBe(0);
    expect(state.goalReached).toBe(false);
  });

  it('keeps authentic mode without a conventional race timer', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    expect(state.remainingSeconds).toBe(Number.POSITIVE_INFINITY);
  });

  it('keeps driving after the daily goal until the next dawn', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.overtakes = state.target;
    state.totalOvertakes = state.target;
    state.carsLeft = 0;
    state.goalReached = true;

    new Simulation(state).update(NO_INPUT, 0.05);

    expect(state.screen).toBe('PLAYING');
    expect(state.day).toBe(1);
    expect(state.carsLeft).toBe(0);
  });

  it('advances immediately to day two with a 300-car target and preserved odometer', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.overtakes = state.target;
    state.totalOvertakes = state.target;
    state.carsLeft = 0;
    state.goalReached = true;
    state.distanceMeters = 1_234;

    finishAuthenticDay(state);

    expect(state.screen).toBe('PLAYING');
    expect(state.day).toBe(2);
    expect(state.completedDays).toBe(1);
    expect(state.target).toBe(300);
    expect(state.carsLeft).toBe(300);
    expect(state.overtakes).toBe(0);
    expect(state.totalOvertakes).toBe(200);
    expect(state.distanceMeters).toBe(1_234);
    expect(state.phase).toBe('DAWN');
    expect(state.newDayFeedbackSeconds).toBeGreaterThan(0);
    expect(state.bestDays).toBe(1);
  });

  it('ends authentic endurance at dawn when the target is incomplete', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.overtakes = 199;
    state.totalOvertakes = 199;
    state.carsLeft = 1;

    finishAuthenticDay(state);

    expect(state.screen).toBe('GAME_OVER');
    expect(state.failureReason).toBe('DAILY_TARGET_MISSED');
    expect(state.day).toBe(1);
    expect(state.completedDays).toBe(0);
    expect(state.phase).toBe('DAWN');
  });

  it('persists completed days as the local best result', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    state.overtakes = state.target;
    state.totalOvertakes = state.target;
    state.carsLeft = 0;
    state.goalReached = true;
    finishAuthenticDay(state);

    expect(createGameState('AUTHENTIC_ENDURANCE', { seed: 2 }).bestDays).toBe(1);
  });

  it('continues through multiple days without a maximum day', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    const simulation = new Simulation(state);

    for (let completed = 1; completed <= 6; completed += 1) {
      state.overtakes = state.target;
      state.totalOvertakes += state.target;
      state.carsLeft = 0;
      state.goalReached = true;
      state.dayElapsedSeconds = state.dayDurationSeconds - 0.01;
      simulation.update(NO_INPUT, 0.02);
      expect(state.completedDays).toBe(completed);
      expect(state.day).toBe(completed + 1);
      expect(state.target).toBe(300);
    }

    expect(state.screen).toBe('PLAYING');
    expect(state.bestDays).toBe(6);
  });
});
