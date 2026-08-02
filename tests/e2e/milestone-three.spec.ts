import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import type { DayPhase } from '../../src/game/types';

async function gameState(page: Page) {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    return contract.getState();
  });
}

async function setDayProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((nextProgress) => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    contract.setDayProgress(nextProgress);
  }, progress);
}

test.describe('Milestone 3 environmental signatures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.getByRole('button', { name: /POC CORRIDA RÁPIDA/ }).click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true });
      contract.step(2);
      contract.setInput({ accelerate: false, steer: 0 });
    });
  });

  test('renders dawn, day, sunset and night as one continuous cycle', async ({ page }, testInfo) => {
    const samples: Array<[string, number, DayPhase]> = [
      ['dawn', 0.06, 'DAWN'],
      ['day', 0.29, 'DAY'],
      ['sunset', 0.5, 'SUNSET'],
      ['night', 0.77, 'NIGHT'],
    ];

    for (const [name, progress, phase] of samples) {
      await setDayProgress(page, progress);
      const state = await gameState(page);
      expect(state.phase).toBe(phase);
      expect(state.weather).toBe('CLEAR');
      await expect(page.locator('[data-hud="phase"]')).toHaveText(/\S/);
      if (testInfo.project.name === 'desktop-720p') {
        await page.screenshot({ path: `screenshots/milestone-3/${name}-1280x720.png` });
      }
    }
  });

  test('reduces visibility in fog and steering response on ice', async ({ page }, testInfo) => {
    await setDayProgress(page, 0.37);
    const fog = await gameState(page);
    expect(fog.weather).toBe('FOG');
    expect(fog.weatherIntensity).toBe(1);
    expect(fog.visibilityDistance).toBeLessThan(140);
    await expect(page.locator('[data-hud="weather"]')).toHaveText('NEBLINA');
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-3/fog-1280x720.png' });
    }

    await setDayProgress(page, 0.65);
    const ice = await gameState(page);
    expect(ice.weather).toBe('ICE');
    expect(ice.weatherIntensity).toBe(1);
    expect(ice.steeringResponse).toBeLessThan(0.5);
    await expect(page.locator('[data-hud="weather"]')).toHaveText('GELO');
    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-3/ice-1280x720.png' });
    }
  });

  test('changes actual lateral control while keeping the car arcade-stable', async ({ page }) => {
    await setDayProgress(page, 0.29);
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true, steer: 1 });
      contract.step(0.45);
    });
    const clearX = (await gameState(page)).playerX;

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('POC_QUICK_RACE');
      contract.setDayProgress(0.65);
      contract.setInput({ accelerate: true, steer: 1 });
      contract.step(0.45);
    });
    const frozen = await gameState(page);
    expect(frozen.weather).toBe('ICE');
    expect(frozen.playerX).toBeGreaterThan(0);
    expect(frozen.playerX).toBeLessThan(clearX * 0.8);
  });
});
