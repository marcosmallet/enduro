import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';

const runtimeEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

type CanonicalScene =
  | 'dawn'
  | 'day'
  | 'sunset'
  | 'night'
  | 'fog'
  | 'ice'
  | 'collision'
  | 'goal'
  | 'new-day'
  | 'game-over';

async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
}

async function setCanonicalScene(page: Page, scene: CanonicalScene): Promise<void> {
  await page.evaluate((requestedScene) => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');

    contract.start('AUTHENTIC_ENDURANCE');
    contract.setWeather('CLEAR');
    if (requestedScene === 'dawn') contract.setPhase('DAWN');
    if (requestedScene === 'day') contract.setPhase('DAY');
    if (requestedScene === 'sunset') contract.setPhase('SUNSET');
    if (requestedScene === 'night') contract.setPhase('NIGHT');
    if (requestedScene === 'fog') {
      contract.setPhase('DAY');
      contract.setWeather('FOG');
    }
    if (requestedScene === 'ice') {
      contract.setPhase('DAY');
      contract.setWeather('ICE');
    }
    if (requestedScene === 'collision') {
      contract.setPhase('DAY');
      contract.forceCollision();
      contract.step(1 / 120);
    }
    if (requestedScene === 'goal') {
      contract.setPhase('DAY');
      contract.completeGoal();
    }
    if (requestedScene === 'new-day') {
      contract.setPhase('DAY');
      contract.completeGoal();
      contract.finishDay();
    }
    if (requestedScene === 'game-over') {
      contract.setPhase('SUNSET');
      contract.finishDay();
    }
  }, scene);
}

test.describe('Milestone 6 optimization and final validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForAssets(page);
  });

  test('enforces graphics budgets without changing simulation density', async ({ page }) => {
    await page.locator('[data-action="graphics-profile"]').selectOption('HIGH');
    const highTrafficCount = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
      contract.step(0.1);
      return contract.getState().trafficCount;
    });

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toHaveAttribute('data-graphics-profile', 'HIGH');
    const highBudget = await canvas.evaluate((element) => ({
      visible: Number((element as HTMLCanvasElement).dataset.visibleTraffic),
      detailed: Number((element as HTMLCanvasElement).dataset.highDetailVehicles),
    }));
    expect(highBudget.visible).toBeLessThanOrEqual(8);
    expect(highBudget.detailed).toBeLessThanOrEqual(3);
    expect(highTrafficCount).toBe(10);

    const lowTrafficCount = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setGraphicsProfile('LOW');
      return contract.getState().trafficCount;
    });
    await expect(canvas).toHaveAttribute('data-graphics-profile', 'LOW');
    expect(lowTrafficCount).toBe(highTrafficCount);

    const platform = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.recordPerformance(12, 20);
      return contract.getPlatformState();
    });
    expect(platform.graphicsSelection).toBe('LOW');
    expect(platform.graphicsProfile).toBe('LOW');

    await page.keyboard.press('F3');
    await expect(page.locator('[data-diagnostic="internal"]')).toHaveText('1280 × 720');
    await expect(page.locator('[data-diagnostic="profile"]')).toHaveText('LOW');
    await expect(page.locator('[data-diagnostic="traffic"]')).toHaveText('10 ACTIVE');
    await expect(page.locator('[data-diagnostic="effects"]')).toContainText('42%');
  });

  test('keeps the interface and fixed rear camera usable at the project viewport', async ({ page }, testInfo) => {
    await expect(page.locator('.build-tag')).toHaveText('M6 · FINAL POC');
    const viewportFit = await page.evaluate(() => {
      const visibleControls = [...document.querySelectorAll<HTMLElement>('.menu button, .menu select')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
        });
      const shell = document.querySelector<HTMLElement>('.game-shell')?.getBoundingClientRect();
      return {
        controlsFit: visibleControls.every(Boolean),
        shellWidth: Math.round(shell?.width ?? 0),
        shellHeight: Math.round(shell?.height ?? 0),
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    expect(viewportFit.controlsFit).toBe(true);
    expect(viewportFit.shellWidth).toBe(viewportFit.viewportWidth);
    expect(viewportFit.shellHeight).toBe(viewportFit.viewportHeight);
    if (testInfo.project.name === 'mobile-landscape' || testInfo.project.name === 'mobile-portrait') {
      await page.screenshot({ path: `.logs/milestone-6-${testInfo.project.name}-menu.png` });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('POC_QUICK_RACE');
      contract.setInput({ accelerate: true, steer: 0.5 });
      contract.step(1.2);
    });
    const state = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      return contract.getState();
    });
    expect(state.screen).toBe('PLAYING');
    expect(state.speedKph).toBeGreaterThan(0);
    expect(state.playerX).toBeGreaterThan(0);
    await expect(page.locator('#game-canvas')).toHaveAttribute('width', '1280');
    await expect(page.locator('#game-canvas')).toHaveAttribute('height', '720');
  });

  test('keeps the player car proportional to nearby traffic', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('POC_QUICK_RACE');
      contract.placeVehicle({ z: 7, lateral: 0.62, speedKph: 0 });
      contract.step(1 / 120);
    });

    const scale = await page.locator('#game-canvas').evaluate((element) => ({
      player: Number((element as HTMLCanvasElement).dataset.playerVisualWidth),
      nearestTraffic: Number((element as HTMLCanvasElement).dataset.nearestTrafficWidth),
    }));
    expect(scale.player).toBe(160);
    expect(scale.nearestTraffic).toBeGreaterThan(75);
    expect(scale.player / scale.nearestTraffic).toBeLessThan(2.1);
    if (
      testInfo.project.name === 'desktop-720p' ||
      testInfo.project.name === 'mobile-landscape' ||
      testInfo.project.name === 'mobile-portrait'
    ) {
      await page.screenshot({ path: `.logs/player-scale-${testInfo.project.name}.png` });
    }
  });

  test('adds bounded camera feedback and honors reduced motion', async ({ page }, testInfo) => {
    const driveAndRead = async () => {
      await page.evaluate(() => {
        const contract = (window as Window & { __roadEnduranceTest?: TestContract })
          .__roadEnduranceTest;
        if (!contract) throw new Error('Test contract was not installed.');
        contract.start('POC_QUICK_RACE');
        contract.setInput({ accelerate: true, steer: 0.72 });
        contract.step(2.5);
      });
      const beforeCollision = await page.locator('#game-canvas').evaluate((element) => ({
        streaks: Number((element as HTMLCanvasElement).dataset.speedStreaks),
      }));
      await page.evaluate(() => {
        const contract = (window as Window & { __roadEnduranceTest?: TestContract })
          .__roadEnduranceTest;
        if (!contract) throw new Error('Test contract was not installed.');
        contract.forceCollision();
        contract.step(1 / 120);
      });
      const camera = await page.locator('#game-canvas').evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        return {
          roll: Number(canvas.dataset.cameraRoll),
          bob: Number(canvas.dataset.cameraBob),
          lean: Number(canvas.dataset.playerLean),
          kick: Number(canvas.dataset.cameraKick),
          motionScale: Number(canvas.dataset.motionScale),
          reducedMotion: canvas.dataset.reducedMotion,
        };
      });
      return { beforeCollision, camera };
    };

    const regular = await driveAndRead();
    expect(regular.beforeCollision.streaks).toBeGreaterThan(0);
    expect(Math.abs(regular.camera.roll)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(regular.camera.bob)).toBeLessThanOrEqual(4);
    expect(Math.abs(regular.camera.lean)).toBeLessThanOrEqual(0.045);
    expect(Math.abs(regular.camera.kick)).toBeLessThanOrEqual(4);
    expect(regular.camera.motionScale).toBe(1);
    expect(regular.camera.reducedMotion).toBe('false');
    if (testInfo.project.name === 'desktop-720p' || testInfo.project.name === 'mobile-landscape') {
      await page.screenshot({ path: `.logs/camera-feedback-${testInfo.project.name}.png` });
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await waitForAssets(page);
    const reduced = await driveAndRead();
    expect(reduced.camera.motionScale).toBeCloseTo(0.18, 2);
    expect(reduced.camera.reducedMotion).toBe('true');
    expect(reduced.beforeCollision.streaks).toBeLessThan(regular.beforeCollision.streaks);
  });

  test('captures the ten canonical fidelity scenes', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-1080p') {
      await expect(page.locator('.build-tag')).toHaveText('M6 · FINAL POC');
      return;
    }

    const scenes: readonly CanonicalScene[] = [
      'dawn',
      'day',
      'sunset',
      'night',
      'fog',
      'ice',
      'collision',
      'goal',
      'new-day',
      'game-over',
    ];
    for (const [index, scene] of scenes.entries()) {
      await setCanonicalScene(page, scene);
      const filename = `${String(index + 1).padStart(2, '0')}-${scene}-1920x1080.png`;
      await page.screenshot({
        path:
          runtimeEnvironment?.UPDATE_CANONICAL_SCREENSHOTS === '1'
            ? `screenshots/milestone-6/${filename}`
            : testInfo.outputPath(filename),
      });
    }

    const gameOverState = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      return contract.getState();
    });
    expect(gameOverState.screen).toBe('GAME_OVER');
  });
});
