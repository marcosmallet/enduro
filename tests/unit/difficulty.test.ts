import { describe, expect, it } from 'vitest';
import { difficultyForDay } from '../../src/game/difficulty';
import { createGameState } from '../../src/game/state';
import { populateTraffic } from '../../src/game/traffic';

describe('configurable difficulty curve', () => {
  it('increases several traffic pressures while keeping a capped profile', () => {
    const firstDay = difficultyForDay(1);
    const laterDay = difficultyForDay(10);
    const cappedDay = difficultyForDay(999);

    expect(laterDay.trafficSpeedBonusKph).toBeGreaterThan(firstDay.trafficSpeedBonusKph);
    expect(laterDay.spawnGapMin).toBeLessThan(firstDay.spawnGapMin);
    expect(laterDay.spawnGapMax).toBeLessThan(firstDay.spawnGapMax);
    expect(laterDay.clusterChance).toBeGreaterThan(firstDay.clusterChance);
    expect(laterDay.laneJitter).toBeGreaterThan(firstDay.laneJitter);
    expect(cappedDay).toEqual(difficultyForDay(19));
    expect(cappedDay.spawnGapMin).toBeGreaterThanOrEqual(20);
    expect(cappedDay.clusterChance).toBeLessThanOrEqual(0.34);
  });

  it('applies the day profile deterministically to spawned traffic', () => {
    const firstDay = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983 });
    const laterDay = createGameState('AUTHENTIC_ENDURANCE', { seed: 1983 });
    laterDay.day = 10;
    populateTraffic(firstDay, 8);
    populateTraffic(laterDay, 8);

    expect(laterDay.traffic[0]?.speedKph).toBeGreaterThan(firstDay.traffic[0]?.speedKph ?? 0);
    expect(laterDay.traffic[1]?.z).toBeLessThanOrEqual(firstDay.traffic[1]?.z ?? 0);
    expect(laterDay.traffic.map((vehicle) => vehicle.id)).toEqual(
      firstDay.traffic.map((vehicle) => vehicle.id),
    );
  });
});
