import { DAY_PHASES } from '../game/dayCycle';
import type { DayPhase } from '../game/types';

export interface ScenePalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  mountainFar: string;
  mountainNear: string;
  ground: string;
  groundAlt: string;
  road: string;
  roadAlt: string;
  roadLine: string;
  haze: string;
  exposure: number;
}

export const PHASE_PALETTES: Record<DayPhase, ScenePalette> = {
  DAWN: {
    skyTop: '#152b4b', skyBottom: '#ed9d68', sun: '#ffe4a6', mountainFar: '#554f68',
    mountainNear: '#263948', ground: '#24362e', groundAlt: '#293d33', road: '#343a3e',
    roadAlt: '#30363a', roadLine: '#efe5cb', haze: '#d49775', exposure: 0.9,
  },
  MORNING: {
    skyTop: '#3f86bc', skyBottom: '#c8e2e6', sun: '#fff2bf', mountainFar: '#718997',
    mountainNear: '#36575d', ground: '#3d5d3c', groundAlt: '#466842', road: '#42484b',
    roadAlt: '#3b4245', roadLine: '#fff2d1', haze: '#b7d4d6', exposure: 1,
  },
  DAY: {
    skyTop: '#2879b7', skyBottom: '#a8d8e5', sun: '#fffbd8', mountainFar: '#6f92a1',
    mountainNear: '#315964', ground: '#436441', groundAlt: '#4b7047', road: '#444a4d',
    roadAlt: '#3d4448', roadLine: '#fff2ce', haze: '#a5cbd2', exposure: 1.06,
  },
  SUNSET: {
    skyTop: '#342c64', skyBottom: '#f08855', sun: '#ffd089', mountainFar: '#624963',
    mountainNear: '#2b3544', ground: '#384235', groundAlt: '#414a38', road: '#3b3b3f',
    roadAlt: '#34363a', roadLine: '#f5d7b1', haze: '#c87062', exposure: 0.86,
  },
  DUSK: {
    skyTop: '#141c3a', skyBottom: '#80506a', sun: '#eca875', mountainFar: '#38324b',
    mountainNear: '#18252d', ground: '#1c2a24', groundAlt: '#213027', road: '#292d31',
    roadAlt: '#25292d', roadLine: '#cfbea6', haze: '#684d64', exposure: 0.64,
  },
  NIGHT: {
    skyTop: '#020610', skyBottom: '#13233a', sun: '#9fb4d1', mountainFar: '#121b29',
    mountainNear: '#091219', ground: '#0b1512', groundAlt: '#0e1a16', road: '#171c21',
    roadAlt: '#13181d', roadLine: '#7f8b94', haze: '#17273a', exposure: 0.4,
  },
  LATE_NIGHT: {
    skyTop: '#050814', skyBottom: '#24364e', sun: '#b7c8d9', mountainFar: '#1d2735',
    mountainNear: '#0d171d', ground: '#101c17', groundAlt: '#14211a', road: '#1b2024',
    roadAlt: '#171c20', roadLine: '#89949c', haze: '#27394d', exposure: 0.48,
  },
};

function colorChannels(color: string): [number, number, number] {
  const normalized = color.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

export function mixSceneColor(from: string, to: string, amount: number): string {
  const [fromRed, fromGreen, fromBlue] = colorChannels(from);
  const [toRed, toGreen, toBlue] = colorChannels(to);
  const ratio = Math.max(0, Math.min(1, amount));
  const channel = (start: number, end: number): string =>
    Math.round(start + (end - start) * ratio).toString(16).padStart(2, '0');
  return `#${channel(fromRed, toRed)}${channel(fromGreen, toGreen)}${channel(fromBlue, toBlue)}`;
}

export function scenePaletteForPhase(phase: DayPhase, phaseProgress: number): ScenePalette {
  const currentIndex = DAY_PHASES.indexOf(phase);
  const nextPhase = DAY_PHASES[(currentIndex + 1) % DAY_PHASES.length] ?? 'DAWN';
  const current = PHASE_PALETTES[phase];
  const next = PHASE_PALETTES[nextPhase];
  const progress = Math.max(0, Math.min(1, phaseProgress));
  const eased = progress * progress * (3 - 2 * progress);
  return {
    skyTop: mixSceneColor(current.skyTop, next.skyTop, eased),
    skyBottom: mixSceneColor(current.skyBottom, next.skyBottom, eased),
    sun: mixSceneColor(current.sun, next.sun, eased),
    mountainFar: mixSceneColor(current.mountainFar, next.mountainFar, eased),
    mountainNear: mixSceneColor(current.mountainNear, next.mountainNear, eased),
    ground: mixSceneColor(current.ground, next.ground, eased),
    groundAlt: mixSceneColor(current.groundAlt, next.groundAlt, eased),
    road: mixSceneColor(current.road, next.road, eased),
    roadAlt: mixSceneColor(current.roadAlt, next.roadAlt, eased),
    roadLine: mixSceneColor(current.roadLine, next.roadLine, eased),
    haze: mixSceneColor(current.haze, next.haze, eased),
    exposure: current.exposure + (next.exposure - current.exposure) * eased,
  };
}
