export type GameMode = 'AUTHENTIC_ENDURANCE' | 'POC_QUICK_RACE';
export type GameScreen = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';
export type FailureReason = 'QUICK_TIME_EXPIRED' | 'DAILY_TARGET_MISSED' | null;
export type Weather = 'CLEAR' | 'FOG' | 'ICE';
export type DayPhase =
  | 'DAWN'
  | 'MORNING'
  | 'DAY'
  | 'SUNSET'
  | 'DUSK'
  | 'NIGHT'
  | 'LATE_NIGHT';
export type VehicleKind = 'COMPACT' | 'SEDAN' | 'SPORT' | 'UTILITY' | 'VAN' | 'TRUCK';
export type TrafficManeuverPhase = 'IDLE' | 'TELEGRAPH' | 'CHANGING';

export interface InputState {
  accelerate: boolean;
  brake: boolean;
  steer: number;
}

export interface TrafficVehicle {
  id: string;
  kind: VehicleKind;
  z: number;
  previousZ: number;
  lateral: number;
  preferredLane: number;
  speedKph: number;
  counted: boolean;
  wasAhead: boolean;
  recycledDuringPass: boolean;
  collided: boolean;
  color: string;
  apparentScale: number;
  lod: 0 | 1 | 2;
  maneuverPhase?: TrafficManeuverPhase;
  maneuverTargetLane?: number;
  maneuverFromLateral?: number;
  maneuverProgress?: number;
  maneuverTimerSeconds?: number;
  maneuverCooldownSeconds?: number;
  maneuverAttempt?: number;
}

export interface GameState {
  screen: GameScreen;
  mode: GameMode;
  elapsedSeconds: number;
  remainingSeconds: number;
  day: number;
  completedDays: number;
  dayElapsedSeconds: number;
  dayDurationSeconds: number;
  target: number;
  carsLeft: number;
  overtakes: number;
  totalOvertakes: number;
  distanceMeters: number;
  speedKph: number;
  playerX: number;
  lateralVelocity: number;
  weather: Weather;
  weatherIntensity: number;
  visibilityDistance: number;
  steeringResponse: number;
  lateralDamping: number;
  phase: DayPhase;
  phaseProgress: number;
  traffic: TrafficVehicle[];
  nextVehicleId: number;
  collisionCooldown: number;
  collisionFlash: number;
  collisionCount: number;
  goalReached: boolean;
  newDayFeedbackSeconds: number;
  failureReason: FailureReason;
  bestDays: number;
  seed: number;
}

export interface SerializableGameState {
  screen: GameScreen;
  mode: GameMode;
  elapsedSeconds: number;
  remainingSeconds: number;
  day: number;
  completedDays: number;
  dayElapsedSeconds: number;
  dayDurationSeconds: number;
  target: number;
  carsLeft: number;
  overtakes: number;
  totalOvertakes: number;
  distanceMeters: number;
  speedKph: number;
  playerX: number;
  weather: Weather;
  weatherIntensity: number;
  visibilityDistance: number;
  steeringResponse: number;
  phase: DayPhase;
  phaseProgress: number;
  dayProgress: number;
  trafficCount: number;
  collisionCount: number;
  goalReached: boolean;
  newDayFeedbackSeconds: number;
  failureReason: FailureReason;
  difficultyLevel: number;
  bestDays: number;
}
