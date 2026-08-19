import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const controllerSource = readFileSync(new URL('../../src/GameController.ts', import.meta.url), 'utf8');

describe('live RAF frame clock plumbing', () => {
  it('forwards the same RAF timestamp to gamepad polling and simulation updates', () => {
    expect(controllerSource).toContain('const gamepadActions = this.input.pollGamepad(now);');
    expect(controllerSource).toContain('this.simulation.update(this.input.state, delta, now);');
    expect(controllerSource).toMatch(/this\.simulation\.update\(\s*\{ accelerate: true, brake: false, steer: Math\.sin\(now \/ 1800\) \* 0\.4 \},\s*delta,\s*now,\s*\);/s);
  });

  it('does not fall back to untimestamped live polling or live player updates', () => {
    expect(controllerSource).not.toContain('const gamepadActions = this.input.pollGamepad();');
    expect(controllerSource).not.toContain('this.simulation.update(this.input.state, delta);');
  });
});
