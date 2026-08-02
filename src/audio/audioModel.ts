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
  weather: Weather;
  collisionCount: number;
  totalOvertakes: number;
  phase: DayPhase;
  goalReached: boolean;
  day: number;
  screen: GameScreen;
}

export interface ContinuousAudioMix {
  engineFrequency: number;
  engineGain: number;
  windGain: number;
  windCutoff: number;
  tireGain: number;
  tireCutoff: number;
  musicBrightness: number;
}

export function snapshotAudioState(state: GameState): AudioSnapshot {
  return {
    speedKph: state.speedKph,
    weather: state.weather,
    collisionCount: state.collisionCount,
    totalOvertakes: state.totalOvertakes,
    phase: state.phase,
    goalReached: state.goalReached,
    day: state.day,
    screen: state.screen,
  };
}

export function continuousAudioMix(snapshot: AudioSnapshot): ContinuousAudioMix {
  const speedRatio = Math.max(0, Math.min(1, snapshot.speedKph / 228));
  const moving = snapshot.speedKph > 2;
  const ice = snapshot.weather === 'ICE';
  return {
    engineFrequency: 48 + speedRatio * 116,
    engineGain: 0.045 + speedRatio * 0.12,
    windGain: moving ? Math.pow(speedRatio, 1.55) * 0.105 : 0,
    windCutoff: 520 + speedRatio * 2_900,
    tireGain: moving ? (0.018 + speedRatio * 0.04) * (ice ? 0.72 : 1) : 0,
    tireCutoff: ice ? 3_500 : 1_250 + speedRatio * 1_050,
    musicBrightness: snapshot.phase === 'NIGHT' || snapshot.phase === 'LATE_NIGHT' ? 520 : 760,
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
