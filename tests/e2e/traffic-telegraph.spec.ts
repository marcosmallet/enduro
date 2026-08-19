import { expect, test, type Page } from '@playwright/test';
import type { TestContract } from '../../src/GameController';
import { projectRoadPoint } from '../../src/rendering/projection';

async function waitForAssets(page: Page): Promise<void> {
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-assets-ready', 'true');
}

async function readManeuvers(page: Page) {
  return page.evaluate(() => {
    const contract = (window as Window & { __roadEnduranceTest?: TestContract })
      .__roadEnduranceTest;
    if (!contract) throw new Error('Test contract was not installed.');
    return contract.getState().trafficManeuvers;
  });
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
    });

    let accepted:
      | {
          cue: Awaited<ReturnType<typeof readManeuvers>>[number];
          changing: Awaited<ReturnType<typeof readManeuvers>>[number];
        }
      | undefined;

    for (let frame = 0; frame < 900 && !accepted; frame += 1) {
      await page.evaluate(() => {
        const contract = (window as Window & { __roadEnduranceTest?: TestContract })
          .__roadEnduranceTest;
        if (!contract) throw new Error('Test contract was not installed.');
        contract.step(1 / 60);
      });
      const maneuvers = await readManeuvers(page);
      const cue = maneuvers.find(
        (vehicle) =>
          vehicle.maneuverPhase === 'TELEGRAPH' &&
          vehicle.maneuverProgress >= 0.65 &&
          vehicle.z >= 28 &&
          vehicle.z <= 120,
      );
      if (!cue) continue;

      await page.screenshot({
        path: `.logs/traffic-telegraph-${testInfo.project.name}.png`,
      });

      for (let follow = 0; follow < 75; follow += 1) {
        await page.evaluate(() => {
          const contract = (window as Window & { __roadEnduranceTest?: TestContract })
            .__roadEnduranceTest;
          if (!contract) throw new Error('Test contract was not installed.');
          contract.step(1 / 60);
        });
        const next = (await readManeuvers(page)).find((vehicle) => vehicle.id === cue.id);
        if (!next || next.maneuverPhase === 'IDLE') break;
        if (next.maneuverPhase === 'CHANGING') {
          accepted = { cue, changing: next };
          break;
        }
      }
    }

    expect(accepted).toBeDefined();
    if (!accepted) return;
    expect(accepted.cue.maneuverTargetLane).not.toBeNull();
    expect(accepted.changing.maneuverPhase).toBe('CHANGING');
    const cuePoint = projectRoadPoint(accepted.cue.z, accepted.cue.lateral);
    const lanePoint = projectRoadPoint(accepted.cue.z, accepted.cue.preferredLane);
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
