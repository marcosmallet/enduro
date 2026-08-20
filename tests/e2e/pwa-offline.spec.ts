import { expect, test } from '@playwright/test';

const runtimeEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

const productionPwaRun = runtimeEnvironment?.PWA_PRODUCTION_E2E === '1';
const appUrl = 'http://127.0.0.1:4173/enduro/';
const nextServiceWorkerUrl = 'http://127.0.0.1:4173/__pwa_test__/next-sw';

test.describe('Production PWA lifecycle', () => {
  test.skip(!productionPwaRun, 'Runs only against the production/public PWA harness.');

  test('keeps the Pages base path playable through updates and an offline reload', async ({
    context,
    page,
  }) => {
    await page.goto(appUrl);
    await expect(page.locator('[data-mode="AUTHENTIC_ENDURANCE"]')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
      await navigator.serviceWorker.ready;
    });

    // Reload once after readiness so the document is definitely controlled by the public SW.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    const registrationsBefore = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    });
    expect(registrationsBefore).toBe(1);

    await page.evaluate(() => {
      const state = window as Window & {
        __pwaE2eControllerChanges?: number;
        __pwaE2eMarker?: string;
      };
      state.__pwaE2eControllerChanges = 0;
      state.__pwaE2eMarker = 'menu-session';
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        state.__pwaE2eControllerChanges = (state.__pwaE2eControllerChanges ?? 0) + 1;
      });
    });

    await page.request.get(nextServiceWorkerUrl);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __pwaE2eControllerChanges?: number })
              .__pwaE2eControllerChanges ?? 0,
        ),
      )
      .toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-mode="AUTHENTIC_ENDURANCE"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { __pwaE2eMarker?: string }).__pwaE2eMarker,
      ),
    ).toBe('menu-session');

    await page.locator('[data-mode="AUTHENTIC_ENDURANCE"]').click();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');

    await page.request.get(nextServiceWorkerUrl);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as Window & { __pwaE2eControllerChanges?: number })
              .__pwaE2eControllerChanges ?? 0,
        ),
      )
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator('.hud')).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as Window & { __pwaE2eMarker?: string }).__pwaE2eMarker,
      ),
    ).toBe('menu-session');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-mode="AUTHENTIC_ENDURANCE"]')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
    await page.locator('[data-mode="AUTHENTIC_ENDURANCE"]').click();
    await expect(page.locator('.hud')).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('[data-mode="AUTHENTIC_ENDURANCE"]')).toBeVisible();

    const registrationsAfter = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    });
    expect(registrationsAfter).toBe(1);
    expect(page.url()).toBe(appUrl);
  });
});
