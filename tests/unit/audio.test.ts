import { describe, expect, it } from 'vitest';
import {
  audioCuesBetween,
  continuousAudioMix,
  deriveEngineLoad,
  type AudioSnapshot,
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
