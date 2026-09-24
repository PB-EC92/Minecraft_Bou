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
  const distance = parseDistance(params.get("distance"));
  if (distance !== undefined) out.distance = distance;
  return out;
}

/** Distance valide pour l'adresse et le stockage : entière, de 16 à 256 blocs. */
export function parseDistance(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return undefined;
  const d = Number(v);
  return Number.isFinite(d) && d >= 16 && d <= 256 ? Math.round(d) : undefined;
}

/** Adresse du monde affiché ; la distance n'y figure que si elle diffère de la valeur par défaut (J3 : elle n'est plus effacée au rechargement). */
export function formatUrlOptions(type: WorldTypeId, seed: number, distance?: number, defaultDistance?: number): string {
  const d = distance !== undefined && distance !== defaultDistance ? `&distance=${distance}` : "";
  return `#monde=${type}&graine=${seed}${d}`;
}
