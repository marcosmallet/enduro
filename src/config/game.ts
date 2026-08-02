export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;
export const HORIZON_Y = 224;
export const ROAD_VISIBLE_DISTANCE = 280;

export const GAME_RULES = {
  authenticFirstDayTarget: 200,
  authenticLaterDayTarget: 300,
  authenticDayDurationSeconds: 180,
  quickRaceTarget: 20,
  quickRaceDurationSeconds: 90,
  maxSpeedKph: 228,
  accelerationKphPerSecond: 82,
  brakingKphPerSecond: 142,
  rollingResistanceKphPerSecond: 19,
  collisionSpeedMultiplier: 0.43,
  playerRoadLimit: 0.88,
  newDayFeedbackSeconds: 2.4,
} as const;

export const DIFFICULTY_CURVE = {
  maxEffectiveLevel: 18,
  trafficSpeedBonusPerLevelKph: 2.1,
  maxTrafficSpeedBonusKph: 34,
  spawnGapMinStart: 32,
  spawnGapMinFloor: 20,
  spawnGapMaxStart: 68,
  spawnGapMaxFloor: 42,
  clusterChanceStart: 0.08,
  clusterChancePerLevel: 0.015,
  clusterChanceMax: 0.34,
  clusterGapMin: 1.5,
  clusterGapMax: 5.5,
  laneJitterStart: 0.04,
  laneJitterMax: 0.1,
} as const;

export const ENVIRONMENT_RULES = {
  fogMinimumVisibilityDistance: 104,
  fogContrastLoss: 0.82,
  iceMinimumSteeringResponse: 0.46,
  iceMinimumLateralDamping: 2.25,
  weatherTransitionFraction: 0.024,
  authenticFogDurationStart: 0.105,
  authenticIceDurationStart: 0.115,
  weatherDurationPerLevel: 0.0035,
  maximumPrimaryWeatherDuration: 0.17,
  additionalWeatherFirstLevel: 4,
  additionalWeatherSecondLevel: 10,
} as const;

export type GraphicsProfile = 'LOW' | 'MEDIUM' | 'HIGH';

export interface GraphicsSettings {
  profile: GraphicsProfile;
  maxTraffic: number;
  maxVisibleTraffic: number;
  highDetailVehicles: number;
  particleScale: number;
  roadTexture: boolean;
  shadows: boolean;
}

export const GRAPHICS_PROFILES: Record<GraphicsProfile, GraphicsSettings> = {
  LOW: {
    profile: 'LOW', maxTraffic: 6, maxVisibleTraffic: 6, highDetailVehicles: 1,
    particleScale: 0.42, roadTexture: false, shadows: false,
  },
  MEDIUM: {
    profile: 'MEDIUM', maxTraffic: 8, maxVisibleTraffic: 8, highDetailVehicles: 2,
    particleScale: 0.72, roadTexture: true, shadows: false,
  },
  HIGH: {
    profile: 'HIGH', maxTraffic: 10, maxVisibleTraffic: 8, highDetailVehicles: 3,
    particleScale: 1, roadTexture: true, shadows: true,
  },
};

export function detectGraphicsProfile(): GraphicsProfile {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (memory >= 8 && cores >= 8) return 'HIGH';
  if (memory >= 4 && cores >= 4) return 'MEDIUM';
  return 'LOW';
}
