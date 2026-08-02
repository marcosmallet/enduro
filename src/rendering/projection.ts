import { HORIZON_Y, LOGICAL_HEIGHT, LOGICAL_WIDTH, ROAD_VISIBLE_DISTANCE } from '../config/game';

export interface ProjectedPoint {
  x: number;
  y: number;
  roadHalfWidth: number;
  scale: number;
  centerX: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roadCurve(distanceMeters: number, z: number): number {
  const broadCurve = Math.sin((distanceMeters + z * 3.8) / 620) * 0.34;
  const secondaryCurve = Math.sin((distanceMeters + z * 1.7) / 240) * 0.09;
  const fadeNearPlayer = clamp(z / 95, 0, 1);
  return (broadCurve + secondaryCurve) * fadeNearPlayer;
}

export function projectRoadPoint(
  z: number,
  lateral = 0,
  distanceMeters = 0,
  width = LOGICAL_WIDTH,
  height = LOGICAL_HEIGHT,
): ProjectedPoint {
  const horizonY = (HORIZON_Y / LOGICAL_HEIGHT) * height;
  const depth = clamp(1 - z / ROAD_VISIBLE_DISTANCE, 0, 1);
  const scale = depth ** 1.52;
  const y = horizonY + (height - horizonY) * scale;
  const roadHalfWidth = 30 + (width * 0.475 - 30) * depth ** 1.08;
  const curveOffset = roadCurve(distanceMeters, z) * roadHalfWidth;
  const centerX = width / 2 + curveOffset;
  return {
    x: centerX + lateral * roadHalfWidth,
    y,
    roadHalfWidth,
    scale,
    centerX,
  };
}
