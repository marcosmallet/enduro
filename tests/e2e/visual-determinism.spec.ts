import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import type { DayPhase, Weather } from '../../src/game/types';
import type { VisualMode } from '../../src/rendering/visualModes';

type VisualScenario = {
  name: 'clear-day' | 'fog' | 'legacy' | 'mobile-touch';
  phase: DayPhase;
  weather: Weather;
  visualMode: VisualMode;
  reveal: number;
};

async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
}

async function prepareScenario(page: Page, scenario: VisualScenario): Promise<void> {
  const prepared = await page.evaluate((requested) => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');

    contract.start('AUTHENTIC_ENDURANCE');
    contract.setPhase(requested.phase);
    contract.setWeather(requested.weather);
    contract.setVisualMode(requested.visualMode, requested.reveal);
    contract.setInput({ accelerate: false, brake: false, steer: 0 });
    contract.placeVehicle({ z: 120, lateral: -0.68, speedKph: 0 });

    for (let frame = 0; frame < 900; frame += 1) {
      contract.step(1 / 60);
      const cue = contract
        .getState()
        .trafficManeuvers.find(
          (vehicle) =>
            vehicle.maneuverPhase === 'TELEGRAPH' &&
            vehicle.maneuverProgress >= 0.65 &&
            vehicle.z >= 28 &&
            vehicle.z <= 120,
        );
      if (cue) {
        return {
          cueId: cue.id,
          targetLane: cue.maneuverTargetLane,
          phase: cue.maneuverPhase,
        };
      }
    }

    return undefined;
  }, scenario);

  expect(prepared, `${scenario.name} should reach a deterministic traffic telegraph`).toBeDefined();
  expect(prepared?.phase).toBe('TELEGRAPH');
  expect(prepared?.targetLane).not.toBeNull();

  await expect
    .poll(async () =>
      Number(
        (await page.locator('#game-canvas').getAttribute('data-traffic-telegraph-cues')) ?? '0',
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(
        (await page
          .locator('#game-canvas')
          .getAttribute('data-traffic-telegraph-max-cue-pixels')) ?? '0',
      ),
    )
    .toBeGreaterThan(6);
}

async function captureScenario(page: Page, scenario: VisualScenario): Promise<Buffer> {
  await prepareScenario(page, scenario);
  return page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
}

test.describe('Deterministic canonical visual states', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForAssets(page);
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
        }
      `,
    });
  });

  test('rebuilds canonical gameplay presentation pixel-identically from seeded state', async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name !== 'desktop-720p' && testInfo.project.name !== 'mobile-landscape') {
      return;
    }

    const scenarios: VisualScenario[] =
      testInfo.project.name === 'mobile-landscape'
        ? [
            {
              name: 'mobile-touch',
              phase: 'DAY',
              weather: 'CLEAR',
              visualMode: 'HYPER',
              reveal: 1,
            },
          ]
        : [
            {
              name: 'clear-day',
              phase: 'DAY',
              weather: 'CLEAR',
              visualMode: 'HYPER',
              reveal: 1,
            },
            {
              name: 'fog',
              phase: 'DAY',
              weather: 'FOG',
              visualMode: 'HYPER',
              reveal: 1,
            },
            {
              name: 'legacy',
              phase: 'DAY',
              weather: 'CLEAR',
              visualMode: 'LEGACY',
              reveal: 0,
            },
          ];

    if (testInfo.project.name === 'mobile-landscape') {
      await expect(page.locator('.touch-controls')).toBeVisible();
      await expect(page.locator('[data-control="left"]')).toBeVisible();
      await expect(page.locator('[data-control="accelerate"]')).toBeVisible();
    }

    for (const scenario of scenarios) {
      const first = await captureScenario(page, scenario);
      const second = await captureScenario(page, scenario);

      // Exact equality is intentionally stricter than a broad screenshot tolerance here.
      // A future historical baseline can allow narrowly justified anti-aliasing drift, but
      // seeded canonical reconstruction itself must not introduce frame-to-frame variance.
      expect(second, `${scenario.name} should render identically after deterministic reset`).toEqual(
        first,
      );

      await testInfo.attach(`${scenario.name}-${testInfo.project.name}`, {
        body: first,
        contentType: 'image/png',
      });
      await page.screenshot({
        path: `.logs/visual-${scenario.name}-${testInfo.project.name}.png`,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
    }
  });
});
