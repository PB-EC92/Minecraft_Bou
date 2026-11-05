import { BlockId } from "./blocks";
import { MAX_STACK, type Inventory, type Stack } from "./inventory";

/**
 * Fabrication (V2 lot 1) : on change un ingrédient du sac en un résultat, en deux touchers (le marteau, puis une
 * carte). Pas de grille ni d'établi : un seul ingrédient, un seul résultat, montrés en icônes et en nombres,
 * lisibles par un enfant de 6 ans. Module pur (sans DOM ni Three.js), testé en Node.
 *
 * Recettes à nous (décision 8 de Pierre, 01/11/2026) : 1 tronc → 2 planches ; 2 planches → 1 clôture ;
 * 1 bloc de sable → 2 blocs de verre. Un tronc donne donc une clôture.
 *
 * Une fabrication est tout ou rien : jamais de fabrication partielle, jamais de bloc perdu. Le sac garde la règle
 * « une case par type » et la position de chaque case.
 */

/** Identifiant stable d'une recette (attribut data-recipe du panneau, accès de test `cubesDebug.craft(id)`). */
export type RecipeId = "planches" | "cloture" | "verre";

/** Un type de bloc et son nombre. */
export interface Ingredient {
  readonly block: BlockId;
  readonly count: number;
}

/** Un seul ingrédient, un seul résultat (pas de grille). */
export interface Recipe {
  readonly id: RecipeId;
  readonly input: Ingredient;
  readonly output: Ingredient;
}

/**
 * Les recettes, dans l'ordre des cartes du panneau : planches, clôture, verre (la chaîne tronc → planches →
 * clôture se lit sur deux cartes voisines). Identifiants stables.
 */
export const RECIPES: readonly Recipe[] = [
  { id: "planches", input: { block: BlockId.Log, count: 1 }, output: { block: BlockId.Planks, count: 2 } },
  { id: "cloture", input: { block: BlockId.Planks, count: 2 }, output: { block: BlockId.Fence, count: 1 } },
  { id: "verre", input: { block: BlockId.Sand, count: 1 }, output: { block: BlockId.Glass, count: 2 } },
];

/** Recette de cet identifiant ; null pour toute autre valeur (inconnu, nombre, objet, null…). */
export function recipeById(id: unknown): Recipe | null {
  if (typeof id !== "string") return null;
  return RECIPES.find((r) => r.id === id) ?? null;
}

/**
 * Bloc gardé par l'étape « ramasser » en cours de la mission (ex. 6 troncs) : on peut fabriquer avec, tant qu'on
 * ne passe pas sous `keep`.
 */
export interface CraftReserve {
  block: BlockId;
  keep: number;
}

export interface CraftOptions {
  reserved?: CraftReserve | null;
}

/**
 * Pourquoi une fabrication est refusée, dans l'ordre où c'est vérifié :
 * - reserved : l'ingrédient est gardé pour la mission (`have` = nombre dans le sac, `keep` = nombre à garder) ;
 * - missing : pas assez d'ingrédient (`have` dans le sac, `need` demandé par la recette) ;
 * - max : la case du résultat dépasserait MAX_STACK (`have` = nombre dans cette case, `added` = nombre fabriqué) ;
 * - full : aucune case pour le résultat.
 */
export type CraftRefusal =
  | { reason: "reserved"; have: number; keep: number }
  | { reason: "missing"; have: number; need: number }
  | { reason: "max"; have: number; added: number }
  | { reason: "full" };

/**
 * Fabrication possible : `next` = contenu du sac après fabrication (une entrée par case) ; `inputSlot` = case de
 * l'ingrédient, `inputLeft` = ce qu'il en reste ; `outputSlot` = case du résultat, qui en contenait `before` et en
 * contiendra `after` ; `sameSlot` : le résultat prend la case de l'ingrédient, qui vient de se vider.
 */
export interface CraftDone {
  ok: true;
  recipe: Recipe;
  next: (Stack | null)[];
  inputSlot: number;
  inputLeft: number;
  outputSlot: number;
  before: number;
  after: number;
  sameSlot: boolean;
}

export type CraftPlan = CraftDone | ({ ok: false; recipe: Recipe } & CraftRefusal);

/**
 * Calcule une fabrication sans rien modifier (ne lève jamais d'exception).
 * Case du résultat : la case de la même sorte ; sinon la case de l'ingrédient si elle vient de se vider (le
 * dernier tronc devient des planches dans SA case, même sac plein) ; sinon la première case vide.
 * Ordre des refus : réservé, manque, maximum, sac plein.
 */
export function planCraft(slots: readonly (Stack | null)[], recipe: Recipe, opts?: CraftOptions): CraftPlan {
  const { input, output } = recipe;
  const i = slots.findIndex((s) => s !== null && s.id === input.block);
  const have = i < 0 ? 0 : (slots[i]?.count ?? 0);
  const r = opts?.reserved;
  if (r && r.block === input.block && have - input.count < r.keep) {
    return { ok: false, recipe, reason: "reserved", have, keep: r.keep };
  }
  if (have < input.count) return { ok: false, recipe, reason: "missing", have, need: input.count };

  const next = slots.map((s) => (s ? { id: s.id, count: s.count } : null));
  const inputLeft = have - input.count;
  next[i] = inputLeft > 0 ? { id: input.block, count: inputLeft } : null;
  let o = next.findIndex((s) => s !== null && s.id === output.block);
  let before = 0;
  if (o >= 0) {
    before = next[o]?.count ?? 0;
    if (before + output.count > MAX_STACK) {
      return { ok: false, recipe, reason: "max", have: before, added: output.count };
    }
    next[o] = { id: output.block, count: before + output.count };
  } else {
    o = inputLeft === 0 ? i : next.indexOf(null);
    if (o < 0) return { ok: false, recipe, reason: "full" };
    next[o] = { id: output.block, count: output.count };
  }
  return {
    ok: true,
    recipe,
    next,
    inputSlot: i,
    inputLeft,
    outputSlot: o,
    before,
    after: before + output.count,
    sameSlot: o === i,
  };
}

/** Plan de chaque recette, dans l'ordre de RECIPES (ordre des cartes). */
export function craftPlans(slots: readonly (Stack | null)[], opts?: CraftOptions): CraftPlan[] {
  return RECIPES.map((r) => planCraft(slots, r, opts));
}

/** La recette est-elle possible maintenant avec ce sac ? */
export function canCraft(inv: Inventory, recipe: Recipe, opts?: CraftOptions): boolean {
  return planCraft(inv.slots(), recipe, opts).ok;
}

/**
 * Fabrique une fois, tout ou rien. En cas de succès, le sac prend le contenu `next` du plan : chaque case garde sa
 * position et la version du sac augmente d'une seule unité. Un refus laisse le sac intact (contenu et version).
 */
export function craft(inv: Inventory, recipe: Recipe, opts?: CraftOptions): CraftPlan {
  const p = planCraft(inv.slots(), recipe, opts);
  if (p.ok) inv.load({ slots: p.next.map((s) => (s ? [s.id, s.count] : null)) });
  return p;
}
