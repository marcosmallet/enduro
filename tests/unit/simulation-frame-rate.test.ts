import { beforeEach, describe, expect, it } from 'vitest';
import { SIMULATION_TRAFFIC_COUNT } from '../../src/config/game';
import { Simulation } from '../../src/game/simulation';
import { createGameState, serializeGameState } from '../../src/game/state';
import { populateTraffic } from '../../src/game/traffic';

const INPUT = { accelerate: true, brake: false, steer: 0.18 } as const;

function runAtFrameRate(fps: number, seconds: number) {
  const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983, targetOverride: 999 });
  populateTraffic(state, SIMULATION_TRAFFIC_COUNT);
  const simulation = new Simulation(state);
  const frameCount = fps * seconds;

  for (let frame = 0; frame < frameCount; frame += 1) {
    simulation.update(INPUT, 1 / fps);
  }

  return {
    state: serializeGameState(state),
    traffic: state.traffic.map((vehicle) => ({
      id: vehicle.id,
      kind: vehicle.kind,
      z: Number(vehicle.z.toFixed(6)),
      lateral: Number(vehicle.lateral.toFixed(6)),
      speedKph: Number(vehicle.speedKph.toFixed(6)),
      counted: vehicle.counted,
      collided: vehicle.collided,
    })),
  };
}

describe('fixed-step simulation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('produces the same gameplay state at 30, 60 and 120 FPS', () => {
    const at60 = runAtFrameRate(60, 12);

    expect(runAtFrameRate(30, 12)).toEqual(at60);
    expect(runAtFrameRate(120, 12)).toEqual(at60);
  });

  it('keeps the existing long-frame safety cap', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 7, targetOverride: 999 });
    const simulation = new Simulation(state);

    simulation.update(INPUT, 1);

    expect(state.elapsedSeconds).toBeCloseTo(0.05, 6);
  });
});
