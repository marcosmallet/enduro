import { describe, expect, it } from 'vitest';
import { ROAD_VISIBLE_DISTANCE } from '../../src/config/game';
import {
  applyWeatherState,
  updateEnvironment,
  weatherWindowsForDay,
} from '../../src/game/environment';
import { updatePlayer } from '../../src/game/physics';
import { createGameState } from '../../src/game/state';
import type { DayPhase } from '../../src/game/types';
import { PHASE_PALETTES, scenePaletteForPhase } from '../../src/rendering/palette';

describe('environmental signatures', () => {
  it('crosses the complete day cycle in the expected order', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1983 });
    const samples: Array<[number, DayPhase]> = [
      [0.03, 'DAWN'],
      [0.18, 'MORNING'],
      [0.3, 'DAY'],
      [0.49, 'SUNSET'],
      [0.63, 'DUSK'],
      [0.77, 'NIGHT'],
      [0.91, 'LATE_NIGHT'],
    ];

    for (const [progress, phase] of samples) {
      state.elapsedSeconds = state.dayDurationSeconds * progress;
      updateEnvironment(state);
      expect(state.phase).toBe(phase);
      expect(state.phaseProgress).toBeGreaterThanOrEqual(0);
      expect(state.phaseProgress).toBeLessThan(1);
    }
  });

  it('blends each phase continuously into the next palette', () => {
    const morningStart = scenePaletteForPhase('MORNING', 0);
    const dawnEnd = scenePaletteForPhase('DAWN', 1);
    const dawnMiddle = scenePaletteForPhase('DAWN', 0.5);

    expect(dawnEnd).toEqual(morningStart);
    expect(dawnMiddle.skyTop).not.toBe(PHASE_PALETTES.DAWN.skyTop);
    expect(dawnMiddle.skyTop).not.toBe(PHASE_PALETTES.MORNING.skyTop);
  });

  it('runs fixed fog and ice sections during the quick race', () => {
    const state = createGameState('POC_QUICK_RACE', { seed: 1983 });

    state.elapsedSeconds = state.dayDurationSeconds * 0.37;
    updateEnvironment(state);
    expect(state.weather).toBe('FOG');
    expect(state.weatherIntensity).toBe(1);
    expect(state.visibilityDistance).toBeLessThan(ROAD_VISIBLE_DISTANCE * 0.5);

    state.elapsedSeconds = state.dayDurationSeconds * 0.65;
    updateEnvironment(state);
    expect(state.weather).toBe('ICE');
    expect(state.weatherIntensity).toBe(1);
    expect(state.steeringResponse).toBeLessThan(0.5);
  });

  it('uses seeded schedules and increases weather frequency without growing forever', () => {
    const dayOne = weatherWindowsForDay('AUTHENTIC_ENDURANCE', 1, 1983);
    const dayTwelve = weatherWindowsForDay('AUTHENTIC_ENDURANCE', 12, 1983);
    const repeated = weatherWindowsForDay('AUTHENTIC_ENDURANCE', 12, 1983);
    const lateDay = weatherWindowsForDay('AUTHENTIC_ENDURANCE', 200, 1983);

    expect(dayOne).toHaveLength(2);
    expect(dayTwelve.length).toBeGreaterThan(dayOne.length);
    expect(repeated).toEqual(dayTwelve);
    expect(lateDay).toHaveLength(4);
    expect(lateDay.every((window) => window.end <= 0.96)).toBe(true);
  });

  it('makes initial steering slower and preserves lateral slide on ice', () => {
    const clear = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    const ice = createGameState('AUTHENTIC_ENDURANCE', { seed: 1 });
    clear.speedKph = 180;
    ice.speedKph = 180;
    applyWeatherState(clear, 'CLEAR', 0);
    applyWeatherState(ice, 'ICE', 1);

    for (let frame = 0; frame < 18; frame += 1) {
      updatePlayer(clear, { accelerate: false, brake: false, steer: 1 }, 1 / 60);
      updatePlayer(ice, { accelerate: false, brake: false, steer: 1 }, 1 / 60);
    }
    expect(ice.playerX).toBeLessThan(clear.playerX);

    for (let frame = 0; frame < 30; frame += 1) {
      updatePlayer(clear, { accelerate: false, brake: false, steer: 0 }, 1 / 60);
      updatePlayer(ice, { accelerate: false, brake: false, steer: 0 }, 1 / 60);
    }
    expect(Math.abs(ice.lateralVelocity)).toBeGreaterThan(Math.abs(clear.lateralVelocity) * 2);
  });
});
