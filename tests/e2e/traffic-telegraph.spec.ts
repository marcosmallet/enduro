import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import type { DayPhase, SerializableTrafficManeuver, Weather } from '../../src/game/types';
import { projectRoadPoint } from '../../src/rendering/projection';
import type { VisualMode } from '../../src/rendering/visualModes';

async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
}

async function advanceToReadableTelegraph(
  page: Page,
): Promise<SerializableTrafficManeuver | undefined> {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');

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
      if (cue) return cue;
    }
    return undefined;
  });
}

async function advanceToCommittedChange(
  page: Page,
  vehicleId: string,
): Promise<SerializableTrafficManeuver | undefined> {
  return page.evaluate((requestedVehicleId) => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');

    for (let follow = 0; follow < 75; follow += 1) {
      contract.step(1 / 60);
      const next = contract
        .getState()
        .trafficManeuvers.find((vehicle) => vehicle.id === requestedVehicleId);
      if (!next || next.maneuverPhase === 'IDLE') return undefined;
      if (next.maneuverPhase === 'CHANGING') return next;
    }
    return undefined;
  }, vehicleId);
}

async function prepareTelegraphScenario(
  page: Page,
  presentation: { phase: DayPhase; weather: Weather; visualMode: VisualMode; reveal?: number },
): Promise<SerializableTrafficManeuver | undefined> {
  await page.evaluate((requested) => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    contract.start('AUTHENTIC_ENDURANCE');
    contract.setPhase(requested.phase);
    contract.setWeather(requested.weather);
    contract.setVisualMode(requested.visualMode, requested.reveal);
    contract.setInput({ accelerate: false, brake: false, steer: 0 });
    contract.placeVehicle({ z: 120, lateral: -0.68, speedKph: 0 });
  }, presentation);
  return advanceToReadableTelegraph(page);
}

test.describe('Traffic player-facing fairness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForAssets(page);
  });

  test('shows a readable telegraph before a committed lane change', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-720p' && testInfo.project.name !== 'mobile-landscape') {
      return;
    }

    const cue = await prepareTelegraphScenario(page, {
      phase: 'DAY',
      weather: 'CLEAR',
      visualMode: 'HYPER',
      reveal: 1,
    });
    expect(cue).toBeDefined();
    if (!cue) return;

    await expect
      .poll(async () => Number((await page.locator('#game-canvas').getAttribute('data-traffic-telegraph-cues')) ?? '0'))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Number((await page.locator('#game-canvas').getAttribute('data-traffic-telegraph-max-cue-pixels')) ?? '0'))
      .toBeGreaterThan(6);

    await page.screenshot({
      path: `.logs/traffic-telegraph-clear-day-${testInfo.project.name}.png`,
    });

    const changing = await advanceToCommittedChange(page, cue.id);
    expect(changing).toBeDefined();
    if (!changing) return;

    expect(cue.maneuverTargetLane).not.toBeNull();
    expect(changing.maneuverPhase).toBe('CHANGING');
    const cuePoint = projectRoadPoint(cue.z, cue.lateral);
    const lanePoint = projectRoadPoint(cue.z, cue.preferredLane);
    const projectedCuePixels = Math.abs(cuePoint.x - lanePoint.x);
    expect(projectedCuePixels).toBeGreaterThan(6);
  });

  test('keeps the directional telegraph visible through fog, night and Legacy presentation', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-720p' && testInfo.project.name !== 'mobile-landscape') {
      return;
    }

    const presentations: Array<{
      name: string;
      phase: DayPhase;
      weather: Weather;
      visualMode: VisualMode;
      reveal?: number;
    }> = [
      { name: 'fog', phase: 'DAY', weather: 'FOG', visualMode: 'HYPER', reveal: 1 },
      { name: 'night', phase: 'NIGHT', weather: 'CLEAR', visualMode: 'HYPER', reveal: 1 },
      { name: 'legacy', phase: 'DAY', weather: 'CLEAR', visualMode: 'LEGACY', reveal: 0 },
    ];

    for (const presentation of presentations) {
      const cue = await prepareTelegraphScenario(page, presentation);
      expect(cue, presentation.name).toBeDefined();
      if (!cue) continue;
      expect(cue.maneuverTargetLane, presentation.name).not.toBeNull();

      await expect
        .poll(async () => Number((await page.locator('#game-canvas').getAttribute('data-traffic-telegraph-cues')) ?? '0'))
        .toBeGreaterThan(0);
      await expect
        .poll(async () => Number((await page.locator('#game-canvas').getAttribute('data-traffic-telegraph-max-cue-pixels')) ?? '0'))
        .toBeGreaterThan(6);

      await page.screenshot({
        path: `.logs/traffic-telegraph-${presentation.name}-${testInfo.project.name}.png`,
      });
    }
  });

  test('keeps maneuver simulation identical across graphics profiles', async ({ page }) => {
    const runProfile = async (profile: 'LOW' | 'MEDIUM' | 'HIGH') =>
      page.evaluate((requestedProfile) => {
        const contract = (window as Window & { __roadEnduranceTest?: TestContract })
          .__roadEnduranceTest;
        if (!contract) throw new Error('Test contract was not installed.');
        contract.start('AUTHENTIC_ENDURANCE');
        contract.setGraphicsProfile(requestedProfile);
        contract.setInput({ accelerate: true, brake: false, steer: 0.18 });
        contract.step(5.5);
        return contract.getState().trafficManeuvers;
      }, profile);

    const high = await runProfile('HIGH');
    const medium = await runProfile('MEDIUM');
    const low = await runProfile('LOW');
    expect(medium).toEqual(high);
    expect(low).toEqual(high);
  });
});
