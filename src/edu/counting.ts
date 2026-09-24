import { BlockId, isPlantId } from "../engine/blocks";
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
]);

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
function capitalize(s: string): string {
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
 *  (« cueillir » pour les fleurs). « de » s'élide en « d' » devant une voyelle ou un h muet (voir withDe). */
export function emptiedText(id: BlockId): ChildText {
  const many = withDe(countNoun(id).many);
  const verb = isPlantId(id) ? "cueillir" : "casser";
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
