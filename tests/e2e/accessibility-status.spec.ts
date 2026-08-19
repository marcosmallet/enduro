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

  test('keeps passive feedback in polite status regions and interactive overlays as dialogs', async ({ page }) => {
    for (const selector of ['.goal-toast', '.day-toast']) {
      const region = page.locator(selector);
      await expect(region).toHaveAttribute('role', 'status');
      await expect(region).toHaveAttribute('aria-live', 'polite');
      await expect(region).toHaveAttribute('aria-atomic', 'true');
    }

    for (const selector of ['.pause-modal', '.result-modal']) {
      const dialog = page.locator(selector);
      await expect(dialog).toHaveAttribute('role', 'dialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(dialog).not.toHaveAttribute('aria-live');
      await expect(dialog).not.toHaveAttribute('aria-atomic');
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('.pause-modal')).toBeVisible();
    await expect(page.locator('.pause-modal')).toHaveAccessibleName('PAUSADO');

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

  test('contains pause focus and restores focus to the gameplay context on dismissal', async ({ page }) => {
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
    });
    await expect(page.locator('#game-canvas')).toBeFocused();

    await page.keyboard.press('Escape');
    const pause = page.locator('.pause-modal');
    const continueButton = pause.locator('[data-action="continue"]');
    const menuButton = pause.locator('[data-action="menu"]');
    await expect(pause).toBeVisible();
    await expect(continueButton).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(continueButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
    await expect(page.locator('#game-canvas')).toBeFocused();
  });

  test('focuses and contains the result dialog with localized accessible naming', async ({ page }) => {
    await page.locator('[data-action="language"]').click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('POC_QUICK_RACE');
      contract.completeGoal();
    });

    const result = page.locator('.result-modal');
    const restartButton = result.locator('[data-action="restart"]');
    const menuButton = result.locator('[data-action="menu"]');
    await expect(result).toBeVisible();
    await expect(result).toHaveAccessibleName('VICTORY');
    await expect(restartButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(menuButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(restartButton).toBeFocused();
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
