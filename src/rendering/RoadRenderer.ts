import {
  GRAPHICS_PROFILES,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  ROAD_VISIBLE_DISTANCE,
} from '../config/game';
import type { GraphicsSettings } from '../config/game';
import type { GameState } from '../game/types';
import type { AssetLibrary } from './AssetLibrary';
import { mixSceneColor, scenePaletteForPhase } from './palette';
import { projectRoadPoint } from './projection';

export class RoadRenderer {
  private asphaltPattern?: CanvasPattern;
  private legacyAmount = 0;
  private graphics = GRAPHICS_PROFILES.HIGH;

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly assets: AssetLibrary,
  ) {}

  setLegacyAmount(legacyAmount: number): void {
    this.legacyAmount = Math.max(0, Math.min(1, legacyAmount));
  }

  setGraphicsSettings(settings: GraphicsSettings): void {
    this.graphics = settings;
  }

  render(state: GameState): void {
    const ctx = this.context;
    const palette = scenePaletteForPhase(state.phase, state.phaseProgress);
    const iceIntensity = state.weather === 'ICE' ? state.weatherIntensity : 0;
    const road = mixSceneColor(palette.road, '#a9c1c8', iceIntensity * 0.72);
    const roadAlt = mixSceneColor(palette.roadAlt, '#819da8', iceIntensity * 0.68);
    const roadLine = mixSceneColor(palette.roadLine, '#e9fbff', iceIntensity * 0.65);
    const segmentLength = 7;
    const scroll = state.distanceMeters % (segmentLength * 2);

    for (let farZ = ROAD_VISIBLE_DISTANCE; farZ > 0; farZ -= segmentLength) {
      const nearZ = Math.max(0, farZ - segmentLength);
      const far = projectRoadPoint(farZ, 0, state.distanceMeters);
      const near = projectRoadPoint(nearZ, 0, state.distanceMeters);
      const band = Math.floor((farZ + scroll) / segmentLength);

      ctx.fillStyle = band % 2 === 0 ? palette.ground : palette.groundAlt;
      ctx.fillRect(0, far.y, LOGICAL_WIDTH, Math.max(1.5, near.y - far.y + 1));

      const shoulderFar = far.roadHalfWidth * 1.07;
      const shoulderNear = near.roadHalfWidth * 1.07;
      this.fillQuad(
        far.centerX - shoulderFar,
        far.y,
        far.centerX + shoulderFar,
        far.y,
        near.centerX + shoulderNear,
        near.y,
        near.centerX - shoulderNear,
        near.y,
        band % 2 === 0
          ? mixSceneColor('#d9d5c8', '#c8e2e8', iceIntensity * 0.7)
          : mixSceneColor('#b64c43', '#7fa1ad', iceIntensity * 0.75),
      );

      this.fillQuad(
        far.centerX - far.roadHalfWidth,
        far.y,
        far.centerX + far.roadHalfWidth,
        far.y,
        near.centerX + near.roadHalfWidth,
        near.y,
        near.centerX - near.roadHalfWidth,
        near.y,
        band % 2 === 0 ? road : roadAlt,
      );

      if (band % 3 !== 0) {
        for (const lane of [-0.5, 0, 0.5]) {
          const lineWidthFar = Math.max(0.6, far.scale * 4.5);
          const lineWidthNear = Math.max(0.8, near.scale * 5.5);
          const farX = far.centerX + lane * far.roadHalfWidth;
          const nearX = near.centerX + lane * near.roadHalfWidth;
          this.fillQuad(
            farX - lineWidthFar,
            far.y,
            farX + lineWidthFar,
            far.y,
            nearX + lineWidthNear,
            near.y,
            nearX - lineWidthNear,
            near.y,
            `${roadLine}bd`,
          );
        }
      }
    }

    this.drawRoadTexture(state, iceIntensity);
  }

  private drawRoadTexture(state: GameState, iceIntensity: number): void {
    if (this.legacyAmount >= 0.58 || !this.graphics.roadTexture) return;
    const texture = this.assets.get('asphalt');
    if (!texture) return;
    this.asphaltPattern ??= this.context.createPattern(texture, 'repeat') ?? undefined;
    if (!this.asphaltPattern) return;

    const ctx = this.context;
    ctx.save();
    ctx.beginPath();
    for (let z = ROAD_VISIBLE_DISTANCE; z >= 0; z -= 14) {
      const point = projectRoadPoint(z, -1, state.distanceMeters);
      ctx.lineTo(point.x, point.y);
    }
    for (let z = 0; z <= ROAD_VISIBLE_DISTANCE; z += 14) {
      const point = projectRoadPoint(z, 1, state.distanceMeters);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.clip();
    const scroll = (state.distanceMeters * 0.72) % texture.naturalHeight;
    ctx.translate(0, scroll);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.095 * (1 - iceIntensity * 0.72);
    ctx.fillStyle = this.asphaltPattern;
    ctx.fillRect(
      0,
      -texture.naturalHeight - scroll,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT + texture.naturalHeight,
    );
    ctx.restore();
  }

  private fillQuad(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    color: string,
  ): void {
    const ctx = this.context;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }
}
