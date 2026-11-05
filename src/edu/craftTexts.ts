import { BlockId } from "../engine/blocks";
import { RECIPES, type CraftPlan, type Recipe, type RecipeId } from "../engine/crafting";
import { MAX_STACK, type Stack } from "../engine/inventory";
import { capitalize, countNoun, maxStackText, numberWords, ordinalWord, quantity, spokenQuantity } from "./counting";
import {
  CRAFT_FULL_MOUSE,
  CRAFT_FULL_TOUCH,
  NBSP,
  SPOKEN_TIPS,
  type ChildText,
  type ReadingLevel,
} from "./texts";

/**
 * Textes de la fabrication (V2 lot 1), calculés d'après la recette et le sac. Module pur, testé en Node.
 *
 * Deux formes pour chaque texte, comme dans counting.ts :
 * - écrite : nombres en chiffres dès 2, additions en chiffres (« 2 + 2 = 4 planches ! ») ;
 * - dite : nombres en lettres, « plus » et « ça fait » ; les termes de l'addition au masculin, le total accordé
 *   au nom (« Vingt plus un, ça fait vingt et une clôtures ! »).
 *
 * Typographie : espace insécable devant ! ? : ; et autour de + et =. Formulations neutres en genre ; aucun mot
 * sur la lampe ni sur les Grignotes (décision 6 de Pierre : la lampe est à découvrir).
 */

/** Total jusqu'auquel le débutant voit l'addition ; au-delà, le total seul (« 12 planches ! »). */
export const DEBUTANT_SUM_MAX = 10;

/** Texte affiché et texte dit (nombres en lettres). */
export interface SaidText {
  text: ChildText;
  spoken: ChildText;
}

/** « un » ou « une » pour 1, sinon le nombre en chiffres (forme écrite). */
function one(n: number, feminine: boolean): string {
  return n === 1 ? (feminine ? "une" : "un") : String(n);
}

/** Addition écrite : « 2 + 2 = 4 planches », espaces insécables autour de + et =. */
function writtenSum(out: BlockId, before: number, added: number): string {
  return `${String(before)}${NBSP}+${NBSP}${String(added)}${NBSP}=${NBSP}${quantity(out, before + added)}`;
}

/** Addition dite : « Deux plus deux, ça fait quatre planches » (termes au masculin, total accordé au nom). */
function spokenSum(out: BlockId, before: number, added: number): string {
  return `${capitalize(numberWords(before))} plus ${numberWords(added)}, ça fait ${spokenQuantity(out, before + added)}`;
}

/** « un tronc donne 2 planches » (écrit) ou « un tronc donne deux planches » (dit) ; « donnent » si l'ingrédient est à 2 ou plus. */
function recipePhrase(r: Recipe, spoken: boolean): string {
  const q = spoken ? spokenQuantity : quantity;
  const verb = r.input.count === 1 ? "donne" : "donnent";
  return `${q(r.input.block, r.input.count)} ${verb} ${q(r.output.block, r.output.count)}`;
}

/** « avec un tronc, tu fabriques 2 planches » (écrit) ou « … deux planches » (dit). */
function recipeExample(r: Recipe, spoken: boolean): string {
  const q = spoken ? spokenQuantity : quantity;
  return `avec ${q(r.input.block, r.input.count)}, tu fabriques ${q(r.output.block, r.output.count)}`;
}

/**
 * Phrase d'une carte (lecteur autonome, jamais lue) : « Un tronc donne 2 planches. », « 2 planches donnent une
 * clôture. », « Un bloc de sable donne 2 blocs de verre. ». Sert aussi d'étiquette (aria-label) à la carte.
 */
export function recipeSentence(r: Recipe): string {
  return `${capitalize(recipePhrase(r, false))}.`;
}

/**
 * Résultat d'une fabrication : `out` = bloc fabriqué, `before` = nombre dans sa case avant, `added` = nombre
 * fabriqué.
 * - avant = 0 : débutant « 2 planches ! » (dit « Deux planches ! ») ; autonome « Tu as fabriqué 2 planches ! » ;
 * - avant > 0, débutant : « 2 + 2 = 4 planches ! » (dit « Deux plus deux, ça fait quatre planches ! ») tant que
 *   le total ne dépasse pas `sumMax`, sinon le total seul (« 12 planches ! ») ;
 * - avant > 0, autonome : « Tu avais 2 planches, tu en fabriques 2 : 2 + 2 = 4 planches ! » (dit « Tu avais deux
 *   planches, tu en fabriques deux. Deux plus deux, ça fait quatre planches ! »).
 */
export function craftText(out: BlockId, before: number, added: number, sumMax = DEBUTANT_SUM_MAX): SaidText {
  const after = before + added;
  if (before <= 0) {
    return {
      text: {
        debutant: `${capitalize(quantity(out, added))}${NBSP}!`,
        autonome: `Tu as fabriqué ${quantity(out, added)}${NBSP}!`,
      },
      spoken: {
        debutant: `${capitalize(spokenQuantity(out, added))}${NBSP}!`,
        autonome: `Tu as fabriqué ${spokenQuantity(out, added)}${NBSP}!`,
      },
    };
  }
  const feminine = countNoun(out).feminine;
  const withSum = after <= sumMax;
  return {
    text: {
      debutant: withSum ? `${writtenSum(out, before, added)}${NBSP}!` : `${capitalize(quantity(out, after))}${NBSP}!`,
      autonome: `Tu avais ${quantity(out, before)}, tu en fabriques ${one(added, feminine)}${NBSP}: ${writtenSum(out, before, added)}${NBSP}!`,
    },
    spoken: {
      debutant: withSum ? `${spokenSum(out, before, added)}${NBSP}!` : `${capitalize(spokenQuantity(out, after))}${NBSP}!`,
      autonome: `Tu avais ${spokenQuantity(out, before)}, tu en fabriques ${numberWords(added, feminine)}. ${spokenSum(out, before, added)}${NBSP}!`,
    },
  };
}

/** Ajoute une phrase à la suite d'un texte, à l'écrit et à l'oral (ex. le savais-tu du premier verre). */
export function withFact(said: SaidText, fact: ChildText): SaidText {
  const join = (a: ChildText, b: ChildText): ChildText => ({
    debutant: `${a.debutant} ${b.debutant}`,
    autonome: `${a.autonome} ${b.autonome}`,
  });
  return { text: join(said.text, fact), spoken: join(said.spoken, fact) };
}

/** Où trouver un ingrédient qu'on n'a pas : phrase dite au débutant, fin de phrase pour l'autonome. */
interface Where {
  debutant: string;
  autonome: string;
}

const WHERE: ReadonlyMap<BlockId, Where> = new Map<BlockId, Where>([
  [BlockId.Log, { debutant: "Va casser un arbre.", autonome: "casse le tronc d'un arbre pour en ramasser" }],
  // Vrai pour tous les types de monde : plages et fonds sous l'eau, désert, carré de sable du monde plat.
  [BlockId.Sand, { debutant: "Il y en a au bord de l'eau.", autonome: "il y en a au bord de l'eau et dans le désert" }],
  [BlockId.Planks, { debutant: "Fabrique-les avec un tronc.", autonome: "fabrique-les d'abord avec un tronc" }],
]);
const ELSEWHERE: Where = { debutant: "Cherche-en dans le monde.", autonome: "cherche-en dans le monde" };

/** Pronom complément d'un ingrédient : « les » (2 et plus), sinon « la » ou « le ». */
function them(block: BlockId, n: number): string {
  return n >= 2 ? "les" : countNoun(block).feminine ? "la" : "le";
}

/** « tes troncs » (2 et plus), sinon « ton tronc » ou « ta planche ». */
function yours(block: BlockId, n: number): string {
  const noun = countNoun(block);
  return n >= 2 ? `tes ${noun.many}` : `${noun.feminine ? "ta" : "ton"} ${noun.one}`;
}

/**
 * Fabrication refusée (voir CraftRefusal). `plans` : plans de toutes les recettes avec le même sac (indice de
 * chaîne : une autre carte fabrique l'ingrédient qui manque) ; `touch` : au doigt (sinon souris et clavier).
 */
export function craftRefusalText(
  plan: Extract<CraftPlan, { ok: false }>,
  plans: readonly CraftPlan[],
  touch: boolean,
): SaidText {
  const { input, output } = plan.recipe;
  const inNoun = countNoun(input.block);
  switch (plan.reason) {
    case "reserved": {
      const { have, keep } = plan;
      const autonome = (spoken: boolean) => {
        const later = "Tu fabriqueras juste après.";
        // Rien dans le sac : « Garde tes troncs » n'aurait pas de sens.
        if (have <= 0) {
          const q = spoken ? spokenQuantity : quantity;
          return `Ramasse d'abord ${q(input.block, keep)} pour la mission. ${later}`;
        }
        const n = spoken ? numberWords(keep, inNoun.feminine) : one(keep, inNoun.feminine);
        return `Garde ${yours(input.block, keep)} pour la mission${NBSP}: il en faut ${n}. ${later}`;
      };
      return {
        text: { debutant: `D'abord ${quantity(input.block, keep)}${NBSP}!`, autonome: autonome(false) },
        spoken: { debutant: `D'abord ${spokenQuantity(input.block, keep)} pour la mission${NBSP}!`, autonome: autonome(true) },
      };
    }
    case "missing": {
      const { have, need } = plan;
      if (have > 0) {
        const lack = need - have;
        const make = (spoken: boolean): ChildText => {
          const q = spoken ? spokenQuantity : quantity;
          const n = (k: number) => (spoken ? numberWords(k, inNoun.feminine) : one(k, inNoun.feminine));
          return {
            debutant: `Il manque ${q(input.block, lack)}${NBSP}!`,
            autonome: `Il te faut ${q(input.block, need)} et tu en as ${n(have)}${NBSP}: il en manque ${n(lack)}.`,
          };
        };
        return { text: make(false), spoken: make(true) };
      }
      const chainIndex = plans.findIndex((p) => p.ok && p.recipe.output.block === input.block);
      const chain = plans[chainIndex];
      if (chain) {
        // Une autre carte fabrique cet ingrédient maintenant : « Fais d'abord des planches ! ».
        const from = chain.recipe.input;
        const rank = RECIPES.findIndex((r) => r.id === chain.recipe.id);
        const card = ordinalWord(rank >= 0 ? rank + 1 : chainIndex + 1);
        const autonome = (spoken: boolean) => {
          const q = spoken ? spokenQuantity : quantity;
          return `Il te faut ${q(input.block, need)}${NBSP}: fabrique-${them(input.block, need)} d'abord avec ${q(from.block, from.count)}, sur la ${card} carte.`;
        };
        return {
          text: { debutant: `Fais d'abord des ${inNoun.many}${NBSP}!`, autonome: autonome(false) },
          spoken: {
            debutant: `Fabrique d'abord des ${inNoun.many} avec ${spokenQuantity(from.block, from.count)}${NBSP}!`,
            autonome: autonome(true),
          },
        };
      }
      const where = WHERE.get(input.block) ?? ELSEWHERE;
      return {
        text: {
          debutant: `Il faut ${quantity(input.block, need)}${NBSP}!`,
          autonome: `Il te faut ${quantity(input.block, need)}${NBSP}: ${where.autonome}.`,
        },
        spoken: {
          debutant: `Il faut ${spokenQuantity(input.block, need)}${NBSP}! ${where.debutant}`,
          autonome: `Il te faut ${spokenQuantity(input.block, need)}${NBSP}: ${where.autonome}.`,
        },
      };
    }
    case "max": {
      const { have, added } = plan;
      const after = have + added;
      const outFeminine = countNoun(output.block).feminine;
      return {
        text: {
          debutant: maxStackText(output.block, MAX_STACK).debutant,
          autonome: `Tu as ${quantity(output.block, have)}${NBSP}: avec ${one(added, outFeminine)} de plus, ça ferait ${String(after)}. Le maximum, c'est ${String(MAX_STACK)}.`,
        },
        spoken: {
          debutant: `${capitalize(numberWords(MAX_STACK))}, c'est le maximum${NBSP}!`,
          // numberWords laisse en chiffres au-delà de cent (« 101 »).
          autonome: `Tu as ${spokenQuantity(output.block, have)}${NBSP}: avec ${numberWords(added, outFeminine)} de plus, ça ferait ${numberWords(after)}. Le maximum, c'est ${numberWords(MAX_STACK)}.`,
        },
      };
    }
    case "full":
      return touch
        ? { text: CRAFT_FULL_TOUCH, spoken: SPOKEN_TIPS.craftFullTouch }
        : { text: CRAFT_FULL_MOUSE, spoken: SPOKEN_TIPS.craftFullMouse };
  }
}

/**
 * Panneau ouvert sans aucune recette possible (V2 lot 1) : le refus à dire plutôt que « Il manque des blocs ! ». Le
 * sac plein passe d'abord (vider une case débloque la carte), puis le maximum ; null si une recette est possible, ou
 * si les refus ne viennent que d'ingrédients qui manquent ou sont gardés pour la mission (CRAFT_NOTHING suffit).
 */
export function craftBlocker(plans: readonly CraftPlan[]): Extract<CraftPlan, { ok: false }> | null {
  if (plans.some((p) => p.ok)) return null;
  const refused = plans.filter((p): p is Extract<CraftPlan, { ok: false }> => !p.ok);
  return refused.find((p) => p.reason === "full") ?? refused.find((p) => p.reason === "max") ?? null;
}

/**
 * Présentation du marteau par Pixel. `r` : la première recette possible (son exemple suit la consigne) ; `touch` :
 * au doigt, sinon clavier et souris (la souris capturée ne clique jamais un bouton : on dit la touche F).
 */
export function craftIntroText(r: Recipe, touch: boolean): SaidText {
  const debutant = touch ? "Touche le marteau qui brille" : "Appuie sur F pour fabriquer";
  const debutantSaid = touch ? "Touche le marteau qui brille" : "Appuie sur la touche F pour fabriquer";
  const how = touch ? "touche le marteau" : "appuie sur F";
  const autonome = (spoken: boolean) =>
    `Nouveau${NBSP}: ${how} pour fabriquer des blocs. ${capitalize(recipeExample(r, spoken))}.`;
  return {
    text: { debutant: `${debutant}${NBSP}!`, autonome: autonome(false) },
    spoken: { debutant: `${debutantSaid}${NBSP}: ${recipeExample(r, true)}${NBSP}!`, autonome: autonome(true) },
  };
}

/**
 * Conseil de l'étape abri quand il reste peu de blocs : fabriquer des planches (première recette, RECIPES[0]).
 * Débutant « Fabrique des planches ! », dit « Pas assez de blocs ? Touche le marteau : un tronc donne deux
 * planches ! » ; autonome « Pas assez de blocs pour ton abri ? Touche le marteau : un tronc donne 2 planches. ».
 */
export function craftMoreBlocksText(touch: boolean): SaidText {
  const r = RECIPES[0]!;
  const how = touch ? "Touche le marteau" : "Appuie sur F";
  const autonome = (spoken: boolean) => `Pas assez de blocs pour ton abri${NBSP}? ${how}${NBSP}: ${recipePhrase(r, spoken)}.`;
  return {
    text: { debutant: `Fabrique des ${countNoun(r.output.block).many}${NBSP}!`, autonome: autonome(false) },
    spoken: {
      debutant: `Pas assez de blocs${NBSP}? ${how}${NBSP}: ${recipePhrase(r, true)}${NBSP}!`,
      autonome: autonome(true),
    },
  };
}

/** État d'une carte : possible, ou la raison du refus. */
export type CardState = "ok" | "reserved" | "missing" | "max" | "full";

/**
 * Ce que montre une carte du panneau (jamais lu à voix haute) :
 * - input : ingrédient, nombre demandé (`need`) et nombre dans le sac (`have`) ;
 * - output : résultat et nombre fabriqué ;
 * - sentence : phrase de la recette pour l'autonome, null pour le débutant (chiffres et icônes) ;
 * - badge : petit texte d'état ; icon : coche (possible), cadenas (gardé pour la mission), sac barré (sac plein).
 */
export interface CraftCardView {
  id: RecipeId;
  state: CardState;
  input: { block: BlockId; need: number; have: number };
  output: { block: BlockId; count: number };
  sentence: string | null;
  badge: string;
  icon: "check" | "lock" | "bag" | null;
}

/** Nombre de blocs de ce type dans les cases. */
function countIn(slots: readonly (Stack | null)[], block: BlockId): number {
  const s = slots.find((c) => c !== null && c.id === block);
  return s ? s.count : 0;
}

/** Badge et icône d'une carte, selon son état et le niveau de lecture. */
function badgeOf(plan: CraftPlan, have: number, level: ReadingLevel): Pick<CraftCardView, "badge" | "icon"> {
  const autonome = level === "autonome";
  const { input } = plan.recipe;
  if (plan.ok) return { badge: autonome ? `Tu as ${quantity(input.block, have)}.` : "", icon: "check" };
  switch (plan.reason) {
    case "reserved": {
      const count = `${String(Math.min(plan.have, plan.keep))}${NBSP}/${NBSP}${String(plan.keep)}`;
      return { badge: autonome ? `Pour la mission${NBSP}: ${count}` : count, icon: "lock" };
    }
    case "missing": {
      if (!autonome) return { badge: "", icon: null };
      const feminine = countNoun(input.block).feminine;
      return {
        badge: plan.have > 0 ? `Tu en as ${one(plan.have, feminine)} sur ${String(plan.need)}.` : "Tu n'en as pas.",
        icon: null,
      };
    }
    case "full":
      return { badge: autonome ? "Sac plein" : "", icon: "bag" };
    case "max":
      return { badge: autonome ? `Maximum${NBSP}: ${String(MAX_STACK)}` : String(MAX_STACK), icon: null };
  }
}

/** Cartes du panneau, une par plan, dans l'ordre des plans (craftPlans suit l'ordre de RECIPES). */
export function craftCardViews(
  plans: readonly CraftPlan[],
  slots: readonly (Stack | null)[],
  level: ReadingLevel,
): CraftCardView[] {
  return plans.map((plan) => {
    const { id, input, output } = plan.recipe;
    const have = countIn(slots, input.block);
    return {
      id,
      state: plan.ok ? "ok" : plan.reason,
      input: { block: input.block, need: input.count, have },
      output: { block: output.block, count: output.count },
      sentence: level === "autonome" ? recipeSentence(plan.recipe) : null,
      ...badgeOf(plan, have, level),
    };
  });
}
