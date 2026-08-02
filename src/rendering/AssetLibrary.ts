export const VISUAL_ASSET_MANIFEST = {
  playerCenter: { path: 'assets/vehicles/player-car-center.webp', bytes: 39_256 },
  playerLeft: { path: 'assets/vehicles/player-car-left.webp', bytes: 41_794 },
  playerRight: { path: 'assets/vehicles/player-car-right.webp', bytes: 40_296 },
  trafficSedan: { path: 'assets/vehicles/traffic-sedan.webp', bytes: 27_826 },
  trafficTruck: { path: 'assets/vehicles/traffic-truck.webp', bytes: 28_252 },
  mountainPanorama: { path: 'assets/landscape/mountain-panorama.webp', bytes: 59_202 },
  asphalt: { path: 'assets/textures/asphalt.webp', bytes: 73_964 },
} as const;

export type VisualAssetName = keyof typeof VISUAL_ASSET_MANIFEST;

export interface AssetStats {
  loaded: number;
  total: number;
  encodedBytes: number;
  decodedMegabytes: number;
}

function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${relativePath}`;
}

export class AssetLibrary {
  private readonly images = new Map<VisualAssetName, HTMLImageElement>();
  readonly ready: Promise<void>;

  constructor(onSettled?: (stats: AssetStats) => void) {
    const entries = Object.entries(VISUAL_ASSET_MANIFEST) as Array<
      [VisualAssetName, (typeof VISUAL_ASSET_MANIFEST)[VisualAssetName]]
    >;
    this.ready = Promise.all(entries.map(([name, asset]) => this.load(name, asset.path))).then(
      () => {
        onSettled?.(this.stats());
      },
    );
  }

  get(name: VisualAssetName): HTMLImageElement | undefined {
    return this.images.get(name);
  }

  stats(): AssetStats {
    let decodedBytes = 0;
    for (const image of this.images.values()) {
      decodedBytes += image.naturalWidth * image.naturalHeight * 4;
    }
    return {
      loaded: this.images.size,
      total: Object.keys(VISUAL_ASSET_MANIFEST).length,
      encodedBytes: Object.values(VISUAL_ASSET_MANIFEST).reduce(
        (total, asset) => total + asset.bytes,
        0,
      ),
      decodedMegabytes: decodedBytes / (1024 * 1024),
    };
  }

  private load(name: VisualAssetName, relativePath: string): Promise<void> {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.addEventListener(
        'load',
        () => {
          this.images.set(name, image);
          resolve();
        },
        { once: true },
      );
      image.addEventListener('error', () => resolve(), { once: true });
      image.src = assetUrl(relativePath);
    });
  }
}
