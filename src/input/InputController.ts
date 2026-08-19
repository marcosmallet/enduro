import type { InputState } from '../game/types';

export interface GamepadActions {
  connected: boolean;
  label: string;
  pausePressed: boolean;
  confirmPressed: boolean;
}

export interface VirtualGamepadState {
  connected?: boolean;
  label?: string;
  steer?: number;
  accelerate?: boolean;
  brake?: boolean;
  pause?: boolean;
  confirm?: boolean;
}

interface DigitalInput {
  accelerate: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
}

interface NormalizedGamepad {
  connected: boolean;
  label: string;
  steer: number;
  accelerate: boolean;
  brake: boolean;
  pause: boolean;
  confirm: boolean;
}

const DEAD_ZONE = 0.18;
export const ANALOG_STEER_STEP = 0.025;
const MIN_ANALOG_STEER = 0.2;

function emptyDigitalInput(): DigitalInput {
  return { accelerate: false, brake: false, left: false, right: false };
}

function pressed(button: GamepadButton | undefined): boolean {
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.35);
}

export function quantizeAnalogSteer(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  if (Math.abs(clamped) < DEAD_ZONE) return 0;
  const quantized = Math.round(clamped / ANALOG_STEER_STEP) * ANALOG_STEER_STEP;
  const magnitude = Math.max(MIN_ANALOG_STEER, Math.abs(quantized));
  return Math.sign(clamped) * Math.min(1, magnitude);
}

export class InputController {
  readonly state: InputState = { accelerate: false, brake: false, steer: 0 };
  private readonly keyboard = emptyDigitalInput();
  private readonly touch = emptyDigitalInput();
  private gamepad: NormalizedGamepad = this.emptyGamepad();
  private virtualGamepad?: VirtualGamepadState;
  private testInput?: Partial<InputState>;
  private previousPause = false;
  private previousConfirm = false;

  constructor(private readonly root: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    this.bindTouchControl('[data-control="left"]', (pressedState) => {
      this.touch.left = pressedState;
      this.updateCombinedState();
    });
    this.bindTouchControl('[data-control="right"]', (pressedState) => {
      this.touch.right = pressedState;
      this.updateCombinedState();
    });
    this.bindTouchControl('[data-control="accelerate"]', (pressedState) => {
      this.touch.accelerate = pressedState;
      this.updateCombinedState();
    });
    this.bindTouchControl('[data-control="brake"]', (pressedState) => {
      this.touch.brake = pressedState;
      this.updateCombinedState();
    });
  }

  pollGamepad(nowMs = performance.now()): GamepadActions {
    this.gamepad = this.virtualGamepad
      ? this.normalizeVirtualGamepad(this.virtualGamepad)
      : this.readNativeGamepad();
    const pausePressed = this.gamepad.pause && !this.previousPause;
    const confirmPressed = this.gamepad.confirm && !this.previousConfirm;
    this.previousPause = this.gamepad.pause;
    this.previousConfirm = this.gamepad.confirm;
    this.updateCombinedState(nowMs);
    return {
      connected: this.gamepad.connected,
      label: this.gamepad.label,
      pausePressed,
      confirmPressed,
    };
  }

  setVirtualGamepad(state: VirtualGamepadState | undefined): void {
    this.virtualGamepad = state;
    this.previousPause = false;
    this.previousConfirm = false;
  }

  setTestInput(state: Partial<InputState>): void {
    this.testInput = { ...this.testInput, ...state };
    this.updateCombinedState();
  }

  reset(): void {
    Object.assign(this.keyboard, emptyDigitalInput());
    Object.assign(this.touch, emptyDigitalInput());
    this.gamepad = this.emptyGamepad();
    this.testInput = undefined;
    this.updateCombinedState();
    this.state.changedAtMs = undefined;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'ArrowUp' || event.code === 'KeyW') this.keyboard.accelerate = true;
    if (event.code === 'ArrowDown' || event.code === 'KeyS') this.keyboard.brake = true;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboard.left = true;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') this.keyboard.right = true;
    this.updateCombinedState();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowUp' || event.code === 'KeyW') this.keyboard.accelerate = false;
    if (event.code === 'ArrowDown' || event.code === 'KeyS') this.keyboard.brake = false;
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') this.keyboard.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') this.keyboard.right = false;
    this.updateCombinedState();
  };

  private readNativeGamepad(): NormalizedGamepad {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = Array.from(pads).find((candidate): candidate is Gamepad => candidate?.connected === true);
    if (!pad) return this.emptyGamepad();
    const analog = quantizeAnalogSteer(pad.axes[0] ?? 0);
    const dpad = Number(pressed(pad.buttons[15])) - Number(pressed(pad.buttons[14]));
    return {
      connected: true,
      label: pad.id || `GAMEPAD ${pad.index + 1}`,
      steer: Math.max(-1, Math.min(1, Math.abs(dpad) > Math.abs(analog) ? dpad : analog)),
      accelerate: pressed(pad.buttons[7]) || pressed(pad.buttons[0]),
      brake: pressed(pad.buttons[6]) || pressed(pad.buttons[1]),
      pause: pressed(pad.buttons[9]),
      confirm: pressed(pad.buttons[0]),
    };
  }

  private normalizeVirtualGamepad(state: VirtualGamepadState): NormalizedGamepad {
    return {
      connected: state.connected ?? true,
      label: state.label ?? 'TEST GAMEPAD',
      steer: quantizeAnalogSteer(state.steer ?? 0),
      accelerate: state.accelerate ?? false,
      brake: state.brake ?? false,
      pause: state.pause ?? false,
      confirm: state.confirm ?? false,
    };
  }

  private updateCombinedState(changedAtMs = performance.now()): void {
    const digitalSteer =
      Number(this.keyboard.right || this.touch.right) -
      Number(this.keyboard.left || this.touch.left);
    const accelerate = this.keyboard.accelerate || this.touch.accelerate || this.gamepad.accelerate;
    const brake = this.keyboard.brake || this.touch.brake || this.gamepad.brake;
    const steer = Math.abs(this.gamepad.steer) >= DEAD_ZONE ? this.gamepad.steer : digitalSteer;
    const nextAccelerate = this.testInput?.accelerate ?? accelerate;
    const nextBrake = this.testInput?.brake ?? brake;
    const nextSteer = this.testInput?.steer ?? steer;
    const changed =
      this.state.accelerate !== nextAccelerate ||
      this.state.brake !== nextBrake ||
      this.state.steer !== nextSteer;

    this.state.accelerate = nextAccelerate;
    this.state.brake = nextBrake;
    this.state.steer = nextSteer;
    if (changed) this.state.changedAtMs = changedAtMs;
  }

  private emptyGamepad(): NormalizedGamepad {
    return {
      connected: false,
      label: 'NONE',
      steer: 0,
      accelerate: false,
      brake: false,
      pause: false,
      confirm: false,
    };
  }

  private bindTouchControl(selector: string, update: (pressedState: boolean) => void): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) return;
    const pressControl = (event: PointerEvent): void => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      update(true);
      element.dataset.pressed = 'true';
    };
    const releaseControl = (event: PointerEvent): void => {
      event.preventDefault();
      update(false);
      element.dataset.pressed = 'false';
    };
    element.addEventListener('pointerdown', pressControl);
    element.addEventListener('pointerup', releaseControl);
    element.addEventListener('pointercancel', releaseControl);
    element.addEventListener('lostpointercapture', () => update(false));
  }
}
