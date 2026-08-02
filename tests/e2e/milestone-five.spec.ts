import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';

async function contractState(page: Page) {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    return contract.getState();
  });
}

async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
}

test.describe('Milestone 5 audio and finish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForAssets(page);
  });

  test('transitions from a real low-resolution Legacy pass to Hyper without changing gameplay', async ({ page }, testInfo) => {
    const before = await contractState(page);
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setVisualMode('LEGACY');
    });
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-render-mode', 'LEGACY');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-legacy-resolution', '320x180');
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-5/menu-legacy-1280x720.png' });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setVisualMode('HYPER', 1);
    });
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-render-mode', 'HYPER');
    await expect(page.locator('#game-canvas')).toHaveAttribute('data-legacy-resolution', '1280x720');
    const after = await contractState(page);
    expect(after.playerX).toBe(before.playerX);
    expect(after.target).toBe(before.target);
    expect(after.day).toBe(before.day);
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-5/menu-hyper-1280x720.png' });
    }
  });

  test('persists master, music, effects and mute controls', async ({ page }, testInfo) => {
    await page.locator('[data-action="audio-toggle"]').click();
    await expect(page.locator('.audio-panel')).toBeVisible();
    await page.locator('[data-audio="master"]').fill('64');
    await page.locator('[data-audio="music"]').fill('18');
    await page.locator('[data-audio="effects"]').fill('73');
    await page.locator('.audio-panel [data-action="mute"]').click();

    const settings = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      return contract.getAudioSettings();
    });
    expect(settings).toEqual({ master: 0.64, music: 0.18, effects: 0.73, muted: true });
    const audioStatus = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      return contract.getPlatformState().audioStatus;
    });
    expect(audioStatus).toBe('MUTED');
    await expect(page.locator('.audio-panel [data-action="mute"]')).toHaveAttribute('aria-pressed', 'true');
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-5/audio-controls-1280x720.png' });
    }

    await page.reload();
    await waitForAssets(page);
    const persisted = await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      return contract.getAudioSettings();
    });
    expect(persisted).toEqual(settings);
  });

  test('drives, pauses and confirms through the gamepad contract', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setGamepad({ confirm: true, label: 'TEST PAD' });
      contract.setGamepad({ confirm: false, label: 'TEST PAD' });
      contract.setGamepad({ accelerate: true, steer: 0.82, label: 'TEST PAD' });
      contract.step(2.2);
    });
    const driving = await contractState(page);
    expect(driving.mode).toBe('AUTHENTIC_ENDURANCE');
    expect(driving.target).toBe(200);
    expect(driving.speedKph).toBeGreaterThan(140);
    expect(driving.playerX).toBeGreaterThan(0.1);
    await page.keyboard.press('F3');
    await expect(page.locator('[data-diagnostic="gamepad"]')).toContainText('CONNECTED');
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-5/gamepad-drive-1280x720.png' });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setGamepad({ pause: true, label: 'TEST PAD' });
    });
    expect((await contractState(page)).screen).toBe('PAUSED');

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setGamepad({ pause: false, label: 'TEST PAD' });
      contract.setGamepad({ confirm: true, label: 'TEST PAD' });
    });
    expect((await contractState(page)).screen).toBe('PLAYING');
  });

  test('exposes fullscreen controls and the PWA installation surface', async ({ page }, testInfo) => {
    const fullscreen = page.locator('[data-action="fullscreen"]');
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');

    expect(await page.evaluate(() => 'serviceWorker' in navigator)).toBe(true);
    await expect(page.locator('[data-action="install"]')).toBeAttached();
    const response = await page.request.get('/icon.svg');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/svg+xml');

    if (testInfo.project.name === 'desktop-720p') {
      await fullscreen.click();
      await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
      await page.keyboard.press('Escape');
    }
  });
});
