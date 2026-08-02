import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';

async function gameState(page: Page) {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    return contract.getState();
  });
}

async function resetLocalRecord(page: Page): Promise<void> {
  await page.goto('/?test=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe('Milestone 2 authentic endurance rules', () => {
  test.beforeEach(async ({ page }) => {
    await resetLocalRecord(page);
  });

  test('completes day one, continues into day two and persists the best result', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: /RESISTÊNCIA AUTÊNTICA/ }).click();
    expect((await gameState(page)).target).toBe(200);

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.setInput({ accelerate: true });
      contract.step(2);
      contract.completeGoal();
    });

    const completedGoal = await gameState(page);
    expect(completedGoal.screen).toBe('PLAYING');
    expect(completedGoal.day).toBe(1);
    expect(completedGoal.carsLeft).toBe(0);
    expect(completedGoal.goalReached).toBe(true);
    expect(completedGoal.distanceMeters).toBeGreaterThan(0);

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-2/goal-complete-1280x720.png' });
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.finishDay();
    });

    const secondDay = await gameState(page);
    expect(secondDay.screen).toBe('PLAYING');
    expect(secondDay.day).toBe(2);
    expect(secondDay.completedDays).toBe(1);
    expect(secondDay.target).toBe(300);
    expect(secondDay.carsLeft).toBe(300);
    expect(secondDay.overtakes).toBe(0);
    expect(secondDay.totalOvertakes).toBe(200);
    expect(secondDay.phase).toBe('DAWN');
    expect(secondDay.difficultyLevel).toBe(1);
    expect(secondDay.bestDays).toBe(1);
    expect(secondDay.newDayFeedbackSeconds).toBeGreaterThan(0);

    if (testInfo.project.name === 'desktop-720p') {
      await page.waitForTimeout(350);
      await page.screenshot({ path: 'screenshots/milestone-2/new-day-1280x720.png' });
    }

    await page.reload();
    await page.getByRole('button', { name: /RESISTÊNCIA AUTÊNTICA/ }).click();
    expect((await gameState(page)).bestDays).toBe(1);
  });

  test('fails at the next dawn when the daily target is incomplete', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: /RESISTÊNCIA AUTÊNTICA/ }).click();
    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract }).__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.finishDay();
    });

    const failedRun = await gameState(page);
    expect(failedRun.screen).toBe('GAME_OVER');
    expect(failedRun.failureReason).toBe('DAILY_TARGET_MISSED');
    expect(failedRun.day).toBe(1);
    expect(failedRun.completedDays).toBe(0);
    expect(failedRun.phase).toBe('DAWN');
    await expect(page.getByRole('heading', { name: 'META DO DIA NÃO CONCLUÍDA' })).toBeVisible();

    if (testInfo.project.name === 'desktop-720p') {
      await page.screenshot({ path: 'screenshots/milestone-2/game-over-1280x720.png' });
    }
  });
});
