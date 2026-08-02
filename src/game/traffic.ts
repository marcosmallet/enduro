import { ROAD_VISIBLE_DISTANCE } from '../config/game';
import { difficultyForDay } from './difficulty';
import { applyCollisionPenalty } from './physics';
import type { GameState, TrafficVehicle, VehicleKind } from './types';
import { SeededRandom } from './random';

const LANES = [-0.68, -0.23, 0.23, 0.68] as const;
const KINDS: readonly VehicleKind[] = ['COMPACT', 'SEDAN', 'SPORT', 'UTILITY', 'VAN', 'TRUCK'];
const COLORS = ['#e8edf2', '#cf3348', '#f1a63b', '#347ea8', '#7f8b94', '#6b527f'] as const;

function createVehicle(
  state: GameState,
  random: SeededRandom,
  z: number,
  excludedLane?: number,
): TrafficVehicle {
  const difficulty = difficultyForDay(state.day);
  const availableLanes =
    excludedLane === undefined ? LANES : LANES.filter((lane) => lane !== excludedLane);
  const lane = random.pick(availableLanes);
  const kind = random.pick(KINDS);
  const speedAdjustment = kind === 'TRUCK' ? -18 : kind === 'SPORT' ? 15 : 0;
  return {
    id: `traffic-${state.nextVehicleId++}`,
    kind,
    z,
    previousZ: z,
    lateral: lane + random.between(-difficulty.laneJitter, difficulty.laneJitter),
    preferredLane: lane,
    speedKph: random.between(58, 104) + speedAdjustment + difficulty.trafficSpeedBonusKph,
    counted: false,
    wasAhead: true,
    recycledDuringPass: false,
    collided: false,
    color: random.pick(COLORS),
    apparentScale: 0,
    lod: 0,
  };
}

export function populateTraffic(state: GameState, count: number): void {
  const random = new SeededRandom(state.seed);
  const difficulty = difficultyForDay(state.day);
  let nextZ = 54;
  let previousLane: number | undefined;
  state.traffic = Array.from({ length: count }, () => {
    const clustered = previousLane !== undefined && random.next() < difficulty.clusterChance;
    const vehicle = createVehicle(state, random, nextZ, clustered ? previousLane : undefined);
    const gap = clustered
      ? random.between(difficulty.clusterGapMin, difficulty.clusterGapMax)
      : random.between(difficulty.spawnGapMin, difficulty.spawnGapMax);
    nextZ += gap;
    previousLane = vehicle.preferredLane;
    return vehicle;
  });
}

function recycleVehicle(state: GameState, vehicle: TrafficVehicle, random: SeededRandom): void {
  const difficulty = difficultyForDay(state.day);
  const furthestVehicle = state.traffic.reduce<TrafficVehicle | undefined>(
    (furthest, candidate) => (!furthest || candidate.z > furthest.z ? candidate : furthest),
    undefined,
  );
  const furthestZ = furthestVehicle?.z ?? 110;
  const clustered = furthestVehicle !== undefined && random.next() < difficulty.clusterChance;
  const gap = clustered
    ? random.between(difficulty.clusterGapMin, difficulty.clusterGapMax)
    : random.between(difficulty.spawnGapMin, difficulty.spawnGapMax);
  const replacement = createVehicle(
    state,
    random,
    Math.min(ROAD_VISIBLE_DISTANCE, furthestZ + gap),
    clustered ? furthestVehicle.preferredLane : undefined,
  );
  Object.assign(vehicle, replacement);
}

export function registerOvertake(state: GameState, vehicle: TrafficVehicle): boolean {
  if (vehicle.counted || !vehicle.wasAhead || vehicle.recycledDuringPass || vehicle.z > -8) {
    return false;
  }
  vehicle.counted = true;
  state.totalOvertakes += 1;
  if (!state.goalReached) state.overtakes = Math.min(state.target, state.overtakes + 1);
  state.carsLeft = Math.max(0, state.target - state.overtakes);
  if (state.carsLeft === 0) {
    state.goalReached = true;
    if (state.mode === 'POC_QUICK_RACE') state.screen = 'VICTORY';
  }
  return true;
}

export function updateTraffic(
  state: GameState,
  deltaSeconds: number,
  random: SeededRandom,
): void {
  const dt = Math.min(deltaSeconds, 0.05);
  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
  state.collisionFlash = Math.max(0, state.collisionFlash - dt);

  for (const vehicle of state.traffic) {
    vehicle.previousZ = vehicle.z;
    vehicle.z -= ((state.speedKph - vehicle.speedKph) / 3.6) * dt;

    const depth = Math.max(0, Math.min(1, 1 - vehicle.z / ROAD_VISIBLE_DISTANCE));
    vehicle.apparentScale = depth ** 1.55;
    vehicle.lod = depth > 0.62 ? 2 : depth > 0.28 ? 1 : 0;

    if (
      vehicle.z > 2 &&
      vehicle.z < 13 &&
      Math.abs(vehicle.lateral - state.playerX) < (vehicle.kind === 'TRUCK' ? 0.27 : 0.21) &&
      state.collisionCooldown === 0
    ) {
      applyCollisionPenalty(state);
      vehicle.collided = true;
      vehicle.z = 18;
      vehicle.lateral += state.playerX >= vehicle.lateral ? -0.16 : 0.16;
    }

    registerOvertake(state, vehicle);

    if (vehicle.z < -26 || vehicle.z > ROAD_VISIBLE_DISTANCE + 35) {
      recycleVehicle(state, vehicle, random);
    }
  }
}
