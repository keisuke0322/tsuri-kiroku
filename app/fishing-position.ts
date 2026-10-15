export type Position = {
  latitude: number;
  longitude: number;
  source: 'gps' | 'map' | 'saved';
  spotId?: number | null;
};

export type Spot = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  favorite: boolean;
};

export function parsePosition(value: unknown): Position | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.latitude !== 'number' ||
    !Number.isFinite(p.latitude) ||
    Math.abs(p.latitude) > 90 ||
    typeof p.longitude !== 'number' ||
    !Number.isFinite(p.longitude) ||
    Math.abs(p.longitude) > 180 ||
    !['gps', 'map', 'saved'].includes(String(p.source))
  )
    return null;
  if (
    p.spotId != null &&
    (typeof p.spotId !== 'number' ||
      !Number.isSafeInteger(p.spotId) ||
      p.spotId < 1)
  )
    return null;
  return {
    latitude: p.latitude,
    longitude: p.longitude,
    source: p.source as Position['source'],
    spotId: p.spotId as number | null | undefined,
  };
}
