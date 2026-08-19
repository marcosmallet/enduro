import { expect, test } from '@playwright/test';

test.describe('First-run control discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
  });

  test('shows the input hint that matches the active interaction surface', async ({ page }, testInfo) => {
    const desktopHint = page.locator('.controls-hint-desktop');
    const touchHint = page.locator('.controls-hint-touch');
    const isMobile = testInfo.project.name === 'mobile-landscape' || testInfo.project.name === 'mobile-portrait';

    if (isMobile) {
      await expect(touchHint).toBeVisible();
      await expect(touchHint).toContainText(/TOQUE|TOUCH/);
      await expect(touchHint).toContainText(/ACELERAR|THROTTLE/);
      await expect(touchHint).toContainText(/FREIO|BRAKE/);
      await expect(desktopHint).toBeHidden();
      return;
    }

    await expect(desktopHint).toBeVisible();
    await expect(desktopHint).toContainText(/WASD/);
    await expect(desktopHint).toContainText(/GAMEPAD/);
    await expect(touchHint).toBeHidden();
  });

  test('keeps contextual discovery localized after switching language', async ({ page }, testInfo) => {
    await page.locator('[data-action="language"]').click();

    if (testInfo.project.name === 'mobile-landscape' || testInfo.project.name === 'mobile-portrait') {
      await expect(page.locator('.controls-hint-touch')).toHaveText('TOUCH: ← → STEER · THROTTLE / BRAKE');
      return;
    }

    await expect(page.locator('.controls-hint-desktop')).toContainText('WASD / ARROWS OR GAMEPAD');
  });
});
