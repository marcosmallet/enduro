import { updateEnduranceDay } from './endurance';
import { updateEnvironment } from './environment';
import { updatePlayer } from './physics';
import { SeededRandom } from './random';
import { updateTraffic } from './traffic';
import type { GameState, InputState } from './types';

export class Simulation {
  private readonly random: SeededRandom;

  constructor(private readonly state: GameState) {
    this.random = new SeededRandom(state.seed ^ 0xa511e9b3);
  }

  update(input: InputState, deltaSeconds: number): void {
    if (this.state.screen !== 'PLAYING') return;
    const dt = Math.min(deltaSeconds, 0.05);
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
