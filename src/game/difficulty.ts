import { DIFFICULTY_CURVE } from '../config/game';

export interface DifficultyProfile {
  level: number;
  trafficSpeedBonusKph: number;
  spawnGapMin: number;
  spawnGapMax: number;
  clusterChance: number;
  clusterGapMin: number;
  clusterGapMax: number;
  laneJitter: number;
}

export function difficultyForDay(day: number): DifficultyProfile {
  const level = Math.min(
    DIFFICULTY_CURVE.maxEffectiveLevel,
    Math.max(0, Math.floor(day) - 1),
  );

  return {
    level,
    trafficSpeedBonusKph: Math.min(
      DIFFICULTY_CURVE.maxTrafficSpeedBonusKph,
      level * DIFFICULTY_CURVE.trafficSpeedBonusPerLevelKph,
    ),
    spawnGapMin: Math.max(
      DIFFICULTY_CURVE.spawnGapMinFloor,
      DIFFICULTY_CURVE.spawnGapMinStart - level * 0.72,
    ),
    spawnGapMax: Math.max(
      DIFFICULTY_CURVE.spawnGapMaxFloor,
      DIFFICULTY_CURVE.spawnGapMaxStart - level * 1.45,
    ),
    clusterChance: Math.min(
      DIFFICULTY_CURVE.clusterChanceMax,
      DIFFICULTY_CURVE.clusterChanceStart + level * DIFFICULTY_CURVE.clusterChancePerLevel,
    ),
    clusterGapMin: DIFFICULTY_CURVE.clusterGapMin,
    clusterGapMax: DIFFICULTY_CURVE.clusterGapMax,
    laneJitter: Math.min(
      DIFFICULTY_CURVE.laneJitterMax,
      DIFFICULTY_CURVE.laneJitterStart + level * 0.004,
    ),
  };
}
