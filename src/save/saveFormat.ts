import type { NightLength } from "../engine/dayNight";
import { isInventoryBlockId, type InventoryData } from "../engine/inventory";
import { parseWorldType, type WorldTypeId } from "../engine/terrain";
import { parseReadingLevel, type ReadingLevel } from "../edu/texts";

/**
 * Formats de sauvegarde (J4, fonctions pures). Tout ce qui est lu (stockage
 * local, fichier importé) passe par les fonctions parse* : une donnée abîmée ou
 * inconnue est ignorée ou remplacée par une valeur par défaut, jamais une erreur
 * qui bloquerait l'enfant.
 */

export const SAVE_VERSION = 1;
export const PROFILE_COUNT = 2;
export const WORLD_SLOTS = 3;
export const MAX_NAME_LENGTH = 16;

/** Clés du stockage local, toutes préfixées « cubes: » (règle 7). */
export const KEYS = {
  profiles: "cubes:profils",
  settings: "cubes:reglages",
  world: (profileId: string, slot: number) => `cubes:monde:${profileId}:${slot}`,
} as const;

export interface Profile {
  /** Identifiant stable (« p1 », « p2 ») : les mondes y sont rattachés, le prénom peut changer. */
  id: string;
  name: string;
  level: ReadingLevel;
  voice: boolean;
  /** Avatar choisi (index dans AVATARS), null tant que l'enfant n'a pas choisi. */
  avatar: number | null;
  /** Tutoriel (mission 0) fini dans un de ses mondes : les mondes suivants commencent à la mission 1 (J6). */
  tutorialDone: boolean;
}

export type { NightLength };
export const NIGHT_LENGTHS: readonly { id: NightLength; name: string }[] = [
  { id: "normale", name: "normale (3 minutes)" },
  { id: "courte", name: "courte (1 minute)" },
  { id: "aucune", name: "pas de nuit" },
];

export interface Settings {
  night: NightLength;
  /** Grignotes actives (J5). */
  creatures: boolean;
  /** Panneau « Tests » et ligne d'infos techniques affichés pendant les parties des enfants (J7 ; masqués par défaut). */
  devTools: boolean;
}

export const DEFAULT_SETTINGS: Settings = { night: "normale", creatures: true, devTools: false };

export interface WorldSave {
  version: number;
  /** Version du générateur de terrain au moment de la sauvegarde (voir GENERATOR_VERSION). */
  gen: number;
  type: WorldTypeId;
  seed: number;
  /** Écart avec le monde d'origine, en base64 (voir worldDiff). */
  edits: string;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  inventory: InventoryData;
  /** Phase du cycle jour/nuit [0, 1). */
  phase: number;
  /** Date de la sauvegarde (ms depuis 1970). */
  savedAt: number;
  /** Progression de la mission (J5), relue et vérifiée par MissionRunner ; absente avant le J5. */
  mission?: unknown;
  /** Cadeau de fin de mission pas encore entré dans le sac (sac plein) : nombre de blocs à donner (J6). */
  reward?: { block: number; count: number };
  /** Écran de félicitations pas encore montré (partie quittée juste après la fin de la mission) (J6). */
  celebrate?: boolean;
}

export interface ExportFile {
  app: "cubes";
  version: number;
  exportedAt: number;
  profiles: Profile[];
  settings: Settings;
  /** Mondes par clé de stockage (KEYS.world). */
  worlds: Record<string, WorldSave>;
  /** Copies de secours par clé de stockage (KEYS.world + « :secours ») (J7 ; absentes des exports plus anciens). */
  backups?: Record<string, WorldSave>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Prénom nettoyé : espaces réduits, longueur bornée ; vide → nom par défaut. */
export function cleanName(v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = v.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return s || fallback;
}

export function defaultProfiles(): Profile[] {
  return [
    { id: "p1", name: "Joueur 1", level: "debutant", voice: true, avatar: null, tutorialDone: false },
    { id: "p2", name: "Joueur 2", level: "autonome", voice: false, avatar: null, tutorialDone: false },
  ];
}

/** Profils lus, ou null si la donnée n'en contient aucun de valide (premier lancement). */
export function parseProfiles(raw: unknown, avatarCount: number): Profile[] | null {
  const list = isObj(raw) && Array.isArray(raw.profiles) ? raw.profiles : Array.isArray(raw) ? raw : null;
  if (!list) return null;
  const defaults = defaultProfiles();
  const out: Profile[] = [];
  for (let i = 0; i < PROFILE_COUNT; i++) {
    const p: unknown = list[i];
    const d = defaults[i]!;
    if (!isObj(p)) return null;
    const level = parseReadingLevel(p.level) ?? d.level;
    const avatar = Number.isInteger(p.avatar) && (p.avatar as number) >= 0 && (p.avatar as number) < avatarCount ? (p.avatar as number) : null;
    out.push({
      id: d.id,
      name: cleanName(p.name, d.name),
      level,
      voice: typeof p.voice === "boolean" ? p.voice : level === "debutant",
      avatar,
      tutorialDone: p.tutorialDone === true,
    });
  }
  return out;
}

export function parseSettings(raw: unknown): Settings {
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
  const night = NIGHT_LENGTHS.some((n) => n.id === raw.night) ? (raw.night as NightLength) : DEFAULT_SETTINGS.night;
  const creatures = typeof raw.creatures === "boolean" ? raw.creatures : DEFAULT_SETTINGS.creatures;
  const devTools = typeof raw.devTools === "boolean" ? raw.devTools : DEFAULT_SETTINGS.devTools;
  return { night, creatures, devTools };
}

/** Monde lu, ou null si la donnée est inutilisable. */
export function parseWorldSave(raw: unknown): WorldSave | null {
  if (!isObj(raw)) return null;
  const type = parseWorldType(typeof raw.type === "string" ? raw.type : null);
  if (!type || !num(raw.seed) || !Number.isInteger(raw.seed) || typeof raw.edits !== "string") return null;
  const p = raw.player;
  if (!isObj(p) || !num(p.x) || !num(p.y) || !num(p.z)) return null;
  const inv = raw.inventory;
  const slots = isObj(inv) && Array.isArray(inv.slots) ? inv.slots : [];
  return {
    version: num(raw.version) ? raw.version : SAVE_VERSION,
    gen: num(raw.gen) ? raw.gen : 1,
    type,
    seed: raw.seed,
    edits: raw.edits,
    player: { x: p.x, y: p.y, z: p.z, yaw: num(p.yaw) ? p.yaw : 0, pitch: num(p.pitch) ? p.pitch : 0 },
    inventory: {
      slots: slots.map((s: unknown) =>
        Array.isArray(s) && isInventoryBlockId(s[0]) && num(s[1]) ? ([s[0], s[1]] as [number, number]) : null,
      ),
    },
    phase: num(raw.phase) ? ((raw.phase % 1) + 1) % 1 : 0,
    savedAt: num(raw.savedAt) ? raw.savedAt : 0,
    ...(isObj(raw.mission) ? { mission: raw.mission } : {}),
    ...(isObj(raw.reward) && isInventoryBlockId(raw.reward.block) && Number.isInteger(raw.reward.count) && (raw.reward.count as number) > 0
      ? { reward: { block: raw.reward.block, count: Math.min(raw.reward.count as number, 99) } }
      : {}),
    ...(raw.celebrate === true ? { celebrate: true } : {}),
  };
}

/** Fichier d'export lu, ou null s'il ne vient pas de Cubes ou est inutilisable. */
export function parseExport(raw: unknown, avatarCount: number): ExportFile | null {
  if (!isObj(raw) || raw.app !== "cubes") return null;
  const profiles = parseProfiles(raw.profiles, avatarCount);
  if (!profiles) return null;
  const worlds: Record<string, WorldSave> = {};
  const backups: Record<string, WorldSave> = {};
  for (const p of profiles) {
    for (let s = 0; s < WORLD_SLOTS; s++) {
      const k = KEYS.world(p.id, s);
      const w = isObj(raw.worlds) ? parseWorldSave(raw.worlds[k]) : null;
      if (w) worlds[k] = w;
      const b = isObj(raw.backups) ? parseWorldSave(raw.backups[`${k}:secours`]) : null;
      if (b) backups[`${k}:secours`] = b;
    }
  }
  return {
    app: "cubes",
    version: num(raw.version) ? raw.version : SAVE_VERSION,
    exportedAt: num(raw.exportedAt) ? raw.exportedAt : 0,
    profiles,
    settings: parseSettings(raw.settings),
    worlds,
    ...(Object.keys(backups).length > 0 ? { backups } : {}),
  };
}

/** Nom du fichier d'export : cubes-sauvegarde-AAAA-MM-JJ.json (date locale). */
export function exportFileName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `cubes-sauvegarde-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

/** Date courte d'une sauvegarde pour la vignette : « aujourd'hui », « hier » ou « 12/09 ». */
export function savedLabel(savedAt: number, now: number): string {
  if (!(savedAt > 0)) return "";
  const d = new Date(savedAt);
  const today = new Date(now);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
