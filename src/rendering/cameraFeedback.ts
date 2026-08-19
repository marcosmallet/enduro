import type { GameState } from '../game/types';
import { roadCurve } from './projection';

const MAX_SPEED_KPH = 228;
const REDUCED_MOTION_SCALE = 0.18;

export interface CameraFeedback {
  worldRollRadians: number;
  worldOffsetY: number;
  playerRollRadians: number;
  playerOffsetX: number;
  playerOffsetY: number;
  motionScale: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function deriveCameraFeedback(
  state: Readonly<GameState>,
  timeSeconds: number,
  reducedMotion = false,
): CameraFeedback {
  const motionScale = reducedMotion ? REDUCED_MOTION_SCALE : 1;
  const speedRatio = clamp(state.speedKph / MAX_SPEED_KPH, 0, 1);
  const steering = clamp(state.lateralVelocity / 1.2, -1, 1);
  const curve = roadCurve(state.distanceMeters, 72);
  const collision = clamp(state.collisionFlash / 0.42, 0, 1);
  const roadPulse = Math.sin(state.distanceMeters * 0.12) * speedRatio;

  return {
    worldRollRadians: clamp(
      (-steering * 0.012 + curve * 0.004 + collision * Math.sin(timeSeconds * 58) * 0.01) *
        motionScale,
      -0.02,
      0.02,
    ),
    worldOffsetY: clamp(
      (roadPulse * 0.8 + Math.sin(timeSeconds * 9) * speedRatio * 1.2 +
        collision * Math.sin(timeSeconds * 70) * 3.2) *
        motionScale,
      -4,
      4,
    ),
    playerRollRadians: clamp(
      (-steering * 0.025 + collision * Math.sin(timeSeconds * 62) * 0.035) * motionScale,
      -0.045,
      0.045,
    ),
    playerOffsetX: clamp(
      collision * Math.sin(timeSeconds * 80) * 4 * motionScale,
      -4,
      4,
    ),
    playerOffsetY: clamp(
      ((speedRatio > 0.65 ? Math.sin(timeSeconds * 40) * (speedRatio - 0.65) * 2.5 : 0) +
        collision * Math.cos(timeSeconds * 65) * 2) *
        motionScale,
      -3,
      3,
    ),
    motionScale,
  };
}
