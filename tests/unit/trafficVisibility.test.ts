import { describe, expect, it } from 'vitest';
import type { TrafficVehicle } from '../../src/game/types';
import { collectVisibleTraffic } from '../../src/rendering/trafficVisibility';

function vehicle(id: string, z: number): TrafficVehicle {
  return {
    id,
    kind: 'SEDAN',
    z,
    previousZ: z,
    lateral: 0,
    preferredLane: 0,
    speedKph: 80,
    counted: false,
    wasAhead: true,
    recycledDuringPass: false,
    collided: false,
    color: '#e8edf2',
    apparentScale: 0,
    lod: 0,
  };
}

describe('traffic visibility selection', () => {
  it('keeps the nearest visible vehicles without changing the simulation list', () => {
    const traffic = [
      vehicle('far', 220),
      vehicle('middle', 90),
      vehicle('near', 20),
      vehicle('behind', -20),
    ];
    const buffer: TrafficVehicle[] = [];

    const visible = collectVisibleTraffic(
      { traffic, visibilityDistance: 280 },
      2,
      buffer,
    );

    expect(visible.map((entry) => entry.id)).toEqual(['middle', 'near']);
    expect(traffic.map((entry) => entry.id)).toEqual(['far', 'middle', 'near', 'behind']);
    expect(visible).toBe(buffer);
  });

  it('reuses the supplied buffer between frames', () => {
    const buffer: TrafficVehicle[] = [vehicle('stale', 10)];
    const state = {
      traffic: [vehicle('one', 40), vehicle('two', 15)],
      visibilityDistance: 280,
    };

    const first = collectVisibleTraffic(state, 1, buffer);
    expect(first.map((entry) => entry.id)).toEqual(['two']);

    state.traffic = [vehicle('three', 25)];
    const second = collectVisibleTraffic(state, 4, buffer);
    expect(second).toBe(first);
    expect(second.map((entry) => entry.id)).toEqual(['three']);
  });
});
