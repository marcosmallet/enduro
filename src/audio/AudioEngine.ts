import type { GameState } from '../game/types';
import {
  advanceAudioLoadReference,
  audioCuesBetween,
  continuousAudioMix,
  snapshotAudioState,
  type AudioCue,
  type AudioScene,
  type AudioSnapshot,
} from './audioModel';

export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
  muted: boolean;
}

export type { AudioScene } from './audioModel';
export type AudioStatus = 'LOCKED' | 'ACTIVE' | 'MUTED' | 'SUSPENDED';

const STORAGE_KEY = 'road-endurance-audio-settings';
const DEFAULT_SETTINGS: AudioSettings = { master: 0.78, music: 0.24, effects: 0.82, muted: false };

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function loadSettings(): AudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (!stored) return { ...DEFAULT_SETTINGS };
    return {
      master: clampVolume(stored.master ?? DEFAULT_SETTINGS.master),
      music: clampVolume(stored.music ?? DEFAULT_SETTINGS.music),
      effects: clampVolume(stored.effects ?? DEFAULT_SETTINGS.effects),
      muted: stored.muted ?? DEFAULT_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class AudioEngine {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private engineGain?: GainNode;
  private engineOscillator?: OscillatorNode;
  private engineHarmonic?: OscillatorNode;
  private windGain?: GainNode;
  private windFilter?: BiquadFilterNode;
  private tireGain?: GainNode;
  private tireFilter?: BiquadFilterNode;
  private musicFilter?: BiquadFilterNode;
  private noiseBuffer?: AudioBuffer;
  private previous?: AudioSnapshot;
  private loadReference?: AudioSnapshot;
  private previousScene?: AudioScene;
  private currentSettings = loadSettings();

  get settings(): AudioSettings {
    return { ...this.currentSettings };
  }

  get status(): AudioStatus {
    if (!this.context) return 'LOCKED';
    if (this.currentSettings.muted) return 'MUTED';
    return this.context.state === 'running' ? 'ACTIVE' : 'SUSPENDED';
  }

  async unlock(): Promise<void> {
    if (!this.context) this.createGraph();
    if (this.context?.state === 'suspended') await this.context.resume();
    this.applySettings();
  }

  resetState(state: GameState): void {
    this.previous = snapshotAudioState(state);
    this.loadReference = undefined;
    this.previousScene = undefined;
  }

  update(state: GameState, scene: AudioScene): void {
    const current = snapshotAudioState(state);
    if (!this.context) {
      this.previous = current;
      this.previousScene = scene;
      return;
    }

    const sceneChanged = this.previousScene !== undefined && this.previousScene !== scene;
    this.loadReference = advanceAudioLoadReference(
      current,
      this.previous,
      this.loadReference,
      sceneChanged,
    );
    const now = this.context.currentTime;
    const mix = continuousAudioMix(current, this.loadReference);
    const driveLevel = scene === 'DRIVE' ? 1 : scene === 'MENU' ? 0.48 : 0.12;
    this.engineOscillator?.frequency.setTargetAtTime(mix.engineFrequency, now, 0.055);
    this.engineHarmonic?.frequency.setTargetAtTime(mix.engineFrequency * 2.01, now, 0.055);
    this.engineGain?.gain.setTargetAtTime(mix.engineGain * driveLevel, now, 0.08);
    this.windGain?.gain.setTargetAtTime(mix.windGain * driveLevel, now, 0.12);
    this.windFilter?.frequency.setTargetAtTime(mix.windCutoff, now, 0.1);
    this.tireGain?.gain.setTargetAtTime(mix.tireGain * driveLevel, now, 0.08);
    this.tireFilter?.frequency.setTargetAtTime(mix.tireCutoff, now, 0.12);
    this.musicFilter?.frequency.setTargetAtTime(mix.musicBrightness, now, 0.8);

    for (const cue of audioCuesBetween(this.previous, current)) this.playCue(cue);
    this.previous = current;
    this.previousScene = scene;
  }

  setMaster(value: number): void {
    this.currentSettings.master = clampVolume(value);
    this.persistAndApply();
  }

  setMusic(value: number): void {
    this.currentSettings.music = clampVolume(value);
    this.persistAndApply();
  }

  setEffects(value: number): void {
    this.currentSettings.effects = clampVolume(value);
    this.persistAndApply();
  }

  toggleMuted(): boolean {
    this.currentSettings.muted = !this.currentSettings.muted;
    this.persistAndApply();
    return this.currentSettings.muted;
  }

  playCue(cue: AudioCue): void {
    if (!this.context || !this.effectsGain || this.currentSettings.muted) return;
    switch (cue) {
      case 'COLLISION':
        this.playNoiseBurst(0.3, 0.3, 180);
        this.playTone(92, 0.28, 0.16, 'sawtooth', 48);
        break;
      case 'OVERTAKE':
        this.playTone(440, 0.085, 0.045, 'sine', 620);
        break;
      case 'PERIOD_CHANGE':
        this.playTone(246, 0.42, 0.035, 'sine', 329);
        break;
      case 'GOAL_COMPLETE':
        this.playArpeggio([392, 523, 659], 0.12, 0.075);
        break;
      case 'NEW_DAY':
        this.playArpeggio([220, 330, 440], 0.15, 0.065);
        break;
      case 'GAME_OVER':
        this.playArpeggio([196, 147, 110], 0.19, 0.075);
        break;
      case 'UI_MOVE':
        this.playTone(330, 0.045, 0.025, 'triangle');
        break;
      case 'UI_CONFIRM':
        this.playArpeggio([330, 494], 0.075, 0.045);
        break;
    }
  }

  private createGraph(): void {
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.noiseBuffer = this.createNoiseBuffer(context);

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    master.connect(compressor).connect(context.destination);
    this.masterGain = master;

    this.musicGain = context.createGain();
    this.effectsGain = context.createGain();
    this.musicGain.connect(master);
    this.effectsGain.connect(master);

    this.createEngine(context);
    this.createNoiseLayers(context);
    this.createMusicBed(context);
    this.applySettings();
  }

  private createEngine(context: AudioContext): void {
    if (!this.effectsGain) return;
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(this.effectsGain);

    const primary = context.createOscillator();
    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    primary.type = 'sawtooth';
    harmonic.type = 'triangle';
    harmonicGain.gain.value = 0.22;
    primary.connect(engineGain);
    harmonic.connect(harmonicGain).connect(engineGain);
    primary.start();
    harmonic.start();
    this.engineGain = engineGain;
    this.engineOscillator = primary;
    this.engineHarmonic = harmonic;
  }

  private createNoiseLayers(context: AudioContext): void {
    if (!this.effectsGain || !this.noiseBuffer) return;
    const wind = context.createBufferSource();
    const windFilter = context.createBiquadFilter();
    const windGain = context.createGain();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.62;
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(this.effectsGain);
    wind.start();

    const tire = context.createBufferSource();
    const tireFilter = context.createBiquadFilter();
    const tireGain = context.createGain();
    tire.buffer = this.noiseBuffer;
    tire.loop = true;
    tireFilter.type = 'highpass';
    tireFilter.Q.value = 0.48;
    tireGain.gain.value = 0;
    tire.connect(tireFilter).connect(tireGain).connect(this.effectsGain);
    tire.start();
    this.windFilter = windFilter;
    this.windGain = windGain;
    this.tireFilter = tireFilter;
    this.tireGain = tireGain;
  }

  private createMusicBed(context: AudioContext): void {
    if (!this.musicGain) return;
    const filter = context.createBiquadFilter();
    const bedGain = context.createGain();
    const root = context.createOscillator();
    const fifth = context.createOscillator();
    root.type = 'sine';
    fifth.type = 'sine';
    root.frequency.value = 55;
    fifth.frequency.value = 82.5;
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    bedGain.gain.value = 0.05;
    root.connect(filter);
    fifth.connect(filter);
    filter.connect(bedGain).connect(this.musicGain);
    root.start();
    fifth.start();
    this.musicFilter = filter;
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 1.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    let noiseState = 0x5eed1234;
    for (let index = 0; index < length; index += 1) {
      noiseState = (Math.imul(noiseState, 1_664_525) + 1_013_904_223) >>> 0;
      const white = (noiseState / 0x1_0000_0000) * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      data[index] = previous;
    }
    return buffer;
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency = frequency,
    delay = 0,
  ): void {
    if (!this.context || !this.effectsGain) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.effectsGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private playArpeggio(frequencies: number[], spacing: number, volume: number): void {
    frequencies.forEach((frequency, index) => {
      this.playTone(frequency, spacing * 1.8, volume, 'sine', frequency * 1.01, index * spacing);
    });
  }

  private playNoiseBurst(duration: number, volume: number, cutoff: number): void {
    if (!this.context || !this.effectsGain || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.effectsGain);
    source.start(now);
    source.stop(now + duration);
  }

  private persistAndApply(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSettings));
    } catch {
      // Settings remain active when storage is unavailable.
    }
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const master = this.currentSettings.muted ? 0 : this.currentSettings.master;
    this.masterGain?.gain.setTargetAtTime(master, now, 0.025);
    this.musicGain?.gain.setTargetAtTime(this.currentSettings.music, now, 0.025);
    this.effectsGain?.gain.setTargetAtTime(this.currentSettings.effects, now, 0.025);
  }
}
