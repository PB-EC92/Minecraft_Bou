import { describe, expect, it } from "vitest";
import { BLOCKS, BlockId } from "../../src/engine/blocks";
import {
  countNoun,
  emptiedText,
  maxStackText,
  numberWords,
  pickupSpeech,
  pickupText,
  quantity,
  spokenQuantity,
  withDe,
} from "../../src/edu/counting";
import * as texts from "../../src/edu/texts";
import { NBSP, READING_LEVELS, parseReadingLevel, pick, type ChildText } from "../../src/edu/texts";

/** Remplace l'espace insécable par une espace ordinaire, pour lire les attendus simplement. */
const plain = (s: string) => s.replaceAll(NBSP, " ");
const plainText = (t: ChildText): ChildText => ({ debutant: plain(t.debutant), autonome: plain(t.autonome) });

/** Nombre de mots : morceaux séparés par des espaces qui contiennent une lettre ou un chiffre. */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function isChildText(v: unknown): v is ChildText {
  return typeof v === "object" && v !== null && "debutant" in v && "autonome" in v;
}

/** Toutes les constantes ChildText exportées par texts.ts. */
const CONSTANTS = Object.entries(texts).filter((e): e is [string, ChildText] => isChildText(e[1]));

/** Vérifie les règles communes d'un texte adressé à l'enfant (affiché). */
function expectChildText(t: ChildText, maxBeginnerWords = 5) {
  expect(t.debutant.trim().length).toBeGreaterThan(0);
  expect(t.autonome.trim().length).toBeGreaterThan(0);
  expect(words(t.debutant)).toBeLessThanOrEqual(maxBeginnerWords);
  expect(t.debutant.length).toBeLessThan(t.autonome.length);
  for (const s of [t.debutant, t.autonome]) {
    // Majuscule initiale (ou chiffre), ponctuation finale, pas d'espace ordinaire devant « ! ? : ; ».
    expect(s).toMatch(/^[\p{Lu}\p{N}]/u);
    expect(s).toMatch(/[.!?]$/);
    expect(s).not.toMatch(/ [!?:;]/);
    expect(s).not.toMatch(/\S[!?:;]/);
    expect(s).not.toMatch(/ {2}/);
  }
}

describe("niveaux de lecture", () => {
  it("proposent débutant puis autonome, avec l'âge", () => {
    expect(READING_LEVELS).toEqual([
      { id: "debutant", name: "débutant (6 ans)" },
      { id: "autonome", name: "autonome (8 ans)" },
    ]);
  });

  it("pick choisit la variante du niveau", () => {
    const t: ChildText = { debutant: "court", autonome: "plus long" };
    expect(pick(t, "debutant")).toBe("court");
    expect(pick(t, "autonome")).toBe("plus long");
  });

  it("parseReadingLevel reconnaît les deux niveaux", () => {
    expect(parseReadingLevel("debutant")).toBe("debutant");
    expect(parseReadingLevel("autonome")).toBe("autonome");
  });

  it("parseReadingLevel tolère accents, casse et espaces", () => {
    expect(parseReadingLevel("débutant")).toBe("debutant");
    expect(parseReadingLevel(" Autonome ")).toBe("autonome");
    expect(parseReadingLevel("DÉBUTANT")).toBe("debutant");
  });

  it("parseReadingLevel refuse le reste", () => {
    for (const v of ["", "expert", "debutante", "auto", null, undefined, 0, 1, true, {}, [], ["debutant"]]) {
      expect(parseReadingLevel(v)).toBeNull();
    }
  });
});

describe("messages fixes (texts.ts)", () => {
  it("sont tous présents", () => {
    const names = CONSTANTS.map(([name]) => name).sort();
    expect(names).toEqual(
      [
        "BOTTOM_LAYER",
        "EMPTY_HAND",
        "FLOWER_IN_WATER",
        "FLOWER_NEEDS_GROUND",
        "FULL_BAG",
        "HOLD_TO_BREAK",
        "IMAGE_BACK",
        "IMAGE_LOST",
        "MOUSE_FALLBACK",
        "MOUSE_RESUME",
        "NO_SPACE",
        "WELCOME",
        "WORLD_EDGE",
      ].sort(),
    );
  });

  for (const [name, t] of CONSTANTS) {
    it(`${name} : deux variantes non vides, débutant ≤ 5 mots et plus court`, () => {
      expectChildText(t);
    });
  }

  it("gardent le sens attendu", () => {
    expect(plain(texts.NO_SPACE.debutant)).toBe("Pas de place !");
    expect(plain(texts.WORLD_EDGE.debutant)).toBe("Trop loin !");
    expect(texts.BOTTOM_LAYER.debutant).toBe("Ça ne se casse pas.");
    expect(texts.EMPTY_HAND.debutant).toBe("Ta case est vide.");
    expect(plain(texts.FULL_BAG.debutant)).toBe("Ton sac est plein !");
    expect(plain(texts.WELCOME.debutant)).toBe("Casse des blocs !");
    expect(texts.WELCOME.autonome).toContain("ramasser");
    expect(texts.FLOWER_NEEDS_GROUND.autonome).toContain("fleur");
    expect(texts.FLOWER_IN_WATER.debutant).toContain("eau");
    expect(texts.FLOWER_IN_WATER.autonome).toContain("eau");
    // Le repli ne promet plus qu'un clic bref casse (J2 : appui maintenu).
    expect(texts.MOUSE_FALLBACK.autonome).toContain("Garde le clic gauche");
    expect(texts.MOUSE_FALLBACK.autonome).not.toMatch(/clic bref/);
  });

  it("formulations neutres : rien qui suppose le genre de l'enfant", () => {
    for (const [name, t] of CONSTANTS) {
      for (const v of [t.debutant, t.autonome]) expect(v, name).not.toMatch(/appuyé|prêt|content/i); // \b ne connaît pas les lettres accentuées
    }
  });

  it("aides d'écran (HINTS) : deux variantes, la débutante plus courte, sans « clic bref » pour casser", () => {
    for (const [name, h] of Object.entries(texts.HINTS)) {
      expect(h.debutant.length, name).toBeGreaterThan(0);
      expect(h.debutant.length, name).toBeLessThan(h.autonome.length);
      expect(h.debutant, name).not.toMatch(/clic bref gauche/);
      expect(h.autonome, name).not.toMatch(/clic bref gauche/);
    }
    expect(texts.HINTS.touch.autonome).toContain("croix");
  });

  it("contiennent les mots cherchés par les tests de fumée (tests/e2e/smoke.spec.ts), dans les deux variantes", () => {
    const expected: [ChildText, string][] = [
      [texts.HOLD_TO_BREAK, "Appuie longtemps"],
      [texts.EMPTY_HAND, "case est vide"],
      [texts.FULL_BAG, "sac est plein"],
    ];
    // Insensible à la casse : la variante autonome peut placer le fragment en milieu de phrase.
    for (const [t, fragment] of expected) {
      expect(t.debutant.toLowerCase()).toContain(fragment.toLowerCase());
      expect(t.autonome.toLowerCase()).toContain(fragment.toLowerCase());
    }
  });
});

describe("noms comptables", () => {
  it("suivent la table de la spécification", () => {
    expect(countNoun(BlockId.Grass)).toEqual({ one: "bloc d'herbe", many: "blocs d'herbe", feminine: false });
    expect(countNoun(BlockId.Dirt)).toEqual({ one: "bloc de terre", many: "blocs de terre", feminine: false });
    expect(countNoun(BlockId.Stone)).toEqual({ one: "pierre", many: "pierres", feminine: true });
    expect(countNoun(BlockId.Planks)).toEqual({ one: "planche", many: "planches", feminine: true });
    expect(countNoun(BlockId.Sand)).toEqual({ one: "bloc de sable", many: "blocs de sable", feminine: false });
    expect(countNoun(BlockId.Log)).toEqual({ one: "tronc", many: "troncs", feminine: false });
    expect(countNoun(BlockId.Water)).toEqual({ one: "bloc d'eau", many: "blocs d'eau", feminine: false });
    expect(countNoun(BlockId.Leaves)).toEqual({ one: "bloc de feuilles", many: "blocs de feuilles", feminine: false });
    expect(countNoun(BlockId.FlowerRed)).toEqual({ one: "fleur rouge", many: "fleurs rouges", feminine: true });
    expect(countNoun(BlockId.FlowerYellow)).toEqual({ one: "fleur jaune", many: "fleurs jaunes", feminine: true });
    expect(countNoun(BlockId.Snow)).toEqual({ one: "bloc de neige", many: "blocs de neige", feminine: false });
    expect(countNoun(BlockId.Cactus)).toEqual({ one: "cactus", many: "cactus", feminine: false });
  });

  it("donnent « bloc » pour l'air et les identifiants inconnus", () => {
    const generic = { one: "bloc", many: "blocs", feminine: false };
    expect(countNoun(BlockId.Air)).toEqual(generic);
    expect(countNoun(200 as BlockId)).toEqual(generic);
    expect(countNoun(-1 as BlockId)).toEqual(generic);
    expect(countNoun(2.5 as BlockId)).toEqual(generic);
  });

  it("existent pour chaque bloc du registre (penser à en ajouter un avec chaque nouveau bloc)", () => {
    for (const d of BLOCKS) {
      if (d.id === BlockId.Air) continue;
      expect(countNoun(d.id).one, `bloc ${d.name}`).not.toBe("bloc");
    }
  });

  it("renvoient une copie", () => {
    const n = countNoun(BlockId.Stone);
    n.one = "caillou";
    n.feminine = false;
    expect(countNoun(BlockId.Stone)).toEqual({ one: "pierre", many: "pierres", feminine: true });
  });
});

describe("nombres en lettres", () => {
  const cases: [number, string][] = [
    [0, "zéro"],
    [1, "un"],
    [7, "sept"],
    [10, "dix"],
    [11, "onze"],
    [16, "seize"],
    [17, "dix-sept"],
    [19, "dix-neuf"],
    [20, "vingt"],
    [21, "vingt et un"],
    [22, "vingt-deux"],
    [30, "trente"],
    [31, "trente et un"],
    [45, "quarante-cinq"],
    [51, "cinquante et un"],
    [61, "soixante et un"],
    [69, "soixante-neuf"],
    [70, "soixante-dix"],
    [71, "soixante et onze"],
    [72, "soixante-douze"],
    [77, "soixante-dix-sept"],
    [79, "soixante-dix-neuf"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [88, "quatre-vingt-huit"],
    [90, "quatre-vingt-dix"],
    [91, "quatre-vingt-onze"],
    [97, "quatre-vingt-dix-sept"],
    [99, "quatre-vingt-dix-neuf"],
    [100, "cent"],
  ];
  for (const [n, w] of cases) {
    it(`${n} → « ${w} »`, () => {
      expect(numberWords(n)).toBe(w);
    });
  }

  it("accorde « un » au féminin", () => {
    expect(numberWords(1, true)).toBe("une");
    expect(numberWords(21, true)).toBe("vingt et une");
    expect(numberWords(31, true)).toBe("trente et une");
    expect(numberWords(61, true)).toBe("soixante et une");
    expect(numberWords(81, true)).toBe("quatre-vingt-une");
  });

  it("ne change rien d'autre au féminin", () => {
    for (const n of [0, 2, 11, 20, 22, 70, 71, 80, 90, 91, 99, 100]) {
      expect(numberWords(n, true)).toBe(numberWords(n));
    }
    expect(numberWords(1, false)).toBe("un");
  });

  it("écrit en chiffres au-delà de 100, les non entiers et les négatifs", () => {
    expect(numberWords(101)).toBe("101");
    expect(numberWords(2.5)).toBe("2.5");
    expect(numberWords(-3)).toBe("-3");
    expect(numberWords(Number.NaN)).toBe("NaN");
    expect(numberWords(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });

  it("n'écrit que des mots connus, sans espace double ni tiret double", () => {
    const vocabulary = new Set([
      "zéro", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze",
      "douze", "treize", "quatorze", "quinze", "seize", "vingt", "vingts", "trente", "quarante", "cinquante",
      "soixante", "cent", "et",
    ]);
    for (const feminine of [false, true]) {
      for (let n = 0; n <= 100; n++) {
        const w = numberWords(n, feminine);
        expect(w, String(n)).toMatch(/^[a-zé]+([ -][a-zé]+)*$/);
        for (const part of w.split(/[ -]/)) expect(vocabulary.has(part), `${n} : « ${part} »`).toBe(true);
        // « et » seulement dans 21, 31, 41, 51, 61 et 71 ; « vingts » seulement dans 80.
        expect(w.includes(" et "), String(n)).toBe([21, 31, 41, 51, 61, 71].includes(n));
        expect(w.endsWith("vingts"), String(n)).toBe(n === 80);
      }
    }
  });
});

describe("élision de « de »", () => {
  it("élide devant une voyelle ou un h", () => {
    expect(withDe("herbe")).toBe("d'herbe");
    expect(withDe("eau")).toBe("d'eau");
    expect(withDe("arbres")).toBe("d'arbres");
    expect(withDe("étoiles")).toBe("d'étoiles");
    expect(withDe("Œufs")).toBe("d'Œufs");
  });

  it("garde « de » devant une consonne", () => {
    expect(withDe("pierres")).toBe("de pierres");
    expect(withDe("blocs d'herbe")).toBe("de blocs d'herbe");
    expect(withDe("cactus")).toBe("de cactus");
  });
});

describe("quantités", () => {
  it("écrit 1 avec l'article accordé", () => {
    expect(quantity(BlockId.Log, 1)).toBe("un tronc");
    expect(quantity(BlockId.Stone, 1)).toBe("une pierre");
    expect(quantity(BlockId.Grass, 1)).toBe("un bloc d'herbe");
    expect(quantity(BlockId.FlowerRed, 1)).toBe("une fleur rouge");
  });

  it("écrit en chiffres à partir de 2, au pluriel", () => {
    expect(quantity(BlockId.Stone, 2)).toBe("2 pierres");
    expect(quantity(BlockId.Stone, 21)).toBe("21 pierres");
    expect(quantity(BlockId.FlowerRed, 3)).toBe("3 fleurs rouges");
    expect(quantity(BlockId.FlowerYellow, 99)).toBe("99 fleurs jaunes");
    expect(quantity(BlockId.Cactus, 5)).toBe("5 cactus");
    expect(quantity(BlockId.Leaves, 4)).toBe("4 blocs de feuilles");
  });

  it("garde le singulier pour zéro", () => {
    expect(quantity(BlockId.Stone, 0)).toBe("0 pierre");
  });

  it("dit toujours en lettres, accordé", () => {
    expect(spokenQuantity(BlockId.Log, 1)).toBe("un tronc");
    expect(spokenQuantity(BlockId.Stone, 1)).toBe("une pierre");
    expect(spokenQuantity(BlockId.Stone, 2)).toBe("deux pierres");
    expect(spokenQuantity(BlockId.Stone, 3)).toBe("trois pierres");
    expect(spokenQuantity(BlockId.Stone, 21)).toBe("vingt et une pierres");
    expect(spokenQuantity(BlockId.Log, 21)).toBe("vingt et un troncs");
    expect(spokenQuantity(BlockId.Stone, 81)).toBe("quatre-vingt-une pierres");
    expect(spokenQuantity(BlockId.Stone, 80)).toBe("quatre-vingts pierres");
    expect(spokenQuantity(BlockId.FlowerRed, 21)).toBe("vingt et une fleurs rouges");
    expect(spokenQuantity(BlockId.Cactus, 1)).toBe("un cactus");
    expect(spokenQuantity(BlockId.Cactus, 2)).toBe("deux cactus");
    expect(spokenQuantity(BlockId.Grass, 71)).toBe("soixante et onze blocs d'herbe");
    expect(spokenQuantity(BlockId.Stone, 0)).toBe("zéro pierre");
    expect(spokenQuantity(BlockId.Air, 3)).toBe("trois blocs");
  });

  it("dit en chiffres au-delà de 100", () => {
    expect(spokenQuantity(BlockId.Stone, 150)).toBe("150 pierres");
  });
});

describe("texte de ramassage", () => {
  it("premier bloc d'un type (total 1)", () => {
    expect(plainText(pickupText(BlockId.Stone, 1))).toEqual({
      debutant: "Une pierre !",
      autonome: "Tu as ramassé ta première pierre !",
    });
    expect(plainText(pickupText(BlockId.Log, 1))).toEqual({
      debutant: "Un tronc !",
      autonome: "Tu as ramassé ton premier tronc !",
    });
    expect(plainText(pickupText(BlockId.Grass, 1))).toEqual({
      debutant: "Un bloc d'herbe !",
      autonome: "Tu as ramassé ton premier bloc d'herbe !",
    });
    expect(plainText(pickupText(BlockId.FlowerYellow, 1)).autonome).toBe("Tu as ramassé ta première fleur jaune !");
  });

  it("« premier » n'est dit qu'au tout premier ramassage d'un type (first = faux ensuite)", () => {
    expect(plainText(pickupText(BlockId.Log, 1, false))).toEqual({
      debutant: "Un tronc !",
      autonome: "Tu as ramassé un tronc. Tu en as un.",
    });
    expect(plainText(pickupText(BlockId.Stone, 1, false)).autonome).toBe("Tu as ramassé une pierre. Tu en as une.");
    expect(plainText(pickupSpeech(BlockId.Stone, 1, false)).autonome).toBe("Tu as ramassé une pierre. Tu en as une.");
    // first n'a d'effet que pour un total de 1
    expect(pickupText(BlockId.Stone, 3, true)).toEqual(pickupText(BlockId.Stone, 3));
    expect(pickupText(BlockId.Stone, 1)).toEqual(pickupText(BlockId.Stone, 1, true));
  });

  it("total 2", () => {
    expect(plainText(pickupText(BlockId.Stone, 2))).toEqual({
      debutant: "2 pierres !",
      autonome: "Tu as ramassé une pierre. Tu en as 2.",
    });
    expect(plainText(pickupText(BlockId.Cactus, 2))).toEqual({
      debutant: "2 cactus !",
      autonome: "Tu as ramassé un cactus. Tu en as 2.",
    });
  });

  it("total 21", () => {
    expect(plainText(pickupText(BlockId.Stone, 21))).toEqual({
      debutant: "21 pierres !",
      autonome: "Tu as ramassé une pierre. Tu en as 21.",
    });
    expect(plainText(pickupText(BlockId.FlowerRed, 21)).debutant).toBe("21 fleurs rouges !");
  });

  it("un total absurde ne lève pas d'exception : partie entière, au moins 1", () => {
    expect(pickupText(BlockId.Stone, 0)).toEqual(pickupText(BlockId.Stone, 1));
    expect(pickupText(BlockId.Stone, -4)).toEqual(pickupText(BlockId.Stone, 1));
    expect(pickupText(BlockId.Stone, Number.NaN)).toEqual(pickupText(BlockId.Stone, 1));
    expect(pickupText(BlockId.Stone, Number.POSITIVE_INFINITY)).toEqual(pickupText(BlockId.Stone, 1));
    expect(pickupText(BlockId.Stone, 3.7)).toEqual(pickupText(BlockId.Stone, 3));
    expect(pickupSpeech(BlockId.Stone, 0)).toEqual(pickupSpeech(BlockId.Stone, 1));
    expect(pickupSpeech(BlockId.Stone, Number.NaN)).toEqual(pickupSpeech(BlockId.Stone, 1));
    expect(pickupSpeech(BlockId.Stone, 3.7)).toEqual(pickupSpeech(BlockId.Stone, 3));
  });

  it("respecte les règles des textes pour chaque bloc et chaque total", () => {
    for (const d of BLOCKS) {
      for (const total of [1, 2, 21, 99]) expectChildText(pickupText(d.id, total));
    }
  });
});

describe("texte de ramassage dit (voix)", () => {
  it("total 1 : identique à l'écrit", () => {
    expect(pickupSpeech(BlockId.Stone, 1)).toEqual(pickupText(BlockId.Stone, 1));
    expect(plainText(pickupSpeech(BlockId.Log, 1))).toEqual({
      debutant: "Un tronc !",
      autonome: "Tu as ramassé ton premier tronc !",
    });
  });

  it("total 2", () => {
    expect(plainText(pickupSpeech(BlockId.Stone, 2))).toEqual({
      debutant: "Deux pierres !",
      autonome: "Tu as ramassé une pierre. Tu en as deux.",
    });
  });

  it("total 3", () => {
    expect(plain(pickupSpeech(BlockId.Stone, 3).debutant)).toBe("Trois pierres !");
  });

  it("total 21, accordé en genre", () => {
    expect(plainText(pickupSpeech(BlockId.Stone, 21))).toEqual({
      debutant: "Vingt et une pierres !",
      autonome: "Tu as ramassé une pierre. Tu en as vingt et une.",
    });
    expect(plainText(pickupSpeech(BlockId.Log, 21))).toEqual({
      debutant: "Vingt et un troncs !",
      autonome: "Tu as ramassé un tronc. Tu en as vingt et un.",
    });
    expect(plain(pickupSpeech(BlockId.FlowerRed, 81).autonome)).toBe(
      "Tu as ramassé une fleur rouge. Tu en as quatre-vingt-une.",
    );
  });

  it("respecte les règles des textes pour chaque bloc et chaque total", () => {
    // Texte entendu, pas lu : « vingt et un » compte pour trois mots, d'où une limite plus large.
    for (const d of BLOCKS) {
      for (const total of [1, 2, 21, 81, 99]) expectChildText(pickupSpeech(d.id, total), 8);
    }
  });

  it("ne contient aucun chiffre jusqu'à 100", () => {
    for (const d of BLOCKS) {
      for (let total = 1; total <= 100; total++) {
        const t = pickupSpeech(d.id, total);
        expect(t.debutant).not.toMatch(/\d/);
        expect(t.autonome).not.toMatch(/\d/);
      }
    }
  });
});

describe("case vidée", () => {
  it("pierres", () => {
    expect(plainText(emptiedText(BlockId.Stone))).toEqual({
      debutant: "Plus de pierres !",
      autonome: "Tu n'as plus de pierres. Va en casser d'autres !",
    });
  });

  it("noms composés et invariables", () => {
    expect(plain(emptiedText(BlockId.Grass).debutant)).toBe("Plus de blocs d'herbe !");
    expect(plain(emptiedText(BlockId.FlowerRed).debutant)).toBe("Plus de fleurs rouges !");
    expect(plain(emptiedText(BlockId.Cactus).debutant)).toBe("Plus de cactus !");
  });

  it("dit « cueillir » pour les fleurs, « casser » pour le reste", () => {
    expect(plain(emptiedText(BlockId.FlowerRed).autonome)).toBe(
      "Tu n'as plus de fleurs rouges. Va en cueillir d'autres !",
    );
    expect(plain(emptiedText(BlockId.FlowerYellow).autonome)).toBe(
      "Tu n'as plus de fleurs jaunes. Va en cueillir d'autres !",
    );
    expect(plain(emptiedText(BlockId.Log).autonome)).toBe("Tu n'as plus de troncs. Va en casser d'autres !");
    expect(plain(emptiedText(200 as BlockId).autonome)).toBe("Tu n'as plus de blocs. Va en casser d'autres !");
  });

  it("respecte les règles des textes pour chaque bloc", () => {
    for (const d of BLOCKS) expectChildText(emptiedText(d.id));
  });
});

describe("case pleine", () => {
  it("99 pierres", () => {
    expect(plainText(maxStackText(BlockId.Stone, 99))).toEqual({
      debutant: "99, c'est le maximum !",
      autonome: "Tu as déjà 99 pierres : c'est le maximum.",
    });
  });

  it("autre bloc, autre maximum", () => {
    expect(plain(maxStackText(BlockId.Log, 99).autonome)).toBe("Tu as déjà 99 troncs : c'est le maximum.");
    expect(plain(maxStackText(BlockId.Cactus, 64).debutant)).toBe("64, c'est le maximum !");
    expect(plain(maxStackText(BlockId.Stone, 1).autonome)).toBe("Tu as déjà une pierre : c'est le maximum.");
  });

  it("respecte les règles des textes pour chaque bloc", () => {
    for (const d of BLOCKS) expectChildText(maxStackText(d.id, 99));
  });
});

describe("typographie", () => {
  it("met une espace insécable devant « ! » et « : »", () => {
    expect(pickupText(BlockId.Stone, 3).debutant).toBe(`3 pierres${NBSP}!`);
    expect(maxStackText(BlockId.Stone, 99).autonome).toContain(`pierres${NBSP}:`);
    expect(texts.NO_SPACE.debutant).toBe(`Pas de place${NBSP}!`);
  });
});
