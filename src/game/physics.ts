import { GAME_RULES } from '../config/game';
import type { GameState, InputState } from './types';

export function updatePlayer(state: GameState, input: InputState, deltaSeconds: number): void {
  const dt = Math.min(deltaSeconds, 0.05);
  let acceleration = -GAME_RULES.rollingResistanceKphPerSecond;
  if (input.accelerate) acceleration = GAME_RULES.accelerationKphPerSecond;
  if (input.brake) acceleration = -GAME_RULES.brakingKphPerSecond;

  state.speedKph = Math.max(
    0,
    Math.min(GAME_RULES.maxSpeedKph, state.speedKph + acceleration * dt),
  );

  const speedFactor = 0.36 + 0.64 * (state.speedKph / GAME_RULES.maxSpeedKph);
  const steeringForce = input.steer * 7.1 * speedFactor * state.steeringResponse;
  state.lateralVelocity += steeringForce * dt;
  state.lateralVelocity *= Math.exp(-state.lateralDamping * dt);
  state.playerX += state.lateralVelocity * dt;

  if (Math.abs(state.playerX) > GAME_RULES.playerRoadLimit) {
    state.playerX = Math.sign(state.playerX) * GAME_RULES.playerRoadLimit;
    state.lateralVelocity *= -0.12;
    state.speedKph = Math.max(0, state.speedKph - 24 * dt);
  }

  state.distanceMeters += (state.speedKph / 3.6) * dt;
}

export function applyCollisionPenalty(state: GameState): void {
  state.speedKph *= GAME_RULES.collisionSpeedMultiplier;
  state.lateralVelocity += state.playerX >= 0 ? -0.75 : 0.75;
  state.collisionCooldown = 0.85;
  state.collisionFlash = 0.42;
  state.collisionCount += 1;
}
