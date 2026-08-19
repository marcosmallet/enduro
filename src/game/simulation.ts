import { updateEnduranceDay } from './endurance';
import { updateEnvironment } from './environment';
import { updatePlayer } from './physics';
import { SeededRandom } from './random';
import { updateTraffic } from './traffic';
import type { GameState, InputState } from './types';

export const SIMULATION_STEP_SECONDS = 1 / 60;
const MAX_FRAME_DELTA_SECONDS = 0.05;
const MAX_STEPS_PER_UPDATE = 3;
const STEP_EPSILON = 1e-9;

interface QueuedInput {
  effectiveAtSeconds: number;
  input: InputState;
}

function coreInput(input: InputState): InputState {
  return {
    accelerate: input.accelerate,
    brake: input.brake,
    steer: input.steer,
  };
}

function sameInput(a: InputState, b: InputState): boolean {
  return a.accelerate === b.accelerate && a.brake === b.brake && a.steer === b.steer;
}

export class Simulation {
  private readonly random: SeededRandom;
  private accumulatorSeconds = 0;
  private activeInput: InputState = { accelerate: false, brake: false, steer: 0 };
  private observedInput: InputState = { accelerate: false, brake: false, steer: 0 };
  private readonly queuedInputs: QueuedInput[] = [];

  constructor(private readonly state: GameState) {
    this.random = new SeededRandom(state.seed ^ 0xa511e9b3);
  }

  update(input: InputState, deltaSeconds: number, nowMs?: number): void {
    if (this.state.screen !== 'PLAYING') {
      this.accumulatorSeconds = 0;
      this.queuedInputs.length = 0;
      this.activeInput = coreInput(input);
      this.observedInput = coreInput(input);
      return;
    }

    const frameDelta = Math.max(0, Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS));
    this.queueObservedInput(input, frameDelta, nowMs);
    this.accumulatorSeconds += frameDelta;
    let steps = 0;

    while (
      this.accumulatorSeconds + STEP_EPSILON >= SIMULATION_STEP_SECONDS &&
      steps < MAX_STEPS_PER_UPDATE
    ) {
      const nextStepTime = this.state.elapsedSeconds + SIMULATION_STEP_SECONDS;
      this.applyQueuedInputs(nextStepTime);
      this.step(this.activeInput, SIMULATION_STEP_SECONDS);
      this.accumulatorSeconds = Math.max(
        0,
        this.accumulatorSeconds - SIMULATION_STEP_SECONDS,
      );
      steps += 1;

      if (this.state.screen !== 'PLAYING') {
        this.accumulatorSeconds = 0;
        this.queuedInputs.length = 0;
        break;
      }
    }

    if (
      steps === MAX_STEPS_PER_UPDATE &&
      this.accumulatorSeconds + STEP_EPSILON >= SIMULATION_STEP_SECONDS
    ) {
      this.accumulatorSeconds %= SIMULATION_STEP_SECONDS;
    }
  }

  private queueObservedInput(input: InputState, frameDelta: number, nowMs?: number): void {
    const next = coreInput(input);
    if (sameInput(next, this.observedInput)) return;

    const horizonStart = this.state.elapsedSeconds + this.accumulatorSeconds;
    let offsetSeconds = 0;
    if (input.changedAtMs !== undefined && Number.isFinite(input.changedAtMs)) {
      const sampleNowMs =
        nowMs ?? (typeof performance !== 'undefined' ? performance.now() : input.changedAtMs);
      const frameStartMs = sampleNowMs - frameDelta * 1000;
      offsetSeconds = Math.max(
        0,
        Math.min(frameDelta, (input.changedAtMs - frameStartMs) / 1000),
      );
    }

    this.queuedInputs.push({
      effectiveAtSeconds: horizonStart + offsetSeconds,
      input: next,
    });
    this.queuedInputs.sort((a, b) => a.effectiveAtSeconds - b.effectiveAtSeconds);
    this.observedInput = next;
  }

  private applyQueuedInputs(nextStepTime: number): void {
    while (
      this.queuedInputs.length > 0 &&
      (this.queuedInputs[0]?.effectiveAtSeconds ?? Number.POSITIVE_INFINITY) <=
        nextStepTime + STEP_EPSILON
    ) {
      const queued = this.queuedInputs.shift();
      if (queued) this.activeInput = queued.input;
    }
  }

  private step(input: InputState, dt: number): void {
    this.state.elapsedSeconds += dt;

    if (Number.isFinite(this.state.remainingSeconds)) {
      this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - dt);
      if (this.state.remainingSeconds === 0 && !this.state.goalReached) {
        this.state.failureReason = 'QUICK_TIME_EXPIRED';
        this.state.screen = 'GAME_OVER';
        updateEnvironment(this.state);
        return;
      }
    }

    updateEnvironment(this.state);
    updatePlayer(this.state, input, dt);
    updateTraffic(this.state, dt, this.random);
    updateEnduranceDay(this.state, dt);
    updateEnvironment(this.state);
  }
}
