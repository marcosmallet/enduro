import { GAME_RULES, ROAD_VISIBLE_DISTANCE } from '../config/game';
import { normalizedDayProgress } from './dayCycle';
import { difficultyForDay } from './difficulty';
import type { GameMode, GameState, SerializableGameState } from './types';

const BEST_DAYS_KEY = 'endurance-road-best-days';

function loadBestDays(): number {
  try {
    const value = Number.parseInt(localStorage.getItem(BEST_DAYS_KEY) ?? '0', 10);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function updateBestDays(completedDays: number): number {
  const nextBest = Math.max(loadBestDays(), Math.max(0, Math.floor(completedDays)));
  try {
    localStorage.setItem(BEST_DAYS_KEY, String(nextBest));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return nextBest;
}

export function targetForDay(mode: GameMode, day: number): number {
  if (mode === 'POC_QUICK_RACE') return GAME_RULES.quickRaceTarget;
  return day === 1 ? GAME_RULES.authenticFirstDayTarget : GAME_RULES.authenticLaterDayTarget;
}

export function createGameState(
  mode: GameMode,
  options: { seed?: number; targetOverride?: number } = {},
): GameState {
  const target = options.targetOverride ?? targetForDay(mode, 1);
  return {
    screen: 'PLAYING',
    mode,
    elapsedSeconds: 0,
    remainingSeconds:
      mode === 'POC_QUICK_RACE' ? GAME_RULES.quickRaceDurationSeconds : Number.POSITIVE_INFINITY,
    day: 1,
    completedDays: 0,
    dayElapsedSeconds: 0,
    dayDurationSeconds:
      mode === 'POC_QUICK_RACE'
        ? GAME_RULES.quickRaceDurationSeconds
        : GAME_RULES.authenticDayDurationSeconds,
    target,
    carsLeft: target,
    overtakes: 0,
    totalOvertakes: 0,
    distanceMeters: 0,
    speedKph: 0,
    playerX: 0,
    lateralVelocity: 0,
    weather: 'CLEAR',
    weatherIntensity: 0,
    visibilityDistance: ROAD_VISIBLE_DISTANCE,
    steeringResponse: 1,
    lateralDamping: 6.4,
    phase: 'DAWN',
    phaseProgress: 0,
    traffic: [],
    nextVehicleId: 1,
    collisionCooldown: 0,
    collisionFlash: 0,
    collisionCount: 0,
    goalReached: false,
    newDayFeedbackSeconds: 0,
    failureReason: null,
    bestDays: loadBestDays(),
    seed: options.seed ?? Date.now(),
  };
}

export function serializeGameState(state: GameState): SerializableGameState {
  return {
    screen: state.screen,
    mode: state.mode,
    elapsedSeconds: Number(state.elapsedSeconds.toFixed(2)),
    remainingSeconds: Number.isFinite(state.remainingSeconds)
      ? Number(state.remainingSeconds.toFixed(2))
      : -1,
    day: state.day,
    completedDays: state.completedDays,
    dayElapsedSeconds: Number(state.dayElapsedSeconds.toFixed(2)),
    dayDurationSeconds: state.dayDurationSeconds,
    target: state.target,
    carsLeft: state.carsLeft,
    overtakes: state.overtakes,
    totalOvertakes: state.totalOvertakes,
    distanceMeters: Number(state.distanceMeters.toFixed(1)),
    speedKph: Number(state.speedKph.toFixed(1)),
    playerX: Number(state.playerX.toFixed(3)),
    weather: state.weather,
    weatherIntensity: Number(state.weatherIntensity.toFixed(3)),
    visibilityDistance: Number(state.visibilityDistance.toFixed(1)),
    steeringResponse: Number(state.steeringResponse.toFixed(3)),
    phase: state.phase,
    phaseProgress: Number(state.phaseProgress.toFixed(3)),
    dayProgress: Number(normalizedDayProgress(state).toFixed(3)),
    trafficCount: state.traffic.length,
    trafficManeuvers: state.traffic.map((vehicle) => ({
      id: vehicle.id,
      z: Number(vehicle.z.toFixed(2)),
      lateral: Number(vehicle.lateral.toFixed(4)),
      preferredLane: Number(vehicle.preferredLane.toFixed(4)),
      maneuverPhase: vehicle.maneuverPhase ?? 'IDLE',
      maneuverTargetLane:
        vehicle.maneuverTargetLane === undefined
          ? null
          : Number(vehicle.maneuverTargetLane.toFixed(4)),
      maneuverProgress: Number((vehicle.maneuverProgress ?? 0).toFixed(3)),
    })),
    collisionCount: state.collisionCount,
    goalReached: state.goalReached,
    newDayFeedbackSeconds: Number(state.newDayFeedbackSeconds.toFixed(2)),
    failureReason: state.failureReason,
    difficultyLevel: difficultyForDay(state.day).level,
    bestDays: state.bestDays,
  };
}
