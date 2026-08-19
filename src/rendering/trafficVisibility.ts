import { ROAD_VISIBLE_DISTANCE } from '../config/game';
import type { GameState, TrafficVehicle } from '../game/types';

type TrafficVisibilityState = Pick<GameState, 'traffic' | 'visibilityDistance'>;

export function collectVisibleTraffic(
  state: TrafficVisibilityState,
  maxVisibleTraffic: number,
  buffer: TrafficVehicle[],
): readonly TrafficVehicle[] {
  buffer.length = 0;
  const visibilityLimit = Math.min(ROAD_VISIBLE_DISTANCE, state.visibilityDistance + 18);

  for (const vehicle of state.traffic) {
    if (vehicle.z > -10 && vehicle.z < visibilityLimit) buffer.push(vehicle);
  }

  buffer.sort((first, second) => second.z - first.z);
  const limit = Math.max(0, Math.floor(maxVisibleTraffic));
  const overflow = buffer.length - limit;
  if (overflow > 0) buffer.splice(0, overflow);
  return buffer;
}
