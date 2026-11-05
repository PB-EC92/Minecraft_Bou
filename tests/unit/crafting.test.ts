import { describe, expect, expectTypeOf, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import {
  RECIPES,
  canCraft,
  craft,
  craftPlans,
  planCraft,
  recipeById,
  type CraftOptions,
  type CraftPlan,
  type Recipe,
  type RecipeId,
} from "../../src/engine/crafting";
import { INVENTORY_SLOTS, Inventory, MAX_STACK, isInventoryBlockId, type Stack } from "../../src/engine/inventory";
import { createRng } from "../../src/engine/random";

const PLANCHES = recipeById("planches")!;
const CLOTURE = recipeById("cloture")!;
const VERRE = recipeById("verre")!;

/** Sac de 9 cases : les entrées données, dans l'ordre, puis des cases vides. */
function bag(...entries: ([BlockId, number] | null)[]): (Stack | null)[] {
  const slots: (Stack | null)[] = entries.map((e) => (e ? { id: e[0], count: e[1] } : null));
  while (slots.length < INVENTORY_SLOTS) slots.push(null);
  return slots;
}

/** Inventaire réel rempli comme `bag`. */
function inventory(...entries: ([BlockId, number] | null)[]): Inventory {
  const inv = new Inventory();
  inv.load({ slots: bag(...entries).map((s) => (s ? [s.id, s.count] : null)) });
  return inv;
}

/** Neuf sortes, pour un sac plein : les troncs en case 5. */
const NINE: [BlockId, number][] = [
  [BlockId.Grass, 3],
  [BlockId.Dirt, 3],
  [BlockId.Stone, 3],
  [BlockId.Leaves, 3],
  [BlockId.Snow, 3],
  [BlockId.Log, 1],
  [BlockId.Cactus, 3],
  [BlockId.Lamp, 1],
  [BlockId.FlowerRed, 3],
];

function expectOk(p: CraftPlan): asserts p is Extract<CraftPlan, { ok: true }> {
  expect(p.ok).toBe(true);
}

function total(slots: readonly (Stack | null)[], id: BlockId): number {
  return slots.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
}

function allBlocks(slots: readonly (Stack | null)[]): number {
  return slots.reduce((n, s) => n + (s ? s.count : 0), 0);
}

describe("fabrication : contrat d'interface (vérifié par npm run typecheck)", () => {
  it("expose les signatures de la spécification", () => {
    expectTypeOf<RecipeId>().toEqualTypeOf<"planches" | "cloture" | "verre">();
    expectTypeOf(planCraft).toEqualTypeOf<
      (slots: readonly (Stack | null)[], recipe: Recipe, opts?: CraftOptions) => CraftPlan
    >();
    expectTypeOf(craftPlans).toEqualTypeOf<(slots: readonly (Stack | null)[], opts?: CraftOptions) => CraftPlan[]>();
    expectTypeOf(canCraft).toEqualTypeOf<(inv: Inventory, recipe: Recipe, opts?: CraftOptions) => boolean>();
    expectTypeOf(craft).toEqualTypeOf<(inv: Inventory, recipe: Recipe, opts?: CraftOptions) => CraftPlan>();
    expectTypeOf(recipeById).toEqualTypeOf<(id: unknown) => Recipe | null>();
  });
});

describe("recettes", () => {
  it("sont trois, dans l'ordre des cartes : planches, clôture, verre", () => {
    expect(RECIPES.map((r) => r.id)).toEqual(["planches", "cloture", "verre"]);
  });

  it("sont celles de Pierre : 1 tronc → 2 planches, 2 planches → 1 clôture, 1 sable → 2 verres", () => {
    expect(RECIPES).toEqual([
      { id: "planches", input: { block: BlockId.Log, count: 1 }, output: { block: BlockId.Planks, count: 2 } },
      { id: "cloture", input: { block: BlockId.Planks, count: 2 }, output: { block: BlockId.Fence, count: 1 } },
      { id: "verre", input: { block: BlockId.Sand, count: 1 }, output: { block: BlockId.Glass, count: 2 } },
    ]);
  });

  it("ont un ingrédient différent du résultat, tous deux rangeables dans le sac, en petits nombres", () => {
    for (const r of RECIPES) {
      expect(r.input.block).not.toBe(r.output.block);
      expect(isInventoryBlockId(r.input.block)).toBe(true);
      expect(isInventoryBlockId(r.output.block)).toBe(true);
      for (const n of [r.input.count, r.output.count]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(4);
      }
    }
  });

  it("ont des identifiants distincts", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("recipeById trouve une recette connue, null pour tout le reste", () => {
    expect(recipeById("planches")).toBe(RECIPES[0]);
    expect(recipeById("cloture")).toBe(RECIPES[1]);
    expect(recipeById("verre")).toBe(RECIPES[2]);
    for (const v of ["", "Planches", "clôture", "lampe", 0, 1, { id: "planches" }, ["verre"], null, undefined, true]) {
      expect(recipeById(v)).toBeNull();
    }
  });
});

describe("planCraft", () => {
  it("ne modifie jamais les cases reçues", () => {
    const cases = [
      bag([BlockId.Log, 3]),
      bag([BlockId.Planks, 1]),
      bag(...NINE),
      bag([BlockId.Planks, 99], [BlockId.Log, 4]),
    ];
    for (const slots of cases) {
      const copy = structuredClone(slots);
      for (const r of RECIPES) {
        planCraft(slots, r);
        planCraft(slots, r, { reserved: { block: BlockId.Log, keep: 6 } });
      }
      craftPlans(slots);
      expect(slots).toEqual(copy);
    }
  });

  it("3 troncs donnent 2 troncs et 2 planches, dans la première case vide", () => {
    const p = planCraft(bag([BlockId.Log, 3]), PLANCHES);
    expectOk(p);
    expect(p.next).toEqual(bag([BlockId.Log, 2], [BlockId.Planks, 2]));
    expect(p).toMatchObject({ inputSlot: 0, inputLeft: 2, outputSlot: 1, before: 0, after: 2, sameSlot: false });
  });

  it("ajoute le résultat dans la case de sa sorte", () => {
    const p = planCraft(bag([BlockId.Planks, 2], null, [BlockId.Log, 5]), PLANCHES);
    expectOk(p);
    expect(p.next).toEqual(bag([BlockId.Planks, 4], null, [BlockId.Log, 4]));
    expect(p).toMatchObject({ inputSlot: 2, outputSlot: 0, before: 2, after: 4, sameSlot: false });
  });

  it("le dernier tronc devient 2 planches dans SA case, même avec un sac de 9 sortes", () => {
    const p = planCraft(bag(...NINE), PLANCHES);
    expectOk(p);
    const expected = bag(...NINE);
    expected[5] = { id: BlockId.Planks, count: 2 };
    expect(p.next).toEqual(expected);
    expect(p).toMatchObject({ inputSlot: 5, inputLeft: 0, outputSlot: 5, before: 0, after: 2, sameSlot: true });
  });

  it("le résultat prend la case libérée plutôt qu'une case vide plus à gauche", () => {
    const p = planCraft(bag(null, [BlockId.Stone, 2], [BlockId.Log, 1]), PLANCHES);
    expectOk(p);
    expect(p.next).toEqual(bag(null, [BlockId.Stone, 2], [BlockId.Planks, 2]));
    expect(p.outputSlot).toBe(2);
    expect(p.sameSlot).toBe(true);
  });

  it("2 planches deviennent une clôture sur place", () => {
    const p = planCraft(bag([BlockId.Dirt, 4], [BlockId.Planks, 2]), CLOTURE);
    expectOk(p);
    expect(p.next).toEqual(bag([BlockId.Dirt, 4], [BlockId.Fence, 1]));
    expect(p).toMatchObject({ inputSlot: 1, inputLeft: 0, outputSlot: 1, before: 0, after: 1, sameSlot: true });
  });

  it("un bloc de sable donne 2 blocs de verre", () => {
    const p = planCraft(bag([BlockId.Sand, 5], [BlockId.Glass, 3]), VERRE);
    expectOk(p);
    expect(p.next).toEqual(bag([BlockId.Sand, 4], [BlockId.Glass, 5]));
    expect(p).toMatchObject({ before: 3, after: 5 });
  });

  it("monte jusqu'à 99 exactement", () => {
    const p = planCraft(bag([BlockId.Planks, 97], [BlockId.Log, 1]), PLANCHES);
    expectOk(p);
    expect(p.next).toEqual(bag([BlockId.Planks, 99]));
    expect(p.after).toBe(MAX_STACK);
  });
});

describe("planCraft : refus", () => {
  it("manque : une planche sur 2, ou rien du tout", () => {
    expect(planCraft(bag([BlockId.Planks, 1]), CLOTURE)).toEqual({
      ok: false,
      recipe: CLOTURE,
      reason: "missing",
      have: 1,
      need: 2,
    });
    expect(planCraft(bag(), PLANCHES)).toEqual({ ok: false, recipe: PLANCHES, reason: "missing", have: 0, need: 1 });
    expect(planCraft(bag([BlockId.Stone, 9]), VERRE)).toMatchObject({ reason: "missing", have: 0, need: 1 });
  });

  it("sac plein : 2 troncs et aucune case pour les planches", () => {
    const full = bag(...NINE);
    full[5] = { id: BlockId.Log, count: 2 };
    expect(planCraft(full, PLANCHES)).toEqual({ ok: false, recipe: PLANCHES, reason: "full" });
  });

  it("maximum : la case du résultat dépasserait 99, sans fabrication partielle", () => {
    expect(planCraft(bag([BlockId.Planks, 98], [BlockId.Log, 3]), PLANCHES)).toEqual({
      ok: false,
      recipe: PLANCHES,
      reason: "max",
      have: 98,
      added: 2,
    });
    expect(planCraft(bag([BlockId.Planks, 99], [BlockId.Log, 3]), PLANCHES)).toMatchObject({
      reason: "max",
      have: 99,
      added: 2,
    });
    expect(planCraft(bag([BlockId.Fence, 99], [BlockId.Planks, 5]), CLOTURE)).toMatchObject({
      reason: "max",
      have: 99,
      added: 1,
    });
    expect(planCraft(bag([BlockId.Glass, 98], [BlockId.Sand, 1]), VERRE)).toMatchObject({ reason: "max", have: 98 });
  });

  it("réservé : on ne passe pas sous le nombre gardé pour la mission", () => {
    const keep6 = { reserved: { block: BlockId.Log, keep: 6 } };
    expect(planCraft(bag([BlockId.Log, 5]), PLANCHES, keep6)).toEqual({
      ok: false,
      recipe: PLANCHES,
      reason: "reserved",
      have: 5,
      keep: 6,
    });
    expect(planCraft(bag([BlockId.Log, 6]), PLANCHES, keep6)).toMatchObject({ reason: "reserved", have: 6 });
    expect(planCraft(bag(), PLANCHES, keep6)).toMatchObject({ reason: "reserved", have: 0, keep: 6 });
    expect(planCraft(bag([BlockId.Log, 7]), PLANCHES, keep6).ok).toBe(true);
    expect(planCraft(bag([BlockId.Log, 8]), PLANCHES, keep6).ok).toBe(true);
  });

  it("réservé : un autre bloc n'est pas gardé ; sans réserve (null), rien n'est gardé", () => {
    const keep6 = { reserved: { block: BlockId.Log, keep: 6 } };
    expect(planCraft(bag([BlockId.Sand, 1]), VERRE, keep6).ok).toBe(true);
    expect(planCraft(bag([BlockId.Planks, 2]), CLOTURE, keep6).ok).toBe(true);
    expect(planCraft(bag([BlockId.Log, 1]), PLANCHES, { reserved: null }).ok).toBe(true);
    expect(planCraft(bag([BlockId.Log, 1]), PLANCHES, {}).ok).toBe(true);
  });

  it("dans l'ordre : réservé, puis manque, puis maximum ou sac plein", () => {
    // Réservé avant manque : aucun tronc et 6 à garder.
    expect(planCraft(bag(), PLANCHES, { reserved: { block: BlockId.Log, keep: 6 } })).toMatchObject({
      reason: "reserved",
    });
    // Manque avant maximum : clôtures à 99 et une seule planche.
    expect(planCraft(bag([BlockId.Fence, 99], [BlockId.Planks, 1]), CLOTURE)).toMatchObject({ reason: "missing" });
    // Manque avant sac plein : sac plein sans planche.
    expect(planCraft(bag(...NINE), CLOTURE)).toMatchObject({ reason: "missing" });
    // Réservé avant maximum : planches à 99 et troncs gardés.
    expect(
      planCraft(bag([BlockId.Planks, 99], [BlockId.Log, 2]), PLANCHES, { reserved: { block: BlockId.Log, keep: 6 } }),
    ).toMatchObject({ reason: "reserved" });
  });
});

describe("craft", () => {
  it("succès : le sac change une seule fois (version +1), les autres cases gardent leur place", () => {
    const inv = inventory([BlockId.Stone, 4], null, [BlockId.Log, 3], [BlockId.Dirt, 7]);
    const v = inv.version;
    const p = craft(inv, PLANCHES);
    expect(p.ok).toBe(true);
    expect(inv.version).toBe(v + 1);
    expect(inv.slots()).toEqual(bag([BlockId.Stone, 4], [BlockId.Planks, 2], [BlockId.Log, 2], [BlockId.Dirt, 7]));
  });

  it("refus : contenu et version identiques", () => {
    const refusals: [Inventory, Recipe, CraftOptions?][] = [
      [inventory([BlockId.Planks, 1]), CLOTURE],
      [inventory([BlockId.Planks, 98], [BlockId.Log, 1]), PLANCHES],
      [inventory([BlockId.Log, 5]), PLANCHES, { reserved: { block: BlockId.Log, keep: 6 } }],
      [inventory(...NINE.map((e): [BlockId, number] => (e[0] === BlockId.Log ? [BlockId.Log, 2] : e))), PLANCHES],
    ];
    for (const [inv, r, opts] of refusals) {
      const before = inv.slots();
      const v = inv.version;
      const p = craft(inv, r, opts);
      expect(p.ok).toBe(false);
      expect(inv.slots()).toEqual(before);
      expect(inv.version).toBe(v);
    }
  });

  it("canCraft = planCraft(…).ok", () => {
    const invs = [inventory([BlockId.Log, 1]), inventory([BlockId.Planks, 1]), inventory(...NINE), inventory()];
    for (const inv of invs) {
      for (const r of RECIPES) {
        for (const opts of [undefined, { reserved: { block: BlockId.Log, keep: 6 } }]) {
          expect(canCraft(inv, r, opts)).toBe(planCraft(inv.slots(), r, opts).ok);
        }
      }
    }
  });

  it("chaîne : 1 tronc → 2 planches → 1 clôture", () => {
    const inv = inventory([BlockId.Log, 1]);
    expect(craft(inv, PLANCHES).ok).toBe(true);
    expect(inv.slots()).toEqual(bag([BlockId.Planks, 2]));
    expect(craft(inv, CLOTURE).ok).toBe(true);
    expect(inv.slots()).toEqual(bag([BlockId.Fence, 1]));
    expect(craft(inv, CLOTURE)).toMatchObject({ ok: false, reason: "missing", have: 0 });
    expect(craft(inv, PLANCHES)).toMatchObject({ ok: false, reason: "missing", have: 0 });
  });

  it("craftPlans suit l'ordre de RECIPES", () => {
    const slots = bag([BlockId.Log, 2], [BlockId.Sand, 1]);
    const plans = craftPlans(slots);
    expect(plans.map((p) => p.recipe.id)).toEqual(RECIPES.map((r) => r.id));
    expect(plans.map((p) => p.ok)).toEqual([true, false, true]);
    expect(plans).toEqual(RECIPES.map((r) => planCraft(slots, r)));
  });
});

describe("aucun bloc perdu", () => {
  /** Sortes tirées : ingrédients et résultats des recettes, plus d'autres blocs pour remplir le sac. */
  const KINDS: readonly BlockId[] = [
    BlockId.Log,
    BlockId.Planks,
    BlockId.Fence,
    BlockId.Sand,
    BlockId.Glass,
    BlockId.Stone,
    BlockId.Dirt,
    BlockId.Grass,
    BlockId.Leaves,
    BlockId.Lamp,
    BlockId.Rainbow,
    BlockId.Snow,
  ];

  function randomBag(rand: () => number): (Stack | null)[] {
    const slots: (Stack | null)[] = new Array<Stack | null>(INVENTORY_SLOTS).fill(null);
    const kinds = [...KINDS].sort(() => rand() - 0.5);
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      if (rand() < 0.25) continue;
      const id = kinds[i];
      if (id === undefined) continue;
      // Beaucoup de petits nombres et de valeurs proches du maximum : les cas limites.
      const r = rand();
      const count = r < 0.4 ? 1 + Math.floor(rand() * 3) : r < 0.6 ? 96 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 99);
      slots[i] = { id, count };
    }
    return slots;
  }

  it("2 000 sacs au hasard : après = avant − ingrédients + résultat, ou sac identique", () => {
    const rand = createRng(20261101);
    let done = 0;
    let refused = 0;
    for (let n = 0; n < 2000; n++) {
      const slots = randomBag(rand);
      const opts: CraftOptions | undefined =
        rand() < 0.3 ? { reserved: { block: BlockId.Log, keep: 1 + Math.floor(rand() * 8) } } : undefined;
      for (const r of RECIPES) {
        const inv = new Inventory();
        inv.load({ slots: slots.map((s) => (s ? [s.id, s.count] : null)) });
        const before = inv.slots();
        const v = inv.version;
        const p = craft(inv, r, opts);
        const after = inv.slots();
        if (!p.ok) {
          refused++;
          expect(after).toEqual(before);
          expect(inv.version).toBe(v);
          continue;
        }
        done++;
        expect(inv.version).toBe(v + 1);
        expect(after).toEqual(p.next);
        expect(total(after, r.input.block)).toBe(total(before, r.input.block) - r.input.count);
        expect(total(after, r.output.block)).toBe(total(before, r.output.block) + r.output.count);
        expect(allBlocks(after)).toBe(allBlocks(before) - r.input.count + r.output.count);
        // Les autres sortes ne bougent pas, et restent à leur place.
        for (let i = 0; i < INVENTORY_SLOTS; i++) {
          const b = before[i];
          if (b && b.id !== r.input.block && b.id !== r.output.block) expect(after[i]).toEqual(b);
        }
        // Une case par sorte, de 1 à 99 blocs.
        const ids = after.filter((s): s is Stack => s !== null).map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of after) if (s) expect(s.count).toBeGreaterThanOrEqual(1);
        for (const s of after) if (s) expect(s.count).toBeLessThanOrEqual(MAX_STACK);
      }
    }
    // Le tirage couvre bien les deux issues.
    expect(done).toBeGreaterThan(500);
    expect(refused).toBeGreaterThan(500);
  });
});
