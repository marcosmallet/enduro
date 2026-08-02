import { describe, expect, it } from 'vitest';
import {
  audioCuesBetween,
  continuousAudioMix,
  type AudioSnapshot,
} from '../../src/audio/audioModel';

function snapshot(overrides: Partial<AudioSnapshot> = {}): AudioSnapshot {
  return {
    speedKph: 0,
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
