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
  autonome: "Vise un bloc avec la croix et appuie longtemps pour le casser.",
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

/** Fleur posée sans bloc plein dessous (voir Game.placeBlock). */
export const FLOWER_NEEDS_GROUND: ChildText = {
  debutant: `La fleur va au sol${NBSP}!`,
  autonome: "Une fleur se pose sur un bloc, pas dans le vide.",
};

/** Fleur posée dans l'eau (l'enfant vise le fond d'une mare : le sol est bien là, mais sous l'eau). */
export const FLOWER_IN_WATER: ChildText = {
  debutant: `Pas dans l'eau${NBSP}!`,
  autonome: "Une fleur ne se pose pas dans l'eau.",
};

/** Souris libérée (Échap) : comment reprendre. */
export const MOUSE_RESUME: ChildText = {
  debutant: `Clique pour jouer${NBSP}!`,
  autonome: "Clique sur le monde pour reprendre la partie.",
};

/** Capture de la souris refusée par le navigateur : mode repli (glisser pour regarder). */
export const MOUSE_FALLBACK: ChildText = {
  debutant: "Glisse pour regarder.",
  autonome: "Glisse en tenant le bouton pour regarder. Garde le clic gauche sans bouger pour casser.",
};

/** Image 3D perdue (tablette passée à une autre appli) : elle revient seule. */
export const IMAGE_LOST: ChildText = {
  debutant: "Attends un peu.",
  autonome: "L'image s'est arrêtée. Attends, le monde revient.",
};

/** Image 3D revenue. */
export const IMAGE_BACK: ChildText = {
  debutant: `Le monde est revenu${NBSP}!`,
  autonome: "Le monde est revenu, tu peux continuer.",
};

/** Début de partie. */
export const WELCOME: ChildText = {
  debutant: `Casse des blocs${NBSP}!`,
  autonome: "Vise un bloc avec la croix et appuie longtemps pour le ramasser.",
};

/**
 * Aides permanentes en bas de l'écran (commandes), selon l'appareil et, au
 * doigt, selon le mode Casser / Poser (le bouton affiche le mode en cours).
 * Plus longues que les messages : elles restent affichées et servent aussi à
 * l'adulte. Forme unique « geste : verbe », même verbe dans les deux niveaux.
 */
export const HINTS: {
  readonly touch: ChildText;
  readonly touchPlace: ChildText;
  readonly mouse: ChildText;
  readonly mouseFallback: ChildText;
} = {
  touch: {
    debutant: `Rond${NBSP}: marcher · glisse${NBSP}: regarder · garde le doigt${NBSP}: casser · touche Casser${NBSP}: poser`,
    autonome:
      `Rond en bas à gauche${NBSP}: marcher · glisse ailleurs${NBSP}: regarder · vise avec la croix du milieu et garde le doigt immobile${NBSP}: casser · ` +
      `touche le bouton Casser, il devient Poser, puis tape${NBSP}: poser`,
  },
  touchPlace: {
    debutant: `Rond${NBSP}: marcher · glisse${NBSP}: regarder · tape${NBSP}: poser · touche Poser${NBSP}: casser`,
    autonome:
      `Rond en bas à gauche${NBSP}: marcher · glisse ailleurs${NBSP}: regarder · vise avec la croix du milieu et tape${NBSP}: poser · ` +
      `touche le bouton Poser, il redevient Casser${NBSP}: casser`,
  },
  mouse: {
    debutant: `Clique pour jouer · ZQSD${NBSP}: marcher · clic gauche gardé${NBSP}: casser · clic droit${NBSP}: poser`,
    autonome:
      `Clique pour capturer la souris · ZQSD${NBSP}: marcher · Espace${NBSP}: sauter ou nager · Maj${NBSP}: plonger\n` +
      `Clic gauche gardé${NBSP}: casser · clic droit${NBSP}: poser · 1 à 9 ou molette${NBSP}: choisir · Échap${NBSP}: libérer la souris`,
  },
  mouseFallback: {
    debutant: `Glisse${NBSP}: regarder · clic gauche gardé${NBSP}: casser · clic droit${NBSP}: poser`,
    autonome:
      `Glisse en tenant le bouton${NBSP}: regarder · ZQSD${NBSP}: marcher · Espace${NBSP}: sauter ou nager\n` +
      `Clic gauche gardé sans bouger${NBSP}: casser · clic droit${NBSP}: poser · 1 à 9 ou molette${NBSP}: choisir`,
  },
};

/* ---------- Écran d'accueil et sauvegarde (J4) ---------- */

export const WHO_PLAYS: ChildText = {
  debutant: `Qui joue${NBSP}?`,
  autonome: `Qui joue${NBSP}? Touche ton prénom.`,
};

export const CHOOSE_AVATAR: ChildText = {
  debutant: `Choisis ton personnage${NBSP}!`,
  autonome: `Choisis le personnage qui jouera pour toi.`,
};

export const CHOOSE_SLOT: ChildText = {
  debutant: `Choisis ton monde${NBSP}!`,
  autonome: `Continue un de tes mondes, ou crée-en un nouveau.`,
};

export const CHOOSE_WORLD_TYPE: ChildText = {
  debutant: `Quel monde${NBSP}?`,
  autonome: `Quel genre de monde veux-tu créer${NBSP}?`,
};

export const SAVED: ChildText = {
  debutant: `C'est enregistré${NBSP}!`,
  autonome: `Ton monde est enregistré.`,
};

export const VIEW_THIRD: ChildText = {
  debutant: `Tu te vois${NBSP}!`,
  autonome: `Tu te vois jouer. Touche encore l'œil pour revenir.`,
};

export const VIEW_FIRST: ChildText = {
  debutant: `Tu vois par tes yeux.`,
  autonome: `Tu vois de nouveau par tes yeux.`,
};

/* ---------- Nuit, créatures, compagnon (J5) ---------- */

export const NIGHT_COMING: ChildText = {
  debutant: `La nuit arrive${NBSP}!`,
  autonome: `La nuit arrive${NBSP}: les Grignotes vont sortir. Une lampe les éloigne.`,
};

export const LAMP_SCARES: ChildText = {
  debutant: `Elles fuient la lampe${NBSP}!`,
  autonome: `Regarde${NBSP}: les Grignotes ont peur de la lumière de la lampe.`,
};

export const BUBBLES_FLY: ChildText = {
  debutant: `Des bulles${NBSP}!`,
  autonome: `Des bulles${NBSP}! Les Grignotes détestent ça.`,
};

/* ---------- Tutoriel, abri, fin de la mission 1 (J6) ---------- */

/** Abri presque fini : il manque le toit (Pixel le dit quand l'enfant se tient dans un abri incomplet). */
export const SHELTER_NO_ROOF: ChildText = {
  debutant: `Il manque le toit${NBSP}!`,
  autonome: `Il manque un toit au-dessus de ta tête. Astuce${NBSP}: avec des murs de trois blocs de haut, on pose le toit depuis l'intérieur.`,
};

export const SHELTER_NO_WALLS: ChildText = {
  debutant: `Il manque un mur${NBSP}!`,
  autonome: `Il manque des murs autour de toi${NBSP}: il en faut au moins trois.`,
};

/** Abri naturel (sous-bois) : il doit le construire lui-même. */
export const SHELTER_NOT_OWN: ChildText = {
  debutant: `Construis-le avec tes blocs${NBSP}!`,
  autonome: `Cet abri s'est fait tout seul${NBSP}: construis le tien avec les blocs de ton sac.`,
};

/**
 * Forme dite (lecteur débutant) du conseil « Il manque le toit » : l'astuce du toit, trop longue pour
 * l'écran d'un lecteur de CP (voir SHELTER_NO_ROOF), est dite à voix haute.
 */
export const SPOKEN_TIPS: { readonly noRoof: ChildText } = {
  noRoof: {
    debutant: `Il manque le toit${NBSP}! Fais des murs de trois blocs de haut, puis pose le toit depuis l'intérieur.`,
    autonome: `Il manque un toit au-dessus de ta tête. Astuce${NBSP}: avec des murs de trois blocs de haut, on pose le toit depuis l'intérieur.`,
  },
};

/** Pierre brillante, lampe ou bloc arc-en-ciel visés sac plein : on ne les casse pas (ils seraient perdus). */
export const FULL_BAG_KEEP: ChildText = {
  debutant: `Sac plein${NBSP}: vide une case${NBSP}!`,
  autonome: `Ton sac est plein${NBSP}: pose tous les blocs d'une case pour faire de la place, puis recommence.`,
};

/** Dernière étape de la mission 1, la nuit : l'enfant a repris sa lampe (elle est dans son sac). */
export const PLACE_LAMP_AGAIN: ChildText = {
  debutant: `Pose ta lampe${NBSP}!`,
  autonome: "Pose ta lampe près de toi, puis regarde ce que font les Grignotes.",
};

/** Dernière étape de la mission 1 : l'enfant est resté loin de sa lampe à la nuit tombée. */
export const BACK_TO_LAMP: ChildText = {
  debutant: `Reviens près de ta lampe${NBSP}!`,
  autonome: `Reviens près de ta lampe pour voir ce que font les Grignotes.`,
};

/** Cadeau de fin de mission qui attend une case libre (sac plein). */
export const REWARD_WAITING: ChildText = {
  debutant: `Vide une case du sac${NBSP}!`,
  autonome: `Ton cadeau t'attend${NBSP}: pose tous les blocs d'une case pour lui faire de la place.`,
};

/** Titre de l'écran de félicitations (prénom de l'enfant, ou rien en mode adresse). */
export function bravoTitle(name: string | null): ChildText {
  const who = name ? ` ${name}` : "";
  return { debutant: `Bravo${who}${NBSP}!`, autonome: `Bravo${who}, mission réussie${NBSP}!` };
}

