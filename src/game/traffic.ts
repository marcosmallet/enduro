import { GAME_RULES, ROAD_VISIBLE_DISTANCE } from '../config/game';
import { difficultyForDay } from './difficulty';
import { applyCollisionPenalty } from './physics';
import type { GameState, TrafficVehicle, VehicleKind } from './types';
import { SeededRandom } from './random';

const LANES = [-0.68, -0.23, 0.23, 0.68] as const;
const KINDS: readonly VehicleKind[] = ['COMPACT', 'SEDAN', 'SPORT', 'UTILITY', 'VAN', 'TRUCK'];
const COLORS = ['#e8edf2', '#cf3348', '#f1a63b', '#347ea8', '#7f8b94', '#6b527f'] as const;
const TELEGRAPH_SECONDS = 0.75;
const LANE_CHANGE_SECONDS = 1.15;
const MIN_REACTION_SECONDS = 0.9;
const MIN_MANEUVER_Z = 28;
const DESTINATION_CLEARANCE_METERS = 15;
const CLUSTER_CLEARANCE_METERS = 8;
const DESTINATION_LATERAL_TOLERANCE = 0.2;
const NEAR_PLAYER_BLOCKADE_Z = 55;

function smoothstep(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

function stableHash(seed: number, id: string, attempt: number, salt: number): number {
  let hash = (seed ^ salt ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return hash >>> 0;
}

function stableUnit(seed: number, id: string, attempt: number, salt: number): number {
  return stableHash(seed, id, attempt, salt) / 0x1_0000_0000;
}

function cooldownForVehicle(seed: number, vehicle: Pick<TrafficVehicle, 'id' | 'maneuverAttempt'>): number {
  const attempt = vehicle.maneuverAttempt ?? 0;
  return 2.4 + stableUnit(seed, vehicle.id, attempt, 0x4c414e45) * 3.6;
}

function nearestLaneIndex(lateral: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < LANES.length; index += 1) {
    const lane = LANES[index];
    if (lane === undefined) continue;
    const distance = Math.abs(lateral - lane);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function plannedAdjacentLane(
  seed: number,
  vehicle: Pick<TrafficVehicle, 'id' | 'preferredLane' | 'maneuverAttempt'>,
): number | undefined {
  const currentIndex = nearestLaneIndex(vehicle.preferredLane);
  const candidates = [currentIndex - 1, currentIndex + 1]
    .filter((index) => index >= 0 && index < LANES.length)
    .map((index) => LANES[index])
    .filter((lane): lane is (typeof LANES)[number] => lane !== undefined);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const attempt = vehicle.maneuverAttempt ?? 0;
  const pick = stableUnit(seed, vehicle.id, attempt, 0x54415247) < 0.5 ? 0 : 1;
  return candidates[pick];
}

function resetManeuver(vehicle: TrafficVehicle, seed: number, cooldown?: number): void {
  vehicle.maneuverPhase = 'IDLE';
  vehicle.maneuverTargetLane = undefined;
  vehicle.maneuverFromLateral = vehicle.lateral;
  vehicle.maneuverProgress = 0;
  vehicle.maneuverTimerSeconds = 0;
  vehicle.maneuverCooldownSeconds = cooldown ?? cooldownForVehicle(seed, vehicle);
}

function isClustered(state: GameState, vehicle: TrafficVehicle): boolean {
  return state.traffic.some(
    (other) => other !== vehicle && Math.abs(other.z - vehicle.z) < CLUSTER_CLEARANCE_METERS,
  );
}

function destinationCorridorIsClear(
  state: GameState,
  vehicle: TrafficVehicle,
  targetLane: number,
): boolean {
  return !state.traffic.some((other) => {
    if (other === vehicle) return false;
    if (Math.abs(other.z - vehicle.z) >= DESTINATION_CLEARANCE_METERS) return false;
    const occupiesTarget =
      Math.abs(other.lateral - targetLane) < DESTINATION_LATERAL_TOLERANCE ||
      Math.abs(other.preferredLane - targetLane) < 0.01 ||
      (other.maneuverPhase !== 'IDLE' &&
        other.maneuverTargetLane !== undefined &&
        Math.abs(other.maneuverTargetLane - targetLane) < 0.01);
    return occupiesTarget;
  });
}

function hasReactionWindow(state: GameState, vehicle: TrafficVehicle): boolean {
  if (vehicle.z < MIN_MANEUVER_Z) return false;
  const closingMetersPerSecond = Math.max(0, (state.speedKph - vehicle.speedKph) / 3.6);
  if (closingMetersPerSecond <= 0) return true;
  const distanceToCollisionEnvelope = Math.max(0, vehicle.z - 13);
  return distanceToCollisionEnvelope / closingMetersPerSecond >= MIN_REACTION_SECONDS;
}

function wouldCreateNearPlayerBlockade(
  state: GameState,
  vehicle: TrafficVehicle,
  targetLane: number,
): boolean {
  if (vehicle.z > NEAR_PLAYER_BLOCKADE_Z) return false;
  const occupied = new Set<number>();
  for (const other of state.traffic) {
    if (other.z < 4 || other.z > NEAR_PLAYER_BLOCKADE_Z) continue;
    occupied.add(nearestLaneIndex(other.lateral));
    if (
      other.maneuverPhase === 'CHANGING' &&
      other.maneuverTargetLane !== undefined
    ) {
      occupied.add(nearestLaneIndex(other.maneuverTargetLane));
    }
  }
  occupied.add(nearestLaneIndex(vehicle.lateral));
  occupied.add(nearestLaneIndex(targetLane));
  return occupied.size >= LANES.length;
}

function canStartOrCommitManeuver(
  state: GameState,
  vehicle: TrafficVehicle,
  targetLane: number,
): boolean {
  return (
    !isClustered(state, vehicle) &&
    destinationCorridorIsClear(state, vehicle, targetLane) &&
    hasReactionWindow(state, vehicle) &&
    !wouldCreateNearPlayerBlockade(state, vehicle, targetLane)
  );
}

function updateManeuver(state: GameState, vehicle: TrafficVehicle, dt: number): void {
  vehicle.maneuverPhase ??= 'IDLE';
  vehicle.maneuverAttempt ??= 0;
  vehicle.maneuverProgress ??= 0;
  vehicle.maneuverTimerSeconds ??= 0;
  vehicle.maneuverCooldownSeconds ??= cooldownForVehicle(state.seed, vehicle);
  vehicle.maneuverFromLateral ??= vehicle.lateral;

  if (vehicle.maneuverPhase === 'IDLE') {
    vehicle.lateral +=
      (vehicle.preferredLane - vehicle.lateral) * Math.min(1, dt * 1.8);
    vehicle.maneuverCooldownSeconds = Math.max(0, vehicle.maneuverCooldownSeconds - dt);
    if (vehicle.maneuverCooldownSeconds > 0 || vehicle.collided) return;

    const targetLane = plannedAdjacentLane(state.seed, vehicle);
    if (targetLane === undefined || !canStartOrCommitManeuver(state, vehicle, targetLane)) {
      vehicle.maneuverAttempt += 1;
      vehicle.maneuverCooldownSeconds = 0.8 + cooldownForVehicle(state.seed, vehicle) * 0.25;
      return;
    }

    vehicle.maneuverPhase = 'TELEGRAPH';
    vehicle.maneuverTargetLane = targetLane;
    vehicle.maneuverFromLateral = vehicle.lateral;
    vehicle.maneuverProgress = 0;
    vehicle.maneuverTimerSeconds = 0;
    return;
  }

  const targetLane = vehicle.maneuverTargetLane;
  if (targetLane === undefined) {
    resetManeuver(vehicle, state.seed, 1.2);
    return;
  }

  if (vehicle.maneuverPhase === 'TELEGRAPH') {
    if (!canStartOrCommitManeuver(state, vehicle, targetLane)) {
      vehicle.maneuverAttempt += 1;
      resetManeuver(vehicle, state.seed, 1.1);
      return;
    }

    vehicle.maneuverTimerSeconds += dt;
    vehicle.maneuverProgress = Math.min(1, vehicle.maneuverTimerSeconds / TELEGRAPH_SECONDS);
    const cueProgress = smoothstep(vehicle.maneuverProgress) * 0.1;
    vehicle.lateral =
      (vehicle.maneuverFromLateral ?? vehicle.lateral) +
      (targetLane - (vehicle.maneuverFromLateral ?? vehicle.lateral)) * cueProgress;

    if (vehicle.maneuverProgress >= 1) {
      vehicle.maneuverPhase = 'CHANGING';
      vehicle.maneuverFromLateral = vehicle.lateral;
      vehicle.maneuverProgress = 0;
      vehicle.maneuverTimerSeconds = 0;
    }
    return;
  }

  vehicle.maneuverTimerSeconds += dt;
  vehicle.maneuverProgress = Math.min(1, vehicle.maneuverTimerSeconds / LANE_CHANGE_SECONDS);
  const movement = smoothstep(vehicle.maneuverProgress);
  vehicle.lateral =
    (vehicle.maneuverFromLateral ?? vehicle.lateral) +
    (targetLane - (vehicle.maneuverFromLateral ?? vehicle.lateral)) * movement;

  if (vehicle.maneuverProgress >= 1) {
    vehicle.lateral = targetLane;
    vehicle.preferredLane = targetLane;
    vehicle.maneuverAttempt += 1;
    resetManeuver(vehicle, state.seed);
  }
}

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
  const vehicle: TrafficVehicle = {
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
    maneuverPhase: 'IDLE',
    maneuverProgress: 0,
    maneuverTimerSeconds: 0,
    maneuverAttempt: 0,
  };
  vehicle.maneuverFromLateral = vehicle.lateral;
  vehicle.maneuverCooldownSeconds = cooldownForVehicle(state.seed, vehicle);
  return vehicle;
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
    updateManeuver(state, vehicle, dt);

    const depth = Math.max(0, Math.min(1, 1 - vehicle.z / ROAD_VISIBLE_DISTANCE));
    vehicle.apparentScale = depth ** 1.55;
    vehicle.lod = depth > 0.62 ? 2 : depth > 0.28 ? 1 : 0;

    if (
      vehicle.z > 2 &&
      vehicle.z < 13 &&
      Math.abs(vehicle.lateral - state.playerX) <
        (vehicle.kind === 'TRUCK' || vehicle.kind === 'VAN'
          ? GAME_RULES.collisionLateralLarge
          : GAME_RULES.collisionLateralRegular) &&
      state.collisionCooldown === 0
    ) {
      applyCollisionPenalty(state);
      vehicle.collided = true;
      resetManeuver(vehicle, state.seed, 1.4);
      vehicle.z = 18;
      vehicle.lateral += state.playerX >= vehicle.lateral ? -0.16 : 0.16;
    }

    registerOvertake(state, vehicle);

    if (vehicle.z < -26 || vehicle.z > ROAD_VISIBLE_DISTANCE + 35) {
      recycleVehicle(state, vehicle, random);
    }
  }
}
