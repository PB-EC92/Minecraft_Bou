import { numberWords } from "./counting";
import { NBSP, type ChildText, type ReadingLevel } from "./texts";
import { fillWord, sayWord, type WordVars } from "./wordLists";

/**
 * Textes de la mission 2 « Les mots » (V2 lot 1). Ce sont des gabarits : le jeu les remplit avec fillWord
 * (wordLists.ts) avant de les montrer ou de les dire. Ils vivent ici et non dans texts.ts, dont le test des
 * constantes refuserait les gabarits bruts ; leur propre test les vérifie une fois remplis.
 *
 * Deux variantes, toujours : débutant (message fixe d'au plus 5 mots) et autonome (phrases complètes). Formes dites :
 * nombres en lettres, lettres par leur nom ({nom}), mots en minuscules ({mot}) et « a, bé, cé » pour ABC ; une voix
 * lirait sinon « AMI » comme un sigle. Quand la forme dite d'un niveau n'est pas donnée par la conception, c'est
 * la forme écrite avec ces mêmes remplacements. Aucun texte ne parle de la lampe ni des Grignotes (décision 6 de
 * Pierre : la lampe est à découvrir).
 *
 * Typographie : espace insécable devant ! ? : ; et à l'intérieur des guillemets « ».
 */

/** Gabarit avec sa forme dite (par défaut, la forme écrite est lue). */
export interface SaidTemplate {
  text: ChildText;
  spoken?: ChildText;
}

/* ---------- Mission et étape 0 ---------- */

export const M2_INTRO: ChildText = {
  debutant: `Écrivons des mots ensemble${NBSP}!`,
  autonome: `J'ai une boîte pleine de lettres${NBSP}! Avec elles, on peut écrire des mots dans le monde.`,
};

/** Mission 1 finie la nuit : on attend le matin (le temps file). */
export const MISSION_2_TOMORROW: ChildText = {
  debutant: `Demain, on écrira des mots${NBSP}!`,
  autonome: `Attendons le matin${NBSP}: je te montrerai ma boîte à lettres.`,
};

/** Étape 0, souris et clavier. */
export const M2_STEP_LETTER: SaidTemplate = {
  text: {
    debutant: "Appuie sur 0, puis pose.",
    autonome: "Appuie sur la touche 0 ou clique sur la case ABC au bout de la barre, choisis une lettre, puis pose-la avec un clic droit.",
  },
  spoken: {
    debutant: "Appuie sur la touche zéro, choisis une lettre, puis pose-la avec le clic droit.",
    autonome: "Appuie sur la touche zéro ou clique sur la case a, bé, cé au bout de la barre, choisis une lettre, puis pose-la avec un clic droit.",
  },
};

/** Étape 0, au doigt. */
export const M2_STEP_LETTER_TOUCH: SaidTemplate = {
  text: {
    debutant: "Touche ABC, pose une lettre.",
    autonome: "Touche la case ABC au bout de la barre, choisis une lettre, puis tape l'écran pour la poser.",
  },
  spoken: {
    debutant: "Touche la case a, bé, cé, puis pose une lettre.",
    autonome: "Touche la case a, bé, cé au bout de la barre, choisis une lettre, puis tape l'écran pour la poser.",
  },
};

/** Conseil de l'étape 0 (identique sur tous les appareils, aucun chiffre). */
export const M2_STEP0_HINT: SaidTemplate = {
  text: {
    debutant: `Cherche la case ABC${NBSP}!`,
    autonome: "La case ABC est au bout de la barre du bas, juste après tes blocs.",
  },
  spoken: {
    debutant: `Cherche la case a, bé, cé${NBSP}!`,
    autonome: "La case a, bé, cé est au bout de la barre du bas, juste après tes blocs.",
  },
};

/* ---------- Consignes d'écriture ---------- */

/** Écrire un mot : copie pour le débutant, dictée pour l'autonome (forme dite par Narrator.dictate). */
export const M2_STEP_WORD: SaidTemplate = {
  text: { debutant: "Écris {MOT}.", autonome: "Écris le mot que j'ai dit." },
  spoken: { debutant: `Écris {mot}${NBSP}: {lettres}.`, autonome: `Écris le mot${NBSP}: {mot}. {phrase} {Mot}.` },
};

/** Lecteur autonome passé en copie (mot entier dévoilé, ou pas de voix) : variante autonome seulement (voix normale). */
export const M2_STEP_WORD_COPY: SaidTemplate = {
  text: { debutant: "Écris {MOT}.", autonome: `Recopie le mot${NBSP}: {MOT}.` },
  spoken: { debutant: `Écris {mot}${NBSP}: {lettres}.`, autonome: `Recopie le mot${NBSP}: {mot}.` },
};

/** Écrire son prénom (sans accent). */
export const M2_STEP_NAME: SaidTemplate = {
  text: { debutant: `Écris ton prénom${NBSP}: {MOT}.`, autonome: "Pour finir, écris ton prénom avec les lettres." },
  spoken: { debutant: `Écris ton prénom${NBSP}: {prenom}. {lettres}.`, autonome: "Pour finir, écris ton prénom avec les lettres." },
};

/** Prénom à accents pour le lecteur autonome : c'est une copie (variante autonome seulement). */
export const M2_STEP_NAME_COPY: SaidTemplate = {
  text: {
    debutant: `Écris ton prénom${NBSP}: {MOT}.`,
    autonome: `Pour finir, écris ton prénom avec les lettres. Les lettres n'ont pas d'accent${NBSP}: écris {MOT}.`,
  },
  spoken: {
    debutant: `Écris ton prénom${NBSP}: {prenom}. {lettres}.`,
    autonome: `Pour finir, écris ton prénom avec les lettres. Les lettres n'ont pas d'accent${NBSP}: écris {lettres}.`,
  },
};

/* ---------- Boîte et main ---------- */

/** Titre de la boîte à lettres (jamais lu : choisir une lettre dit son nom seul). */
export const TRAY_TITLE: ChildText = { debutant: "Choisis une lettre.", autonome: "Choisis la lettre à poser." };

/** Au PC seulement (jamais lu). */
export const TRAY_KEYBOARD: ChildText = {
  debutant: `Ou tape-la au clavier${NBSP}!`,
  autonome: "Tu peux aussi la taper au clavier.",
};

/**
 * Copie : la lettre choisie n'est pas celle attendue (elle reste en main). La variante autonome de la conception
 * (« Il faut la lettre {L}. ») était plus courte que la débutante : elle dit en plus quoi faire.
 */
export const TRAY_WRONG_PICK: SaidTemplate = {
  text: { debutant: `Cherche la lettre {L}${NBSP}!`, autonome: `Il faut la lettre {L}${NBSP}: rouvre la boîte pour la choisir.` },
  spoken: {
    debutant: "Ça, c'est un {nomChoisi}. Cherche la lettre {nom}.",
    autonome: `Il faut la lettre {nom}${NBSP}: rouvre la boîte pour la choisir.`,
  },
};

/** Lettre choisie et pas posée depuis LETTER_IN_HAND_MS, au doigt. */
export const LETTER_IN_HAND_TOUCH: ChildText = {
  debutant: "Tape l'écran pour la poser.",
  autonome: `La lettre est dans ta main${NBSP}: vise le sol avec la croix, puis tape l'écran pour la poser.`,
};

/** Même cas, à la souris. */
export const LETTER_IN_HAND_MOUSE: ChildText = {
  debutant: "Clic droit pour la poser.",
  autonome: `La lettre est dans ta main${NBSP}: vise le sol avec la croix, puis fais un clic droit pour la poser.`,
};

/* ---------- Aide de la copie ---------- */

export const GHOST_LINE: SaidTemplate = {
  text: { debutant: `Remplis les cases claires${NBSP}!`, autonome: "Pose chaque lettre dans une case claire, de gauche à droite." },
  spoken: {
    debutant: "Pose les lettres dans les cases claires, de gauche à droite.",
    autonome: "Pose chaque lettre dans une case claire, de gauche à droite.",
  },
};

/**
 * Copie : la lettre suivante (au bout de COPY_SAY_NEXT_MS sans progrès, puis toutes les COPY_REPEAT_MS). La variante
 * autonome de la conception (« Lettre suivante : {L}. ») était plus courte que la débutante : une phrase complète.
 */
export const NEXT_LETTER: SaidTemplate = {
  text: { debutant: `Maintenant, la lettre {L}${NBSP}!`, autonome: `Maintenant, pose la lettre suivante du mot${NBSP}: un {L}.` },
  spoken: {
    debutant: `Maintenant, la lettre {nom}${NBSP}!`,
    autonome: `Maintenant, pose la lettre suivante du mot${NBSP}: un {nom}.`,
  },
};

/** Lieu de la lettre donnée ({ou} de GIVE_LETTER) : dans le fantôme suivant s'il y en a un, sinon devant l'enfant. */
export const PLACE_WHERE: { readonly ghost: string; readonly ahead: string } = {
  ghost: "dans la case claire",
  ahead: "devant toi",
};

/** La lettre attendue est mise dans la main de l'enfant. */
export const GIVE_LETTER: SaidTemplate = {
  text: { debutant: `Voici la lettre {L}${NBSP}!`, autonome: `Je te donne la lettre {L}${NBSP}: pose-la {ou}.` },
  spoken: { debutant: `Voici la lettre {nom}${NBSP}! Pose-la {ou}.`, autonome: `Je te donne la lettre {nom}${NBSP}: pose-la {ou}.` },
};

/* ---------- Corrections ---------- */

/** Copie : une lettre fausse (contour orange). */
export const WRONG_LETTER: SaidTemplate = {
  text: {
    debutant: "Ici, il faut un {L}.",
    autonome: `Presque${NBSP}! La {rang} lettre doit être un {L}${NBSP}: casse celle-ci et pose un {L}.`,
  },
  spoken: {
    debutant: "Ici, il faut un {nom}. Casse l'autre lettre, puis pose un {nom}.",
    autonome: `Presque${NBSP}! La {rang} lettre doit être un {nom}${NBSP}: casse celle-ci et pose un {nom}.`,
  },
};

/** Lettre fausse toujours là BREAK_TIP_MS plus tard, au doigt (seulement en mode Poser). */
export const BREAK_TIP_TOUCH: ChildText = {
  debutant: "Touche Poser, puis casse-la.",
  autonome: "Pour enlever une lettre, touche le bouton Poser (il devient Casser) et garde le doigt sur la lettre.",
};

/** Même cas, à la souris. */
export const BREAK_TIP_MOUSE: ChildText = {
  debutant: "Garde le clic gauche dessus.",
  autonome: "Pour enlever une lettre, vise-la et garde le clic gauche appuyé.",
};

export const EXTRA_LETTER: ChildText = {
  debutant: `Une lettre en trop${NBSP}!`,
  autonome: `Le mot est là, mais une lettre en trop est collée${NBSP}: casse-la.`,
};

/** Après validation d'un mot collé à un mot déjà écrit. */
export const SPACE_BETWEEN: ChildText = {
  debutant: `Un espace entre les mots${NBSP}!`,
  autonome: `La prochaine fois, laisse une case vide entre deux mots${NBSP}: sinon, les lettres se collent.`,
};

export const LEFT_TO_RIGHT: ChildText = {
  debutant: `De gauche à droite${NBSP}!`,
  autonome: `De ton côté, les lettres sont à l'envers${NBSP}: écris de gauche à droite, comme dans un livre.`,
};

/** Après validation d'un mot qui ne se lit que de l'autre côté. */
export const READ_OTHER_SIDE: ChildText = {
  debutant: `Fais le tour pour lire${NBSP}!`,
  autonome: `Ton mot est juste, mais il se lit de l'autre côté${NBSP}: fais le tour pour le lire.`,
};

export const HIDDEN_WORD: ChildText = {
  debutant: `Ton mot est caché${NBSP}!`,
  autonome: `Un bloc cache ton mot${NBSP}: il faut de la place devant les lettres pour pouvoir les lire.`,
};

export const TOWER: ChildText = {
  debutant: `Écris ton mot couché${NBSP}!`,
  autonome: `Une colonne de lettres se lit de haut en bas${NBSP}: écris plutôt ton mot couché, de gauche à droite.`,
};

/** Mot réussi (la forme dite du débutant épelle, puis dit le mot et sa phrase). */
export const WORD_DONE: SaidTemplate = {
  text: { debutant: `Tu as écrit {MOT}${NBSP}!`, autonome: `Bravo${NBSP}! Tu as écrit {MOT}.` },
  spoken: { debutant: `{lettres}${NBSP}: {mot}${NBSP}! Bravo${NBSP}! {phrase}`, autonome: `Bravo${NBSP}! Tu as écrit {mot}.` },
};

/** Prénom réussi : comme WORD_DONE, le prénom tel qu'enregistré à la place du mot et de sa phrase. */
export const WORD_DONE_NAME: SaidTemplate = {
  text: WORD_DONE.text,
  spoken: { debutant: `{lettres}${NBSP}: {prenom}${NBSP}! Bravo${NBSP}!`, autonome: `Bravo${NBSP}! Tu as écrit {prenom}.` },
};

/* ---------- Retours de la dictée (le lecteur autonome entend ensuite LISTEN_AGAIN, par dictate) ---------- */

export const DICT_WRONG: ChildText = {
  debutant: `Une lettre à changer${NBSP}!`,
  autonome: `Presque${NBSP}! La {rang} lettre n'est pas la bonne.`,
};

export const DICT_MISSING: ChildText = {
  debutant: "Il manque une lettre.",
  autonome: `Presque${NBSP}! Il manque une lettre. Redis le mot tout bas, son par son.`,
};

export const DICT_SWAP: ChildText = {
  debutant: `Deux lettres sont échangées${NBSP}!`,
  autonome: `Presque${NBSP}! Deux lettres ont échangé leur place${NBSP}: redis le mot lentement pour retrouver l'ordre des sons.`,
};

/**
 * Une lettre en trop au milieu du mot (LAMMPE pour LAMPE). En trop au début ou à la fin, le mot entier est là : c'est
 * EXTRA_LETTER, comme en copie.
 */
export const DICT_EXTRA: ChildText = {
  debutant: `Une lettre en trop${NBSP}!`,
  autonome: `Presque${NBSP}! Il y a une lettre en trop dans ton mot. Redis-le tout bas, son par son.`,
};

export const DICT_FAR: ChildText = {
  debutant: `Écoute encore le mot${NBSP}!`,
  autonome: "Ce n'est pas encore ce mot. Écoute-le encore une fois, puis corrige tes lettres.",
};

/**
 * Dit (dictate) après DICT_WRONG, DICT_MISSING, DICT_EXTRA et DICT_FAR. Jamais affiché, et dit seulement au lecteur
 * autonome (le débutant est toujours en copie) : les deux variantes sont identiques.
 */
export const LISTEN_AGAIN: ChildText = {
  debutant: `Écoute bien${NBSP}: {mot}.`,
  autonome: `Écoute bien${NBSP}: {mot}.`,
};

/* ---------- Indices de la dictée (forme dite par dictate) ---------- */

export const DICT_HELP_COUNT: SaidTemplate = {
  text: { debutant: "Le mot a {n} lettres.", autonome: `Indice${NBSP}: le mot a {n} lettres.` },
  spoken: {
    debutant: `Indice${NBSP}: le mot a {nLettres} lettres. Je le redis${NBSP}: {mot}.`,
    autonome: `Indice${NBSP}: le mot a {nLettres} lettres. Je le redis${NBSP}: {mot}.`,
  },
};

/** {astuce} : l'astuce du mot (écrite, ou dite dans la forme dite), vide s'il n'en a pas. */
export const DICT_HELP_FIRST: SaidTemplate = {
  text: { debutant: "Il commence par {L}.", autonome: `Indice${NBSP}: le mot commence par la lettre {L}. {astuce}` },
  spoken: {
    debutant: `Indice${NBSP}: le mot commence par la lettre {nom}. {astuce}`,
    autonome: `Indice${NBSP}: le mot commence par la lettre {nom}. {astuce}`,
  },
};

export const DICT_HELP_MORE: SaidTemplate = {
  text: { debutant: `Puis la lettre {L}${NBSP}!`, autonome: `Indice${NBSP}: la {rang} lettre est un {L}.` },
  spoken: {
    debutant: `Indice${NBSP}: la {rang} lettre est un {nom}.`,
    autonome: `Indice${NBSP}: la {rang} lettre est un {nom}.`,
  },
};

/** Mot entier dévoilé : on passe en copie. */
export const DICT_HELP_ALL: SaidTemplate = {
  text: { debutant: `Regarde${NBSP}: {MOT}.`, autonome: `Voici le mot en entier${NBSP}: recopie-le.` },
  spoken: { debutant: `Regarde${NBSP}: {mot}.`, autonome: `Voici le mot en entier${NBSP}: recopie-le.` },
};

/** Pas de voix française : la dictée devient une copie (affiché seulement). */
export const NO_VOICE_COPY: ChildText = {
  debutant: `Recopie ce mot${NBSP}!`,
  autonome: `Je n'ai pas de voix ici${NBSP}: recopie le mot affiché.`,
};

/* ---------- Fin ---------- */

/** Sans « Bravo » : l'écran de félicitations l'affiche déjà en titre. */
export const M2_OUTRO: ChildText = {
  debutant: "Tes mots sont bien écrits.",
  autonome: "Tous tes mots sont bien écrits. Garde la boîte à lettres pour écrire où tu veux.",
};

/** Récapitulatif dit sur l'écran de félicitations ({liste} : recapList ; {nMots} : nombre de mots en lettres). */
export const RECAP_SPOKEN: ChildText = {
  debutant: `Tu as écrit${NBSP}: {liste}.`,
  autonome: `Tu as écrit {nMots} mots${NBSP}: {liste}.`,
};

/**
 * Suffixe de l'aide d'écran quand la case ABC est là (jamais lu ; ce n'est pas une phrase : pas de majuscule ni de
 * ponctuation finale), comme HINT_EXTRAS dans texts.ts.
 */
export const LETTERS_HINT: ChildText = {
  debutant: `0${NBSP}: lettres`,
  autonome: `0 ou case ABC${NBSP}: lettres`,
};

/** Libellé de la case des lettres (sans variante, comme « Un abri »). */
export const LETTERS_LABEL = "ABC";

/**
 * Liste des mots écrits, pour RECAP_SPOKEN : mots dits en minuscules (forme `say`), le prénom tel qu'enregistré ;
 * « et » avant le dernier mot pour l'autonome (« lampe, cabane, planche et Tom »), virgules seules pour le débutant.
 */
export function recapList(words: readonly string[], level: ReadingLevel, name: string | null): string {
  const said = words.map((w) => sayWord(w, name));
  if (level === "debutant" || said.length < 2) return said.join(", ");
  return `${said.slice(0, -1).join(", ")} et ${said[said.length - 1] ?? ""}`;
}

/** Variables de RECAP_SPOKEN : la liste et le nombre de mots en lettres. */
export function recapVars(words: readonly string[], level: ReadingLevel, name: string | null): WordVars {
  return { liste: recapList(words, level, name), nMots: numberWords(words.length) };
}

/**
 * Ligne du récapitulatif de l'écran de félicitations (libellé sans variante, à côté des lettres-blocs) : débutant
 * « ami » (le prénom tel qu'enregistré : « Léa ») ; autonome « lampe (5 lettres) ».
 */
export function recapWordLabel(text: string, level: ReadingLevel, name: string | null): string {
  const said = sayWord(text, name);
  return level === "autonome" ? `${said} (${String(text.length)} lettres)` : said;
}

/**
 * Remplit un gabarit et sa forme dite. spokenVars : variables de la forme dite si elles diffèrent (l'astuce dite,
 * voir wordVars) ; par défaut, les mêmes.
 */
export function fillSaid(t: SaidTemplate | ChildText, vars: WordVars, spokenVars: WordVars = vars): { text: ChildText; spoken: ChildText } {
  const said: SaidTemplate = "text" in t ? t : { text: t };
  return { text: fillWord(said.text, vars), spoken: fillWord(said.spoken ?? said.text, spokenVars) };
}

