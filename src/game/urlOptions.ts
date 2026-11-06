import { parseReadingLevel, type ReadingLevel } from "../edu/texts";
import { parseWorldType, type WorldTypeId } from "../engine/terrain";
import { parseSlotHoldMs } from "../input/slotHold";

/**
 * Options de démarrage lues dans l'adresse, après le « # » (fonctionne en
 * `file://`) : `cubes.html#monde=ile&graine=1234&heure=20&distance=48`.
 * Sert aux tests et à retrouver un monde précis (même type + même graine =
 * même monde). Les valeurs invalides sont ignorées. Mode adresse (V2 lot 1) :
 * `#mission=2` lance la mission 2 « Les mots », `&lecture=autonome` choisit le
 * niveau de lecture (débutant par défaut), `&appui=800` la durée de l'appui long
 * qui vide une case (ms, de 500 à 2 000).
 */
export interface UrlOptions {
  type?: WorldTypeId;
  seed?: number;
  hour?: number;
  distance?: number;
  /** Mode adresse : Grignotes (J5) seulement si demandées (#creatures=1), pour ne pas perturber les tests. */
  creatures?: boolean;
  /** Mode adresse : compagnon et mission seulement si demandés : #mission=0 (tutoriel, J6), 1 (mission 1) ou 2 (mission 2, V2 lot 1). */
  mission?: 0 | 1 | 2;
  /** Mode adresse : niveau de lecture (&lecture=debutant ou autonome, accents et casse tolérés) (V2 lot 1). */
  lecture?: ReadingLevel;
  /**
   * Mode adresse : durée de l'appui long qui vide une case (&appui=800, ms de 500 à 2 000, arrondie ; sinon ignorée).
   * Le mode adresse ne lit pas les réglages du mode parent : sans cette option, 1 s.
   */
  slotHoldMs?: number;
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
  if (params.get("creatures") === "1") out.creatures = true;
  const mission = params.get("mission");
  if (mission === "0" || mission === "1" || mission === "2") out.mission = mission === "0" ? 0 : mission === "1" ? 1 : 2;
  const lecture = parseReadingLevel(params.get("lecture"));
  if (lecture) out.lecture = lecture;
  const appui = parseSlotHoldMs(params.get("appui"));
  if (appui !== undefined) out.slotHoldMs = appui;
  return out;
}

/** Distance valide pour l'adresse et le stockage : entière, de 16 à 256 blocs. */
export function parseDistance(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return undefined;
  const d = Number(v);
  return Number.isFinite(d) && d >= 16 && d <= 256 ? Math.round(d) : undefined;
}

/**
 * Adresse du monde affiché ; la distance n'y figure que si elle diffère de la valeur par défaut (J3 : elle n'est plus
 * effacée au rechargement). La durée de l'appui long (&appui=…) y reste quand l'adresse l'a donnée : l'adulte qui
 * l'essaie peut recharger (F5) sans revenir à 1 s.
 */
export function formatUrlOptions(type: WorldTypeId, seed: number, distance?: number, defaultDistance?: number, slotHoldMs?: number): string {
  const d = distance !== undefined && distance !== defaultDistance ? `&distance=${distance}` : "";
  const a = slotHoldMs !== undefined ? `&appui=${slotHoldMs}` : "";
  return `#monde=${type}&graine=${seed}${d}${a}`;
}
