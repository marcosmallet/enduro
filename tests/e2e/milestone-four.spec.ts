import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import { VISUAL_ASSET_MANIFEST } from '../../src/rendering/AssetLibrary';

async function waitForVisualAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
  await expect(page.locator('#game-canvas')).toHaveAttribute(
    'data-assets-loaded',
    String(Object.keys(VISUAL_ASSET_MANIFEST).length),
  );
}

test.describe('Milestone 4 generated visual pass', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForVisualAssets(page);
  });

  test('loads every optimized asset and exposes the final visual diagnostics', async ({ page }) => {
    for (const asset of Object.values(VISUAL_ASSET_MANIFEST)) {
      const response = await page.request.get(`/${asset.path}`);
      expect(response.ok(), asset.path).toBe(true);
      expect(response.headers()['content-type']).toContain('image/webp');
      expect(Number(response.headers()['content-length'])).toBe(asset.bytes);
    }

    await page.keyboard.press('F3');
    await expect(page.locator('[data-diagnostic="assets"]')).toContainText('7/7');
    await expect(page.locator('[data-diagnostic="assets"]')).toContainText('KB');
  });

  test('renders the generated vehicles, landscape and asphalt through key states', async ({ page }, testInfo) => {
    await page.locator('[data-mode="POC_QUICK_RACE"]').click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true, steer: -1 });
      contract.step(1.8);
      contract.setInput({ accelerate: false, steer: 0 });
      contract.setPhase('DAY');
      contract.setWeather('CLEAR');
    });

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-4/gameplay-day-1280x720.png' });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setPhase('NIGHT');
      contract.setWeather('CLEAR');
    });
    await expect(page.locator('.game-shell')).toHaveAttribute('data-phase', 'NIGHT');

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-4/gameplay-night-1280x720.png' });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.forceCollision();
    });
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-4/collision-sparks-1280x720.png' });
    }
  });

  test('keeps the visual menu readable on desktop and mobile landscape', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: 'ENDURO' })).toBeVisible();
    await expect(page.locator('.build-tag')).toHaveText('M6 · FINAL POC');
    await expect(page.locator('.mode-grid')).toBeVisible();

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-4/menu-1280x720.png' });
    }
  });
});
