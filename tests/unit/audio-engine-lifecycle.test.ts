import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import type { GameState } from '../../src/game/types';

class MockAudioParam {
  value = 0;

  setTargetAtTime(value: number): void {
    this.value = value;
  }

  setValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class MockAudioNode {
  connect<T>(destination: T): T {
    return destination;
  }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam();
  knee = new MockAudioParam();
  ratio = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  Q = new MockAudioParam();
  frequency = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam();
  started = false;

  start(): void {
    this.started = true;
  }

  stop(): void {}
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  started = false;

  start(): void {
    this.started = true;
  }

  stop(): void {}
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];

  readonly destination = new MockAudioNode();
  readonly sampleRate = 8;
  readonly currentTime = 1;
  state: AudioContextState = 'running';
  oscillators: MockOscillatorNode[] = [];
  bufferSources: MockAudioBufferSourceNode[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  createGain(): GainNode {
    return new MockGainNode() as unknown as GainNode;
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    return new MockDynamicsCompressorNode() as unknown as DynamicsCompressorNode;
  }

  createOscillator(): OscillatorNode {
    const oscillator = new MockOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new MockAudioBufferSourceNode();
    this.bufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new MockBiquadFilterNode() as unknown as BiquadFilterNode;
  }

  createBuffer(_channels: number, length: number): AudioBuffer {
    const channel = new Float32Array(length);
    return {
      getChannelData: () => channel,
    } as unknown as AudioBuffer;
  }
}

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    screen: 'PLAYING',
    mode: 'AUTHENTIC_ENDURANCE',
    elapsedSeconds: 1,
    remainingSeconds: 120,
    day: 1,
    completedDays: 0,
    dayElapsedSeconds: 1,
    dayDurationSeconds: 120,
    target: 10,
    carsLeft: 10,
    overtakes: 0,
    totalOvertakes: 0,
    distanceMeters: 100,
    speedKph: 120,
    playerX: 0,
    lateralVelocity: 0,
    weather: 'CLEAR',
    weatherIntensity: 0,
    visibilityDistance: 1,
    steeringResponse: 1,
    lateralDamping: 1,
    phase: 'DAY',
    phaseProgress: 0.5,
    traffic: [],
    nextVehicleId: 1,
    collisionCooldown: 0,
    collisionFlash: 0,
    collisionCount: 0,
    goalReached: false,
    newDayFeedbackSeconds: 0,
    failureReason: null,
    bestDays: 0,
    seed: 1234,
    ...overrides,
  };
}

describe('AudioEngine lifecycle', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    MockAudioContext.instances = [];
    storage.clear();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });

  it('keeps one persistent graph across unlock, drive, pause, resume and reset', async () => {
    const engine = new AudioEngine();
    const driving = gameState();
    const paused = gameState({ screen: 'PAUSED' });
    const reset = gameState({ speedKph: 0, elapsedSeconds: 0, distanceMeters: 0 });

    await engine.unlock();
    await engine.unlock();

    expect(MockAudioContext.instances).toHaveLength(1);
    const context = MockAudioContext.instances[0];
    expect(context).toBeDefined();
    if (!context) return;

    // Two engine oscillators plus two music-bed oscillators are the persistent graph.
    expect(context.oscillators).toHaveLength(4);
    // Wind and tire are the two persistent looping noise sources.
    expect(context.bufferSources).toHaveLength(2);

    engine.update(driving, 'DRIVE');
    engine.update(paused, 'PAUSED');
    engine.update(driving, 'DRIVE');
    engine.resetState(reset);
    engine.update(reset, 'MENU');
    await engine.unlock();

    expect(MockAudioContext.instances).toHaveLength(1);
    expect(context.oscillators).toHaveLength(4);
    expect(context.bufferSources).toHaveLength(2);
    expect(engine.status).toBe('ACTIVE');
  });

  it('preserves persisted mixer settings while lifecycle operations remain idempotent', async () => {
    const first = new AudioEngine();
    await first.unlock();
    first.setMaster(0.61);
    first.setMusic(0.19);
    first.setEffects(0.73);
    expect(first.toggleMuted()).toBe(true);

    const persisted = storage.get('road-endurance-audio-settings');
    expect(persisted).toBeDefined();

    const second = new AudioEngine();
    expect(second.settings).toEqual({
      master: 0.61,
      music: 0.19,
      effects: 0.73,
      muted: true,
    });

    await second.unlock();
    await second.unlock();
    expect(MockAudioContext.instances).toHaveLength(2);
    expect(second.status).toBe('MUTED');
  });
});
