import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import {
  RECIPES,
  craftPlans,
  planCraft,
  recipeById,
  type CraftOptions,
  type CraftPlan,
  type Recipe,
} from "../../src/engine/crafting";
import { INVENTORY_SLOTS, MAX_STACK, type Stack } from "../../src/engine/inventory";
import { createRng } from "../../src/engine/random";
import {
  DEBUTANT_SUM_MAX,
  craftCardViews,
  craftIntroText,
  craftMoreBlocksText,
  craftRefusalText,
  craftText,
  recipeSentence,
  withFact,
  type SaidText,
} from "../../src/edu/craftTexts";
import {
  CRAFT_FULL_MOUSE,
  CRAFT_FULL_TOUCH,
  CRAFT_GLASS_FACT,
  NBSP,
  SPOKEN_TIPS,
  type ChildText,
} from "../../src/edu/texts";

const PLANCHES = recipeById("planches")!;
const CLOTURE = recipeById("cloture")!;
const VERRE = recipeById("verre")!;
const KEEP_6_LOGS: CraftOptions = { reserved: { block: BlockId.Log, keep: 6 } };

/** Remplace l'espace insécable par une espace ordinaire, pour lire les attendus simplement. */
const plain = (s: string) => s.replaceAll(NBSP, " ");
const plainText = (t: ChildText): ChildText => ({ debutant: plain(t.debutant), autonome: plain(t.autonome) });
const plainSaid = (s: SaidText): SaidText => ({ text: plainText(s.text), spoken: plainText(s.spoken) });

/** Nombre de mots : morceaux séparés par des espaces qui contiennent une lettre ou un chiffre. */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Sac de 9 cases : les entrées données, dans l'ordre, puis des cases vides. */
function bag(...entries: ([BlockId, number] | null)[]): (Stack | null)[] {
  const slots: (Stack | null)[] = entries.map((e) => (e ? { id: e[0], count: e[1] } : null));
  while (slots.length < INVENTORY_SLOTS) slots.push(null);
  return slots;
}

/** Refus de la recette `r` avec ce sac, et les plans de toutes les recettes (pour l'indice de chaîne). */
function refusal(slots: (Stack | null)[], r: Recipe, opts?: CraftOptions) {
  const plans = craftPlans(slots, opts);
  const plan = plans.find((p) => p.recipe.id === r.id)!;
  if (plan.ok) throw new Error(`la recette ${r.id} est possible`);
  return { plan, plans };
}

function refusalText(slots: (Stack | null)[], r: Recipe, opts?: CraftOptions, touch = true): SaidText {
  const { plan, plans } = refusal(slots, r, opts);
  return plainSaid(craftRefusalText(plan, plans, touch));
}

/** Sac plein de 9 sortes, troncs en case 5. */
function fullBag(logs: number): (Stack | null)[] {
  return bag(
    [BlockId.Grass, 3],
    [BlockId.Dirt, 3],
    [BlockId.Stone, 3],
    [BlockId.Leaves, 3],
    [BlockId.Snow, 3],
    [BlockId.Log, logs],
    [BlockId.Cactus, 3],
    [BlockId.Rainbow, 1],
    [BlockId.FlowerRed, 3],
  );
}

describe("recipeSentence", () => {
  it("dit chaque recette en une phrase, avec le verbe accordé (donne / donnent)", () => {
    expect(RECIPES.map((r) => plain(recipeSentence(r)))).toEqual([
      "Un tronc donne 2 planches.",
      "2 planches donnent une clôture.",
      "Un bloc de sable donne 2 blocs de verre.",
    ]);
    const custom: Recipe = { id: "planches", input: { block: BlockId.Stone, count: 3 }, output: { block: BlockId.Dirt, count: 1 } };
    expect(recipeSentence(custom)).toBe("3 pierres donnent un bloc de terre.");
  });
});

describe("craftText : résultat d'une fabrication", () => {
  it("première fabrication (avant = 0) : le résultat seul", () => {
    expect(plainSaid(craftText(BlockId.Planks, 0, 2))).toEqual({
      text: { debutant: "2 planches !", autonome: "Tu as fabriqué 2 planches !" },
      spoken: { debutant: "Deux planches !", autonome: "Tu as fabriqué deux planches !" },
    });
    expect(plainSaid(craftText(BlockId.Fence, 0, 1))).toEqual({
      text: { debutant: "Une clôture !", autonome: "Tu as fabriqué une clôture !" },
      spoken: { debutant: "Une clôture !", autonome: "Tu as fabriqué une clôture !" },
    });
    expect(plainText(craftText(BlockId.Glass, 0, 2).text)).toEqual({
      debutant: "2 blocs de verre !",
      autonome: "Tu as fabriqué 2 blocs de verre !",
    });
  });

  it("ensuite, une addition : écrite en chiffres, dite avec « plus » et « ça fait »", () => {
    expect(plainSaid(craftText(BlockId.Planks, 2, 2))).toEqual({
      text: { debutant: "2 + 2 = 4 planches !", autonome: "Tu avais 2 planches, tu en fabriques 2 : 2 + 2 = 4 planches !" },
      spoken: {
        debutant: "Deux plus deux, ça fait quatre planches !",
        autonome: "Tu avais deux planches, tu en fabriques deux. Deux plus deux, ça fait quatre planches !",
      },
    });
  });

  it("accorde au féminin ce qui parle de la clôture, mais pas les termes de l'addition", () => {
    expect(plainSaid(craftText(BlockId.Fence, 1, 1))).toEqual({
      text: {
        debutant: "1 + 1 = 2 clôtures !",
        autonome: "Tu avais une clôture, tu en fabriques une : 1 + 1 = 2 clôtures !",
      },
      spoken: {
        debutant: "Un plus un, ça fait deux clôtures !",
        autonome: "Tu avais une clôture, tu en fabriques une. Un plus un, ça fait deux clôtures !",
      },
    });
    expect(plain(craftText(BlockId.Fence, 20, 1).spoken.autonome)).toBe(
      "Tu avais vingt clôtures, tu en fabriques une. Vingt plus un, ça fait vingt et une clôtures !",
    );
    expect(plain(craftText(BlockId.Fence, 20, 1).spoken.debutant)).toBe("Vingt et une clôtures !");
  });

  it("le débutant voit l'addition jusqu'à un total de 10, puis le total seul", () => {
    expect(DEBUTANT_SUM_MAX).toBe(10);
    expect(plain(craftText(BlockId.Planks, 8, 2).text.debutant)).toBe("8 + 2 = 10 planches !");
    expect(plain(craftText(BlockId.Planks, 8, 2).spoken.debutant)).toBe("Huit plus deux, ça fait dix planches !");
    expect(plainSaid(craftText(BlockId.Planks, 10, 2))).toEqual({
      text: { debutant: "12 planches !", autonome: "Tu avais 10 planches, tu en fabriques 2 : 10 + 2 = 12 planches !" },
      spoken: {
        debutant: "Douze planches !",
        autonome: "Tu avais dix planches, tu en fabriques deux. Dix plus deux, ça fait douze planches !",
      },
    });
    // Seuil réglable (future « plage de nombres » du mode parent).
    expect(plain(craftText(BlockId.Planks, 2, 2, 3).text.debutant)).toBe("4 planches !");
    expect(plain(craftText(BlockId.Glass, 4, 2).text.debutant)).toBe("4 + 2 = 6 blocs de verre !");
  });

  it("withFact ajoute une phrase à la suite, à l'écrit et à l'oral", () => {
    expect(plainSaid(withFact(craftText(BlockId.Glass, 0, 2), CRAFT_GLASS_FACT))).toEqual({
      text: {
        debutant: "2 blocs de verre ! Le sable devient du verre !",
        autonome: "Tu as fabriqué 2 blocs de verre ! Le savais-tu ? Le verre se fabrique avec du sable chauffé très fort.",
      },
      spoken: {
        debutant: "Deux blocs de verre ! Le sable devient du verre !",
        autonome:
          "Tu as fabriqué deux blocs de verre ! Le savais-tu ? Le verre se fabrique avec du sable chauffé très fort.",
      },
    });
  });
});

describe("craftRefusalText", () => {
  it("réservé : d'abord le nombre demandé par la mission", () => {
    expect(refusalText(bag([BlockId.Log, 3]), PLANCHES, KEEP_6_LOGS)).toEqual({
      text: {
        debutant: "D'abord 6 troncs !",
        autonome: "Garde tes troncs pour la mission : il en faut 6. Tu fabriqueras juste après.",
      },
      spoken: {
        debutant: "D'abord six troncs pour la mission !",
        autonome: "Garde tes troncs pour la mission : il en faut six. Tu fabriqueras juste après.",
      },
    });
  });

  it("réservé sans aucun tronc : « ramasse d'abord »", () => {
    expect(refusalText(bag(), PLANCHES, KEEP_6_LOGS)).toEqual({
      text: { debutant: "D'abord 6 troncs !", autonome: "Ramasse d'abord 6 troncs pour la mission. Tu fabriqueras juste après." },
      spoken: {
        debutant: "D'abord six troncs pour la mission !",
        autonome: "Ramasse d'abord six troncs pour la mission. Tu fabriqueras juste après.",
      },
    });
  });

  it("manque, avec une partie de l'ingrédient : ce qui manque", () => {
    expect(refusalText(bag([BlockId.Planks, 1]), CLOTURE)).toEqual({
      text: { debutant: "Il manque une planche !", autonome: "Il te faut 2 planches et tu en as une : il en manque une." },
      spoken: {
        debutant: "Il manque une planche !",
        autonome: "Il te faut deux planches et tu en as une : il en manque une.",
      },
    });
  });

  it("manque, mais une autre carte fabrique l'ingrédient maintenant : indice de chaîne", () => {
    expect(refusalText(bag([BlockId.Log, 1]), CLOTURE)).toEqual({
      text: {
        debutant: "Fais d'abord des planches !",
        autonome: "Il te faut 2 planches : fabrique-les d'abord avec un tronc, sur la première carte.",
      },
      spoken: {
        debutant: "Fabrique d'abord des planches avec un tronc !",
        autonome: "Il te faut deux planches : fabrique-les d'abord avec un tronc, sur la première carte.",
      },
    });
  });

  it("pas d'indice de chaîne si la carte des planches est elle-même refusée (troncs gardés)", () => {
    const t = refusalText(bag([BlockId.Log, 3]), CLOTURE, KEEP_6_LOGS);
    expect(t.text.debutant).toBe("Il faut 2 planches !");
    expect(t.spoken.debutant).toBe("Il faut deux planches ! Fabrique-les avec un tronc.");
    expect(t.text.autonome).toBe("Il te faut 2 planches : fabrique-les d'abord avec un tronc.");
  });

  it("manque, sans rien : il faut l'ingrédient, et l'endroit où le trouver", () => {
    expect(refusalText(bag(), PLANCHES)).toEqual({
      text: { debutant: "Il faut un tronc !", autonome: "Il te faut un tronc : casse le tronc d'un arbre pour en ramasser." },
      spoken: {
        debutant: "Il faut un tronc ! Va casser un arbre.",
        autonome: "Il te faut un tronc : casse le tronc d'un arbre pour en ramasser.",
      },
    });
    expect(refusalText(bag(), VERRE)).toEqual({
      text: {
        debutant: "Il faut un bloc de sable !",
        autonome: "Il te faut un bloc de sable : il y en a au bord de l'eau et dans le désert.",
      },
      spoken: {
        debutant: "Il faut un bloc de sable ! Il y en a au bord de l'eau.",
        autonome: "Il te faut un bloc de sable : il y en a au bord de l'eau et dans le désert.",
      },
    });
    expect(refusalText(bag(), CLOTURE)).toEqual({
      text: { debutant: "Il faut 2 planches !", autonome: "Il te faut 2 planches : fabrique-les d'abord avec un tronc." },
      spoken: {
        debutant: "Il faut deux planches ! Fabrique-les avec un tronc.",
        autonome: "Il te faut deux planches : fabrique-les d'abord avec un tronc.",
      },
    });
  });

  it("manque un autre bloc : « cherche-en dans le monde »", () => {
    const stone: Recipe = { id: "verre", input: { block: BlockId.Stone, count: 1 }, output: { block: BlockId.Dirt, count: 1 } };
    const plan = planCraft(bag(), stone);
    if (plan.ok) throw new Error("possible");
    expect(plainSaid(craftRefusalText(plan, [plan], true))).toEqual({
      text: { debutant: "Il faut une pierre !", autonome: "Il te faut une pierre : cherche-en dans le monde." },
      spoken: {
        debutant: "Il faut une pierre ! Cherche-en dans le monde.",
        autonome: "Il te faut une pierre : cherche-en dans le monde.",
      },
    });
  });

  it("maximum : 99 au plus, et le calcul pour l'autonome (101 reste en chiffres)", () => {
    expect(refusalText(bag([BlockId.Planks, 98], [BlockId.Log, 1]), PLANCHES)).toEqual({
      text: {
        debutant: "99, c'est le maximum !",
        autonome: "Tu as 98 planches : avec 2 de plus, ça ferait 100. Le maximum, c'est 99.",
      },
      spoken: {
        debutant: "Quatre-vingt-dix-neuf, c'est le maximum !",
        autonome:
          "Tu as quatre-vingt-dix-huit planches : avec deux de plus, ça ferait cent. Le maximum, c'est quatre-vingt-dix-neuf.",
      },
    });
    const at99 = refusalText(bag([BlockId.Planks, 99], [BlockId.Log, 1]), PLANCHES);
    expect(at99.text.autonome).toBe("Tu as 99 planches : avec 2 de plus, ça ferait 101. Le maximum, c'est 99.");
    expect(at99.spoken.autonome).toBe(
      "Tu as quatre-vingt-dix-neuf planches : avec deux de plus, ça ferait 101. Le maximum, c'est quatre-vingt-dix-neuf.",
    );
    expect(refusalText(bag([BlockId.Fence, 99], [BlockId.Planks, 2]), CLOTURE).text.autonome).toBe(
      "Tu as 99 clôtures : avec une de plus, ça ferait 100. Le maximum, c'est 99.",
    );
  });

  it("sac plein : la consigne du doigt ou de la souris, et sa forme dite", () => {
    const { plan, plans } = refusal(fullBag(2), PLANCHES);
    expect(craftRefusalText(plan, plans, true)).toEqual({ text: CRAFT_FULL_TOUCH, spoken: SPOKEN_TIPS.craftFullTouch });
    expect(craftRefusalText(plan, plans, false)).toEqual({ text: CRAFT_FULL_MOUSE, spoken: SPOKEN_TIPS.craftFullMouse });
  });

  it("au doigt ou à la souris, seul le sac plein change", () => {
    const cases: [(Stack | null)[], Recipe, CraftOptions?][] = [
      [bag([BlockId.Log, 3]), PLANCHES, KEEP_6_LOGS],
      [bag([BlockId.Planks, 1]), CLOTURE],
      [bag([BlockId.Log, 1]), CLOTURE],
      [bag(), VERRE],
      [bag([BlockId.Planks, 98], [BlockId.Log, 1]), PLANCHES],
    ];
    for (const [slots, r, opts] of cases) {
      expect(refusalText(slots, r, opts, true)).toEqual(refusalText(slots, r, opts, false));
    }
  });
});

describe("craftIntroText : présentation du marteau", () => {
  it("au doigt : le marteau qui brille, et l'exemple de la première recette possible", () => {
    expect(plainSaid(craftIntroText(PLANCHES, true))).toEqual({
      text: {
        debutant: "Touche le marteau qui brille !",
        autonome: "Nouveau : touche le marteau pour fabriquer des blocs. Avec un tronc, tu fabriques 2 planches.",
      },
      spoken: {
        debutant: "Touche le marteau qui brille : avec un tronc, tu fabriques deux planches !",
        autonome: "Nouveau : touche le marteau pour fabriquer des blocs. Avec un tronc, tu fabriques deux planches.",
      },
    });
  });

  it("au clavier : la touche F", () => {
    expect(plainSaid(craftIntroText(PLANCHES, false))).toEqual({
      text: {
        debutant: "Appuie sur F pour fabriquer !",
        autonome: "Nouveau : appuie sur F pour fabriquer des blocs. Avec un tronc, tu fabriques 2 planches.",
      },
      spoken: {
        debutant: "Appuie sur la touche F pour fabriquer : avec un tronc, tu fabriques deux planches !",
        autonome: "Nouveau : appuie sur F pour fabriquer des blocs. Avec un tronc, tu fabriques deux planches.",
      },
    });
  });

  it("l'exemple suit la première recette possible avec ce sac", () => {
    const first = (slots: (Stack | null)[], opts?: CraftOptions) => craftPlans(slots, opts).find((p) => p.ok)!.recipe;
    expect(first(bag([BlockId.Sand, 3]))).toBe(VERRE);
    expect(plain(craftIntroText(first(bag([BlockId.Sand, 3])), true).text.autonome)).toBe(
      "Nouveau : touche le marteau pour fabriquer des blocs. Avec un bloc de sable, tu fabriques 2 blocs de verre.",
    );
    // Troncs gardés pour la mission : les planches passent avant.
    const r = first(bag([BlockId.Log, 3], [BlockId.Planks, 2]), KEEP_6_LOGS);
    expect(r).toBe(CLOTURE);
    expect(plain(craftIntroText(r, false).text.autonome)).toBe(
      "Nouveau : appuie sur F pour fabriquer des blocs. Avec 2 planches, tu fabriques une clôture.",
    );
    expect(plain(craftIntroText(r, true).spoken.debutant)).toBe(
      "Touche le marteau qui brille : avec deux planches, tu fabriques une clôture !",
    );
  });
});

describe("craftMoreBlocksText : conseil de l'étape abri", () => {
  it("au doigt et au clavier, quantités de la première recette", () => {
    expect(plainSaid(craftMoreBlocksText(true))).toEqual({
      text: {
        debutant: "Fabrique des planches !",
        autonome: "Pas assez de blocs pour ton abri ? Touche le marteau : un tronc donne 2 planches.",
      },
      spoken: {
        debutant: "Pas assez de blocs ? Touche le marteau : un tronc donne deux planches !",
        autonome: "Pas assez de blocs pour ton abri ? Touche le marteau : un tronc donne deux planches.",
      },
    });
    expect(plainSaid(craftMoreBlocksText(false))).toEqual({
      text: {
        debutant: "Fabrique des planches !",
        autonome: "Pas assez de blocs pour ton abri ? Appuie sur F : un tronc donne 2 planches.",
      },
      spoken: {
        debutant: "Pas assez de blocs ? Appuie sur F : un tronc donne deux planches !",
        autonome: "Pas assez de blocs pour ton abri ? Appuie sur F : un tronc donne deux planches.",
      },
    });
  });
});

describe("craftCardViews", () => {
  it("décrit chaque carte : état, ingrédient (demandé, dans le sac), résultat", () => {
    const slots = bag([BlockId.Log, 5], [BlockId.Planks, 1]);
    const views = craftCardViews(craftPlans(slots), slots, "debutant");
    expect(views.map((v) => v.id)).toEqual(["planches", "cloture", "verre"]);
    expect(views.map((v) => v.state)).toEqual(["ok", "missing", "missing"]);
    expect(views[0]).toMatchObject({
      input: { block: BlockId.Log, need: 1, have: 5 },
      output: { block: BlockId.Planks, count: 2 },
    });
    expect(views[1]).toMatchObject({ input: { block: BlockId.Planks, need: 2, have: 1 }, output: { block: BlockId.Fence, count: 1 } });
    expect(views[2]).toMatchObject({ input: { block: BlockId.Sand, need: 1, have: 0 }, output: { block: BlockId.Glass, count: 2 } });
  });

  it("phrase de la recette seulement pour l'autonome", () => {
    const slots = bag([BlockId.Log, 5]);
    const plans = craftPlans(slots);
    expect(craftCardViews(plans, slots, "debutant").map((v) => v.sentence)).toEqual([null, null, null]);
    expect(craftCardViews(plans, slots, "autonome").map((v) => v.sentence)).toEqual(RECIPES.map(recipeSentence));
  });

  it("possible : coche ; l'autonome lit ce qu'il a", () => {
    const slots = bag([BlockId.Log, 5], [BlockId.Planks, 2], [BlockId.Sand, 1]);
    const plans = craftPlans(slots);
    const deb = craftCardViews(plans, slots, "debutant");
    const aut = craftCardViews(plans, slots, "autonome");
    expect(deb.map((v) => [v.state, v.icon, v.badge])).toEqual([
      ["ok", "check", ""],
      ["ok", "check", ""],
      ["ok", "check", ""],
    ]);
    expect(aut.map((v) => [v.icon, v.badge])).toEqual([
      ["check", "Tu as 5 troncs."],
      ["check", "Tu as 2 planches."],
      ["check", "Tu as un bloc de sable."],
    ]);
  });

  it("réservé : cadenas et compte de la mission", () => {
    const slots = bag([BlockId.Log, 3]);
    const plans = craftPlans(slots, KEEP_6_LOGS);
    const [deb] = craftCardViews(plans, slots, "debutant");
    const [aut] = craftCardViews(plans, slots, "autonome");
    expect(deb).toMatchObject({ state: "reserved", icon: "lock", badge: `3${NBSP}/${NBSP}6` });
    expect(aut).toMatchObject({ state: "reserved", icon: "lock", badge: `Pour la mission${NBSP}: 3${NBSP}/${NBSP}6` });
    // Le compte ne dépasse pas le nombre demandé (6 troncs gardés, 6 dans le sac : 6 / 6).
    const six = bag([BlockId.Log, 6]);
    expect(craftCardViews(craftPlans(six, KEEP_6_LOGS), six, "debutant")[0]?.badge).toBe(`6${NBSP}/${NBSP}6`);
  });

  it("manque : rien pour le débutant (icônes fantômes), ce qu'il a pour l'autonome", () => {
    const slots = bag([BlockId.Planks, 1]);
    const plans = craftPlans(slots);
    const deb = craftCardViews(plans, slots, "debutant");
    const aut = craftCardViews(plans, slots, "autonome");
    expect(deb.map((v) => [v.state, v.icon, v.badge])).toEqual([
      ["missing", null, ""],
      ["missing", null, ""],
      ["missing", null, ""],
    ]);
    expect(aut.map((v) => v.badge)).toEqual(["Tu n'en as pas.", "Tu en as une sur 2.", "Tu n'en as pas."]);
  });

  it("sac plein : sac barré ; maximum : 99", () => {
    const full = fullBag(2);
    const plans = craftPlans(full);
    expect(craftCardViews(plans, full, "debutant")[0]).toMatchObject({ state: "full", icon: "bag", badge: "" });
    expect(craftCardViews(plans, full, "autonome")[0]).toMatchObject({ state: "full", icon: "bag", badge: "Sac plein" });

    const max = bag([BlockId.Planks, 99], [BlockId.Log, 1]);
    const maxPlans = craftPlans(max);
    expect(craftCardViews(maxPlans, max, "debutant")[0]).toMatchObject({ state: "max", icon: null, badge: "99" });
    expect(craftCardViews(maxPlans, max, "autonome")[0]).toMatchObject({
      state: "max",
      icon: null,
      badge: `Maximum${NBSP}: ${String(MAX_STACK)}`,
    });
  });
});

/** Tous les textes de la fabrication, sur beaucoup de sacs : résultats, refus, présentation, conseil. */
function corpus(): SaidText[] {
  const out: SaidText[] = [];
  for (const r of RECIPES) {
    for (let before = 0; before + r.output.count <= MAX_STACK; before++) out.push(craftText(r.output.block, before, r.output.count));
    for (const touch of [true, false]) out.push(craftIntroText(r, touch));
  }
  for (const touch of [true, false]) out.push(craftMoreBlocksText(touch));
  out.push(withFact(craftText(BlockId.Glass, 0, 2), CRAFT_GLASS_FACT));

  const rand = createRng(8);
  const kinds = [BlockId.Log, BlockId.Planks, BlockId.Fence, BlockId.Sand, BlockId.Glass, BlockId.Stone, BlockId.Dirt];
  for (let n = 0; n < 600; n++) {
    const slots = bag(
      ...kinds.map((id): [BlockId, number] | null => {
        const x = rand();
        return x < 0.35 ? null : [id, x < 0.6 ? 1 + Math.floor(rand() * 3) : 90 + Math.floor(rand() * 10)];
      }),
      [BlockId.Leaves, 1],
      rand() < 0.5 ? [BlockId.Snow, 1] : null,
    );
    const opts: CraftOptions | undefined =
      rand() < 0.4 ? { reserved: { block: BlockId.Log, keep: 1 + Math.floor(rand() * 8) } } : undefined;
    const plans = craftPlans(slots, opts);
    for (const p of plans) {
      if (p.ok) continue;
      for (const touch of [true, false]) out.push(craftRefusalText(p, plans, touch));
    }
  }
  return out;
}

const ALL = corpus();

function reasonsIn(plans: readonly CraftPlan[]): Set<string> {
  return new Set(plans.filter((p): p is Extract<CraftPlan, { ok: false }> => !p.ok).map((p) => p.reason));
}

describe("règles d'écriture (sur tous les textes)", () => {
  it("le corpus couvre les cinq sortes de refus et des additions", () => {
    const seen = new Set<string>();
    for (const [slots, opts] of [
      [bag([BlockId.Log, 3]), KEEP_6_LOGS],
      [bag([BlockId.Planks, 1]), undefined],
      [bag([BlockId.Planks, 99], [BlockId.Log, 1]), undefined],
      [fullBag(2), undefined],
    ] as const) {
      for (const r of reasonsIn(craftPlans(slots, opts))) seen.add(r);
    }
    expect([...seen].sort()).toEqual(["full", "max", "missing", "reserved"]);
    expect(ALL.length).toBeGreaterThan(500);
    expect(ALL.some((s) => s.text.debutant.includes("+"))).toBe(true);
  });

  it("typographie : espace insécable devant ! ? : ; et autour de + et =, jamais d'espace simple", () => {
    for (const said of ALL) {
      for (const s of [said.text.debutant, said.text.autonome, said.spoken.debutant, said.spoken.autonome]) {
        expect(s).toMatch(/^[\p{Lu}\p{N}]/u);
        expect(s).toMatch(/[.!?]$/);
        expect(s).not.toMatch(/ [!?:;]/);
        expect(s).not.toMatch(/\S[!?:;]/);
        expect(s).not.toMatch(/[^ ][+=]/);
        expect(s).not.toMatch(/[+=][^ ]/);
        expect(s).not.toMatch(/ {2}|  |  | {2}/);
        expect(s).not.toMatch(/\s$|^\s/);
      }
    }
  });

  it("débutant : au plus 6 mots (5 pour un texte fixe), plus court que l'autonome", () => {
    for (const said of ALL) {
      const t = said.text;
      if (t.debutant.includes(CRAFT_GLASS_FACT.debutant)) continue; // deux phrases (voir plus bas)
      expect(words(t.debutant)).toBeLessThanOrEqual(6);
      expect(t.debutant.length).toBeLessThan(t.autonome.length);
    }
    for (const t of [
      craftIntroText(PLANCHES, true).text,
      craftIntroText(PLANCHES, false).text,
      craftMoreBlocksText(true).text,
      craftMoreBlocksText(false).text,
    ]) {
      expect(words(t.debutant)).toBeLessThanOrEqual(5);
    }
    // La phrase « savais-tu » ajoutée garde deux phrases courtes.
    const glass = withFact(craftText(BlockId.Glass, 0, 2), CRAFT_GLASS_FACT).text;
    expect(glass.debutant.length).toBeLessThan(glass.autonome.length);
  });

  it("ni « appuyé », ni « prêt », ni « content », ni « lampe » (textes, cartes et badges)", () => {
    const forbidden = /appuy[ée]|pr[êe]te?s?\b|content|lampe/i;
    for (const said of ALL) {
      for (const s of [said.text.debutant, said.text.autonome, said.spoken.debutant, said.spoken.autonome]) {
        expect(s).not.toMatch(forbidden);
      }
    }
    for (const slots of [bag([BlockId.Log, 3]), bag([BlockId.Planks, 1]), fullBag(2), bag([BlockId.Planks, 99], [BlockId.Log, 1])]) {
      for (const level of ["debutant", "autonome"] as const) {
        for (const opts of [undefined, KEEP_6_LOGS]) {
          for (const v of craftCardViews(craftPlans(slots, opts), slots, level)) {
            expect(v.badge).not.toMatch(forbidden);
            expect(v.sentence ?? "").not.toMatch(forbidden);
          }
        }
      }
    }
  });

  it("formes dites : aucun chiffre sauf au-delà de cent (101)", () => {
    for (const said of ALL) {
      for (const s of [said.spoken.debutant, said.spoken.autonome]) {
        expect(s.replace("101", "")).not.toMatch(/\d/);
      }
    }
  });
});
