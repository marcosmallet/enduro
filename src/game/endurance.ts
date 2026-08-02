import { GAME_RULES } from '../config/game';
import { targetForDay, updateBestDays } from './state';
import type { GameState } from './types';

export function updateEnduranceDay(state: GameState, deltaSeconds: number): void {
  state.newDayFeedbackSeconds = Math.max(0, state.newDayFeedbackSeconds - deltaSeconds);
  if (state.mode !== 'AUTHENTIC_ENDURANCE') return;

  state.dayElapsedSeconds = Math.min(
    state.dayDurationSeconds,
    state.dayElapsedSeconds + deltaSeconds,
  );
  if (state.dayElapsedSeconds < state.dayDurationSeconds) return;

  if (!state.goalReached) {
    state.failureReason = 'DAILY_TARGET_MISSED';
    state.screen = 'GAME_OVER';
    return;
  }

  state.completedDays = state.day;
  state.bestDays = updateBestDays(state.completedDays);
  state.day += 1;
  state.target = targetForDay(state.mode, state.day);
  state.carsLeft = state.target;
  state.overtakes = 0;
  state.goalReached = false;
  state.dayElapsedSeconds = 0;
  state.newDayFeedbackSeconds = GAME_RULES.newDayFeedbackSeconds;
  state.failureReason = null;
}
