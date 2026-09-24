import { describe, expect, expectTypeOf, it } from "vitest";
import { BLOCKS, BlockId, HOTBAR_BLOCKS } from "../../src/engine/blocks";
import {
  INVENTORY_SLOTS,
  Inventory,
  MAX_STACK,
  isInventoryBlockId,
  type AddResult,
  type InventoryData,
  type Stack,
} from "../../src/engine/inventory";

/** Neuf types différents, pour remplir toutes les cases. */
const NINE_TYPES: readonly BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Planks,
  BlockId.Sand,
  BlockId.Log,
  BlockId.Leaves,
  BlockId.Snow,
  BlockId.Cactus,
];

describe("inventaire : contrat d'interface (vérifié par npm run typecheck)", () => {
  it("expose exactement les signatures de la spécification J2", () => {
    expectTypeOf<Stack>().toEqualTypeOf<{ id: BlockId; count: number }>();
    expectTypeOf<AddResult>().toEqualTypeOf<
      { ok: true; slot: number; count: number; added: number } | { ok: false; reason: "full" | "max"; slot: number | null }
    >();
    expectTypeOf<InventoryData>().toEqualTypeOf<{ slots: ([number, number] | null)[] }>();
    expectTypeOf(Inventory).constructorParameters.toEqualTypeOf<[size?: number]>();
    expectTypeOf(Inventory.fromJSON).toEqualTypeOf<(data: unknown, size?: number) => Inventory>();
    const inv = new Inventory();
    expectTypeOf(inv.size).toEqualTypeOf<number>();
    expectTypeOf(inv.version).toEqualTypeOf<number>();
    expectTypeOf(inv.slot).toEqualTypeOf<(i: number) => Stack | null>();
    expectTypeOf(inv.slots).toEqualTypeOf<() => (Stack | null)[]>();
    expectTypeOf(inv.count).toEqualTypeOf<(id: BlockId) => number>();
    expectTypeOf(inv.indexOf).toEqualTypeOf<(id: BlockId) => number>();
    expectTypeOf(inv.totalBlocks).toEqualTypeOf<() => number>();
    expectTypeOf(inv.usedSlots).toEqualTypeOf<() => number>();
    expectTypeOf(inv.add).toEqualTypeOf<(id: BlockId, n?: number) => AddResult>();
    expectTypeOf(inv.takeFrom).toEqualTypeOf<(i: number, n?: number) => BlockId | null>();
    expectTypeOf(inv.clear).toEqualTypeOf<() => void>();
    expectTypeOf(inv.fill).toEqualTypeOf<(ids: readonly BlockId[], count: number) => void>();
    expectTypeOf(inv.toJSON).toEqualTypeOf<() => InventoryData>();
    // size et version sont en lecture seule (version n'a qu'un accesseur de lecture).
    expectTypeOf<Pick<Inventory, "size" | "version">>().toEqualTypeOf<{ readonly size: number; readonly version: number }>();
  });
});

describe("inventaire : création", () => {
  it("a 9 cases vides par défaut", () => {
    const inv = new Inventory();
    expect(INVENTORY_SLOTS).toBe(9);
    expect(MAX_STACK).toBe(99);
    expect(inv.size).toBe(INVENTORY_SLOTS);
    expect(inv.slots()).toEqual(new Array(9).fill(null));
    expect(inv.usedSlots()).toBe(0);
    expect(inv.totalBlocks()).toBe(0);
    expect(inv.version).toBe(0);
  });

  it("accepte une autre taille et refuse une taille invalide", () => {
    expect(new Inventory(3).size).toBe(3);
    expect(new Inventory(3).slots()).toHaveLength(3);
    for (const bad of [0, -1, 2.5, Number.NaN, Infinity]) expect(() => new Inventory(bad)).toThrow(RangeError);
  });
});

describe("inventaire : ajout", () => {
  it("range un nouveau type dans la première case vide", () => {
    const inv = new Inventory();
    expect(inv.add(BlockId.Stone)).toEqual({ ok: true, slot: 0, count: 1, added: 1 });
    expect(inv.slot(0)).toEqual({ id: BlockId.Stone, count: 1 });
    expect(inv.add(BlockId.Grass, 4)).toEqual({ ok: true, slot: 1, count: 4, added: 4 });
    expect(inv.slot(1)).toEqual({ id: BlockId.Grass, count: 4 });
  });

  it("cumule dans la case existante du même type", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone);
    expect(inv.add(BlockId.Stone)).toEqual({ ok: true, slot: 0, count: 2, added: 1 });
    expect(inv.add(BlockId.Stone, 5)).toEqual({ ok: true, slot: 0, count: 7, added: 5 });
    expect(inv.count(BlockId.Stone)).toBe(7);
  });

  it("n'utilise qu'une case par type", () => {
    const inv = new Inventory();
    inv.add(BlockId.Grass);
    inv.add(BlockId.Stone);
    expect(inv.add(BlockId.Grass)).toEqual({ ok: true, slot: 0, count: 2, added: 1 });
    expect(inv.usedSlots()).toBe(2);
    expect(inv.slots().filter((s) => s?.id === BlockId.Grass)).toHaveLength(1);
    expect(inv.indexOf(BlockId.Grass)).toBe(0);
    expect(inv.indexOf(BlockId.Stone)).toBe(1);
  });

  it("refuse un nouveau type quand toutes les cases sont prises (full)", () => {
    const inv = new Inventory();
    for (const id of NINE_TYPES) expect(inv.add(id).ok).toBe(true);
    expect(inv.usedSlots()).toBe(9);
    expect(inv.add(BlockId.FlowerRed)).toEqual({ ok: false, reason: "full", slot: null });
    expect(inv.count(BlockId.FlowerRed)).toBe(0);
    // Un type déjà présent se cumule toujours.
    expect(inv.add(BlockId.Snow)).toEqual({ ok: true, slot: 7, count: 2, added: 1 });
  });

  it("refuse d'ajouter à une case déjà à 99 (max)", () => {
    const inv = new Inventory();
    inv.add(BlockId.Grass);
    expect(inv.add(BlockId.Stone, 99)).toEqual({ ok: true, slot: 1, count: 99, added: 99 });
    expect(inv.add(BlockId.Stone)).toEqual({ ok: false, reason: "max", slot: 1 });
    expect(inv.count(BlockId.Stone)).toBe(MAX_STACK);
  });

  it("plafonne un ajout partiel à 99", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 95);
    expect(inv.add(BlockId.Stone, 10)).toEqual({ ok: true, slot: 0, count: 99, added: 4 });
    expect(inv.add(BlockId.Log, 150)).toEqual({ ok: true, slot: 1, count: 99, added: 99 });
    expect(inv.add(BlockId.Sand, Infinity)).toEqual({ ok: true, slot: 2, count: 99, added: 99 });
  });

  it("« max » passe avant « full » quand le type est déjà présent et plein", () => {
    const inv = new Inventory(2);
    inv.add(BlockId.Stone, 99);
    inv.add(BlockId.Dirt);
    expect(inv.add(BlockId.Stone)).toEqual({ ok: false, reason: "max", slot: 0 });
    expect(inv.add(BlockId.Sand)).toEqual({ ok: false, reason: "full", slot: null });
  });

  it("lève une erreur pour l'air et les identifiants inconnus", () => {
    const inv = new Inventory();
    for (const bad of [BlockId.Air, BLOCKS.length, 200, 255, -1, 2.5, Number.NaN]) {
      expect(() => inv.add(bad as BlockId)).toThrow(Error);
    }
    expect(inv.usedSlots()).toBe(0);
    expect(inv.version).toBe(0);
    // Sac plein : l'air reste une erreur, pas un simple refus « full ».
    for (const id of NINE_TYPES) inv.add(id);
    expect(() => inv.add(BlockId.Air)).toThrow(Error);
  });

  it("lève une erreur pour un nombre à ajouter invalide", () => {
    const inv = new Inventory();
    for (const bad of [0, -1, 1.5, Number.NaN, -Infinity]) expect(() => inv.add(BlockId.Stone, bad)).toThrow(RangeError);
    expect(inv.usedSlots()).toBe(0);
  });

  it("accepte chaque bloc du registre sauf l'air", () => {
    const inv = new Inventory(BLOCKS.length);
    for (const def of BLOCKS) {
      if (def.id === BlockId.Air) continue;
      expect(inv.add(def.id).ok).toBe(true);
    }
    expect(inv.usedSlots()).toBe(BLOCKS.length - 1);
  });
});

describe("inventaire : retrait", () => {
  it("retire un bloc et renvoie son type", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    expect(inv.takeFrom(0)).toBe(BlockId.Stone);
    expect(inv.slot(0)).toEqual({ id: BlockId.Stone, count: 2 });
    expect(inv.takeFrom(0, 2)).toBe(BlockId.Stone);
    expect(inv.slot(0)).toBeNull();
  });

  it("une case qui tombe à 0 redevient vide", () => {
    const inv = new Inventory();
    inv.add(BlockId.Log);
    expect(inv.takeFrom(0)).toBe(BlockId.Log);
    expect(inv.slot(0)).toBeNull();
    expect(inv.slots()[0]).toBeNull();
    expect(inv.indexOf(BlockId.Log)).toBe(-1);
    expect(inv.count(BlockId.Log)).toBe(0);
    expect(inv.usedSlots()).toBe(0);
    expect(inv.takeFrom(0)).toBeNull();
  });

  it("ne retire pas plus que ce qu'il y a", () => {
    const inv = new Inventory();
    inv.add(BlockId.Sand, 4);
    expect(inv.takeFrom(0, 10)).toBe(BlockId.Sand);
    expect(inv.slot(0)).toBeNull();
    inv.add(BlockId.Sand, 4);
    expect(inv.takeFrom(0, Infinity)).toBe(BlockId.Sand);
    expect(inv.slot(0)).toBeNull();
  });

  it("renvoie null pour une case vide ou hors bornes", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone);
    expect(inv.takeFrom(1)).toBeNull();
    for (const bad of [-1, 9, 100, 0.5, Number.NaN]) expect(inv.takeFrom(bad)).toBeNull();
    expect(inv.count(BlockId.Stone)).toBe(1);
  });

  it("lève une erreur pour un nombre à retirer invalide", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    for (const bad of [0, -2, 1.5, Number.NaN]) expect(() => inv.takeFrom(0, bad)).toThrow(RangeError);
    expect(inv.count(BlockId.Stone)).toBe(3);
  });

  it("réutilise la case vidée pour le prochain nouveau type", () => {
    const inv = new Inventory();
    inv.add(BlockId.Grass);
    inv.add(BlockId.Stone);
    inv.add(BlockId.Dirt);
    inv.takeFrom(1); // la pierre disparaît : trou en case 1
    expect(inv.slots().map((s) => s?.id ?? null)).toEqual([BlockId.Grass, null, BlockId.Dirt, null, null, null, null, null, null]);
    // Un type déjà présent reste dans sa case, même s'il y a un trou avant elle.
    expect(inv.add(BlockId.Dirt)).toEqual({ ok: true, slot: 2, count: 2, added: 1 });
    expect(inv.add(BlockId.Sand)).toEqual({ ok: true, slot: 1, count: 1, added: 1 });
    expect(inv.add(BlockId.Log)).toEqual({ ok: true, slot: 3, count: 1, added: 1 });
    // Les autres cases n'ont pas bougé.
    expect(inv.indexOf(BlockId.Grass)).toBe(0);
    expect(inv.indexOf(BlockId.Dirt)).toBe(2);
  });

  it("un sac plein retrouve de la place quand une case se vide", () => {
    const inv = new Inventory();
    for (const id of NINE_TYPES) inv.add(id);
    expect(inv.add(BlockId.FlowerYellow).ok).toBe(false);
    inv.takeFrom(4);
    expect(inv.add(BlockId.FlowerYellow)).toEqual({ ok: true, slot: 4, count: 1, added: 1 });
  });
});

describe("inventaire : lecture", () => {
  it("slot et slots renvoient des copies", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 5);
    const s = inv.slot(0)!;
    s.count = 50;
    s.id = BlockId.Grass;
    const all = inv.slots();
    all[0]!.count = 70;
    all[1] = { id: BlockId.Dirt, count: 1 };
    expect(inv.slot(0)).toEqual({ id: BlockId.Stone, count: 5 });
    expect(inv.slot(1)).toBeNull();
    expect(inv.version).toBe(1);
  });

  it("slot renvoie null hors bornes", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone);
    for (const bad of [-1, 9, 1.5, Number.NaN, Infinity]) expect(inv.slot(bad)).toBeNull();
  });

  it("compte les blocs et les cases", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    inv.add(BlockId.Grass, 10);
    inv.add(BlockId.Stone, 2);
    expect(inv.count(BlockId.Stone)).toBe(5);
    expect(inv.count(BlockId.Grass)).toBe(10);
    expect(inv.count(BlockId.Log)).toBe(0);
    expect(inv.count(BlockId.Air)).toBe(0);
    expect(inv.indexOf(BlockId.Log)).toBe(-1);
    expect(inv.indexOf(BlockId.Air)).toBe(-1);
    expect(inv.totalBlocks()).toBe(15);
    expect(inv.usedSlots()).toBe(2);
  });
});

describe("inventaire : version", () => {
  it("augmente de 1 à chaque changement effectif", () => {
    const inv = new Inventory();
    expect(inv.version).toBe(0);
    inv.add(BlockId.Stone);
    expect(inv.version).toBe(1);
    inv.add(BlockId.Stone, 5); // un seul changement, même pour plusieurs blocs
    expect(inv.version).toBe(2);
    inv.takeFrom(0);
    expect(inv.version).toBe(3);
    inv.takeFrom(0, 99); // vide la case
    expect(inv.version).toBe(4);
    inv.add(BlockId.Log, 97);
    inv.add(BlockId.Log, 10); // ajout partiel (2 sur 10) : c'est un changement
    expect(inv.count(BlockId.Log)).toBe(MAX_STACK);
    expect(inv.version).toBe(6);
  });

  it("ne bouge pas quand rien ne change", () => {
    const inv = new Inventory(1);
    inv.add(BlockId.Stone, 99);
    const v = inv.version;
    expect(inv.add(BlockId.Stone).ok).toBe(false); // max
    expect(inv.add(BlockId.Dirt).ok).toBe(false); // full
    expect(inv.takeFrom(5)).toBeNull(); // hors bornes
    expect(() => inv.add(BlockId.Air)).toThrow();
    inv.slot(0);
    inv.slots();
    inv.toJSON();
    expect(inv.version).toBe(v);
    inv.takeFrom(0, 99);
    const v2 = inv.version;
    expect(inv.takeFrom(0)).toBeNull(); // case vide
    inv.clear(); // déjà vide
    expect(inv.version).toBe(v2);
  });

  it("clear vide tout et compte pour un changement", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    inv.add(BlockId.Grass);
    const v = inv.version;
    inv.clear();
    expect(inv.version).toBe(v + 1);
    expect(inv.usedSlots()).toBe(0);
    expect(inv.totalBlocks()).toBe(0);
    expect(inv.slots()).toEqual(new Array(9).fill(null));
  });
});

describe("inventaire : fill", () => {
  it("vide puis remplit dans l'ordre", () => {
    const inv = new Inventory();
    inv.add(BlockId.FlowerRed, 7);
    inv.fill([BlockId.Stone, BlockId.Grass, BlockId.Log], 10);
    expect(inv.slots()).toEqual([
      { id: BlockId.Stone, count: 10 },
      { id: BlockId.Grass, count: 10 },
      { id: BlockId.Log, count: 10 },
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(inv.count(BlockId.FlowerRed)).toBe(0);
  });

  it("remplit la barre complète avec les blocs de la barre du prototype", () => {
    const inv = new Inventory();
    inv.fill(HOTBAR_BLOCKS, MAX_STACK);
    expect(inv.usedSlots()).toBe(9);
    expect(inv.totalBlocks()).toBe(9 * MAX_STACK);
    HOTBAR_BLOCKS.forEach((id, i) => expect(inv.slot(i)).toEqual({ id, count: MAX_STACK }));
  });

  it("tronque à la taille de l'inventaire", () => {
    const inv = new Inventory(3);
    inv.fill(NINE_TYPES, 5);
    expect(inv.usedSlots()).toBe(3);
    expect(inv.slots().map((s) => s?.id)).toEqual(NINE_TYPES.slice(0, 3));
  });

  it("borne le nombre à [1, 99]", () => {
    const inv = new Inventory();
    inv.fill([BlockId.Stone], 0);
    expect(inv.count(BlockId.Stone)).toBe(1);
    inv.fill([BlockId.Stone], -8);
    expect(inv.count(BlockId.Stone)).toBe(1);
    inv.fill([BlockId.Stone], 150);
    expect(inv.count(BlockId.Stone)).toBe(99);
    inv.fill([BlockId.Stone], Infinity);
    expect(inv.count(BlockId.Stone)).toBe(99);
    inv.fill([BlockId.Stone], 2.7);
    expect(inv.count(BlockId.Stone)).toBe(2);
    inv.fill([BlockId.Stone], Number.NaN);
    expect(inv.count(BlockId.Stone)).toBe(1);
  });

  it("garde une case par type : un doublon est ignoré sans laisser de trou", () => {
    const inv = new Inventory();
    inv.fill([BlockId.Stone, BlockId.Grass, BlockId.Stone, BlockId.Dirt], 4);
    expect(inv.slots().slice(0, 4)).toEqual([
      { id: BlockId.Stone, count: 4 },
      { id: BlockId.Grass, count: 4 },
      { id: BlockId.Dirt, count: 4 },
      null,
    ]);
  });

  it("une liste vide vide l'inventaire", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone);
    inv.fill([], 5);
    expect(inv.usedSlots()).toBe(0);
  });

  it("refuse l'air et les identifiants inconnus sans rien modifier", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 2);
    const v = inv.version;
    expect(() => inv.fill([BlockId.Grass, BlockId.Air], 5)).toThrow(Error);
    expect(() => inv.fill([BlockId.Grass, 200 as BlockId], 5)).toThrow(Error);
    expect(inv.slots()[0]).toEqual({ id: BlockId.Stone, count: 2 });
    expect(inv.usedSlots()).toBe(1);
    expect(inv.version).toBe(v);
  });

  it("augmente la version une seule fois, et pas du tout si le contenu est identique", () => {
    const inv = new Inventory();
    inv.fill([BlockId.Stone, BlockId.Grass], 5);
    expect(inv.version).toBe(1);
    inv.fill([BlockId.Stone, BlockId.Grass], 5);
    expect(inv.version).toBe(1);
    inv.fill([BlockId.Stone, BlockId.Grass], 6);
    expect(inv.version).toBe(2);
    inv.fill([BlockId.Grass, BlockId.Stone], 6);
    expect(inv.version).toBe(3);
    const empty = new Inventory();
    empty.fill([], 3);
    expect(empty.version).toBe(0);
  });
});

describe("inventaire : sauvegarde (toJSON / fromJSON)", () => {
  it("toJSON donne une entrée [id, nombre] ou null par case", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    inv.add(BlockId.Grass, 12);
    inv.add(BlockId.Log);
    inv.takeFrom(1, 12); // trou en case 1
    expect(inv.toJSON()).toEqual({
      slots: [[BlockId.Stone, 3], null, [BlockId.Log, 1], null, null, null, null, null, null],
    });
  });

  it("fait l'aller-retour, positions et trous compris, même en passant par du texte", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    inv.add(BlockId.Grass, 99);
    inv.add(BlockId.Cactus, 42);
    inv.add(BlockId.FlowerYellow, 7);
    inv.takeFrom(1, 99);
    const back = Inventory.fromJSON(JSON.parse(JSON.stringify(inv)));
    expect(back.size).toBe(inv.size);
    expect(back.slots()).toEqual(inv.slots());
    expect(back.toJSON()).toEqual(inv.toJSON());
    expect(back.version).toBe(0);
    // L'inventaire relu fonctionne normalement : la case vide est réutilisée.
    expect(back.add(BlockId.Sand)).toEqual({ ok: true, slot: 1, count: 1, added: 1 });
  });

  it("respecte la taille demandée et tronque les entrées au-delà", () => {
    const data = { slots: [[3, 1], [1, 2], [2, 3], [6, 4], [5, 5]] };
    const small = Inventory.fromJSON(data, 3);
    expect(small.size).toBe(3);
    expect(small.toJSON()).toEqual({ slots: [[3, 1], [1, 2], [2, 3]] });
    // Moins d'entrées que de cases : le reste est vide.
    const big = Inventory.fromJSON({ slots: [[3, 1]] }, 12);
    expect(big.size).toBe(12);
    expect(big.usedSlots()).toBe(1);
    expect(big.slots()).toHaveLength(12);
  });

  it("une taille invalide retombe sur 9 cases sans lever d'exception", () => {
    for (const bad of [0, -3, 2.5, Number.NaN, Infinity, 2 ** 40]) {
      const inv = Inventory.fromJSON({ slots: [[3, 1]] }, bad);
      expect(inv.size).toBe(INVENTORY_SLOTS);
      expect(inv.count(BlockId.Stone)).toBe(1);
    }
  });

  it("donne un inventaire vide pour des données qui ne sont pas un inventaire", () => {
    const junk: unknown[] = [null, undefined, "chaîne", "", 42, true, [], [[3, 1]], {}, { slots: "x" }, { slots: 7 }, { slots: null }, { slots: { 0: [3, 1] } }, () => 1];
    for (const data of junk) {
      const inv = Inventory.fromJSON(data);
      expect(inv.size).toBe(INVENTORY_SLOTS);
      expect(inv.usedSlots()).toBe(0);
      expect(inv.version).toBe(0);
    }
  });

  it("ignore les entrées farfelues et garde les bonnes à leur place", () => {
    const data = {
      slots: [
        [BlockId.Air, 5], // air
        [999, 3], // identifiant inconnu
        [BLOCKS.length, 2], // juste après le dernier bloc
        [-1, 2], // négatif
        [3.5, 2], // identifiant non entier
        ["3", 5], // identifiant en texte
        [BlockId.Stone, 4], // valide, case 6
        [BlockId.Grass, 0], // nombre nul
        [BlockId.Grass, -2], // nombre négatif
      ],
    };
    const inv = Inventory.fromJSON(data);
    expect(inv.toJSON()).toEqual({ slots: [null, null, null, null, null, null, [BlockId.Stone, 4], null, null] });
  });

  it("ignore les nombres non entiers et les formes inattendues", () => {
    const data = {
      slots: [
        [BlockId.Stone, 1.5],
        [BlockId.Stone, "5"],
        [BlockId.Stone, Number.NaN],
        [BlockId.Stone, Infinity],
        [BlockId.Stone],
        "pierre",
        { id: BlockId.Stone, count: 5 },
        42,
        [BlockId.Dirt, 2, "en trop"], // éléments en trop : les deux premiers suffisent
      ],
    };
    const inv = Inventory.fromJSON(data);
    expect(inv.count(BlockId.Stone)).toBe(0);
    expect(inv.toJSON()).toEqual({ slots: [null, null, null, null, null, null, null, null, [BlockId.Dirt, 2]] });
  });

  it("tolère un tableau à trous ou plus court que l'inventaire", () => {
    const slots: unknown[] = [];
    slots[2] = [BlockId.Log, 3];
    slots.length = 4;
    const inv = Inventory.fromJSON({ slots });
    expect(inv.toJSON()).toEqual({ slots: [null, null, [BlockId.Log, 3], null, null, null, null, null, null] });
  });

  it("borne le nombre à 99", () => {
    const inv = Inventory.fromJSON({ slots: [[BlockId.Stone, 500], [BlockId.Dirt, 1e12]] });
    expect(inv.count(BlockId.Stone)).toBe(MAX_STACK);
    expect(inv.count(BlockId.Dirt)).toBe(MAX_STACK);
  });

  it("fusionne un type en double dans sa première case (total borné à 99)", () => {
    const inv = Inventory.fromJSON({ slots: [[BlockId.Grass, 1], [BlockId.Stone, 10], null, [BlockId.Stone, 5], [BlockId.Stone, 90]] });
    expect(inv.toJSON()).toEqual({ slots: [[BlockId.Grass, 1], [BlockId.Stone, 99], null, null, null, null, null, null, null] });
    expect(inv.slots().filter((s) => s?.id === BlockId.Stone)).toHaveLength(1);
  });

  it("tronque avant de fusionner : un doublon situé au-delà de la taille est ignoré", () => {
    const inv = Inventory.fromJSON({ slots: [[BlockId.Stone, 2], [BlockId.Dirt, 1], [BlockId.Stone, 50]] }, 2);
    expect(inv.toJSON()).toEqual({ slots: [[BlockId.Stone, 2], [BlockId.Dirt, 1]] });
  });

  it("relit aussi un Inventory passé directement (sans JSON.stringify)", () => {
    const inv = new Inventory();
    inv.add(BlockId.Stone, 3);
    inv.add(BlockId.Log, 8);
    const copy = Inventory.fromJSON(inv);
    expect(copy).not.toBe(inv);
    expect(copy.toJSON()).toEqual(inv.toJSON());
  });

  it("une entrée invalide ne réserve pas le type : le doublon valide suivant est gardé à sa place", () => {
    const inv = Inventory.fromJSON({ slots: [[BlockId.Stone, 0], [BlockId.Stone, 3]] });
    expect(inv.toJSON().slots.slice(0, 2)).toEqual([null, [BlockId.Stone, 3]]);
  });

  it("ne lève jamais d'exception, même sur un objet piégé", () => {
    const trapped = Object.defineProperty({}, "slots", {
      get() {
        throw new Error("piège");
      },
    });
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    for (const data of [trapped, revoked.proxy, { slots: revoked.proxy }]) {
      expect(() => Inventory.fromJSON(data)).not.toThrow();
      expect(Inventory.fromJSON(data).usedSlots()).toBe(0);
    }
  });

  it("une entrée piégée est ignorée comme les autres : les entrées valides restent", () => {
    const throwing = new Proxy([], {
      get() {
        throw new Error("piège");
      },
    });
    const getter = Object.defineProperty([BlockId.Dirt, 1], 1, {
      get() {
        throw new Error("piège");
      },
    });
    const data = { slots: [[BlockId.Stone, 2], throwing, getter, revokedEntry(), [BlockId.Log, 5]] };
    expect(() => Inventory.fromJSON(data)).not.toThrow();
    expect(Inventory.fromJSON(data).toJSON()).toEqual({
      slots: [[BlockId.Stone, 2], null, null, null, [BlockId.Log, 5], null, null, null, null],
    });
  });
});

describe("identifiants rangeables", () => {
  it("accepte les blocs du registre sauf l'air, refuse le reste", () => {
    for (const def of BLOCKS) expect(isInventoryBlockId(def.id)).toBe(def.id !== BlockId.Air);
    for (const bad of [BLOCKS.length, 255, -1, 1.5, Number.NaN, "3", null, undefined, {}]) expect(isInventoryBlockId(bad)).toBe(false);
  });
});

/** Tableau dont le Proxy a été révoqué : toute lecture, même Array.isArray, lève. */
function revokedEntry(): unknown {
  const r = Proxy.revocable([BlockId.Sand, 1], {});
  r.revoke();
  return r.proxy;
}

describe("rechargement d'une sauvegarde (J4)", () => {
  it("load remplace le contenu, garde les positions et augmente la version", () => {
    const inv = new Inventory();
    inv.add(BlockId.Dirt, 4);
    const v = inv.version;
    inv.load({ slots: [null, [BlockId.Stone, 7], [999, 1]] });
    expect(inv.slots()[0]).toBeNull();
    expect(inv.slot(1)).toEqual({ id: BlockId.Stone, count: 7 });
    expect(inv.count(BlockId.Dirt)).toBe(0);
    expect(inv.version).toBe(v + 1);
    inv.load({ slots: [null, [BlockId.Stone, 7]] });
    expect(inv.version).toBe(v + 1);
    inv.load("illisible");
    expect(inv.totalBlocks()).toBe(0);
  });
});
