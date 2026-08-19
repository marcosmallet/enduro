import { AudioEngine, type AudioSettings } from './audio/AudioEngine';
import { BRANDING } from './config/runtimeBranding';
import {
  detectGraphicsProfile,
  GRAPHICS_PROFILES,
  SIMULATION_TRAFFIC_COUNT,
  type GraphicsProfile,
} from './config/game';
import { difficultyForDay } from './game/difficulty';
import { applyWeatherState, updateEnvironment } from './game/environment';
import { createGameState, serializeGameState } from './game/state';
import { Simulation } from './game/simulation';
import { populateTraffic } from './game/traffic';
import type {
  DayPhase,
  GameMode,
  GameState,
  InputState,
  SerializableGameState,
  TrafficVehicle,
  Weather,
} from './game/types';
import {
  InputController,
  type GamepadActions,
  type VirtualGamepadState,
} from './input/InputController';
import { translate, type Language, type TranslationKey } from './i18n';
import {
  GraphicsManager,
  type GraphicsSelection,
} from './performance/GraphicsManager';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { hyperRevealProgress, type VisualMode } from './rendering/visualModes';
import { createGameMarkup } from './ui/gameMarkup';

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const GRAPHICS_STORAGE_KEY = 'road-endurance-graphics-profile';
const ELEMENT_CACHE = new WeakMap<ParentNode, Map<string, Element>>();

function loadGraphicsSelection(): GraphicsSelection {
  try {
    const stored = localStorage.getItem(GRAPHICS_STORAGE_KEY);
    return stored === 'LOW' || stored === 'MEDIUM' || stored === 'HIGH' ? stored : 'AUTO';
  } catch {
    return 'AUTO';
  }
}

export interface PlatformState {
  visualMode: VisualMode;
  legacyAmount: number;
  audioStatus: string;
  gamepadConnected: boolean;
  gamepadLabel: string;
  fullscreen: boolean;
  graphicsSelection: GraphicsSelection;
  graphicsProfile: GraphicsProfile;
}

export interface TestContract {
  start: (mode: GameMode, targetOverride?: number) => void;
  getState: () => SerializableGameState;
  setInput: (input: Partial<InputState>) => void;
  step: (seconds: number) => void;
  placeVehicle: (options: { z: number; lateral?: number; speedKph?: number }) => string;
  setPhase: (phase: DayPhase) => void;
  setWeather: (weather: Weather) => void;
  setDayProgress: (progress: number) => void;
  forceCollision: () => void;
  completeGoal: () => void;
  finishDay: () => void;
  setGamepad: (state: VirtualGamepadState | null) => void;
  setVisualMode: (mode: VisualMode, revealProgress?: number) => void;
  getPlatformState: () => PlatformState;
  getAudioSettings: () => AudioSettings;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  setGraphicsProfile: (selection: GraphicsSelection) => void;
  recordPerformance: (fps: number, seconds: number) => void;
}

declare global {
  interface Window {
    __roadEnduranceTest?: TestContract;
  }
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  let cache = ELEMENT_CACHE.get(root);
  if (!cache) {
    cache = new Map<string, Element>();
    ELEMENT_CACHE.set(root, cache);
  }
  const cached = cache.get(selector);
  if (cached) return cached as T;

  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  cache.set(selector, element);
  return element;
}

function setTextContent(element: Element, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function setStyleProperty(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

export class GameController {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: CanvasRenderer;
  private readonly input: InputController;
  private readonly audio = new AudioEngine();
  private readonly graphics = new GraphicsManager(detectGraphicsProfile(), loadGraphicsSelection());
  private state: GameState;
  private simulation: Simulation;
  private language: Language = 'pt';
  private visualMode: VisualMode = 'HYPER';
  private legacyAmount = 1;
  private menuDemoStartedAt = performance.now();
  private testRevealProgress?: number;
  private gamepadConnected = false;
  private gamepadLabel = 'NONE';
  private deferredInstallPrompt?: DeferredInstallPrompt;
  private currentMode: GameMode = 'POC_QUICK_RACE';
  private inMenu = true;
  private diagnosticsVisible = false;
  private activeModal?: HTMLElement;
  private modalReturnFocus?: HTMLElement;
  private lastFrameTime = performance.now();
  private frameCounter = 0;
  private frameAccumulator = 0;
  private measuredFps = 60;
  private readonly testMode = new URLSearchParams(window.location.search).get('test') === '1';

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = createGameMarkup();
    this.canvas = requiredElement<HTMLCanvasElement>(root, '#game-canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    this.renderer.setGraphicsSettings(GRAPHICS_PROFILES[this.graphics.activeProfile]);
    this.input = new InputController(root);
    this.state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
    this.state.speedKph = 142;
    populateTraffic(this.state, SIMULATION_TRAFFIC_COUNT);
    this.simulation = new Simulation(this.state);
    this.bindUi();
    this.applyBranding();
    this.updateLanguage();
    if (this.testMode) this.installTestContract();
    requestAnimationFrame(this.frame);
  }

  private bindUi(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
      button.addEventListener('click', () => this.startFromUserGesture(button.dataset.mode as GameMode));
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="restart"]')) {
      button.addEventListener('click', () => {
        this.audio.playCue('UI_CONFIRM');
        this.start(this.currentMode);
      });
    }
    requiredElement<HTMLButtonElement>(this.root, '[data-action="continue"]').addEventListener(
      'click',
      () => {
        this.audio.playCue('UI_CONFIRM');
        this.togglePause(false);
      },
    );
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="menu"]')) {
      button.addEventListener('click', () => {
        this.audio.playCue('UI_MOVE');
        this.showMenu();
      });
    }
    requiredElement<HTMLButtonElement>(this.root, '[data-action="language"]').addEventListener(
      'click',
      () => {
        this.audio.playCue('UI_MOVE');
        this.language = this.language === 'pt' ? 'en' : 'pt';
        this.updateLanguage();
      },
    );
    requiredElement<HTMLButtonElement>(this.root, '[data-action="fullscreen"]').addEventListener(
      'click',
      () => {
        this.audio.playCue('UI_MOVE');
        this.toggleFullscreen();
      },
    );
    requiredElement<HTMLSelectElement>(this.root, '[data-action="visual-mode"]').addEventListener(
      'change',
      (event) => {
        this.audio.playCue('UI_MOVE');
        this.selectVisualMode((event.currentTarget as HTMLSelectElement).value as VisualMode);
      },
    );
    requiredElement<HTMLSelectElement>(this.root, '[data-action="graphics-profile"]').addEventListener(
      'change',
      (event) => {
        this.audio.playCue('UI_MOVE');
        this.setGraphicsSelection(
          (event.currentTarget as HTMLSelectElement).value as GraphicsSelection,
        );
      },
    );
    requiredElement<HTMLButtonElement>(this.root, '[data-action="audio-toggle"]').addEventListener(
      'click',
      () => {
        this.unlockAudio('UI_MOVE');
        const panel = requiredElement<HTMLElement>(this.root, '.audio-panel');
        setHidden(panel, !panel.hidden);
      },
    );
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="mute"]')) {
      button.addEventListener('click', () => {
        this.unlockAudio();
        this.audio.toggleMuted();
        this.syncAudioControls();
      });
    }
    for (const input of this.root.querySelectorAll<HTMLInputElement>('[data-audio]')) {
      input.addEventListener('input', () => {
        this.unlockAudio();
        const value = Number(input.value) / 100;
        if (input.dataset.audio === 'master') this.audio.setMaster(value);
        if (input.dataset.audio === 'music') this.audio.setMusic(value);
        if (input.dataset.audio === 'effects') this.audio.setEffects(value);
        this.syncAudioControls();
      });
    }
    requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]').addEventListener(
      'click',
      () => void this.installPwa(),
    );
    document.addEventListener('fullscreenchange', () => this.syncFullscreenButton());
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event as DeferredInstallPrompt;
      setHidden(requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]'), false);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = undefined;
      setHidden(requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]'), true);
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Tab' && this.trapModalFocus(event)) return;
      if (event.repeat) return;
      if (event.code === 'Escape' && !this.inMenu) this.togglePause(this.state.screen !== 'PAUSED');
      if (event.code === 'KeyR' && !this.inMenu) this.start(this.currentMode);
      if (event.code === 'KeyM') {
        this.unlockAudio();
        this.audio.toggleMuted();
        this.syncAudioControls();
      }
      if (event.code === 'F3') {
        event.preventDefault();
        this.diagnosticsVisible = !this.diagnosticsVisible;
        setHidden(
          requiredElement<HTMLElement>(this.root, '.diagnostics'),
          !this.diagnosticsVisible,
        );
      }
      if ((event.code === 'Enter' || event.code === 'Space') && this.inMenu) {
        const active = document.activeElement;
        if (!(active instanceof HTMLButtonElement) && !(active instanceof HTMLSelectElement)) {
          this.startFromUserGesture('AUTHENTIC_ENDURANCE');
        }
      }
    });
    this.syncAudioControls();
    this.syncFullscreenButton();
    requiredElement<HTMLSelectElement>(this.root, '[data-action="graphics-profile"]').value =
      this.graphics.selection;
  }

  private modalFocusableElements(modal: HTMLElement): HTMLElement[] {
    return Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden);
  }

  private trapModalFocus(event: KeyboardEvent): boolean {
    const modal = this.activeModal;
    if (!modal || modal.hidden) return false;
    const focusable = this.modalFocusableElements(modal);
    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return true;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return false;
    const active = document.activeElement;
    if (!modal.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return true;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  private setModalBackgroundInert(inert: boolean): void {
    for (const selector of ['.menu', '.hud', '.touch-controls', '#game-canvas']) {
      requiredElement<HTMLElement>(this.root, selector).inert = inert;
    }
  }

  private activateModal(
    modal: HTMLElement,
    preferredSelector: string,
    rememberReturnFocus: boolean,
  ): void {
    if (this.activeModal === modal) return;
    if (rememberReturnFocus) {
      const active = document.activeElement;
      this.modalReturnFocus =
        active instanceof HTMLElement && this.root.contains(active) ? active : undefined;
    }
    this.activeModal = modal;
    this.setModalBackgroundInert(true);
    queueMicrotask(() => {
      if (this.activeModal !== modal || modal.hidden) return;
      const preferred = modal.querySelector<HTMLElement>(preferredSelector);
      (preferred ?? this.modalFocusableElements(modal)[0] ?? modal).focus({ preventScroll: true });
    });
  }

  private deactivateModal(restoreFocus: boolean): void {
    if (!this.activeModal) return;
    this.activeModal = undefined;
    this.setModalBackgroundInert(false);
    const returnFocus = this.modalReturnFocus;
    this.modalReturnFocus = undefined;
    if (!restoreFocus) return;
    queueMicrotask(() => {
      if (returnFocus && this.root.contains(returnFocus) && !returnFocus.closest('[hidden]')) {
        returnFocus.focus({ preventScroll: true });
      } else {
        this.canvas.focus({ preventScroll: true });
      }
    });
  }

  private startFromUserGesture(mode: GameMode): void {
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (coarsePointer && !standalone && !document.fullscreenElement) this.requestFullscreen();
    this.unlockAudio('UI_CONFIRM');
    this.start(mode);
  }

  private unlockAudio(cue?: 'UI_MOVE' | 'UI_CONFIRM'): void {
    void this.audio
      .unlock()
      .then(() => {
        if (cue) this.audio.playCue(cue);
      })
      .catch(() => {
        // Browsers can deny audio activation; controls and gameplay remain available.
      });
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else this.requestFullscreen();
  }

  private requestFullscreen(): void {
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    void this.root.requestFullscreen().catch(() => {
      // Fullscreen is optional; the layout remains usable when the browser rejects it.
    });
  }

  private syncFullscreenButton(): void {
    const button = requiredElement<HTMLButtonElement>(this.root, '[data-action="fullscreen"]');
    const active = Boolean(document.fullscreenElement);
    setTextContent(button, active ? '×' : '⛶');
    button.setAttribute('aria-label', translate(this.language, active ? 'exitFullscreen' : 'fullscreen'));
    button.setAttribute('aria-pressed', String(active));
  }

  private selectVisualMode(mode: VisualMode): void {
    this.visualMode = mode;
    this.testRevealProgress = undefined;
    this.menuDemoStartedAt = performance.now();
    requiredElement<HTMLElement>(this.root, '.game-shell').dataset.visualMode = mode;
    requiredElement<HTMLSelectElement>(this.root, '[data-action="visual-mode"]').value = mode;
    this.updateVisualPresentation(performance.now());
  }

  private setGraphicsSelection(selection: GraphicsSelection): void {
    this.graphics.setSelection(selection);
    try {
      localStorage.setItem(GRAPHICS_STORAGE_KEY, selection);
    } catch {
      // The selected profile remains active when storage is unavailable.
    }
    requiredElement<HTMLSelectElement>(this.root, '[data-action="graphics-profile"]').value =
      selection;
    this.applyGraphicsProfile();
  }

  private applyGraphicsProfile(): void {
    this.renderer.setGraphicsSettings(GRAPHICS_PROFILES[this.graphics.activeProfile]);
  }

  private syncAudioControls(): void {
    const settings = this.audio.settings;
    for (const key of ['master', 'music', 'effects'] as const) {
      const percent = Math.round(settings[key] * 100);
      const input = requiredElement<HTMLInputElement>(this.root, `[data-audio="${key}"]`);
      const value = String(percent);
      if (input.value !== value) input.value = value;
      setTextContent(
        requiredElement<HTMLOutputElement>(this.root, `[data-audio-value="${key}"]`),
        `${percent}%`,
      );
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="mute"]')) {
      setTextContent(button, translate(this.language, settings.muted ? 'unmute' : 'mute'));
      button.setAttribute('aria-pressed', String(settings.muted));
    }
  }

  private async installPwa(): Promise<void> {
    if (!this.deferredInstallPrompt) return;
    const prompt = this.deferredInstallPrompt;
    await prompt.prompt();
    await prompt.userChoice;
    setHidden(requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]'), true);
    this.deferredInstallPrompt = undefined;
  }

  private applyBranding(): void {
    setTextContent(requiredElement<HTMLElement>(this.root, '[data-brand="eyebrow"]'), BRANDING.eyebrow);
    setTextContent(requiredElement<HTMLElement>(this.root, '[data-brand="name"]'), BRANDING.logoText);
    setTextContent(requiredElement<HTMLElement>(this.root, '[data-brand="subtitle"]'), BRANDING.subtitle);
    const legal = requiredElement<HTMLElement>(this.root, '[data-brand="legal"]');
    setTextContent(legal, BRANDING.legalNotice);
    setHidden(legal, BRANDING.legalNotice.length === 0);
    document.title = `${BRANDING.name} — ${BRANDING.subtitle}`;
    document.documentElement.style.setProperty('--accent', BRANDING.colors.accent);
    document.documentElement.style.setProperty('--accent-warm', BRANDING.colors.accentWarm);
    document.documentElement.style.setProperty('--panel', BRANDING.colors.panel);
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute(
      'content',
      BRANDING.description,
    );
  }

  private start(mode: GameMode, targetOverride?: number): void {
    this.currentMode = mode;
    this.input.reset();
    this.state = createGameState(mode, {
      seed: this.testMode ? 1983 : Date.now(),
      targetOverride,
    });
    updateEnvironment(this.state);
    populateTraffic(this.state, SIMULATION_TRAFFIC_COUNT);
    this.simulation = new Simulation(this.state);
    this.audio.resetState(this.state);
    this.inMenu = false;
    this.updateVisualPresentation(performance.now());
    setHidden(requiredElement<HTMLElement>(this.root, '.menu'), true);
    setHidden(requiredElement<HTMLElement>(this.root, '.hud'), false);
    setHidden(requiredElement<HTMLElement>(this.root, '.pause-modal'), true);
    setHidden(requiredElement<HTMLElement>(this.root, '.result-modal'), true);
    setHidden(requiredElement<HTMLElement>(this.root, '.audio-panel'), true);
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'true';
    this.deactivateModal(false);
    this.canvas.focus({ preventScroll: true });
    this.syncView();
  }

  private showMenu(): void {
    this.input.reset();
    this.inMenu = true;
    this.state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
    this.state.speedKph = 142;
    updateEnvironment(this.state);
    populateTraffic(this.state, SIMULATION_TRAFFIC_COUNT);
    this.simulation = new Simulation(this.state);
    this.audio.resetState(this.state);
    this.menuDemoStartedAt = performance.now();
    this.testRevealProgress = undefined;
    setHidden(requiredElement<HTMLElement>(this.root, '.menu'), false);
    setHidden(requiredElement<HTMLElement>(this.root, '.hud'), true);
    setHidden(requiredElement<HTMLElement>(this.root, '.pause-modal'), true);
    setHidden(requiredElement<HTMLElement>(this.root, '.result-modal'), true);
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'false';
    this.deactivateModal(false);
    queueMicrotask(() => {
      requiredElement<HTMLButtonElement>(this.root, '[data-mode="AUTHENTIC_ENDURANCE"]').focus({
        preventScroll: true,
      });
    });
  }

  private togglePause(paused: boolean): void {
    if (this.inMenu || this.state.screen === 'VICTORY' || this.state.screen === 'GAME_OVER') return;
    this.state.screen = paused ? 'PAUSED' : 'PLAYING';
    this.input.reset();
    const modal = requiredElement<HTMLElement>(this.root, '.pause-modal');
    setHidden(modal, !paused);
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = paused ? 'false' : 'true';
    if (paused) this.activateModal(modal, '[data-action="continue"]', true);
    else this.deactivateModal(true);
    this.syncView();
  }

  private readonly frame = (now: number): void => {
    const delta = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const gamepadActions = this.input.pollGamepad(now);
    this.handleGamepadActions(gamepadActions);
    this.updateVisualPresentation(now);
    if (!this.testMode) {
      if (this.inMenu) {
        this.simulation.update(
          { accelerate: true, brake: false, steer: Math.sin(now / 1800) * 0.4 },
          delta,
          now,
        );
      } else {
        this.simulation.update(this.input.state, delta, now);
      }
    }
    this.audio.update(
      this.state,
      this.inMenu ? 'MENU' : this.state.screen === 'PAUSED' ? 'PAUSED' : 'DRIVE',
    );
    this.renderer.render(this.state, now / 1000);
    this.recordFrame(delta);
    this.syncView();
    requestAnimationFrame(this.frame);
  };

  private handleGamepadActions(actions: GamepadActions): void {
    this.gamepadConnected = actions.connected;
    this.gamepadLabel = actions.label;
    if (actions.pausePressed && !this.inMenu) {
      this.togglePause(this.state.screen !== 'PAUSED');
      this.audio.playCue('UI_MOVE');
    }
    if (!actions.confirmPressed) return;
    if (this.inMenu) {
      this.unlockAudio('UI_CONFIRM');
      this.start('AUTHENTIC_ENDURANCE');
      return;
    }
    if (this.state.screen === 'PAUSED') {
      this.togglePause(false);
      this.audio.playCue('UI_CONFIRM');
    } else if (this.state.screen === 'VICTORY' || this.state.screen === 'GAME_OVER') {
      this.start(this.currentMode);
      this.audio.playCue('UI_CONFIRM');
    }
  }

  private updateVisualPresentation(now: number): void {
    let reveal = 1;
    if (this.visualMode === 'HYPER' && this.inMenu) {
      reveal = this.testRevealProgress ?? hyperRevealProgress(now - this.menuDemoStartedAt);
    }
    this.legacyAmount =
      this.visualMode === 'LEGACY' ? 1 : this.visualMode === 'HYPER' && this.inMenu ? 1 - reveal : 0;
    this.renderer.setVisualPresentation(this.visualMode, this.legacyAmount);
    const shell = requiredElement<HTMLElement>(this.root, '.game-shell');
    setStyleProperty(shell, '--legacy-amount', this.legacyAmount.toFixed(3));
    const transition = requiredElement<HTMLElement>(this.root, '[data-transition="era"]');
    setHidden(transition, !this.inMenu || this.visualMode !== 'HYPER' || reveal >= 0.999);
    setStyleProperty(transition, '--reveal-progress', `${Math.round(reveal * 100)}%`);
  }

  private recordFrame(delta: number): void {
    this.frameCounter += 1;
    this.frameAccumulator += delta;
    if (this.frameAccumulator >= 0.5) {
      this.measuredFps = Math.round(this.frameCounter / this.frameAccumulator);
      if (
        !this.testMode &&
        this.graphics.recordSample(this.measuredFps, this.frameAccumulator)
      ) {
        this.applyGraphicsProfile();
      }
      this.frameCounter = 0;
      this.frameAccumulator = 0;
    }
  }

  private syncView(): void {
    if (this.testMode) {
      this.canvas.dataset.gameState = JSON.stringify(serializeGameState(this.state));
    }

    setTextContent(requiredElement<HTMLElement>(this.root, '[data-hud="day"]'), String(this.state.day));
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="cars-left"]'),
      String(this.state.carsLeft),
    );
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="speed"]'),
      String(Math.round(this.state.speedKph)),
    );
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="distance"]'),
      (this.state.distanceMeters / 1000).toFixed(1),
    );
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="best"]'),
      String(this.state.bestDays),
    );
    setStyleProperty(
      requiredElement<HTMLElement>(this.root, '[data-hud="progress"]'),
      'width',
      `${(this.state.overtakes / this.state.target) * 100}%`,
    );
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="phase"]'),
      this.phaseLabel(this.state.phase),
    );
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="weather"]'),
      this.weatherLabel(this.state.weather),
    );

    const shell = requiredElement<HTMLElement>(this.root, '.game-shell');
    if (shell.dataset.phase !== this.state.phase) shell.dataset.phase = this.state.phase;
    if (shell.dataset.weather !== this.state.weather) shell.dataset.weather = this.state.weather;
    setStyleProperty(shell, '--weather-intensity', this.state.weatherIntensity.toFixed(3));

    const timer = requiredElement<HTMLElement>(this.root, '[data-hud="timer"]');
    setHidden(timer, this.state.mode !== 'POC_QUICK_RACE' || this.inMenu);
    if (Number.isFinite(this.state.remainingSeconds)) {
      const seconds = Math.ceil(this.state.remainingSeconds);
      setTextContent(
        timer,
        `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
      );
    }

    const goalToast = requiredElement<HTMLElement>(this.root, '.goal-toast');
    setHidden(goalToast, !this.state.goalReached || this.state.screen === 'VICTORY');
    const dayToast = requiredElement<HTMLElement>(this.root, '.day-toast');
    setHidden(dayToast, this.inMenu || this.state.newDayFeedbackSeconds <= 0);
    setTextContent(
      requiredElement<HTMLElement>(this.root, '[data-hud="new-day"]'),
      `${translate(this.language, 'day')} ${this.state.day}`,
    );

    if (!this.inMenu && (this.state.screen === 'VICTORY' || this.state.screen === 'GAME_OVER')) {
      const modal = requiredElement<HTMLElement>(this.root, '.result-modal');
      setHidden(modal, false);
      setTextContent(
        requiredElement<HTMLElement>(modal, '[data-result="kicker"]'),
        this.state.screen === 'VICTORY' ? 'TARGET / COMPLETE' : 'TARGET / MISSED',
      );
      setTextContent(
        requiredElement<HTMLElement>(modal, '[data-result="title"]'),
        translate(
          this.language,
          this.state.screen === 'VICTORY'
            ? 'victory'
            : this.state.failureReason === 'DAILY_TARGET_MISSED'
              ? 'dayGoalMissed'
              : 'timeOver',
        ),
      );
      setTextContent(
        requiredElement<HTMLElement>(modal, '[data-result="summary"]'),
        this.resultSummary(),
      );
      requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'false';
      this.activateModal(modal, '[data-action="restart"]', false);
    }
    this.syncDiagnostics();
  }

  private syncDiagnostics(): void {
    if (!this.diagnosticsVisible) return;
    const set = (name: string, value: string): void => {
      setTextContent(requiredElement<HTMLElement>(this.root, `[data-diagnostic="${name}"]`), value);
    };
    set('fps', `${this.measuredFps} FPS`);
    set('frame', `${(1000 / Math.max(1, this.measuredFps)).toFixed(1)} MS`);
    set('internal', `${this.canvas.width} × ${this.canvas.height}`);
    set(
      'profile',
      this.graphics.selection === 'AUTO'
        ? `AUTO → ${this.graphics.activeProfile}`
        : this.graphics.activeProfile,
    );
    set('traffic', `${this.state.traffic.length} ACTIVE`);
    const settings = GRAPHICS_PROFILES[this.graphics.activeProfile];
    set(
      'effects',
      `${Math.round(settings.particleScale * 100)}% · ${this.canvas.dataset.visibleTraffic ?? '0'}/${settings.maxVisibleTraffic} VISIBLE · ${this.canvas.dataset.highDetailVehicles ?? '0'}/${settings.highDetailVehicles} HQ`,
    );
    set(
      'weather',
      this.state.weather === 'CLEAR'
        ? `CLEAR / ${Math.round(this.state.visibilityDistance)} M`
        : `${this.state.weather} ${Math.round(this.state.weatherIntensity * 100)}% / ${Math.round(this.state.visibilityDistance)} M`,
    );
    set('phase', this.state.phase);
    set('speed', `${Math.round(this.state.speedKph)} KM/H`);
    set('distance', `${(this.state.distanceMeters / 1000).toFixed(2)} KM`);
    set('counter', `${this.state.carsLeft} / ${this.state.target}`);
    const daySecondsLeft =
      this.state.mode === 'POC_QUICK_RACE'
        ? this.state.remainingSeconds
        : Math.max(0, this.state.dayDurationSeconds - this.state.dayElapsedSeconds);
    set('day-clock', `${Math.ceil(daySecondsLeft)} S`);
    const difficulty = difficultyForDay(this.state.day);
    set('difficulty', `L${difficulty.level} / +${difficulty.trafficSpeedBonusKph.toFixed(0)} KM/H`);
    const assets = this.renderer.assetStats();
    set(
      'assets',
      `${assets.loaded}/${assets.total} · ${(assets.encodedBytes / 1024).toFixed(0)} KB · ${assets.decodedMegabytes.toFixed(1)} MB RAM`,
    );
    set('audio', this.audio.status);
    set('gamepad', this.gamepadConnected ? `CONNECTED · ${this.gamepadLabel.slice(0, 24)}` : 'NONE');
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    set(
      'pwa',
      standalone
        ? 'INSTALLED'
        : 'serviceWorker' in navigator && navigator.serviceWorker.controller
          ? 'OFFLINE READY'
          : 'AVAILABLE',
    );
  }

  private updateLanguage(): void {
    document.documentElement.lang = this.language === 'pt' ? 'pt-BR' : 'en';
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-i18n]')) {
      setTextContent(element, translate(this.language, element.dataset.i18n as TranslationKey));
    }
    this.syncAudioControls();
    this.syncFullscreenButton();
    this.syncView();
  }

  private phaseLabel(phase: DayPhase): string {
    const keys: Record<DayPhase, TranslationKey> = {
      DAWN: 'dawn',
      MORNING: 'morning',
      DAY: 'dayPhase',
      SUNSET: 'sunset',
      DUSK: 'dusk',
      NIGHT: 'night',
      LATE_NIGHT: 'lateNight',
    };
    return translate(this.language, keys[phase]);
  }

  private weatherLabel(weather: Weather): string {
    if (weather === 'CLEAR') return translate(this.language, 'clear');
    return translate(this.language, weather === 'FOG' ? 'fog' : 'ice');
  }

  private resultSummary(): string {
    const distance = (this.state.distanceMeters / 1000).toFixed(1);
    if (this.language === 'pt') {
      return `${this.state.completedDays} dias sobrevividos · ${this.state.totalOvertakes} ultrapassagens · ${distance} km`;
    }
    return `${this.state.completedDays} days survived · ${this.state.totalOvertakes} overtakes · ${distance} km`;
  }

  private installTestContract(): void {
    window.__roadEnduranceTest = {
      start: (mode, targetOverride) => this.start(mode, targetOverride),
      getState: () => serializeGameState(this.state),
      setInput: (input) => this.input.setTestInput(input),
      step: (seconds) => {
        this.handleGamepadActions(this.input.pollGamepad());
        this.updateVisualPresentation(performance.now());
        const frameCount = Math.max(1, Math.ceil(seconds / (1 / 60)));
        const dt = seconds / frameCount;
        for (let frame = 0; frame < frameCount; frame += 1) {
          this.simulation.update(this.input.state, dt);
        }
        this.audio.update(
          this.state,
          this.inMenu ? 'MENU' : this.state.screen === 'PAUSED' ? 'PAUSED' : 'DRIVE',
        );
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      placeVehicle: (options) => this.placeTestVehicle(options),
      setPhase: (phase) => {
        this.state.phase = phase;
        this.state.phaseProgress = 0.35;
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      setWeather: (weather) => {
        applyWeatherState(this.state, weather, weather === 'CLEAR' ? 0 : 1);
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      setDayProgress: (progress) => {
        const normalized = Math.max(0, Math.min(0.999, progress));
        if (this.state.mode === 'POC_QUICK_RACE') {
          this.state.elapsedSeconds = normalized * this.state.dayDurationSeconds;
          this.state.remainingSeconds = Math.max(
            0,
            this.state.dayDurationSeconds - this.state.elapsedSeconds,
          );
        } else {
          this.state.dayElapsedSeconds = normalized * this.state.dayDurationSeconds;
        }
        updateEnvironment(this.state);
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      forceCollision: () => {
        this.state.speedKph = 180;
        this.state.playerX = 0;
        this.placeTestVehicle({ z: 7, lateral: 0, speedKph: 0 });
        this.simulation.update({ accelerate: false, brake: false, steer: 0 }, 1 / 60);
        this.syncView();
      },
      completeGoal: () => {
        const missingOvertakes = Math.max(0, this.state.target - this.state.overtakes);
        this.state.totalOvertakes += missingOvertakes;
        this.state.overtakes = this.state.target;
        this.state.carsLeft = 0;
        this.state.goalReached = true;
        if (this.state.mode === 'POC_QUICK_RACE') this.state.screen = 'VICTORY';
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      finishDay: () => {
        if (this.state.mode !== 'AUTHENTIC_ENDURANCE') return;
        this.state.dayElapsedSeconds = Math.max(0, this.state.dayDurationSeconds - 1 / 120);
        this.simulation.update({ accelerate: false, brake: false, steer: 0 }, 1 / 60);
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
      setGamepad: (state) => {
        this.input.setVirtualGamepad(state ?? undefined);
        this.handleGamepadActions(this.input.pollGamepad());
      },
      setVisualMode: (mode, revealProgress = 1) => {
        this.visualMode = mode;
        this.testRevealProgress = Math.max(0, Math.min(1, revealProgress));
        requiredElement<HTMLElement>(this.root, '.game-shell').dataset.visualMode = mode;
        requiredElement<HTMLSelectElement>(this.root, '[data-action="visual-mode"]').value = mode;
        this.updateVisualPresentation(performance.now());
        this.renderer.render(this.state, performance.now() / 1000);
      },
      getPlatformState: () => ({
        visualMode: this.visualMode,
        legacyAmount: Number(this.legacyAmount.toFixed(3)),
        audioStatus: this.audio.status,
        gamepadConnected: this.gamepadConnected,
        gamepadLabel: this.gamepadLabel,
        fullscreen: Boolean(document.fullscreenElement),
        graphicsSelection: this.graphics.selection,
        graphicsProfile: this.graphics.activeProfile,
      }),
      getAudioSettings: () => this.audio.settings,
      setAudioSettings: (settings) => {
        if (settings.master !== undefined) this.audio.setMaster(settings.master);
        if (settings.music !== undefined) this.audio.setMusic(settings.music);
        if (settings.effects !== undefined) this.audio.setEffects(settings.effects);
        if (settings.muted !== undefined && settings.muted !== this.audio.settings.muted) {
          this.audio.toggleMuted();
        }
        this.syncAudioControls();
      },
      setGraphicsProfile: (selection) => this.setGraphicsSelection(selection),
      recordPerformance: (fps, seconds) => {
        if (this.graphics.recordSample(fps, seconds)) this.applyGraphicsProfile();
        this.renderer.render(this.state, performance.now() / 1000);
        this.syncView();
      },
    };
  }

  private placeTestVehicle(options: { z: number; lateral?: number; speedKph?: number }): string {
    const vehicle = this.state.traffic[0];
    if (!vehicle) throw new Error('No traffic vehicle is available.');
    const testVehicle: Partial<TrafficVehicle> = {
      id: `test-${this.state.nextVehicleId++}`,
      z: options.z,
      previousZ: options.z,
      lateral: options.lateral ?? 0,
      preferredLane: options.lateral ?? 0,
      speedKph: options.speedKph ?? 0,
      counted: false,
      wasAhead: true,
      recycledDuringPass: false,
      collided: false,
    };
    Object.assign(vehicle, testVehicle);
    this.syncView();
    return vehicle.id;
  }
}
