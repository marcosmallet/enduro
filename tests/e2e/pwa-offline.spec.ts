import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const runtimeEnvironment = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

const productionPwaRun = runtimeEnvironment?.PWA_PRODUCTION_E2E === '1';
const appUrl = 'http://127.0.0.1:4173/enduro/';
const nextServiceWorkerUrl = 'http://127.0.0.1:4173/__pwa_test__/next-sw';

interface LifecycleProbe {
  rafOwners: number;
  audioContexts: number;
}

async function installLifecycleProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const state = window as Window & { __pwaLifecycleProbe?: LifecycleProbe };
    const probe: LifecycleProbe = { rafOwners: 0, audioContexts: 0 };
    state.__pwaLifecycleProbe = probe;

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const rafOwners = new Set<FrameRequestCallback>();
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      rafOwners.add(callback);
      probe.rafOwners = rafOwners.size;
      return nativeRequestAnimationFrame(callback);
    }) as typeof window.requestAnimationFrame;

    const NativeAudioContext = window.AudioContext;
    if (NativeAudioContext) {
      window.AudioContext = new Proxy(NativeAudioContext, {
        construct(target, args, newTarget) {
          probe.audioContexts += 1;
          return Reflect.construct(target, args, newTarget);
        },
      }) as typeof AudioContext;
    }
  });
}

async function expectSingleLifecycleOwner(page: Page, expectedAudioContexts: number): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const probe = (window as Window & { __pwaLifecycleProbe?: LifecycleProbe })
          .__pwaLifecycleProbe;
        return probe ? { ...probe } : undefined;
      }),
    )
    .toEqual({ rafOwners: 1, audioContexts: expectedAudioContexts });
}

async function expectSinglePauseTransition(page: Page): Promise<void> {
  const modal = page.locator('.pause-modal');
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
}

test.describe('Production PWA lifecycle', () => {
  test.skip(!productionPwaRun, 'Runs only against the production/public PWA harness.');

  test('keeps one browser lifecycle owner through updates, offline reload and reconnect', async ({
    context,
    page,
  }) => {
    await installLifecycleProbe(context);
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
    await expectSingleLifecycleOwner(page, 0);

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
    await expectSingleLifecycleOwner(page, 0);

    await page.locator('[data-mode="AUTHENTIC_ENDURANCE"]').click();
    await expect(page.locator('.hud')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
    await expectSingleLifecycleOwner(page, 1);

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
    await expectSingleLifecycleOwner(page, 1);
    await expectSinglePauseTransition(page);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-mode="AUTHENTIC_ENDURANCE"]')).toBeVisible();
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
    await expectSingleLifecycleOwner(page, 0);
    await page.locator('[data-mode="AUTHENTIC_ENDURANCE"]').click();
    await expect(page.locator('.hud')).toBeVisible();
    await expectSingleLifecycleOwner(page, 1);

    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.locator('.hud')).toBeVisible();
    await expectSingleLifecycleOwner(page, 1);
    await expectSinglePauseTransition(page);

    const registrationsAfter = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    });
    expect(registrationsAfter).toBe(1);
    expect(page.url()).toBe(appUrl);
  });
});
