export function createGameMarkup(): string {
  return `
    <main class="game-shell" data-visual-mode="HYPER">
      <canvas id="game-canvas" aria-label="Estrada de corrida vista por trás do carro"></canvas>
      <div class="vignette" aria-hidden="true"></div>
      <div class="film-grain" aria-hidden="true"></div>

      <section class="hud" hidden>
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
          <span class="controls-hint controls-hint-desktop" data-i18n="controls"></span>
          <span class="controls-hint controls-hint-touch" data-i18n="controlsTouch"></span>
          <span class="build-tag">M6 · FINAL POC</span>
        </div>
        <style>
          .controls-hint-touch { display: none; }
          @media (pointer: coarse) {
            .controls-hint-desktop { display: none; }
            .controls-hint-touch { display: inline; }
          }
        </style>
      </section>

      <section class="modal pause-modal" hidden aria-labelledby="pause-title" role="status" aria-live="polite" aria-atomic="true">
        <span class="modal-kicker">SYSTEM / HOLD</span>
        <h2 id="pause-title" data-i18n="paused"></h2>
        <div class="modal-actions">
          <button type="button" data-action="continue" data-i18n="continue"></button>
          <button type="button" data-action="restart" data-i18n="restart"></button>
          <button type="button" data-action="mute" data-i18n="mute"></button>
          <button type="button" data-action="menu" data-i18n="menu"></button>
        </div>
      </section>

      <section class="modal result-modal" hidden aria-labelledby="result-title" role="status" aria-live="polite" aria-atomic="true">
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

      <div class="goal-toast" hidden role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true">✓</span><strong data-i18n="goalComplete"></strong></div>
      <div class="day-toast" hidden role="status" aria-live="polite" aria-atomic="true">
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
