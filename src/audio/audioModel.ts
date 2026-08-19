import type { DayPhase, GameScreen, GameState, Weather } from '../game/types';

export type AudioCue =
  | 'COLLISION'
  | 'OVERTAKE'
  | 'PERIOD_CHANGE'
  | 'GOAL_COMPLETE'
  | 'GAME_OVER'
  | 'NEW_DAY'
  | 'UI_MOVE'
  | 'UI_CONFIRM';

export interface AudioSnapshot {
  speedKph: number;
  elapsedSeconds: number;
  weather: Weather;
  collisionCount: number;
  totalOvertakes: number;
  phase: DayPhase;
  goalReached: boolean;
  day: number;
  screen: GameScreen;
}

export interface ContinuousAudioMix {
  engineLoad: number;
  engineFrequency: number;
  engineGain: number;
  windGain: number;
  windCutoff: number;
  tireGain: number;
  tireCutoff: number;
  musicBrightness: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function snapshotAudioState(state: GameState): AudioSnapshot {
  return {
    speedKph: state.speedKph,
    elapsedSeconds: state.elapsedSeconds,
    weather: state.weather,
    collisionCount: state.collisionCount,
    totalOvertakes: state.totalOvertakes,
    phase: state.phase,
    goalReached: state.goalReached,
    day: state.day,
    screen: state.screen,
  };
}

export function advanceAudioLoadReference(
  current: AudioSnapshot,
  previousRender: AudioSnapshot | undefined,
  currentReference: AudioSnapshot | undefined,
): AudioSnapshot | undefined {
  if (!previousRender) return currentReference;
  const deltaSeconds = current.elapsedSeconds - previousRender.elapsedSeconds;
  return Number.isFinite(deltaSeconds) && deltaSeconds > 0.001
    ? previousRender
    : currentReference;
}

export function deriveEngineLoad(
  current: AudioSnapshot,
  previous?: AudioSnapshot,
): number {
  if (current.speedKph <= 2) return 0.16;
  if (!previous) return 0.38;

  const deltaSeconds = current.elapsedSeconds - previous.elapsedSeconds;
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0.001) return 0.38;
  const accelerationKphPerSecond =
    (current.speedKph - previous.speedKph) / deltaSeconds;
  return clamp(0.38 + accelerationKphPerSecond / 82, 0.12, 1);
}

export function continuousAudioMix(
  snapshot: AudioSnapshot,
  previous?: AudioSnapshot,
): ContinuousAudioMix {
  const speedRatio = clamp(snapshot.speedKph / 228, 0, 1);
  const moving = snapshot.speedKph > 2;
  const engineLoad = deriveEngineLoad(snapshot, previous);
  const fog = snapshot.weather === 'FOG';
  const ice = snapshot.weather === 'ICE';

  const baseWindGain = moving ? Math.pow(speedRatio, 1.55) * 0.105 : 0;
  const baseWindCutoff = 520 + speedRatio * 2_900;
  const baseTireGain = moving ? 0.018 + speedRatio * 0.04 : 0;
  const baseTireCutoff = 1_250 + speedRatio * 1_050;
  const night = snapshot.phase === 'NIGHT' || snapshot.phase === 'LATE_NIGHT';

  return {
    engineLoad,
    engineFrequency: clamp(46 + speedRatio * 112 + engineLoad * 20, 46, 178),
    engineGain: clamp(0.036 + speedRatio * 0.104 + engineLoad * 0.03, 0.04, 0.17),
    windGain: clamp(baseWindGain * (fog ? 0.78 : ice ? 0.94 : 1), 0, 0.105),
    windCutoff: clamp(baseWindCutoff * (fog ? 0.64 : ice ? 0.92 : 1), 320, 3_420),
    tireGain: clamp(baseTireGain * (fog ? 0.88 : ice ? 0.72 : 1), 0, 0.058),
    tireCutoff: clamp(ice ? 3_500 : baseTireCutoff * (fog ? 0.82 : 1), 650, 3_500),
    musicBrightness: clamp((night ? 520 : 760) * (fog ? 0.88 : 1), 450, 760),
  };
}

export function audioCuesBetween(
  previous: AudioSnapshot | undefined,
  current: AudioSnapshot,
): AudioCue[] {
  if (!previous) return [];
  const cues: AudioCue[] = [];
  if (current.collisionCount > previous.collisionCount) cues.push('COLLISION');
  if (current.totalOvertakes > previous.totalOvertakes) cues.push('OVERTAKE');
  if (current.phase !== previous.phase) cues.push('PERIOD_CHANGE');
  if (current.goalReached && !previous.goalReached) cues.push('GOAL_COMPLETE');
  if (current.day > previous.day) cues.push('NEW_DAY');
  if (current.screen === 'GAME_OVER' && previous.screen !== 'GAME_OVER') cues.push('GAME_OVER');
  return cues;
}
