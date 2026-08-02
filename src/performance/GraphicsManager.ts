import type { GraphicsProfile } from '../config/game';

export type GraphicsSelection = 'AUTO' | GraphicsProfile;

const ORDER: readonly GraphicsProfile[] = ['LOW', 'MEDIUM', 'HIGH'];

function profileIndex(profile: GraphicsProfile): number {
  return ORDER.indexOf(profile);
}

export class GraphicsManager {
  private active: GraphicsProfile;
  private lowFpsSeconds = 0;
  private recoverySeconds = 0;

  constructor(
    private readonly automaticCeiling: GraphicsProfile,
    private selectionValue: GraphicsSelection = 'AUTO',
  ) {
    this.active = selectionValue === 'AUTO' ? automaticCeiling : selectionValue;
  }

  get selection(): GraphicsSelection {
    return this.selectionValue;
  }

  get activeProfile(): GraphicsProfile {
    return this.active;
  }

  setSelection(selection: GraphicsSelection): boolean {
    this.selectionValue = selection;
    this.lowFpsSeconds = 0;
    this.recoverySeconds = 0;
    const next = selection === 'AUTO' ? this.automaticCeiling : selection;
    if (next === this.active) return false;
    this.active = next;
    return true;
  }

  recordSample(fps: number, seconds: number): boolean {
    if (this.selectionValue !== 'AUTO') return false;
    const sampleSeconds = Math.max(0, Math.min(2, seconds));
    const downgradeThreshold = this.active === 'HIGH' ? 50 : this.active === 'MEDIUM' ? 38 : 0;
    if (downgradeThreshold > 0 && fps < downgradeThreshold) {
      this.lowFpsSeconds += sampleSeconds;
      this.recoverySeconds = 0;
    } else {
      this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - sampleSeconds * 0.5);
      this.recoverySeconds = fps >= 57 ? this.recoverySeconds + sampleSeconds : 0;
    }

    if (this.lowFpsSeconds >= 4 && this.active !== 'LOW') {
      this.active = ORDER[profileIndex(this.active) - 1] ?? 'LOW';
      this.lowFpsSeconds = 0;
      this.recoverySeconds = 0;
      return true;
    }

    if (
      this.recoverySeconds >= 12 &&
      profileIndex(this.active) < profileIndex(this.automaticCeiling)
    ) {
      this.active = ORDER[profileIndex(this.active) + 1] ?? this.automaticCeiling;
      this.lowFpsSeconds = 0;
      this.recoverySeconds = 0;
      return true;
    }
    return false;
  }
}
