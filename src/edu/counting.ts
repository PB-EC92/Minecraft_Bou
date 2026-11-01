import { BlockId, isPlantId, LETTERS } from "../engine/blocks";
import { NBSP, type ChildText } from "./texts";

/**
 * Comptage (J2) : le jeu dit combien de blocs l'enfant a dans son sac
 * (« trois pierres ! »). Noms comptables accordés, nombres en toutes lettres
 * (orthographe traditionnelle), textes de ramassage en deux variantes.
 *
 * Deux formes pour chaque texte chiffré :
 * - affichée : nombres en chiffres dès 2 (« 3 pierres ! »), plus facile à lire ;
 * - dite : nombres en lettres accordés en genre (« vingt et une pierres ! »),
 *   car une voix de synthèse lirait « 21 pierres » au masculin.
 *
 * Apostrophe droite (') comme dans les autres textes du jeu.
 */

/** Nom comptable d'un type de bloc : singulier, pluriel, genre (accord de « un/une »). */
export interface CountNoun {
  one: string;
  many: string;
  feminine: boolean;
}

const NOUNS: ReadonlyMap<BlockId, CountNoun> = new Map<BlockId, CountNoun>([
  [BlockId.Grass, { one: "bloc d'herbe", many: "blocs d'herbe", feminine: false }],
  [BlockId.Dirt, { one: "bloc de terre", many: "blocs de terre", feminine: false }],
  [BlockId.Stone, { one: "pierre", many: "pierres", feminine: true }],
  [BlockId.Planks, { one: "planche", many: "planches", feminine: true }],
  [BlockId.Sand, { one: "bloc de sable", many: "blocs de sable", feminine: false }],
  [BlockId.Log, { one: "tronc", many: "troncs", feminine: false }],
  [BlockId.Water, { one: "bloc d'eau", many: "blocs d'eau", feminine: false }],
  [BlockId.Leaves, { one: "bloc de feuilles", many: "blocs de feuilles", feminine: false }],
  [BlockId.FlowerRed, { one: "fleur rouge", many: "fleurs rouges", feminine: true }],
  [BlockId.FlowerYellow, { one: "fleur jaune", many: "fleurs jaunes", feminine: true }],
  [BlockId.Snow, { one: "bloc de neige", many: "blocs de neige", feminine: false }],
  [BlockId.Cactus, { one: "cactus", many: "cactus", feminine: false }],
  [BlockId.Lamp, { one: "lampe", many: "lampes", feminine: true }],
  [BlockId.Fence, { one: "clôture", many: "clôtures", feminine: true }],
  [BlockId.GlowStone, { one: "pierre brillante", many: "pierres brillantes", feminine: true }],
  [BlockId.Rainbow, { one: "bloc arc-en-ciel", many: "blocs arc-en-ciel", feminine: false }],
  // V2 lot 1 : « un verre » seul se lirait comme un verre à boire.
  [BlockId.Glass, { one: "bloc de verre", many: "blocs de verre", feminine: false }],
  // Noms de secours : une lettre n'entre jamais dans le sac (mission 2).
  ...Array.from(LETTERS, (c, k): [BlockId, CountNoun] => [
    (BlockId.LetterA + k) as BlockId,
    { one: `lettre ${c}`, many: `lettres ${c}`, feminine: true },
  ]),
]);

/** Blocs qu'on ne trouve pas dans la nature : on les fabrique (V2 lot 1). */
export const MADE: ReadonlySet<BlockId> = new Set([BlockId.Planks, BlockId.Fence, BlockId.Glass]);

const GENERIC: CountNoun = { one: "bloc", many: "blocs", feminine: false };

/** Nom comptable d'un bloc (copie). Air ou identifiant inconnu : « bloc » / « blocs ». */
export function countNoun(id: BlockId): CountNoun {
  const n = NOUNS.get(id) ?? GENERIC;
  return { one: n.one, many: n.many, feminine: n.feminine };
}

const UNITS: readonly string[] = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
/** Dizaines de 20 à 60, indexées par le chiffre des dizaines. */
const TENS: readonly string[] = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 ≤ n ≤ 99, entier. */
function below100(n: number, feminine: boolean): string {
  if (n === 1) return feminine ? "une" : "un";
  if (n <= 16) return UNITS[n] ?? String(n);
  if (n < 20) return `dix-${UNITS[n - 10] ?? String(n - 10)}`;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens <= 6) {
    const base = TENS[tens] ?? String(tens * 10);
    if (unit === 0) return base;
    if (unit === 1) return `${base} et ${feminine ? "une" : "un"}`;
    return `${base}-${UNITS[unit] ?? String(unit)}`;
  }
  if (tens === 7) {
    // 70 à 79 : soixante-dix, soixante et onze, soixante-douze…
    return n === 71 ? "soixante et onze" : `soixante-${below100(n - 60, feminine)}`;
  }
  // 80 à 99 : quatre-vingts, quatre-vingt-un, quatre-vingt-onze…
  return n === 80 ? "quatre-vingts" : `quatre-vingt-${below100(n - 80, feminine)}`;
}

/** Nombre en toutes lettres (0 à 100), orthographe traditionnelle : « vingt et un », « soixante et onze »,
 *  « quatre-vingts », « quatre-vingt-un », « quatre-vingt-dix-neuf », « cent » ; féminin : un → une
 *  (« une », « vingt et une », « quatre-vingt-une »). Au-delà de 100 ou non entier : chiffres (String(n)). */
export function numberWords(n: number, feminine = false): string {
  if (!Number.isInteger(n) || n < 0 || n > 100) return String(n);
  if (n === 100) return "cent";
  return below100(n, feminine);
}

/** Singulier jusqu'à 1 (et pour 0), pluriel à partir de 2 : règle du français. */
function nounFor(noun: CountNoun, n: number): string {
  return Math.abs(n) >= 2 ? noun.many : noun.one;
}

/** Première lettre en majuscule. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * « de » devant un nom, élidé en « d' » devant une voyelle ou un h (traité
 * comme muet : aucun nom du jeu ne commence par un h aspiré).
 * Ex. « de pierres », « d'herbe », « d'eau ».
 */
export function withDe(noun: string): string {
  return /^[aeiouàâäéèêëîïôöùûüœæh]/i.test(noun) ? `d'${noun}` : `de ${noun}`;
}

/** Total de ramassage exploitable : partie entière, au moins 1 (NaN, infini ou total < 1 → 1). */
function pickupTotal(total: number): number {
  return Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 1;
}

/** Quantité écrite (affichage) : n = 1 → article en lettres « une pierre » / « un tronc » ; n ≥ 2 → chiffres « 3 pierres ». */
export function quantity(id: BlockId, n: number): string {
  const noun = countNoun(id);
  if (n === 1) return `${noun.feminine ? "une" : "un"} ${noun.one}`;
  return `${String(n)} ${nounFor(noun, n)}`;
}

/** Quantité dite (voix) : toujours en lettres, accordée : « trois pierres », « vingt et une pierres », « un tronc ». */
export function spokenQuantity(id: BlockId, n: number): string {
  const noun = countNoun(id);
  return `${numberWords(n, noun.feminine)} ${nounFor(noun, n)}`;
}

/** Au ramassage, total = nombre dans le sac APRÈS ajout.
 *  débutant : total 1 « Une pierre ! » ; total ≥ 2 « 3 pierres ! » (majuscule initiale).
 *  autonome : total 1 « Tu as ramassé ta première pierre ! » (« ton premier tronc », « ton premier bloc d'herbe ») ;
 *             total ≥ 2 « Tu as ramassé une pierre. Tu en as 3. »
 *  first : faux si ce type a déjà été ramassé dans ce monde (la case s'était vidée) : « premier » serait
 *  faux, on dit alors « Tu as ramassé une pierre. Tu en as une. ». Par défaut : vrai quand total = 1. */
export function pickupText(id: BlockId, total: number, first = pickupTotal(total) === 1): ChildText {
  const n = pickupTotal(total);
  if (n === 1) return first ? firstPickup(id) : againPickup(id);
  return {
    debutant: `${capitalize(quantity(id, n))}${NBSP}!`,
    autonome: `Tu as ramassé ${quantity(id, 1)}. Tu en as ${String(n)}.`,
  };
}

/** Palier de lecture à voix haute du compte : tous les PICKUP_VOICE_STEP blocs d'un même type. */
export const PICKUP_VOICE_STEP = 5;

/**
 * Le compte d'un ramassage doit-il être lu à voix haute ? (retour de la première séance J2 :
 * relu à chaque bloc, il devenait répétitif). Oui pour le premier bloc d'un type (ou le retour
 * d'un type dont la case s'était vidée : total 1) et à chaque palier (5, 10, 15…) ; sinon le
 * « pop » et le nombre à l'écran suffisent. voicePending : une lecture de ce même type attend
 * encore (appui maintenu, voir Narrator.snooze) ; on la remplace alors par le compte à jour,
 * pour que la voix ne dise pas « cinq » quand l'écran montre déjà 7.
 */
export function shouldSpeakPickup(total: number, voicePending = false): boolean {
  const n = pickupTotal(total);
  return voicePending || n === 1 || n % PICKUP_VOICE_STEP === 0;
}

/** Même contenu, pour la voix : nombres en lettres accordés (« Trois pierres ! », « … Tu en as trois. »). */
export function pickupSpeech(id: BlockId, total: number, first = pickupTotal(total) === 1): ChildText {
  const n = pickupTotal(total);
  if (n === 1) return first ? firstPickup(id) : againPickup(id);
  const noun = countNoun(id);
  return {
    debutant: `${capitalize(spokenQuantity(id, n))}${NBSP}!`,
    autonome: `Tu as ramassé ${spokenQuantity(id, 1)}. Tu en as ${numberWords(n, noun.feminine)}.`,
  };
}

/** Premier bloc d'un type : déjà en lettres, identique à l'écrit et à l'oral. */
function firstPickup(id: BlockId): ChildText {
  const noun = countNoun(id);
  return {
    debutant: `${capitalize(quantity(id, 1))}${NBSP}!`,
    autonome: `Tu as ramassé ${noun.feminine ? "ta première" : "ton premier"} ${noun.one}${NBSP}!`,
  };
}

/** Un seul bloc de ce type dans le sac, mais pas le premier ramassé : déjà en lettres, identique à l'écrit et à l'oral. */
function againPickup(id: BlockId): ChildText {
  const noun = countNoun(id);
  const one = noun.feminine ? "une" : "un";
  return {
    debutant: `${capitalize(quantity(id, 1))}${NBSP}!`,
    autonome: `Tu as ramassé ${quantity(id, 1)}. Tu en as ${one}.`,
  };
}

/** Case vidée par une pose : débutant « Plus de pierres ! » ; autonome « Tu n'as plus de pierres. Va en casser d'autres ! »
 *  (« cueillir » pour les fleurs, « fabriquer » pour les blocs fabriqués, voir MADE : « Tu n'as plus de blocs de verre.
 *  Va en fabriquer d'autres ! »). « de » s'élide en « d' » devant une voyelle ou un h muet (voir withDe). */
export function emptiedText(id: BlockId): ChildText {
  const many = withDe(countNoun(id).many);
  const verb = isPlantId(id) ? "cueillir" : MADE.has(id) ? "fabriquer" : "casser";
  return {
    debutant: `Plus ${many}${NBSP}!`,
    autonome: `Tu n'as plus ${many}. Va en ${verb} d'autres${NBSP}!`,
  };
}

/** Case de ce type déjà pleine (MAX 99) : débutant « 99, c'est le maximum ! » ; autonome « Tu as déjà 99 pierres : c'est le maximum. » */
export function maxStackText(id: BlockId, max: number): ChildText {
  return {
    debutant: `${String(max)}, c'est le maximum${NBSP}!`,
    autonome: `Tu as déjà ${quantity(id, max)}${NBSP}: c'est le maximum.`,
  };
}

/** Une Grignote a chipé un bloc (J5). « te la rende » / « te le rende » selon le genre du nom. */
export function stolenText(id: BlockId): ChildText {
  const noun = countNoun(id);
  return {
    debutant: `Une Grignote a pris ${quantity(id, 1)}${NBSP}!`,
    autonome: `Une Grignote a chipé ${quantity(id, 1)}${NBSP}! Lance-lui des bulles pour qu'elle te ${noun.feminine ? "la" : "le"} rende.`,
  };
}

/** Une Grignote touchée par une bulle rend le bloc chipé (J5). */
export function returnedText(id: BlockId): ChildText {
  return {
    debutant: `Elle te rend ${quantity(id, 1)}${NBSP}!`,
    autonome: `La Grignote te rend ${quantity(id, 1)}. Bravo${NBSP}!`,
  };
}

/**
 * Objectif « ramasser » atteint (J7) : le compte est dit à voix haute (« Six troncs ! Bravo ! »), la voix ne
 * lisant sinon les comptes qu'au premier bloc et aux paliers de 5 (J2.1). Écrit en chiffres, dit en lettres.
 */
export function goalReachedText(id: BlockId, n: number): { text: ChildText; spoken: ChildText } {
  return {
    text: {
      debutant: `${capitalize(quantity(id, n))}${NBSP}! Bravo${NBSP}!`,
      autonome: `Tu as ${quantity(id, n)}. Bravo, c'est fait${NBSP}!`,
    },
    spoken: {
      debutant: `${capitalize(spokenQuantity(id, n))}${NBSP}! Bravo${NBSP}!`,
      autonome: `Tu as ${spokenQuantity(id, n)}. Bravo, c'est fait${NBSP}!`,
    },
  };
}

/** Possessif accordé au nombre et au genre : « tes » (n ≥ 2), sinon « ta » ou « ton ». */
function yourFor(noun: CountNoun, n: number): string {
  return n >= 2 ? "tes" : noun.feminine ? "ta" : "ton";
}

/**
 * Les blocs d'une case, avec le possessif : « tes 2 fleurs rouges » (n ≥ 2, en chiffres à l'écrit, en lettres
 * accordées à l'oral : « tes deux fleurs rouges »), « ton bloc d'herbe », « ta fleur jaune » (n ≤ 1).
 */
function yourBlocks(id: BlockId, n: number, spoken: boolean): string {
  const noun = countNoun(id);
  if (n <= 1) return `${yourFor(noun, n)} ${noun.one}`;
  return `tes ${spoken ? numberWords(n, noun.feminine) : String(n)} ${noun.many}`;
}

/** Geste qui vide une case du sac (appui long, V2 lot 1) : le doigt, ou la touche de la case (key = 1 à 9). */
export type SlotGesture = { kind: "touch" } | { kind: "key"; key: number };

/**
 * Sac plein (J7) : quelle case vider, concrètement (« Pose tes 2 fleurs rouges ! »). id, n : la sorte proposée
 * et son nombre dans le sac (voir Game.fullBagAdvice).
 * gesture (V2 lot 1) : comment vider la case d'un appui long, au doigt (« garde le doigt sur leur case ») ou au
 * clavier (« garde la touche 4 enfoncée »). L'écrit du débutant ne change pas ; sa forme dite ajoute le geste,
 * nombres en lettres. Sans geste : textes du J7.
 */
export function emptySlotText(id: BlockId, n: number, gesture?: SlotGesture): { text: ChildText; spoken: ChildText } {
  const them = (spoken: boolean) => yourBlocks(id, n, spoken);
  const debutant = (spoken: boolean) => `Pose ${them(spoken)}${NBSP}!`;
  if (!gesture) {
    const make = (spoken: boolean): ChildText => ({
      debutant: debutant(spoken),
      autonome: `Ton sac est plein${NBSP}: pose ${them(spoken)} pour libérer une case.`,
    });
    return { text: make(false), spoken: make(true) };
  }
  const leur = n >= 2 ? "leur" : "sa";
  if (gesture.kind === "touch") {
    const autonome = (spoken: boolean) =>
      `Ton sac est plein${NBSP}: pose ${them(spoken)}, ou garde le doigt sur ${leur} case pour la vider.`;
    return {
      text: { debutant: debutant(false), autonome: autonome(false) },
      spoken: { debutant: `Pose ${them(true)}, ou garde le doigt sur ${leur} case.`, autonome: autonome(true) },
    };
  }
  const key = (spoken: boolean) => (spoken ? numberWords(gesture.key) : String(gesture.key));
  const autonome = (spoken: boolean) =>
    `Ton sac est plein${NBSP}: pose ${them(spoken)}, ou garde la touche ${key(spoken)} enfoncée pour vider ${leur} case.`;
  return {
    text: { debutant: debutant(false), autonome: autonome(false) },
    spoken: { debutant: `Pose ${them(true)}, ou garde la touche ${key(true)} enfoncée.`, autonome: autonome(true) },
  };
}

/**
 * Case vidée par un appui long (V2 lot 1). Débutant « Case vidée ! », à l'écrit comme à l'oral ; autonome
 * « Case vidée : tes 12 blocs de terre ont disparu. » (dit : « tes douze blocs de terre »), ou pour un seul bloc
 * « Case vidée : ta pierre a disparu. ».
 */
export function discardedText(id: BlockId, n: number): { text: ChildText; spoken: ChildText } {
  const debutant = `Case vidée${NBSP}!`;
  const make = (spoken: boolean): ChildText => ({
    debutant,
    autonome: `Case vidée${NBSP}: ${yourBlocks(id, n, spoken)} ${n >= 2 ? "ont" : "a"} disparu.`,
  });
  return { text: make(false), spoken: make(true) };
}

/**
 * Appui long sur une case qu'on ne vide pas (V2 lot 1, voir discardVerdict) : la lampe, le cadeau de fin de mission,
 * ou le bloc demandé par l'étape en cours. Sans chiffre (identique à l'écrit et à l'oral) et sans un mot sur les
 * Grignotes (décision 6 : la lampe est à découvrir).
 */
export function keepSlotText(id: BlockId, n: number, why: "keep-lamp" | "keep-gift" | "keep-goal"): ChildText {
  if (why === "keep-lamp") {
    return n >= 2
      ? { debutant: `Garde tes lampes${NBSP}!`, autonome: `Tes lampes sont précieuses${NBSP}: elles restent dans ton sac.` }
      : { debutant: `Garde ta lampe${NBSP}!`, autonome: `Ta lampe est précieuse${NBSP}: elle reste dans ton sac.` };
  }
  if (why === "keep-gift") {
    return {
      debutant: `Garde ton cadeau${NBSP}!`,
      autonome: `Ton cadeau reste dans ton sac${NBSP}: pose ses blocs pour décorer ton abri.`,
    };
  }
  const noun = countNoun(id);
  const them = `${yourFor(noun, n)} ${n >= 2 ? noun.many : noun.one}`;
  return {
    debutant: `Garde ${them}${NBSP}!`,
    autonome: `Garde ${them}${NBSP}: Pixel en a besoin pour la mission.`,
  };
}

const ORDINALS: readonly string[] = ["", "", "deuxième", "troisième", "quatrième", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième"];

/**
 * Adjectif ordinal en lettres (mission 2 : « la troisième lettre ») : 1 → « première » (« premier » au masculin),
 * puis « deuxième » … « dixième » ; tout autre nombre : `${n}e` (« 11e »).
 */
export function ordinalWord(n: number, feminine = true): string {
  if (n === 1) return feminine ? "première" : "premier";
  if (Number.isInteger(n) && n >= 2 && n <= 10) return ORDINALS[n] ?? `${String(n)}e`;
  return `${String(n)}e`;
}

/** Cadeau de fin de mission (J6) : « Cadeau : 5 blocs arc-en-ciel ! » ; forme dite en lettres (« cinq blocs arc-en-ciel »). */
export function rewardText(id: BlockId, n: number): { text: ChildText; spoken: ChildText } {
  return {
    text: {
      debutant: `Cadeau${NBSP}: ${quantity(id, n)}${NBSP}!`,
      autonome: `Cadeau${NBSP}: tu as gagné ${quantity(id, n)} pour décorer ton abri${NBSP}!`,
    },
    spoken: {
      debutant: `Cadeau${NBSP}: ${spokenQuantity(id, n)}${NBSP}!`,
      autonome: `Cadeau${NBSP}: tu as gagné ${spokenQuantity(id, n)} pour décorer ton abri${NBSP}!`,
    },
  };
}
