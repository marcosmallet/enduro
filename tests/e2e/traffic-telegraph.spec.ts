import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import type { SerializableTrafficManeuver } from '../../src/game/types';
import { projectRoadPoint } from '../../src/rendering/projection';

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

test.describe('Traffic player-facing fairness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await waitForAssets(page);
  });

  test('shows a readable telegraph before a committed lane change', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'desktop-720p' && testInfo.project.name !== 'mobile-landscape') {
      return;
    }

    await page.evaluate(() => {
      const contract = (window as Window & { __roadEnduranceTest?: TestContract })
        .__roadEnduranceTest;
      if (!contract) throw new Error('Test contract was not installed.');
      contract.start('AUTHENTIC_ENDURANCE');
      contract.setInput({ accelerate: false, brake: false, steer: 0 });
      // Keep one candidate stationary in the readable mid-field while the rest of traffic
      // naturally clears its corridor. Its seeded cooldown/intent remain production-owned.
      contract.placeVehicle({ z: 120, lateral: -0.68, speedKph: 0 });
    });

    const cue = await advanceToReadableTelegraph(page);
    expect(cue).toBeDefined();
    if (!cue) return;

    await page.screenshot({
      path: `.logs/traffic-telegraph-${testInfo.project.name}.png`,
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
