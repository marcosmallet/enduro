import { describe, expect, it } from 'vitest';
import { GRAPHICS_PROFILES, SIMULATION_TRAFFIC_COUNT } from '../../src/config/game';
import { GraphicsManager } from '../../src/performance/GraphicsManager';

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
});
