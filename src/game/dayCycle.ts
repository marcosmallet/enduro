import type { DayPhase, GameState } from './types';

export const DAY_PHASES: readonly DayPhase[] = [
  'DAWN',
  'MORNING',
  'DAY',
  'SUNSET',
  'DUSK',
  'NIGHT',
  'LATE_NIGHT',
];

export function normalizedDayProgress(state: GameState): number {
  const elapsed =
    state.mode === 'POC_QUICK_RACE' ? state.elapsedSeconds : state.dayElapsedSeconds;
  return Math.max(0, Math.min(0.999_999, elapsed / state.dayDurationSeconds));
}

export function updatePrototypeDayCycle(state: GameState): void {
  if (state.failureReason === 'DAILY_TARGET_MISSED') {
    state.phase = 'DAWN';
    state.phaseProgress = 0;
    return;
  }
  const normalized = normalizedDayProgress(state);
  const phasePosition = normalized * DAY_PHASES.length;
  const phaseIndex = Math.min(DAY_PHASES.length - 1, Math.floor(phasePosition));
  state.phase = DAY_PHASES[phaseIndex] ?? 'DAWN';
  state.phaseProgress = phasePosition - phaseIndex;
}
