import { AudioEngine, type AudioSettings } from './audio/AudioEngine';
import { BRANDING } from './config/runtimeBranding';
import {
  detectGraphicsProfile,
  GRAPHICS_PROFILES,
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

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const GRAPHICS_STORAGE_KEY = 'road-endurance-graphics-profile';

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
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
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
  private lastFrameTime = performance.now();
  private frameCounter = 0;
  private frameAccumulator = 0;
  private measuredFps = 60;
  private readonly testMode = new URLSearchParams(window.location.search).get('test') === '1';

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = this.createMarkup();
    this.canvas = requiredElement<HTMLCanvasElement>(root, '#game-canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    this.renderer.setGraphicsSettings(GRAPHICS_PROFILES[this.graphics.activeProfile]);
    this.input = new InputController(root);
    this.state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
    this.state.speedKph = 142;
    populateTraffic(this.state, GRAPHICS_PROFILES[this.graphics.activeProfile].maxTraffic);
    this.simulation = new Simulation(this.state);
    this.bindUi();
    this.applyBranding();
    this.updateLanguage();
    if (this.testMode) this.installTestContract();
    requestAnimationFrame(this.frame);
  }

  private createMarkup(): string {
    return `
      <main class="game-shell" data-visual-mode="HYPER">
        <canvas id="game-canvas" aria-label="Estrada de corrida vista por trás do carro"></canvas>
        <div class="vignette" aria-hidden="true"></div>
        <div class="film-grain" aria-hidden="true"></div>

        <section class="hud" aria-live="polite" hidden>
          <div class="hud-cluster hud-primary">
            <span class="hud-kicker" data-i18n="day">DIA</span>
            <strong class="hud-value" data-hud="day">1</strong>
          </div>
          <div class="hud-cluster hud-counter">
            <span class="hud-kicker" data-i18n="carsLeft">CARROS RESTANTES</span>
            <strong class="hud-value hud-value-large" data-hud="cars-left">20</strong>
            <div class="target-line"><span data-hud="progress"></span></div>
          </div>
          <div class="hud-cluster hud-metrics">
            <div><span data-i18n="speed">VELOCIDADE</span><strong><span data-hud="speed">0</span> <small>KM/H</small></strong></div>
            <div><span data-i18n="distance">DISTÂNCIA</span><strong><span data-hud="distance">0.0</span> <small>KM</small></strong></div>
            <div><span data-i18n="best">MELHOR</span><strong><span data-hud="best">0</span> <small data-i18n="daysUnit">DIAS</small></strong></div>
          </div>
          <div class="environment-chip"><span data-hud="phase">AMANHECER</span><i></i><span data-hud="weather">LIMPO</span></div>
          <div class="quick-timer" data-hud="timer" hidden>01:30</div>
        </section>

        <section class="menu" aria-labelledby="brand-title">
          <div class="menu-topline">
            <span class="eyebrow" data-brand="eyebrow"></span>
            <div class="menu-actions">
              <button class="text-button" type="button" data-action="language">PT / EN</button>
              <button class="text-button" type="button" data-action="audio-toggle" data-i18n="audio">ÁUDIO</button>
              <button class="text-button" type="button" data-action="install" data-i18n="install" hidden>INSTALAR</button>
              <button class="icon-button" type="button" data-action="fullscreen" aria-label="Tela cheia">⛶</button>
            </div>
          </div>
          <div class="title-lockup">
            <div class="speed-mark" aria-hidden="true"><i></i><i></i><i></i></div>
            <h1 id="brand-title" data-brand="name"></h1>
            <p class="subtitle" data-brand="subtitle"></p>
            <p class="legal" data-brand="legal"></p>
            <div class="era-transition" data-transition="era" aria-hidden="true">
              <span>LEGACY</span><div><i></i></div><span>HYPER REALISTIC</span>
            </div>
          </div>
          <div class="mode-grid">
            <button class="mode-card mode-card-primary" type="button" data-mode="AUTHENTIC_ENDURANCE">
              <span class="mode-index">01</span>
              <span><strong data-i18n="authentic"></strong><small data-i18n="authenticDetail"></small></span>
              <b aria-hidden="true">→</b>
            </button>
            <button class="mode-card" type="button" data-mode="POC_QUICK_RACE">
              <span class="mode-index">02</span>
              <span><strong data-i18n="quick"></strong><small data-i18n="quickDetail"></small></span>
              <b aria-hidden="true">→</b>
            </button>
          </div>
          <section class="audio-panel" aria-label="Controles de áudio" hidden>
            <div class="audio-panel-heading">
              <strong data-i18n="audio">ÁUDIO</strong>
              <button type="button" data-action="mute" data-i18n="mute">SILENCIAR</button>
            </div>
            <label><span data-i18n="masterVolume">GERAL</span><input type="range" min="0" max="100" step="1" data-audio="master"><output data-audio-value="master"></output></label>
            <label><span data-i18n="musicVolume">MÚSICA</span><input type="range" min="0" max="100" step="1" data-audio="music"><output data-audio-value="music"></output></label>
            <label><span data-i18n="effectsVolume">EFEITOS</span><input type="range" min="0" max="100" step="1" data-audio="effects"><output data-audio-value="effects"></output></label>
          </section>
          <div class="menu-footer">
            <label><span>VISUAL</span>
              <select data-action="visual-mode" aria-label="Modo visual">
                <option value="HYPER">HYPER REALISTIC</option>
                <option value="CINEMATIC">CINEMATIC</option>
                <option value="LEGACY">LEGACY</option>
              </select>
            </label>
            <label><span data-i18n="graphics">GRÁFICOS</span>
              <select data-action="graphics-profile" aria-label="Perfil gráfico">
                <option value="AUTO">AUTO</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>
            <span class="controls-hint" data-i18n="controls"></span>
            <span class="build-tag">M6 · FINAL POC</span>
          </div>
        </section>

        <section class="modal pause-modal" hidden aria-labelledby="pause-title">
          <span class="modal-kicker">SYSTEM / HOLD</span>
          <h2 id="pause-title" data-i18n="paused"></h2>
          <div class="modal-actions">
            <button type="button" data-action="continue" data-i18n="continue"></button>
            <button type="button" data-action="restart" data-i18n="restart"></button>
            <button type="button" data-action="mute" data-i18n="mute"></button>
            <button type="button" data-action="menu" data-i18n="menu"></button>
          </div>
        </section>

        <section class="modal result-modal" hidden aria-labelledby="result-title">
          <span class="modal-kicker" data-result="kicker">RUN COMPLETE</span>
          <h2 id="result-title" data-result="title"></h2>
          <p data-result="summary"></p>
          <div class="modal-actions">
            <button type="button" data-action="restart" data-i18n="restart"></button>
            <button type="button" data-action="menu" data-i18n="menu"></button>
          </div>
        </section>

        <aside class="diagnostics" hidden>
          <div><strong>F3 / DIAGNOSTICS</strong><span data-diagnostic="fps">60 FPS</span></div>
          <dl>
            <dt>FRAME</dt><dd data-diagnostic="frame">16.7 MS</dd>
            <dt>INTERNAL</dt><dd data-diagnostic="internal">1280 × 720</dd>
            <dt>PROFILE</dt><dd data-diagnostic="profile"></dd>
            <dt>TRAFFIC</dt><dd data-diagnostic="traffic"></dd>
            <dt>WEATHER</dt><dd data-diagnostic="weather"></dd>
            <dt>PHASE</dt><dd data-diagnostic="phase"></dd>
            <dt>SPEED</dt><dd data-diagnostic="speed"></dd>
            <dt>DISTANCE</dt><dd data-diagnostic="distance"></dd>
            <dt>DAILY COUNT</dt><dd data-diagnostic="counter"></dd>
            <dt>DAY CLOCK</dt><dd data-diagnostic="day-clock"></dd>
            <dt>DIFFICULTY</dt><dd data-diagnostic="difficulty"></dd>
            <dt>ASSETS</dt><dd data-diagnostic="assets">LOADING</dd>
            <dt>AUDIO</dt><dd data-diagnostic="audio">LOCKED</dd>
            <dt>GAMEPAD</dt><dd data-diagnostic="gamepad">NONE</dd>
            <dt>PWA</dt><dd data-diagnostic="pwa">INSTALLING</dd>
            <dt>EFFECTS</dt><dd data-diagnostic="effects">100%</dd>
          </dl>
        </aside>

        <div class="goal-toast" hidden><span>✓</span><strong data-i18n="goalComplete"></strong></div>
        <div class="day-toast" hidden>
          <span data-i18n="newDay">NOVO DIA</span>
          <strong data-hud="new-day">DIA 2</strong>
        </div>

        <div class="touch-controls" aria-label="Controles de toque">
          <div class="touch-steering">
            <button type="button" data-control="left" aria-label="Esquerda">←</button>
            <button type="button" data-control="right" aria-label="Direita">→</button>
          </div>
          <div class="touch-pedals">
            <button type="button" data-control="brake" data-i18n="touchBrake"></button>
            <button type="button" data-control="accelerate" data-i18n="touchGas"></button>
          </div>
        </div>
      </main>`;
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
        panel.hidden = !panel.hidden;
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
      requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]').hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = undefined;
      requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]').hidden = true;
    });
    window.addEventListener('keydown', (event) => {
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
        requiredElement<HTMLElement>(this.root, '.diagnostics').hidden = !this.diagnosticsVisible;
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
    button.textContent = active ? '×' : '⛶';
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
    const settings = GRAPHICS_PROFILES[this.graphics.activeProfile];
    this.renderer.setGraphicsSettings(settings);
    if (this.state.traffic.length > settings.maxTraffic) {
      this.state.traffic = [...this.state.traffic]
        .sort((first, second) => first.z - second.z)
        .slice(0, settings.maxTraffic);
    } else if (this.inMenu && this.state.traffic.length < settings.maxTraffic) {
      populateTraffic(this.state, settings.maxTraffic);
    }
  }

  private syncAudioControls(): void {
    const settings = this.audio.settings;
    for (const key of ['master', 'music', 'effects'] as const) {
      const percent = Math.round(settings[key] * 100);
      requiredElement<HTMLInputElement>(this.root, `[data-audio="${key}"]`).value = String(percent);
      requiredElement<HTMLOutputElement>(this.root, `[data-audio-value="${key}"]`).textContent = `${percent}%`;
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action="mute"]')) {
      button.textContent = translate(this.language, settings.muted ? 'unmute' : 'mute');
      button.setAttribute('aria-pressed', String(settings.muted));
    }
  }

  private async installPwa(): Promise<void> {
    if (!this.deferredInstallPrompt) return;
    const prompt = this.deferredInstallPrompt;
    await prompt.prompt();
    await prompt.userChoice;
    requiredElement<HTMLButtonElement>(this.root, '[data-action="install"]').hidden = true;
    this.deferredInstallPrompt = undefined;
  }

  private applyBranding(): void {
    requiredElement<HTMLElement>(this.root, '[data-brand="eyebrow"]').textContent = BRANDING.eyebrow;
    requiredElement<HTMLElement>(this.root, '[data-brand="name"]').textContent = BRANDING.logoText;
    requiredElement<HTMLElement>(this.root, '[data-brand="subtitle"]').textContent = BRANDING.subtitle;
    const legal = requiredElement<HTMLElement>(this.root, '[data-brand="legal"]');
    legal.textContent = BRANDING.legalNotice;
    legal.hidden = BRANDING.legalNotice.length === 0;
    document.title = `${BRANDING.name} — ${BRANDING.subtitle}`;
    document.documentElement.style.setProperty('--accent', BRANDING.colors.accent);
    document.documentElement.style.setProperty('--accent-warm', BRANDING.colors.accentWarm);
    document.documentElement.style.setProperty('--panel', BRANDING.colors.panel);
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', BRANDING.description);
  }

  private start(mode: GameMode, targetOverride?: number): void {
    this.currentMode = mode;
    this.input.reset();
    this.state = createGameState(mode, {
      seed: this.testMode ? 1983 : Date.now(),
      targetOverride,
    });
    updateEnvironment(this.state);
    populateTraffic(this.state, GRAPHICS_PROFILES[this.graphics.activeProfile].maxTraffic);
    this.simulation = new Simulation(this.state);
    this.audio.resetState(this.state);
    this.inMenu = false;
    this.updateVisualPresentation(performance.now());
    requiredElement<HTMLElement>(this.root, '.menu').hidden = true;
    requiredElement<HTMLElement>(this.root, '.hud').hidden = false;
    requiredElement<HTMLElement>(this.root, '.pause-modal').hidden = true;
    requiredElement<HTMLElement>(this.root, '.result-modal').hidden = true;
    requiredElement<HTMLElement>(this.root, '.audio-panel').hidden = true;
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'true';
    this.syncView();
  }

  private showMenu(): void {
    this.input.reset();
    this.inMenu = true;
    this.state = createGameState('POC_QUICK_RACE', { seed: 1983, targetOverride: 999 });
    this.state.speedKph = 142;
    updateEnvironment(this.state);
    populateTraffic(this.state, GRAPHICS_PROFILES[this.graphics.activeProfile].maxTraffic);
    this.simulation = new Simulation(this.state);
    this.audio.resetState(this.state);
    this.menuDemoStartedAt = performance.now();
    this.testRevealProgress = undefined;
    requiredElement<HTMLElement>(this.root, '.menu').hidden = false;
    requiredElement<HTMLElement>(this.root, '.hud').hidden = true;
    requiredElement<HTMLElement>(this.root, '.pause-modal').hidden = true;
    requiredElement<HTMLElement>(this.root, '.result-modal').hidden = true;
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'false';
  }

  private togglePause(paused: boolean): void {
    if (this.inMenu || this.state.screen === 'VICTORY' || this.state.screen === 'GAME_OVER') return;
    this.state.screen = paused ? 'PAUSED' : 'PLAYING';
    this.input.reset();
    requiredElement<HTMLElement>(this.root, '.pause-modal').hidden = !paused;
    requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = paused ? 'false' : 'true';
    this.syncView();
  }

  private readonly frame = (now: number): void => {
    const delta = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const gamepadActions = this.input.pollGamepad();
    this.handleGamepadActions(gamepadActions);
    this.updateVisualPresentation(now);
    if (!this.testMode) {
      if (this.inMenu) this.simulation.update({ accelerate: true, brake: false, steer: Math.sin(now / 1800) * 0.4 }, delta);
      else this.simulation.update(this.input.state, delta);
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
    shell.style.setProperty('--legacy-amount', this.legacyAmount.toFixed(3));
    const transition = requiredElement<HTMLElement>(this.root, '[data-transition="era"]');
    transition.hidden = !this.inMenu || this.visualMode !== 'HYPER' || reveal >= 0.999;
    transition.style.setProperty('--reveal-progress', `${Math.round(reveal * 100)}%`);
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
    const serialized = serializeGameState(this.state);
    if (this.testMode) this.canvas.dataset.gameState = JSON.stringify(serialized);
    requiredElement<HTMLElement>(this.root, '[data-hud="day"]').textContent = String(this.state.day);
    requiredElement<HTMLElement>(this.root, '[data-hud="cars-left"]').textContent = String(this.state.carsLeft);
    requiredElement<HTMLElement>(this.root, '[data-hud="speed"]').textContent = String(Math.round(this.state.speedKph));
    requiredElement<HTMLElement>(this.root, '[data-hud="distance"]').textContent = (this.state.distanceMeters / 1000).toFixed(1);
    requiredElement<HTMLElement>(this.root, '[data-hud="best"]').textContent = String(this.state.bestDays);
    requiredElement<HTMLElement>(this.root, '[data-hud="progress"]').style.width = `${(this.state.overtakes / this.state.target) * 100}%`;
    requiredElement<HTMLElement>(this.root, '[data-hud="phase"]').textContent = this.phaseLabel(this.state.phase);
    requiredElement<HTMLElement>(this.root, '[data-hud="weather"]').textContent = this.weatherLabel(this.state.weather);
    const shell = requiredElement<HTMLElement>(this.root, '.game-shell');
    shell.dataset.phase = this.state.phase;
    shell.dataset.weather = this.state.weather;
    shell.style.setProperty('--weather-intensity', this.state.weatherIntensity.toFixed(3));
    const timer = requiredElement<HTMLElement>(this.root, '[data-hud="timer"]');
    timer.hidden = this.state.mode !== 'POC_QUICK_RACE' || this.inMenu;
    if (Number.isFinite(this.state.remainingSeconds)) {
      const seconds = Math.ceil(this.state.remainingSeconds);
      timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }

    const goalToast = requiredElement<HTMLElement>(this.root, '.goal-toast');
    goalToast.hidden = !this.state.goalReached || this.state.screen === 'VICTORY';
    const dayToast = requiredElement<HTMLElement>(this.root, '.day-toast');
    dayToast.hidden = this.inMenu || this.state.newDayFeedbackSeconds <= 0;
    requiredElement<HTMLElement>(this.root, '[data-hud="new-day"]').textContent =
      `${translate(this.language, 'day')} ${this.state.day}`;

    if (!this.inMenu && (this.state.screen === 'VICTORY' || this.state.screen === 'GAME_OVER')) {
      const modal = requiredElement<HTMLElement>(this.root, '.result-modal');
      modal.hidden = false;
      requiredElement<HTMLElement>(modal, '[data-result="kicker"]').textContent =
        this.state.screen === 'VICTORY' ? 'TARGET / COMPLETE' : 'TARGET / MISSED';
      requiredElement<HTMLElement>(modal, '[data-result="title"]').textContent = translate(
        this.language,
        this.state.screen === 'VICTORY'
          ? 'victory'
          : this.state.failureReason === 'DAILY_TARGET_MISSED'
            ? 'dayGoalMissed'
            : 'timeOver',
      );
      requiredElement<HTMLElement>(modal, '[data-result="summary"]').textContent = this.resultSummary();
      requiredElement<HTMLElement>(this.root, '.touch-controls').dataset.active = 'false';
    }
    this.syncDiagnostics();
  }

  private syncDiagnostics(): void {
    if (!this.diagnosticsVisible) return;
    const set = (name: string, value: string): void => {
      requiredElement<HTMLElement>(this.root, `[data-diagnostic="${name}"]`).textContent = value;
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
      element.textContent = translate(this.language, element.dataset.i18n as TranslationKey);
    }
    this.syncAudioControls();
    this.syncFullscreenButton();
    this.syncView();
  }

  private phaseLabel(phase: DayPhase): string {
    const keys: Record<DayPhase, TranslationKey> = {
      DAWN: 'dawn', MORNING: 'morning', DAY: 'dayPhase', SUNSET: 'sunset', DUSK: 'dusk', NIGHT: 'night', LATE_NIGHT: 'lateNight',
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
        for (let frame = 0; frame < frameCount; frame += 1) this.simulation.update(this.input.state, dt);
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
