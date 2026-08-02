import { ENVIRONMENT_RULES, ROAD_VISIBLE_DISTANCE } from '../config/game';
import { normalizedDayProgress, updatePrototypeDayCycle } from './dayCycle';
import { difficultyForDay } from './difficulty';
import type { GameMode, GameState, Weather } from './types';

export interface WeatherWindow {
  weather: Exclude<Weather, 'CLEAR'>;
  start: number;
  end: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function seededUnit(seed: number, day: number, channel: number): number {
  let value = (seed ^ Math.imul(day, 0x9e3779b1) ^ Math.imul(channel, 0x85ebca6b)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function jitter(seed: number, day: number, channel: number, amount: number): number {
  return (seededUnit(seed, day, channel) * 2 - 1) * amount;
}

export function weatherWindowsForDay(
  mode: GameMode,
  day: number,
  seed: number,
): WeatherWindow[] {
  if (mode === 'POC_QUICK_RACE') {
    return [
      { weather: 'FOG', start: 0.32, end: 0.44 },
      { weather: 'ICE', start: 0.59, end: 0.71 },
    ];
  }

  const level = difficultyForDay(day).level;
  const primaryDuration = Math.min(
    ENVIRONMENT_RULES.maximumPrimaryWeatherDuration,
    ENVIRONMENT_RULES.authenticFogDurationStart +
      level * ENVIRONMENT_RULES.weatherDurationPerLevel,
  );
  const iceDuration = Math.min(
    ENVIRONMENT_RULES.maximumPrimaryWeatherDuration,
    ENVIRONMENT_RULES.authenticIceDurationStart +
      level * ENVIRONMENT_RULES.weatherDurationPerLevel,
  );
  const fogStart = 0.31 + jitter(seed, day, 1, 0.018);
  const iceStart = 0.59 + jitter(seed, day, 2, 0.022);
  const windows: WeatherWindow[] = [
    { weather: 'FOG', start: fogStart, end: fogStart + primaryDuration },
    { weather: 'ICE', start: iceStart, end: iceStart + iceDuration },
  ];

  if (level >= ENVIRONMENT_RULES.additionalWeatherFirstLevel) {
    const start = 0.81 + jitter(seed, day, 3, 0.018);
    windows.push({
      weather: day % 2 === 0 ? 'FOG' : 'ICE',
      start,
      end: Math.min(0.96, start + 0.062 + level * 0.0015),
    });
  }
  if (level >= ENVIRONMENT_RULES.additionalWeatherSecondLevel) {
    const start = 0.17 + jitter(seed, day, 4, 0.014);
    windows.push({
      weather: day % 2 === 0 ? 'ICE' : 'FOG',
      start,
      end: Math.min(0.27, start + 0.052 + level * 0.0012),
    });
  }
  return windows.sort((left, right) => left.start - right.start);
}

export function weatherWindowIntensity(progress: number, window: WeatherWindow): number {
  if (progress <= window.start || progress >= window.end) return 0;
  const ramp = Math.min(
    ENVIRONMENT_RULES.weatherTransitionFraction,
    (window.end - window.start) * 0.28,
  );
  const fadeIn = smoothstep((progress - window.start) / ramp);
  const fadeOut = smoothstep((window.end - progress) / ramp);
  return Math.min(fadeIn, fadeOut);
}

export function applyWeatherState(
  state: GameState,
  weather: Weather,
  intensity: number,
): void {
  const normalizedIntensity = weather === 'CLEAR' ? 0 : clamp(intensity, 0, 1);
  state.weather = normalizedIntensity > 0 ? weather : 'CLEAR';
  state.weatherIntensity = normalizedIntensity;
  const fogIntensity = state.weather === 'FOG' ? normalizedIntensity : 0;
  const iceIntensity = state.weather === 'ICE' ? normalizedIntensity : 0;
  state.visibilityDistance =
    ROAD_VISIBLE_DISTANCE -
    fogIntensity * (ROAD_VISIBLE_DISTANCE - ENVIRONMENT_RULES.fogMinimumVisibilityDistance);
  state.steeringResponse =
    1 - iceIntensity * (1 - ENVIRONMENT_RULES.iceMinimumSteeringResponse);
  state.lateralDamping =
    6.4 - iceIntensity * (6.4 - ENVIRONMENT_RULES.iceMinimumLateralDamping);
}

export function updateEnvironment(state: GameState): void {
  updatePrototypeDayCycle(state);
  const progress = normalizedDayProgress(state);
  let selectedWeather: Weather = 'CLEAR';
  let selectedIntensity = 0;
  for (const window of weatherWindowsForDay(state.mode, state.day, state.seed)) {
    const intensity = weatherWindowIntensity(progress, window);
    if (intensity > selectedIntensity) {
      selectedWeather = window.weather;
      selectedIntensity = intensity;
    }
  }
  applyWeatherState(state, selectedWeather, selectedIntensity);
}
