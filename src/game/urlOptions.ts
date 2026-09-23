import { parseWorldType, type WorldTypeId } from "../engine/terrain";

/**
 * Options de démarrage lues dans l'adresse, après le « # » (fonctionne en
 * `file://`) : `cubes.html#monde=ile&graine=1234&heure=20&distance=48`.
 * Sert aux tests et à retrouver un monde précis (même type + même graine =
 * même monde). Les valeurs invalides sont ignorées.
 */
export interface UrlOptions {
  type?: WorldTypeId;
  seed?: number;
  hour?: number;
  distance?: number;
}

export const MAX_SEED = 999_999;

export function parseSeed(s: string | null | undefined): number | undefined {
  if (!s || !/^\d+$/.test(s.trim())) return undefined;
  const n = Number(s.trim());
  return n >= 1 && n <= MAX_SEED ? n : undefined;
}

export function parseUrlOptions(hash: string): UrlOptions {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const out: UrlOptions = {};
  const type = parseWorldType(params.get("monde"));
  if (type) out.type = type;
  const seed = parseSeed(params.get("graine"));
  if (seed !== undefined) out.seed = seed;
  const hour = Number(params.get("heure"));
  if (params.has("heure") && Number.isFinite(hour) && hour >= 0 && hour < 24) out.hour = hour;
  const distance = Number(params.get("distance"));
  if (params.has("distance") && Number.isFinite(distance) && distance >= 16 && distance <= 256) out.distance = Math.round(distance);
  return out;
}

export function formatUrlOptions(type: WorldTypeId, seed: number): string {
  return `#monde=${type}&graine=${seed}`;
}
