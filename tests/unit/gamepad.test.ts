import { describe, expect, it } from 'vitest';
import { InputController } from '../../src/input/InputController';

function controlsRoot(): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = `
    <button data-control="left"></button>
    <button data-control="right"></button>
    <button data-control="accelerate"></button>
    <button data-control="brake"></button>`;
  return root;
}

describe('gamepad input normalization', () => {
  it('combines analog driving with edge-triggered pause and confirmation', () => {
    const input = new InputController(controlsRoot());
    input.setVirtualGamepad({ steer: 0.72, accelerate: true, pause: true, confirm: true });

    const first = input.pollGamepad();
    expect(input.state.steer).toBeCloseTo(0.725, 6);
    expect(input.state.accelerate).toBe(true);
    expect(first.pausePressed).toBe(true);
    expect(first.confirmPressed).toBe(true);

    const held = input.pollGamepad();
    expect(held.pausePressed).toBe(false);
    expect(held.confirmPressed).toBe(false);
  });

  it('keeps keyboard steering available inside the analog dead zone', () => {
    const input = new InputController(controlsRoot());
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    input.setVirtualGamepad({ steer: 0.08 });
    input.pollGamepad();

    expect(input.state.steer).toBe(-1);
  });

  it('preserves deterministic test commands while polling for controllers', () => {
    const input = new InputController(controlsRoot());
    input.setTestInput({ accelerate: true, steer: -0.45 });
    input.pollGamepad();

    expect(input.state.accelerate).toBe(true);
    expect(input.state.steer).toBeCloseTo(-0.45);
  });
});
