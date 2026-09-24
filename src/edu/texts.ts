/**
 * Textes adressés à l'enfant (J2). Chaque message existe TOUJOURS en deux
 * variantes :
 * - débutant (6 ans, CP, déchiffre) : 1 à 4 mots simples, lus à voix haute ;
 * - autonome (8 ans, CE2) : une ou deux phrases courtes et complètes.
 *
 * Ton gentil et encourageant, jamais de reproche. Formulations neutres
 * (« Appuie longtemps » plutôt que « Reste appuyé·e ») : le jeu ne connaît
 * pas encore l'enfant (profils au J4).
 *
 * Typographie française : une espace insécable (NBSP) précède « ! ? : ; »,
 * pour que le signe ne passe jamais seul à la ligne dans le bandeau.
 */

/** Espace insécable, placée devant « ! ? : ; » dans tous les textes. */
export const NBSP = "\u00a0";

/** Niveau de lecture d'un profil. */
export type ReadingLevel = "debutant" | "autonome";

/** Niveaux proposés dans les réglages, dans l'ordre d'affichage. */
export const READING_LEVELS: readonly { id: ReadingLevel; name: string }[] = [
  { id: "debutant", name: "débutant (6 ans)" },
  { id: "autonome", name: "autonome (8 ans)" },
];

/** Texte adressé à l'enfant, dans ses deux variantes. */
export interface ChildText {
  debutant: string;
  autonome: string;
}

/** Choisit la variante correspondant au niveau de lecture. */
export function pick(t: ChildText, level: ReadingLevel): string {
  return level === "autonome" ? t.autonome : t.debutant;
}

/**
 * Lit un niveau de lecture (réglage stocké, option d'URL). Tolère la casse,
 * les espaces autour et les accents (« Débutant » → "debutant").
 * Toute autre valeur : null.
 */
export function parseReadingLevel(v: unknown): ReadingLevel | null {
  if (typeof v !== "string") return null;
  const s = v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // accents (diacritiques combinants après NFD)
  return s === "debutant" || s === "autonome" ? s : null;
}

// Messages fixes.

/** Poser un bloc là où l'enfant se tient. */
export const NO_SPACE: ChildText = {
  debutant: `Pas de place${NBSP}!`,
  autonome: `Pas de place${NBSP}: tu te tiens ici. Recule un peu${NBSP}!`,
};

/** Casser la couche du bas (incassable). */
export const BOTTOM_LAYER: ChildText = {
  debutant: "Ça ne se casse pas.",
  autonome: "Le sol tout en bas ne se casse pas.",
};

/** Viser ou poser hors du monde. */
export const WORLD_EDGE: ChildText = {
  debutant: `Trop loin${NBSP}!`,
  autonome: `Trop loin${NBSP}: le monde s'arrête ici.`,
};

/** Clic ou tape trop bref pour casser. */
export const HOLD_TO_BREAK: ChildText = {
  debutant: `Appuie longtemps${NBSP}!`,
  autonome: "Appuie longtemps sur un bloc pour le casser.",
};

/** Poser avec une case vide. */
export const EMPTY_HAND: ChildText = {
  debutant: "Ta case est vide.",
  autonome: `Cette case est vide${NBSP}: casse des blocs pour les ramasser.`,
};

/** Sac plein : 9 types de blocs déjà ramassés, plus de case libre. */
export const FULL_BAG: ChildText = {
  debutant: `Ton sac est plein${NBSP}!`,
  autonome: `Ton sac est plein${NBSP}: pose tous les blocs d'une case pour la vider.`,
};

/** Fleur posée sans bloc plein dessous, ou dans l'eau (voir Game.placeBlock). */
export const FLOWER_NEEDS_GROUND: ChildText = {
  debutant: `Pose-la sur le sol${NBSP}!`,
  autonome: "Une fleur se pose sur un bloc, pas dans le vide ni dans l'eau.",
};

/** Début de partie. */
export const WELCOME: ChildText = {
  debutant: `Casse des blocs${NBSP}!`,
  autonome: "Appuie longtemps sur un bloc pour le casser et le ramasser.",
};
