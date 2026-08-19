import { expect, test } from '@playwright/test';
import type { TestContract } from '../../src/GameController';

test.describe('Accessible gameplay status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
  });

  test('keeps high-frequency HUD metrics outside automatic live regions', async ({ page }) => {
    await expect(page.locator('.hud')).not.toHaveAttribute('aria-live');

    const liveRegionOwnership = await page.evaluate(() => {
      const speed = document.querySelector<HTMLElement>('[data-hud="speed"]');
      const distance = document.querySelector<HTMLElement>('[data-hud="distance"]');
      const carsLeft = document.querySelector<HTMLElement>('[data-hud="cars-left"]');
      return {
        speed: speed?.closest('[aria-live]') !== null,
        distance: distance?.closest('[aria-live]') !== null,
        carsLeft: carsLeft?.closest('[aria-live]') !== null,
      };
    });

    expect(liveRegionOwnership).toEqual({ speed: false, distance: false, carsLeft: false });

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('POC_QUICK_RACE');
      contract.setInput({ accelerate: true, brake: false, steer: 0 });
      contract.step(2);
    });

    await expect(page.locator('[data-hud="speed"]')).not.toHaveText('0');
    await expect(page.locator('[data-hud="distance"]')).not.toHaveText('0.0');
    await expect(page.locator('.hud')).not.toHaveAttribute('aria-live');
  });

  test('exposes only discrete localized gameplay states as polite atomic status', async ({ page }) => {
    const discreteRegions = ['.pause-modal', '.result-modal', '.goal-toast', '.day-toast'];
    for (const selector of discreteRegions) {
      const region = page.locator(selector);
      await expect(region).toHaveAttribute('role', 'status');
      await expect(region).toHaveAttribute('aria-live', 'polite');
      await expect(region).toHaveAttribute('aria-atomic', 'true');
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('.pause-modal')).toBeVisible();
    await expect(page.locator('#pause-title')).toHaveText('PAUSADO');

    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.completeGoal();
    });
    await expect(page.locator('.goal-toast')).toBeVisible();
    await expect(page.locator('.goal-toast')).toContainText('META CONCLUÍDA');

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.finishDay();
    });
    await expect(page.locator('.day-toast')).toBeVisible();
    await expect(page.locator('.day-toast')).toContainText('NOVO DIA');
    await expect(page.locator('[data-hud="new-day"]')).toHaveText('DIA 2');
  });

  test('keeps discrete status localization on the existing i18n path', async ({ page }) => {
    await page.locator('[data-action="language"]').click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
    });

    await page.keyboard.press('Escape');
    await expect(page.locator('#pause-title')).toHaveText('PAUSED');
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.completeGoal();
    });
    await expect(page.locator('.goal-toast')).toContainText('GOAL COMPLETE');

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.finishDay();
    });
    await expect(page.locator('.day-toast')).toContainText('NEW DAY');
    await expect(page.locator('[data-hud="new-day"]')).toHaveText('DAY 2');
  });
});
