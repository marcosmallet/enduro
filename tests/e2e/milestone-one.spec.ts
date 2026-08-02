import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';

async function gameState(page: Page) {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    return contract.getState();
  });
}

test.describe('Milestone 1 identity prototype', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
  });

  test('opens the branded menu and starts both game modes', async ({ page }, testInfo) => {
    await expect(page.getByRole('heading', { name: 'ENDURO' })).toBeVisible();
    await expect(page.getByText('HYPER-REALISTIC FAN REMAKE')).toBeVisible();

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-1/menu-1280x720.png' });
    }

    await page.getByRole('button', { name: /POC CORRIDA RÁPIDA/ }).click();
    await expect(page.locator('.hud')).toBeVisible();
    await expect.poll(async () => (await gameState(page)).target).toBe(20);

    await page.reload();
    await page.getByRole('button', { name: /RESISTÊNCIA AUTÊNTICA/ }).click();
    await expect.poll(async () => (await gameState(page)).target).toBe(200);
  });

  test('accelerates, steers, overtakes, collides, pauses and restarts', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: /POC CORRIDA RÁPIDA/ }).click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true, steer: 0 });
      contract.step(3.2);
    });
    expect((await gameState(page)).speedKph).toBeGreaterThan(180);

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true, steer: 1 });
      contract.step(0.7);
      contract.setInput({ accelerate: true, steer: 0 });
    });
    expect((await gameState(page)).playerX).toBeGreaterThan(0.05);

    const overtakesBefore = (await gameState(page)).overtakes;
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.placeVehicle({ z: 4, lateral: -0.68, speedKph: 0 });
      contract.step(1);
    });
    expect((await gameState(page)).overtakes).toBeGreaterThan(overtakesBefore);

    const collisionsBefore = (await gameState(page)).collisionCount;
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.forceCollision();
    });
    const collisionState = await gameState(page);
    expect(collisionState.collisionCount).toBe(collisionsBefore + 1);
    expect(collisionState.speedKph).toBeLessThan(100);

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-1/gameplay-1280x720.png' });
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'PAUSADO' })).toBeVisible();
    expect((await gameState(page)).screen).toBe('PAUSED');

    await page.keyboard.press('KeyR');
    expect((await gameState(page)).overtakes).toBe(0);
    expect((await gameState(page)).screen).toBe('PLAYING');
  });
});
