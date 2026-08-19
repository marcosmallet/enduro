import { describe, expect, it } from 'vitest';
import {
  advanceAudioLoadReference,
  audioCuesBetween,
  continuousAudioMix,
  deriveEngineLoad,
  type AudioSnapshot,
  type ContinuousAudioMix,
} from '../../src/audio/audioModel';

function snapshot(overrides: Partial<AudioSnapshot> = {}): AudioSnapshot {
  return {
    speedKph: 0,
    elapsedSeconds: 0,
    weather: 'CLEAR',
    collisionCount: 0,
    totalOvertakes: 0,
    phase: 'DAWN',
    goalReached: false,
    day: 1,
    screen: 'PLAYING',
    ...overrides,
  };
}

function speedForTrajectory(timeSeconds: number): number {
  if (timeSeconds <= 1) return 60 + timeSeconds * 60;
  if (timeSeconds <= 2) return 120;
  return Math.max(75, 120 - (timeSeconds - 2) * 45);
}

function sampleMixAtRenderCadence(renderHz: number): Map<string, ContinuousAudioMix> {
  let previousRender = snapshot({ speedKph: 60, elapsedSeconds: 0 });
  let loadReference: AudioSnapshot | undefined;
  const mixes = new Map<string, ContinuousAudioMix>();
  const frameCount = Math.ceil(renderHz * 3);

  for (let frame = 1; frame <= frameCount; frame += 1) {
    const renderTime = frame / renderHz;
    const simulationStep = Math.floor(renderTime * 60 + 1e-7);
    const simulationTime = simulationStep / 60;
    const current = snapshot({
      speedKph: speedForTrajectory(simulationTime),
      elapsedSeconds: simulationTime,
    });
    loadReference = advanceAudioLoadReference(current, previousRender, loadReference);
    mixes.set(simulationTime.toFixed(4), continuousAudioMix(current, loadReference));
    previousRender = current;
  }

  return mixes;
}

describe('procedural audio model', () => {
  it('raises engine and wind energy with speed and changes tire color on ice', () => {
    const idle = continuousAudioMix(snapshot());
    const fast = continuousAudioMix(snapshot({ speedKph: 210 }));
    const ice = continuousAudioMix(snapshot({ speedKph: 210, weather: 'ICE' }));

    expect(fast.engineFrequency).toBeGreaterThan(idle.engineFrequency);
    expect(fast.engineGain).toBeGreaterThan(idle.engineGain);
    expect(fast.windGain).toBeGreaterThan(idle.windGain);
    expect(ice.tireCutoff).toBeGreaterThan(fast.tireCutoff);
    expect(ice.tireGain).toBeLessThan(fast.tireGain);
  });

  it('distinguishes engine load at equal road speed using audio-only history', () => {
    const accelerating = snapshot({ speedKph: 120, elapsedSeconds: 2 });
    const acceleratingPrevious = snapshot({ speedKph: 100, elapsedSeconds: 1 });
    const coasting = snapshot({ speedKph: 120, elapsedSeconds: 2 });
    const coastingPrevious = snapshot({ speedKph: 120, elapsedSeconds: 1 });
    const brakingPrevious = snapshot({ speedKph: 138, elapsedSeconds: 1 });

    const loadedMix = continuousAudioMix(accelerating, acceleratingPrevious);
    const coastMix = continuousAudioMix(coasting, coastingPrevious);
    const brakingMix = continuousAudioMix(coasting, brakingPrevious);

    expect(loadedMix.engineLoad).toBeGreaterThan(coastMix.engineLoad);
    expect(coastMix.engineLoad).toBeGreaterThan(brakingMix.engineLoad);
    expect(loadedMix.engineFrequency).toBeGreaterThan(coastMix.engineFrequency);
    expect(loadedMix.engineGain).toBeGreaterThan(coastMix.engineGain);
  });

  it('keeps the last distinct simulation reference across repeated render snapshots', () => {
    const beforeStep = snapshot({ speedKph: 100, elapsedSeconds: 1 });
    const afterStep = snapshot({ speedKph: 101, elapsedSeconds: 1 + 1 / 60 });
    let reference = advanceAudioLoadReference(afterStep, beforeStep, undefined);
    const firstMix = continuousAudioMix(afterStep, reference);

    reference = advanceAudioLoadReference(afterStep, afterStep, reference);
    const repeatedMix = continuousAudioMix(afterStep, reference);

    expect(reference).toBe(beforeStep);
    expect(firstMix.engineLoad).toBeGreaterThan(0.38);
    expect(repeatedMix.engineLoad).toBeCloseTo(firstMix.engineLoad, 8);
    expect(repeatedMix.engineFrequency).toBeCloseTo(firstMix.engineFrequency, 8);
    expect(repeatedMix.engineGain).toBeCloseTo(firstMix.engineGain, 8);
  });

  it('clears stale load history across menu, pause, resume and reset transitions', () => {
    const menu = snapshot({ speedKph: 142, elapsedSeconds: 1, screen: 'PLAYING' });
    const accelerating = snapshot({ speedKph: 170, elapsedSeconds: 1.25, screen: 'PLAYING' });
    let reference = advanceAudioLoadReference(accelerating, menu, undefined);
    const loaded = continuousAudioMix(accelerating, reference);
    expect(loaded.engineLoad).toBeGreaterThan(0.38);

    const paused = snapshot({
      speedKph: 170,
      elapsedSeconds: 1.25,
      screen: 'PAUSED',
      weather: 'FOG',
    });
    reference = advanceAudioLoadReference(paused, accelerating, reference, true);
    const pausedMix = continuousAudioMix(paused, reference);
    expect(reference).toBeUndefined();
    expect(pausedMix.engineLoad).toBeCloseTo(0.38, 8);
    expect(pausedMix.windGain).toBeLessThan(continuousAudioMix({ ...paused, weather: 'CLEAR' }).windGain);

    const resumed = snapshot({
      speedKph: 170,
      elapsedSeconds: 1.25,
      screen: 'PLAYING',
      weather: 'FOG',
    });
    reference = advanceAudioLoadReference(resumed, paused, reference, true);
    expect(reference).toBeUndefined();
    expect(continuousAudioMix(resumed, reference).engineLoad).toBeCloseTo(0.38, 8);

    const reset = snapshot({ speedKph: 0, elapsedSeconds: 0, screen: 'PLAYING' });
    reference = advanceAudioLoadReference(reset, resumed, undefined, true);
    const resetMix = continuousAudioMix(reset, reference);
    expect(reference).toBeUndefined();
    expect(resetMix.engineLoad).toBeCloseTo(0.16, 8);
    expect(resetMix.windGain).toBe(0);
    expect(resetMix.tireGain).toBe(0);
  });

  it('keeps the engine-load envelope materially equivalent at 30, 60 and 120 Hz', () => {
    const mixes30 = sampleMixAtRenderCadence(30);
    const mixes60 = sampleMixAtRenderCadence(60);
    const mixes120 = sampleMixAtRenderCadence(120);

    for (const [time, mix30] of mixes30) {
      const mix60 = mixes60.get(time);
      const mix120 = mixes120.get(time);
      expect(mix60, `missing 60 Hz sample at ${time}s`).toBeDefined();
      expect(mix120, `missing 120 Hz sample at ${time}s`).toBeDefined();
      if (!mix60 || !mix120) continue;

      expect(mix60.engineLoad).toBeCloseTo(mix30.engineLoad, 6);
      expect(mix120.engineLoad).toBeCloseTo(mix30.engineLoad, 6);
      expect(mix60.engineFrequency).toBeCloseTo(mix30.engineFrequency, 6);
      expect(mix120.engineFrequency).toBeCloseTo(mix30.engineFrequency, 6);
      expect(mix60.engineGain).toBeCloseTo(mix30.engineGain, 6);
      expect(mix120.engineGain).toBeCloseTo(mix30.engineGain, 6);
    }

    const accelerating = mixes120.get('0.5000');
    const cruising = mixes120.get('1.5000');
    const decelerating = mixes120.get('2.5000');
    expect(accelerating).toBeDefined();
    expect(cruising).toBeDefined();
    expect(decelerating).toBeDefined();
    if (!accelerating || !cruising || !decelerating) return;
    expect(accelerating.engineLoad).toBeGreaterThan(cruising.engineLoad);
    expect(cruising.engineLoad).toBeGreaterThan(decelerating.engineLoad);
  });

  it('keeps continuous mix values bounded across extreme snapshots', () => {
    const previous = snapshot({ speedKph: 0, elapsedSeconds: 1 });
    const extreme = continuousAudioMix(
      snapshot({ speedKph: 999, elapsedSeconds: 1.01, weather: 'ICE' }),
      previous,
    );

    expect(extreme.engineLoad).toBeGreaterThanOrEqual(0.12);
    expect(extreme.engineLoad).toBeLessThanOrEqual(1);
    expect(extreme.engineFrequency).toBeGreaterThanOrEqual(46);
    expect(extreme.engineFrequency).toBeLessThanOrEqual(178);
    expect(extreme.engineGain).toBeGreaterThanOrEqual(0.04);
    expect(extreme.engineGain).toBeLessThanOrEqual(0.17);
    expect(extreme.windGain).toBeGreaterThanOrEqual(0);
    expect(extreme.windGain).toBeLessThanOrEqual(0.105);
    expect(extreme.windCutoff).toBeGreaterThanOrEqual(320);
    expect(extreme.windCutoff).toBeLessThanOrEqual(3420);
    expect(extreme.tireGain).toBeGreaterThanOrEqual(0);
    expect(extreme.tireGain).toBeLessThanOrEqual(0.058);
    expect(extreme.tireCutoff).toBeGreaterThanOrEqual(650);
    expect(extreme.tireCutoff).toBeLessThanOrEqual(3500);
  });

  it('gives CLEAR, FOG and ICE distinct bounded surface/environment mixes', () => {
    const current = snapshot({ speedKph: 150, elapsedSeconds: 2 });
    const previous = snapshot({ speedKph: 145, elapsedSeconds: 1 });
    const clear = continuousAudioMix(current, previous);
    const fog = continuousAudioMix({ ...current, weather: 'FOG' }, previous);
    const ice = continuousAudioMix({ ...current, weather: 'ICE' }, previous);

    expect(fog.windGain).toBeLessThan(clear.windGain);
    expect(fog.windCutoff).toBeLessThan(clear.windCutoff);
    expect(fog.tireCutoff).toBeLessThan(clear.tireCutoff);
    expect(ice.tireCutoff).toBeGreaterThan(clear.tireCutoff);
    expect(ice.tireGain).toBeLessThan(clear.tireGain);
    expect(fog.musicBrightness).toBeLessThan(clear.musicBrightness);
  });

  it('stays quiet and safe at zero speed and handles invalid history timing', () => {
    const stopped = snapshot({ speedKph: 0, elapsedSeconds: 5, weather: 'FOG' });
    const sameTime = snapshot({ speedKph: 70, elapsedSeconds: 5 });

    const stoppedMix = continuousAudioMix(stopped, sameTime);
    expect(stoppedMix.windGain).toBe(0);
    expect(stoppedMix.tireGain).toBe(0);
    expect(stoppedMix.engineLoad).toBe(0.16);
    expect(deriveEngineLoad(sameTime, sameTime)).toBeCloseTo(0.38, 6);
  });

  it('derives original cues from simulation transitions without duplicate idle cues', () => {
    const previous = snapshot();
    const current = snapshot({
      collisionCount: 1,
      totalOvertakes: 1,
      phase: 'MORNING',
      goalReached: true,
      day: 2,
      screen: 'GAME_OVER',
    });

    expect(audioCuesBetween(previous, current)).toEqual([
      'COLLISION',
      'OVERTAKE',
      'PERIOD_CHANGE',
      'GOAL_COMPLETE',
      'NEW_DAY',
      'GAME_OVER',
    ]);
    expect(audioCuesBetween(current, current)).toEqual([]);
  });
});
