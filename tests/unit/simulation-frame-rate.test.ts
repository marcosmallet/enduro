import { beforeEach, describe, expect, it } from 'vitest';
import { SIMULATION_TRAFFIC_COUNT } from '../../src/config/game';
import { Simulation } from '../../src/game/simulation';
import { createGameState, serializeGameState } from '../../src/game/state';
import { populateTraffic } from '../../src/game/traffic';
import type { InputState } from '../../src/game/types';

const INPUT = { accelerate: true, brake: false, steer: 0.18 } as const;

interface InputEdge {
  atSeconds: number;
  input: Omit<InputState, 'changedAtMs'>;
}

const INPUT_TIMELINE: InputEdge[] = [
  { atSeconds: 0, input: { accelerate: true, brake: false, steer: 0 } },
  { atSeconds: 0.743, input: { accelerate: true, brake: false, steer: -0.72 } },
  { atSeconds: 1.013, input: { accelerate: false, brake: true, steer: -0.72 } },
  { atSeconds: 1.537, input: { accelerate: true, brake: false, steer: 0.76 } },
  { atSeconds: 2.051, input: { accelerate: true, brake: false, steer: -0.56 } },
  { atSeconds: 2.733, input: { accelerate: true, brake: false, steer: 0.24 } },
];

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

function inputAtTime(timeSeconds: number): InputState {
  let edge = INPUT_TIMELINE[0];
  for (const candidate of INPUT_TIMELINE) {
    if (candidate.atSeconds > timeSeconds + 1e-9) break;
    edge = candidate;
  }
  if (!edge) throw new Error('Input timeline must start at zero.');
  return { ...edge.input, changedAtMs: edge.atSeconds * 1000 };
}

function runInputTimelineAtFrameRate(fps: number) {
  const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983, targetOverride: 999 });
  populateTraffic(state, SIMULATION_TRAFFIC_COUNT);
  state.speedKph = 150;
  const nearVehicle = state.traffic[0];
  if (!nearVehicle) throw new Error('Expected traffic for deterministic input test.');
  nearVehicle.z = 34;
  nearVehicle.previousZ = 34;
  nearVehicle.lateral = 0.23;
  nearVehicle.preferredLane = 0.23;
  nearVehicle.speedKph = 76;
  nearVehicle.maneuverCooldownSeconds = 0.45;

  const simulation = new Simulation(state);
  const checkpoints: Array<{
    time: number;
    speedKph: number;
    playerX: number;
    lateralVelocity: number;
    collisions: number;
    overtakes: number;
    traffic: Array<{
      id: string;
      z: number;
      lateral: number;
      phase: string;
      target: number | null;
    }>;
  }> = [];
  let nextCheckpoint = 0.5;
  const frameCount = fps * 4;

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const frameEndSeconds = frame / fps;
    simulation.update(inputAtTime(frameEndSeconds), 1 / fps, frameEndSeconds * 1000);

    if (Math.abs(state.elapsedSeconds - nextCheckpoint) < 1e-7) {
      checkpoints.push({
        time: nextCheckpoint,
        speedKph: Number(state.speedKph.toFixed(6)),
        playerX: Number(state.playerX.toFixed(6)),
        lateralVelocity: Number(state.lateralVelocity.toFixed(6)),
        collisions: state.collisionCount,
        overtakes: state.totalOvertakes,
        traffic: state.traffic.slice(0, 4).map((vehicle) => ({
          id: vehicle.id,
          z: Number(vehicle.z.toFixed(6)),
          lateral: Number(vehicle.lateral.toFixed(6)),
          phase: vehicle.maneuverPhase ?? 'IDLE',
          target: vehicle.maneuverTargetLane ?? null,
        })),
      });
      nextCheckpoint += 0.5;
    }
  }

  return checkpoints;
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

  it('assigns timestamped input edges to the same fixed step at 30, 60 and 120 FPS', () => {
    const at60 = runInputTimelineAtFrameRate(60);

    expect(runInputTimelineAtFrameRate(30)).toEqual(at60);
    expect(runInputTimelineAtFrameRate(120)).toEqual(at60);
    expect(at60).toHaveLength(8);
    expect(at60.some((sample) => Math.abs(sample.playerX) > 0.05)).toBe(true);
  });

  it('keeps the existing long-frame safety cap', () => {
    const state = createGameState('AUTHENTIC_ENDURANCE', { seed: 7, targetOverride: 999 });
    const simulation = new Simulation(state);

    simulation.update(INPUT, 1);

    expect(state.elapsedSeconds).toBeCloseTo(0.05, 6);
  });
});
