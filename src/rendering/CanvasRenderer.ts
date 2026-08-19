import {
  ENVIRONMENT_RULES,
  GRAPHICS_PROFILES,
  HORIZON_Y,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  ROAD_VISIBLE_DISTANCE,
} from '../config/game';
import type { GraphicsSettings } from '../config/game';
import type { GameState, TrafficVehicle } from '../game/types';
import { AssetLibrary, type AssetStats, type VisualAssetName } from './AssetLibrary';
import { scenePaletteForPhase } from './palette';
import { projectRoadPoint } from './projection';
import { RoadRenderer } from './RoadRenderer';
import { collectVisibleTraffic } from './trafficVisibility';
import { legacyRenderSize, type VisualMode } from './visualModes';

const PLAYER_VISUAL_WIDTH = 160;
const PLAYER_VISUAL_HEIGHT = 94;

const SUN_PHASE_OFFSETS: Record<GameState['phase'], number> = {
  DAWN: 0.08,
  MORNING: 0.22,
  DAY: 0.48,
  SUNSET: 0.82,
  DUSK: 0.95,
  NIGHT: 1.2,
  LATE_NIGHT: -0.15,
};

const TRAFFIC_COLOR_FILTERS: Readonly<Record<string, string>> = {
  '#e8edf2': 'brightness(1.03) saturate(.7)',
  '#cf3348': 'sepia(.55) saturate(3.2) hue-rotate(305deg) brightness(.88)',
  '#f1a63b': 'sepia(.72) saturate(3.1) hue-rotate(350deg) brightness(.96)',
  '#347ea8': 'sepia(.4) saturate(2.4) hue-rotate(155deg) brightness(.84)',
  '#7f8b94': 'brightness(.78) saturate(.42)',
  '#6b527f': 'sepia(.38) saturate(1.8) hue-rotate(215deg) brightness(.72)',
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly assets: AssetLibrary;
  private readonly roadRenderer: RoadRenderer;
  private readonly visibleTraffic: TrafficVehicle[] = [];
  private readonly legacyCanvas = document.createElement('canvas');
  private readonly legacyContext: CanvasRenderingContext2D;
  private legacyAmount = 0;
  private graphics = GRAPHICS_PROFILES.HIGH;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is not available.');
    const legacyContext = this.legacyCanvas.getContext('2d', { alpha: false });
    if (!legacyContext) throw new Error('Legacy Canvas 2D is not available.');
    this.canvas = canvas;
    this.context = context;
    this.legacyContext = legacyContext;
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
    canvas.dataset.assetsReady = 'loading';
    this.assets = new AssetLibrary((stats) => {
      canvas.dataset.assetsReady = stats.loaded === stats.total ? 'true' : 'fallback';
      canvas.dataset.assetsLoaded = String(stats.loaded);
    });
    this.roadRenderer = new RoadRenderer(this.context, this.assets);
  }

  assetStats(): AssetStats {
    return this.assets.stats();
  }

  setVisualPresentation(mode: VisualMode, legacyAmount: number): void {
    this.legacyAmount = Math.max(0, Math.min(1, legacyAmount));
    this.roadRenderer.setLegacyAmount(this.legacyAmount);
    const size = legacyRenderSize(this.legacyAmount);
    this.canvas.dataset.renderMode = mode;
    this.canvas.dataset.legacyAmount = this.legacyAmount.toFixed(3);
    this.canvas.dataset.legacyResolution = `${size.width}x${size.height}`;
  }

  setGraphicsSettings(settings: GraphicsSettings): void {
    this.graphics = settings;
    this.roadRenderer.setGraphicsSettings(settings);
    this.canvas.dataset.graphicsProfile = settings.profile;
    this.canvas.dataset.particleScale = settings.particleScale.toFixed(2);
  }

  render(state: GameState, timeSeconds: number): void {
    const ctx = this.context;
    const palette = scenePaletteForPhase(state.phase, state.phaseProgress);
    ctx.save();
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.drawSky(state, timeSeconds);
    this.drawLandscape(state);
    this.roadRenderer.render(state);
    this.drawIceReflections(state, timeSeconds);
    this.drawRoadside(state);

    if (state.phase === 'NIGHT' || state.phase === 'LATE_NIGHT') {
      this.drawHeadlights(state);
    }

    const visibleTraffic = collectVisibleTraffic(
      state,
      this.graphics.maxVisibleTraffic,
      this.visibleTraffic,
    );
    this.canvas.dataset.visibleTraffic = String(visibleTraffic.length);
    let detailedNearVehicles = 0;
    let nearestTrafficWidth = 0;
    for (const vehicle of visibleTraffic) {
      const near = vehicle.z < 62;
      const detailed = !near || detailedNearVehicles < this.graphics.highDetailVehicles;
      if (near && detailed) detailedNearVehicles += 1;
      nearestTrafficWidth = this.drawTrafficVehicle(state, vehicle, detailed);
    }
    this.canvas.dataset.highDetailVehicles = String(detailedNearVehicles);
    this.canvas.dataset.nearestTrafficWidth = nearestTrafficWidth.toFixed(1);

    this.drawFog(state);
    this.drawPlayer(state, timeSeconds);
    this.drawCollisionSparks(state, timeSeconds);
    this.drawSpeedStreaks(state, timeSeconds);
    this.drawIceParticles(state, timeSeconds);

    if (state.collisionFlash > 0) {
      ctx.fillStyle = `rgba(255, 82, 70, ${Math.min(0.22, state.collisionFlash * 0.5)})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(2, 5, 8, ${Math.max(0, 1 - palette.exposure) * 0.2})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
    if (this.legacyAmount > 0.005) this.applyLegacyPass();
  }

  private drawSky(state: GameState, timeSeconds: number): void {
    const ctx = this.context;
    const palette = scenePaletteForPhase(state.phase, state.phaseProgress);
    const gradient = ctx.createLinearGradient(0, 0, 0, HORIZON_Y + 110);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, HORIZON_Y + 130);

    const sunProgress = SUN_PHASE_OFFSETS[state.phase] + state.phaseProgress * 0.12;
    const sunX = LOGICAL_WIDTH * (0.08 + sunProgress * 0.78);
    const sunY = HORIZON_Y - Math.sin(Math.max(0, Math.min(1, sunProgress)) * Math.PI) * 145;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 55);
    sunGlow.addColorStop(0, palette.sun);
    sunGlow.addColorStop(0.24, `${palette.sun}b8`);
    sunGlow.addColorStop(1, `${palette.sun}00`);
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 60, sunY - 60, 120, 120);

    if (state.phase === 'NIGHT' || state.phase === 'LATE_NIGHT') {
      ctx.fillStyle = '#d8e4ef';
      for (let index = 0; index < 38; index += 1) {
        const x = (index * 197 + 43) % LOGICAL_WIDTH;
        const y = 22 + ((index * 71) % 155);
        ctx.globalAlpha = 0.25 + 0.45 * ((Math.sin(timeSeconds * 1.7 + index) + 1) / 2);
        ctx.fillRect(x, y, index % 7 === 0 ? 2 : 1, index % 7 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      for (let index = 0; index < 18; index += 1) {
        const x = (index * 113 + 67) % LOGICAL_WIDTH;
        const y = HORIZON_Y + 8 + (index % 4) * 3;
        ctx.fillStyle = index % 3 === 0 ? '#ffb55f' : '#d3efff';
        ctx.globalAlpha = 0.22 + (index % 5) * 0.08;
        ctx.fillRect(x, y, index % 4 === 0 ? 3 : 2, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawLandscape(state: GameState): void {
    const ctx = this.context;
    const palette = scenePaletteForPhase(state.phase, state.phaseProgress);
    const parallax = state.distanceMeters * 0.012;
    ctx.fillStyle = palette.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y + 45);
    for (let x = 0; x <= LOGICAL_WIDTH; x += 80) {
      const y = HORIZON_Y - 24 - Math.sin(x * 0.012 + parallax * 0.12) * 35 - Math.sin(x * 0.027) * 13;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(LOGICAL_WIDTH, HORIZON_Y + 70);
    ctx.closePath();
    ctx.fill();

    const panorama = this.legacyAmount < 0.64 ? this.assets.get('mountainPanorama') : undefined;
    if (panorama) {
      const height = 170;
      const width = LOGICAL_WIDTH + 260;
      const offset = -(width - LOGICAL_WIDTH) / 2 + Math.sin(parallax * 0.022) * 42;
      ctx.save();
      ctx.globalAlpha = 0.58 + palette.exposure * 0.22;
      ctx.filter = `brightness(${0.42 + palette.exposure * 0.62}) saturate(${0.72 + palette.exposure * 0.3})`;
      ctx.drawImage(panorama, offset, HORIZON_Y - 91, width, height);
      ctx.restore();
    } else {
      ctx.fillStyle = palette.mountainNear;
      ctx.beginPath();
      ctx.moveTo(0, HORIZON_Y + 62);
      for (let x = 0; x <= LOGICAL_WIDTH; x += 54) {
        const y = HORIZON_Y + 12 - Math.sin(x * 0.019 + parallax * 0.2) * 22 - Math.cos(x * 0.041) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(LOGICAL_WIDTH, HORIZON_Y + 85);
      ctx.closePath();
      ctx.fill();
    }

    const haze = ctx.createLinearGradient(0, HORIZON_Y - 34, 0, HORIZON_Y + 54);
    haze.addColorStop(0, `${palette.haze}00`);
    haze.addColorStop(0.62, `${palette.haze}33`);
    haze.addColorStop(1, `${palette.haze}00`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON_Y - 36, LOGICAL_WIDTH, 95);
  }

  private drawRoadside(state: GameState): void {
    const ctx = this.context;
    const isNight = state.phase === 'NIGHT' || state.phase === 'LATE_NIGHT';
    const spacing = 32;
    const offset = state.distanceMeters % spacing;
    for (let z = ROAD_VISIBLE_DISTANCE - offset; z > 12; z -= spacing) {
      const side = Math.floor((z + offset) / spacing) % 2 === 0 ? -1 : 1;
      const point = projectRoadPoint(z, side * 1.2, state.distanceMeters);
      const height = Math.max(3, point.scale * 57);
      ctx.strokeStyle = isNight ? '#8998a0' : '#343b39';
      ctx.lineWidth = Math.max(1, point.scale * 3);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x, point.y - height);
      ctx.stroke();
      ctx.fillStyle = isNight ? '#d8f6ff' : '#d8d3b7';
      ctx.fillRect(point.x - height * 0.18, point.y - height, height * 0.36, height * 0.16);
      if (isNight) {
        ctx.fillStyle = 'rgba(150, 230, 255, .2)';
        ctx.beginPath();
        ctx.arc(point.x, point.y - height * 0.9, height * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawTrafficVehicle(state: GameState, vehicle: TrafficVehicle, detailed: boolean): number {
    const ctx = this.context;
    const point = projectRoadPoint(vehicle.z, vehicle.lateral, state.distanceMeters);
    const kindScale = vehicle.kind === 'TRUCK' ? 1.32 : vehicle.kind === 'VAN' ? 1.15 : 1;
    const width = Math.max(2, point.scale * 84 * kindScale);
    const assetName: VisualAssetName =
      vehicle.kind === 'TRUCK' || vehicle.kind === 'VAN' ? 'trafficTruck' : 'trafficSedan';
    const asset = detailed && this.legacyAmount < 0.62 ? this.assets.get(assetName) : undefined;
    const assetRatio = asset ? asset.naturalHeight / asset.naturalWidth : undefined;
    const height = Math.max(
      3,
      assetRatio ? width * assetRatio : point.scale * (vehicle.kind === 'TRUCK' ? 110 : 64),
    );
    const x = point.x - width / 2;
    const y = point.y - height;
    const isNight = state.phase === 'NIGHT' || state.phase === 'LATE_NIGHT';

    ctx.save();
    const fogDepth =
      state.weather === 'FOG'
        ? Math.max(
            0,
            Math.min(
              1,
              (vehicle.z - state.visibilityDistance * 0.24) /
                Math.max(1, state.visibilityDistance * 0.76),
            ),
          ) * state.weatherIntensity
        : 0;
    ctx.globalAlpha =
      (0.45 + point.scale * 0.55) *
      (1 - fogDepth * ENVIRONMENT_RULES.fogContrastLoss);
    if (this.graphics.shadows) {
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y - height * 0.03, width * 0.58, height * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (asset) {
      const dayFilter = this.trafficColorFilter(vehicle.color);
      ctx.filter = isNight ? 'brightness(.2) saturate(.65) contrast(1.15)' : dayFilter;
      ctx.drawImage(asset, x, y, width, height);
      ctx.filter = 'none';

      const isTruck = assetName === 'trafficTruck';
      const lightY = y + height * (isTruck ? 0.72 : 0.43);
      const lightWidth = Math.max(1.2, width * (isTruck ? 0.13 : 0.18));
      const lightHeight = Math.max(1, height * (isTruck ? 0.045 : 0.07));
      ctx.fillStyle = isNight ? '#ff2445' : 'rgba(255, 56, 74, .72)';
      if (isNight) {
        ctx.shadowColor = '#ff183c';
        ctx.shadowBlur = Math.max(3, width * 0.24);
      }
      ctx.fillRect(x + width * 0.12, lightY, lightWidth, lightHeight);
      ctx.fillRect(x + width * (isTruck ? 0.75 : 0.7), lightY, lightWidth, lightHeight);
      ctx.restore();
      return width;
    }

    roundedRect(ctx, x, y + height * 0.22, width, height * 0.74, Math.max(1, width * 0.13));
    ctx.fillStyle = isNight ? '#111820' : vehicle.color;
    ctx.fill();

    const cabinWidth = vehicle.kind === 'TRUCK' ? 0.82 : 0.65;
    roundedRect(
      ctx,
      point.x - (width * cabinWidth) / 2,
      y,
      width * cabinWidth,
      height * 0.5,
      Math.max(1, width * 0.1),
    );
    ctx.fillStyle = isNight ? '#0a1017' : '#22313e';
    ctx.fill();
    ctx.fillStyle = isNight ? '#ff314b' : '#ff5265';
    const lightWidth = Math.max(1.4, width * 0.17);
    const lightHeight = Math.max(1.2, height * 0.09);
    ctx.fillRect(x + width * 0.12, y + height * 0.65, lightWidth, lightHeight);
    ctx.fillRect(x + width * 0.71, y + height * 0.65, lightWidth, lightHeight);
    if (isNight && point.scale < 0.42) {
      ctx.shadowColor = '#ff203b';
      ctx.shadowBlur = Math.max(3, width * 0.22);
      ctx.fillRect(x + width * 0.12, y + height * 0.65, lightWidth, lightHeight);
      ctx.fillRect(x + width * 0.71, y + height * 0.65, lightWidth, lightHeight);
    }
    ctx.restore();
    return width;
  }

  private trafficColorFilter(color: string): string {
    return TRAFFIC_COLOR_FILTERS[color] ?? 'none';
  }

  private drawPlayer(state: GameState, timeSeconds: number): void {
    const ctx = this.context;
    const road = projectRoadPoint(0, state.playerX, state.distanceMeters);
    const speedRatio = state.speedKph / 228;
    const vibration = speedRatio > 0.7 ? Math.sin(timeSeconds * 45) * (speedRatio - 0.7) * 3 : 0;
    const collisionKick = state.collisionFlash > 0 ? Math.sin(timeSeconds * 80) * 6 : 0;
    const centerX = road.x + collisionKick;
    const baseY = LOGICAL_HEIGHT - 34 + vibration;
    const width = PLAYER_VISUAL_WIDTH;
    const height = PLAYER_VISUAL_HEIGHT;
    const x = centerX - width / 2;
    const y = baseY - height;
    this.canvas.dataset.playerVisualWidth = String(PLAYER_VISUAL_WIDTH);

    ctx.save();
    if (this.graphics.shadows) {
      ctx.fillStyle = 'rgba(0,0,0,.48)';
      ctx.beginPath();
      ctx.ellipse(centerX, baseY - 2, width * 0.57, height * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const pose: VisualAssetName =
      state.lateralVelocity < -0.055
        ? 'playerLeft'
        : state.lateralVelocity > 0.055
          ? 'playerRight'
          : 'playerCenter';
    const playerAsset = this.legacyAmount < 0.62 ? this.assets.get(pose) : undefined;
    if (playerAsset) {
      const assetWidth = PLAYER_VISUAL_WIDTH;
      const assetHeight = assetWidth * (playerAsset.naturalHeight / playerAsset.naturalWidth);
      ctx.translate(centerX, baseY);
      if (state.collisionFlash > 0) {
        ctx.rotate(Math.sin(timeSeconds * 62) * state.collisionFlash * 0.035);
      }
      const isNight = state.phase === 'NIGHT' || state.phase === 'LATE_NIGHT';
      ctx.filter = isNight ? 'brightness(.58) saturate(.82) contrast(1.06)' : 'none';
      ctx.drawImage(playerAsset, -assetWidth / 2, -assetHeight + 6, assetWidth, assetHeight);
      ctx.filter = 'none';
      if (isNight) {
        ctx.shadowColor = '#ff2048';
        ctx.shadowBlur = assetWidth * 0.069;
        ctx.fillStyle = '#ff3155';
        const lightWidth = assetWidth * 0.197;
        const lightHeight = assetWidth * 0.041;
        const lightY = -assetHeight * 0.37;
        ctx.fillRect(-assetWidth * 0.349, lightY, lightWidth, lightHeight);
        ctx.fillRect(assetWidth * 0.151, lightY, lightWidth, lightHeight);
      }
      ctx.restore();
      return;
    }

    const bodyGradient = ctx.createLinearGradient(x, y, x + width, baseY);
    bodyGradient.addColorStop(0, '#087c9c');
    bodyGradient.addColorStop(0.48, '#26d7f5');
    bodyGradient.addColorStop(1, '#075b78');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.042, baseY - height * 0.161);
    ctx.lineTo(x + width * 0.137, y + height * 0.304);
    ctx.quadraticCurveTo(centerX, y - height * 0.027, x + width * 0.863, y + height * 0.304);
    ctx.lineTo(x + width * 0.958, baseY - height * 0.161);
    ctx.quadraticCurveTo(centerX, baseY + height * 0.045, x + width * 0.042, baseY - height * 0.161);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#111a23';
    ctx.beginPath();
    ctx.moveTo(x + width * 0.253, y + height * 0.348);
    ctx.quadraticCurveTo(centerX, y + height * 0.089, x + width * 0.747, y + height * 0.348);
    ctx.lineTo(x + width * 0.826, y + height * 0.58);
    ctx.lineTo(x + width * 0.174, y + height * 0.58);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff3656';
    roundedRect(
      ctx,
      x + width * 0.126,
      baseY - height * 0.366,
      width * 0.221,
      height * 0.134,
      width * 0.026,
    );
    ctx.fill();
    roundedRect(
      ctx,
      x + width * 0.653,
      baseY - height * 0.366,
      width * 0.221,
      height * 0.134,
      width * 0.026,
    );
    ctx.fill();
    ctx.fillStyle = '#d8f7ff';
    ctx.fillRect(centerX - width * 0.1, baseY - height * 0.25, width * 0.2, height * 0.045);
    ctx.fillStyle = '#05080b';
    ctx.fillRect(x + width * 0.016, baseY - height * 0.277, width * 0.095, height * 0.241);
    ctx.fillRect(x + width * 0.889, baseY - height * 0.277, width * 0.095, height * 0.241);
    ctx.restore();
  }

  private drawCollisionSparks(state: GameState, timeSeconds: number): void {
    if (state.collisionFlash <= 0) return;
    const ctx = this.context;
    const center = projectRoadPoint(0, state.playerX, state.distanceMeters).x;
    const amount = Math.min(1, state.collisionFlash / 0.42);
    const particleCount = Math.max(6, Math.round(18 * this.graphics.particleScale));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < particleCount; index += 1) {
      const angle = -Math.PI * 0.85 + (index / Math.max(1, particleCount - 1)) * Math.PI * 0.7;
      const travel = (16 + (index % 6) * 7) * (1 - amount * 0.35);
      const flicker = 0.65 + Math.sin(timeSeconds * 80 + index * 2.3) * 0.25;
      const x = center + Math.cos(angle) * travel * (index % 2 === 0 ? -1 : 1);
      const y = LOGICAL_HEIGHT - 52 + Math.sin(angle) * travel;
      ctx.fillStyle = `rgba(255, ${130 + (index % 3) * 35}, 54, ${amount * flicker})`;
      ctx.fillRect(x, y, 2 + (index % 3), 1.5 + (index % 2));
    }
    ctx.restore();
  }

  private drawHeadlights(state: GameState): void {
    const ctx = this.context;
    const fogIntensity = state.weather === 'FOG' ? state.weatherIntensity : 0;
    const glow = ctx.createLinearGradient(0, LOGICAL_HEIGHT, 0, HORIZON_Y + 100);
    glow.addColorStop(0, `rgba(205, 238, 255, ${0.22 + fogIntensity * 0.08})`);
    glow.addColorStop(0.66, `rgba(190, 225, 255, ${0.06 + fogIntensity * 0.08})`);
    glow.addColorStop(1, 'rgba(180, 220, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(LOGICAL_WIDTH * 0.3, LOGICAL_HEIGHT);
    ctx.lineTo(LOGICAL_WIDTH * 0.47, HORIZON_Y + 105);
    ctx.lineTo(LOGICAL_WIDTH * 0.53, HORIZON_Y + 105);
    ctx.lineTo(LOGICAL_WIDTH * 0.7, LOGICAL_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  private drawFog(state: GameState): void {
    if (state.weather !== 'FOG' || state.weatherIntensity <= 0.01) return;
    const ctx = this.context;
    const palette = scenePaletteForPhase(state.phase, state.phaseProgress);
    const intensity = state.weatherIntensity;
    const fogStartY = HORIZON_Y - 90;
    const veil = ctx.createLinearGradient(0, fogStartY, 0, LOGICAL_HEIGHT);
    veil.addColorStop(0, `${palette.haze}00`);
    veil.addColorStop(0.2, `${palette.haze}${Math.round(150 * intensity).toString(16).padStart(2, '0')}`);
    veil.addColorStop(0.34, `${palette.haze}${Math.round(205 * intensity).toString(16).padStart(2, '0')}`);
    veil.addColorStop(0.64, `${palette.haze}${Math.round(36 * intensity).toString(16).padStart(2, '0')}`);
    veil.addColorStop(1, `${palette.haze}00`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, fogStartY, LOGICAL_WIDTH, LOGICAL_HEIGHT - fogStartY);

    ctx.fillStyle = `rgba(218, 231, 232, ${intensity * 0.055})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  private drawIceReflections(state: GameState, timeSeconds: number): void {
    if (state.weather !== 'ICE' || state.weatherIntensity <= 0.04) return;
    const ctx = this.context;
    const intensity = state.weatherIntensity;
    const reflectionCount = Math.max(5, Math.round(13 * this.graphics.particleScale));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < reflectionCount; index += 1) {
      const travel = (state.distanceMeters * 0.5 + timeSeconds * 7 + index * 23) % 210;
      const z = 18 + travel;
      const lateral = ((index * 47) % 160) / 100 - 0.8;
      const point = projectRoadPoint(z, lateral, state.distanceMeters);
      const length = Math.max(3, point.scale * (34 + (index % 4) * 9));
      ctx.strokeStyle = `rgba(198, 238, 255, ${intensity * (0.08 + (index % 3) * 0.035)})`;
      ctx.lineWidth = Math.max(0.7, point.scale * 2.6);
      ctx.beginPath();
      ctx.moveTo(point.x - length * 0.5, point.y);
      ctx.lineTo(point.x + length * 0.5, point.y + point.scale * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawIceParticles(state: GameState, timeSeconds: number): void {
    if (state.weather !== 'ICE' || state.weatherIntensity < 0.2 || state.speedKph < 30) return;
    const ctx = this.context;
    const intensity = state.weatherIntensity;
    const particleCount = Math.max(5, Math.round(14 * this.graphics.particleScale));
    ctx.save();
    for (let index = 0; index < particleCount; index += 1) {
      const progress = (timeSeconds * (0.6 + index * 0.025) + index * 0.113) % 1;
      const direction = index % 2 === 0 ? -1 : 1;
      const x = LOGICAL_WIDTH / 2 + direction * (105 + progress * (150 + index * 4));
      const y = LOGICAL_HEIGHT - 48 - progress * 105;
      ctx.fillStyle = `rgba(218, 246, 255, ${intensity * (1 - progress) * 0.42})`;
      ctx.fillRect(x, y, 2 + (index % 3), 1.5);
    }
    ctx.restore();
  }

  private drawSpeedStreaks(state: GameState, timeSeconds: number): void {
    if (state.speedKph < 150) return;
    const ctx = this.context;
    const intensity = (state.speedKph - 150) / 78;
    const streakCount = Math.max(6, Math.round(16 * this.graphics.particleScale));
    ctx.strokeStyle = `rgba(226, 246, 255, ${0.08 + intensity * 0.1})`;
    ctx.lineWidth = 2;
    for (let index = 0; index < streakCount; index += 1) {
      const direction = index % 2 === 0 ? -1 : 1;
      const progress = (timeSeconds * (1.4 + index * 0.03) + index * 0.19) % 1;
      const y = HORIZON_Y + 80 + progress * 360;
      const x = LOGICAL_WIDTH / 2 + direction * (280 + index * 18 + progress * 220);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + direction * (12 + intensity * 24), y + 24);
      ctx.stroke();
    }
  }

  private applyLegacyPass(): void {
    const size = legacyRenderSize(this.legacyAmount);
    if (this.legacyCanvas.width !== size.width || this.legacyCanvas.height !== size.height) {
      this.legacyCanvas.width = size.width;
      this.legacyCanvas.height = size.height;
    }
    const buffer = this.legacyContext;
    buffer.imageSmoothingEnabled = false;
    buffer.clearRect(0, 0, size.width, size.height);
    buffer.drawImage(this.canvas, 0, 0, size.width, size.height);

    const ctx = this.context;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.filter = `contrast(${1 + this.legacyAmount * 0.34}) saturate(${1 - this.legacyAmount * 0.48})`;
    ctx.drawImage(this.legacyCanvas, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(8, 29, 34, ${this.legacyAmount * 0.12})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }
}
