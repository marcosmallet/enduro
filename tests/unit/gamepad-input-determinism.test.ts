// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createGameState } from '../../src/game/state';
import { Simulation } from '../../src/game/simulation';
import { InputController, quantizeAnalogSteer } from '../../src/input/InputController';

interface RunResult {
  playerX: number;
  lateralVelocity: number;
  speedKph: number;
}

function analogTrajectory(seconds: number): number {
  return Math.sin(seconds * Math.PI * 0.7) * 0.72;
}

function runAtPollingRate(hz: number): RunResult {
  document.body.innerHTML = '<main id="root"></main>';
  const root = document.querySelector<HTMLElement>('#root');
  if (!root) throw new Error('Expected test root.');

  const input = new InputController(root);
  const state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
  state.traffic = [];
  const simulation = new Simulation(state);
  const frameSeconds = 1 / hz;
  const durationSeconds = 4;
  let nowMs = 0;

  for (let elapsed = 0; elapsed < durationSeconds - 1e-9; elapsed += frameSeconds) {
    input.setVirtualGamepad({
      connected: true,
      accelerate: true,
      steer: analogTrajectory(elapsed),
    });
    input.pollGamepad(nowMs);
    simulation.update(input.state, frameSeconds, nowMs);
    nowMs += frameSeconds * 1000;
  }

  return {
    playerX: state.playerX,
    lateralVelocity: state.lateralVelocity,
    speedKph: state.speedKph,
  };
}

describe('real-input analog gamepad determinism', () => {
  it('quantizes only meaningful analog steering outside the dead zone', () => {
    expect(quantizeAnalogSteer(0.1)).toBe(0);
    expect(quantizeAnalogSteer(-0.17)).toBe(0);
    expect(quantizeAnalogSteer(0.181)).toBeCloseTo(0.2, 6);
    expect(quantizeAnalogSteer(0.713)).toBeCloseTo(0.725, 6);
    expect(quantizeAnalogSteer(-2)).toBe(-1);
  });

  it('keeps a continuous physical steering trajectory equivalent across 30/60/120 Hz polling', () => {
    const at30 = runAtPollingRate(30);
    const at60 = runAtPollingRate(60);
    const at120 = runAtPollingRate(120);

    for (const result of [at30, at120]) {
      // Lower polling rates cannot observe samples that never existed. The contract is therefore
      // perceptual/fixed-step equivalence, not byte equality: final steering state stays within a
      // small fraction of a lane while speed remains effectively identical.
      expect(Math.abs(result.playerX - at60.playerX)).toBeLessThan(0.06);
      expect(Math.abs(result.lateralVelocity - at60.lateralVelocity)).toBeLessThan(0.09);
      expect(Math.abs(result.speedKph - at60.speedKph)).toBeLessThan(0.25);
    }
  });

  it('clears stale analog timestamps across reset and pause/resume boundaries', () => {
    document.body.innerHTML = '<main id="root"></main>';
    const root = document.querySelector<HTMLElement>('#root');
    if (!root) throw new Error('Expected test root.');

    const input = new InputController(root);
    const state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
    state.traffic = [];
    const simulation = new Simulation(state);

    input.setVirtualGamepad({ steer: 0.8, accelerate: true });
    input.pollGamepad(100);
    expect(input.state.changedAtMs).toBe(100);
    simulation.update(input.state, 1 / 60, 100);

    state.screen = 'PAUSED';
    input.reset();
    expect(input.state.steer).toBe(0);
    expect(input.state.changedAtMs).toBeUndefined();
    simulation.update(input.state, 1 / 60, 116.667);

    state.screen = 'PLAYING';
    simulation.update(input.state, 1 / 60, 133.334);
    expect(input.state.steer).toBe(0);
    expect(input.state.changedAtMs).toBeUndefined();
  });
});
