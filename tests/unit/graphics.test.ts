import { describe, expect, it } from 'vitest';
import { GRAPHICS_PROFILES, SIMULATION_TRAFFIC_COUNT } from '../../src/config/game';
import { GraphicsManager } from '../../src/performance/GraphicsManager';

function createClock() {
  let now = 0;
  return {
    now: () => now,
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
  };
}

describe('graphics profiles and dynamic effect reduction', () => {
  it('keeps rendering budgets inside the fixed simulation traffic pool', () => {
    expect(SIMULATION_TRAFFIC_COUNT).toBe(10);

    for (const settings of Object.values(GRAPHICS_PROFILES)) {
      expect(settings.maxVisibleTraffic).toBeLessThanOrEqual(8);
      expect(settings.maxVisibleTraffic).toBeLessThanOrEqual(SIMULATION_TRAFFIC_COUNT);
      expect(settings.highDetailVehicles).toBeLessThanOrEqual(3);
      expect(settings).not.toHaveProperty('maxTraffic');
    }

    expect(GRAPHICS_PROFILES.LOW.particleScale).toBeLessThan(
      GRAPHICS_PROFILES.MEDIUM.particleScale,
    );
    expect(GRAPHICS_PROFILES.MEDIUM.particleScale).toBeLessThan(
      GRAPHICS_PROFILES.HIGH.particleScale,
    );
  });

  it('downgrades an automatic profile after sustained low frame rate', () => {
    const manager = new GraphicsManager('HIGH');

    expect(manager.recordSample(42, 2)).toBe(false);
    expect(manager.recordSample(42, 2)).toBe(true);
    expect(manager.activeProfile).toBe('MEDIUM');
  });

  it('recovers gradually without exceeding the detected ceiling', () => {
    const manager = new GraphicsManager('MEDIUM');
    manager.recordSample(30, 2);
    manager.recordSample(30, 2);
    expect(manager.activeProfile).toBe('LOW');

    for (let sample = 0; sample < 6; sample += 1) manager.recordSample(60, 2);
    expect(manager.activeProfile).toBe('MEDIUM');

    for (let sample = 0; sample < 6; sample += 1) manager.recordSample(60, 2);
    expect(manager.activeProfile).toBe('MEDIUM');
  });

  it('honors a manual profile without automatic adaptation', () => {
    const manager = new GraphicsManager('HIGH', 'MEDIUM');

    for (let sample = 0; sample < 10; sample += 1) manager.recordSample(12, 2);
    expect(manager.selection).toBe('MEDIUM');
    expect(manager.activeProfile).toBe('MEDIUM');

    expect(manager.setSelection('HIGH')).toBe(true);
    expect(manager.activeProfile).toBe('HIGH');
  });

  it('keeps representative menu or pause-like rendering eligible for AUTO adaptation', () => {
    const clock = createClock();
    const manager = new GraphicsManager('HIGH', 'AUTO', clock.now);

    for (let sample = 0; sample < 8; sample += 1) {
      clock.advance(0.5);
      manager.recordSample(30, 0.5);
    }

    expect(manager.activeProfile).toBe('MEDIUM');
    expect(manager.sampleTiming).toEqual({
      sampledSeconds: 0.5,
      wallSeconds: 0.5,
      representative: true,
    });
  });

  it('does not let an isolated capped long-frame spike trigger a downgrade', () => {
    const clock = createClock();
    const manager = new GraphicsManager('HIGH', 'AUTO', clock.now);

    clock.advance(1.2);
    expect(manager.recordSample(20, 0.5)).toBe(false);
    expect(manager.sampleTiming.representative).toBe(true);

    for (let sample = 0; sample < 6; sample += 1) {
      clock.advance(0.5);
      manager.recordSample(60, 0.5);
    }

    expect(manager.activeProfile).toBe('HIGH');
  });

  it('rejects background-throttled samples whose wall time is not represented by capped RAF time', () => {
    const clock = createClock();
    const manager = new GraphicsManager('HIGH', 'AUTO', clock.now);

    // A hidden tab near 1 RAF/s contributes only 0.05 s per real second because the
    // controller caps RAF delta at 50 ms. Ten hidden seconds therefore look like a
    // 0.5 s / 20 FPS sample. Eight such samples used to accumulate the 4 sampled
    // seconds required for an AUTO downgrade after roughly 80 real hidden seconds.
    for (let sample = 0; sample < 8; sample += 1) {
      clock.advance(10);
      expect(manager.recordSample(20, 0.5)).toBe(false);
      expect(manager.sampleTiming).toEqual({
        sampledSeconds: 0.5,
        wallSeconds: 10,
        representative: false,
      });
    }

    expect(manager.activeProfile).toBe('HIGH');
  });

  it('resumes normal downgrade and recovery hysteresis after a background gap', () => {
    const clock = createClock();
    const manager = new GraphicsManager('HIGH', 'AUTO', clock.now);

    clock.advance(10);
    manager.recordSample(20, 0.5);
    expect(manager.activeProfile).toBe('HIGH');

    for (let sample = 0; sample < 2; sample += 1) {
      clock.advance(2);
      manager.recordSample(30, 2);
    }
    expect(manager.activeProfile).toBe('MEDIUM');

    for (let sample = 0; sample < 6; sample += 1) {
      clock.advance(2);
      manager.recordSample(60, 2);
    }
    expect(manager.activeProfile).toBe('HIGH');
  });

  it.each(['LOW', 'MEDIUM', 'HIGH'] as const)(
    'keeps manual %s selection unaffected by background timing gaps',
    (selection) => {
      const clock = createClock();
      const manager = new GraphicsManager('HIGH', selection, clock.now);

      for (let sample = 0; sample < 8; sample += 1) {
        clock.advance(10);
        manager.recordSample(12, 0.5);
      }

      expect(manager.selection).toBe(selection);
      expect(manager.activeProfile).toBe(selection);
    },
  );
});
