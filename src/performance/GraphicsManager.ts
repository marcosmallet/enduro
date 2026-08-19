import type { GraphicsProfile } from '../config/game';

export type GraphicsSelection = 'AUTO' | GraphicsProfile;

export interface GraphicsSampleTiming {
  sampledSeconds: number;
  wallSeconds: number;
  representative: boolean;
}

const ORDER: readonly GraphicsProfile[] = ['LOW', 'MEDIUM', 'HIGH'];
const NON_REPRESENTATIVE_WALL_RATIO = 3;
const NON_REPRESENTATIVE_WALL_SLACK_SECONDS = 1;

function profileIndex(profile: GraphicsProfile): number {
  return ORDER.indexOf(profile);
}

export class GraphicsManager {
  private active: GraphicsProfile;
  private lowFpsSeconds = 0;
  private recoverySeconds = 0;
  private lastSampleWallTimeMs: number;
  private sampleTimingValue: GraphicsSampleTiming = {
    sampledSeconds: 0,
    wallSeconds: 0,
    representative: true,
  };

  constructor(
    private readonly automaticCeiling: GraphicsProfile,
    private selectionValue: GraphicsSelection = 'AUTO',
    private readonly nowMs: () => number = () => performance.now(),
  ) {
    this.active = selectionValue === 'AUTO' ? automaticCeiling : selectionValue;
    this.lastSampleWallTimeMs = this.nowMs();
  }

  get selection(): GraphicsSelection {
    return this.selectionValue;
  }

  get activeProfile(): GraphicsProfile {
    return this.active;
  }

  get sampleTiming(): GraphicsSampleTiming {
    return { ...this.sampleTimingValue };
  }

  setSelection(selection: GraphicsSelection): boolean {
    this.selectionValue = selection;
    this.resetAdaptationHistory();
    this.lastSampleWallTimeMs = this.nowMs();
    const next = selection === 'AUTO' ? this.automaticCeiling : selection;
    if (next === this.active) return false;
    this.active = next;
    return true;
  }

  recordSample(fps: number, seconds: number): boolean {
    const now = this.nowMs();
    const wallSeconds = Math.max(0, (now - this.lastSampleWallTimeMs) / 1000);
    this.lastSampleWallTimeMs = now;
    const sampleSeconds = Math.max(0, Math.min(2, seconds));
    const representative =
      wallSeconds <=
      Math.max(
        sampleSeconds * NON_REPRESENTATIVE_WALL_RATIO,
        sampleSeconds + NON_REPRESENTATIVE_WALL_SLACK_SECONDS,
      );
    this.sampleTimingValue = {
      sampledSeconds: sampleSeconds,
      wallSeconds,
      representative,
    };

    if (this.selectionValue !== 'AUTO') return false;
    if (!representative) {
      this.resetAdaptationHistory();
      return false;
    }

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
      this.resetAdaptationHistory();
      return true;
    }

    if (
      this.recoverySeconds >= 12 &&
      profileIndex(this.active) < profileIndex(this.automaticCeiling)
    ) {
      this.active = ORDER[profileIndex(this.active) + 1] ?? this.automaticCeiling;
      this.resetAdaptationHistory();
      return true;
    }
    return false;
  }

  private resetAdaptationHistory(): void {
    this.lowFpsSeconds = 0;
    this.recoverySeconds = 0;
  }
}
