import { describe, expect, it } from "vitest";
import { NBSP, type ChildText } from "../../src/edu/texts";
import {
  AUTONOME_WORDS,
  DEBUTANT_WORDS,
  fillWord,
  findEntry,
  LETTER_NAMES,
  letterName,
  nameWord,
  pickWord,
  sayWord,
  spell,
  wordList,
  wordVars,
  type WordEntry,
  type WordVars,
} from "../../src/edu/wordLists";

/** Nombre de mots : morceaux séparés par des espaces qui contiennent une lettre ou un chiffre (comme counting.test). */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Minuscules sans accent, pour chercher un mot dans une phrase. */
const flat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Indice attendu de pickWord, calculé exactement en entiers longs (BigInt). */
function expectedIndex(seed: number, tier: number, n: number): number {
  const v = BigInt.asUintN(32, BigInt(seed) * 2654435761n + BigInt(tier) * 40503n);
  return Number(v % BigInt(n));
}

/** Formulations qui accorderaient un mot au genre de l'enfant. */
const GENDERED = /(?<!\p{L})(prête?s?|contente?s?|fatiguée?s?|perdue?s?|coincée?s?|seule?s?|assise?s?|appuyée?s?)(?!\p{L})/iu;

const ALL = [...DEBUTANT_WORDS, ...AUTONOME_WORDS];
const TIERS = [1, 2, 3] as const;

describe("listes de mots (mission 2)", () => {
  it("débutant : 3 lettres au palier 1, 4 lettres aux paliers 2 et 3 ; autonome : 5, 6 puis 7 lettres", () => {
    for (const e of DEBUTANT_WORDS) expect(e.text.length).toBe(e.tier === 1 ? 3 : 4);
    for (const e of AUTONOME_WORDS) expect(e.text.length).toBe(e.tier + 4);
    for (const list of [DEBUTANT_WORDS, AUTONOME_WORDS]) {
      for (const tier of TIERS) expect(list.filter((e) => e.tier === tier).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("capitales A–Z sans accent, aucun doublon (ni dans une liste, ni d'une liste à l'autre)", () => {
    for (const e of ALL) expect(e.text).toMatch(/^[A-Z]{3,7}$/);
    expect(new Set(ALL.map((e) => e.text)).size).toBe(ALL.length);
  });

  it("syllabes recollées = le mot ; forme dite en minuscules (Pixel avec sa majuscule)", () => {
    for (const e of ALL) {
      expect(e.syllables.join("")).toBe(e.text);
      for (const s of e.syllables) expect(s.length).toBeGreaterThan(0);
      expect(e.say.toUpperCase()).toBe(e.text);
      if (e.text === "PIXEL") expect(e.say).toBe("Pixel");
      else expect(e.say).toBe(e.text.toLowerCase());
    }
    expect(findEntry("debutant", "AMI")?.syllables).toEqual(["A", "MI"]);
    expect(findEntry("autonome", "NUAGE")?.syllables).toEqual(["NU", "A", "GE"]);
    // Palier 3 du débutant : une seule syllabe (un son à deux lettres ou une lettre muette).
    for (const e of DEBUTANT_WORDS.filter((w) => w.tier === 3)) expect(e.syllables).toEqual([e.text]);
  });

  it("chaque mot a sa phrase ; celle de l'autonome (dictée) contient le mot", () => {
    for (const e of ALL) {
      expect(e.sentence).toMatch(/^\p{Lu}.*\.$/u);
      expect(e.sentence).not.toMatch(/ {2}/);
    }
    for (const e of AUTONOME_WORDS) expect(flat(e.sentence)).toContain(flat(e.say));
  });

  it("aucune phrase ni astuce ne dit que la lampe éloigne les Grignotes (décision 6) ; formulations neutres", () => {
    const texts = ALL.flatMap((e) => [
      e.sentence,
      ...(e.tip ? [e.tip.text.debutant, e.tip.text.autonome, ...(e.tip.spoken ? [e.tip.spoken.debutant, e.tip.spoken.autonome] : [])] : []),
    ]);
    for (const s of texts) {
      if (/grignote/i.test(s)) expect(s).not.toMatch(/lampe|lumi[eè]re/i);
      expect(s).not.toMatch(GENDERED);
    }
  });

  it("astuces : deux variantes, débutant d'au plus 5 mots et plus court ; forme dite avec les noms des lettres", () => {
    const tipped = ALL.filter((e) => e.tip);
    expect(tipped.length).toBeGreaterThanOrEqual(12);
    for (const e of tipped) {
      const t = e.tip!;
      for (const v of [t.text, ...(t.spoken ? [t.spoken] : [])]) {
        expect(v.debutant.trim().length).toBeGreaterThan(0);
        expect(v.autonome.trim().length).toBeGreaterThan(0);
        expect(words(v.debutant)).toBeLessThanOrEqual(5);
        expect(v.debutant.length).toBeLessThan(v.autonome.length);
        for (const s of [v.debutant, v.autonome]) {
          expect(s).toMatch(/^\p{Lu}/u);
          expect(s).toMatch(/[.!?]$/);
          expect(s).not.toMatch(/ [!?:;]/);
          expect(s).not.toMatch(/\S[!?:;]/);
          expect(s).not.toMatch(/«(?! )|(?<! )»/);
        }
      }
    }
    const lampe = findEntry("autonome", "LAMPE")!;
    expect(lampe.tip!.spoken!.autonome).toBe("Devant la lettre pé, le son an s'écrit avec un emme.");
    expect(lampe.tip!.text.autonome).toBe(`Devant la lettre P, le son «${NBSP}an${NBSP}» s'écrit avec un M.`);
    // Renard : la forme dite est la forme écrite.
    expect(findEntry("autonome", "RENARD")!.tip!.spoken).toBeUndefined();
    expect(findEntry("autonome", "JARDIN")!.tip).toBe(findEntry("autonome", "LAPIN")!.tip);
  });

  it("listes par niveau et recherche d'un mot", () => {
    expect(wordList("debutant")).toBe(DEBUTANT_WORDS);
    expect(wordList("autonome")).toBe(AUTONOME_WORDS);
    expect(findEntry("debutant", "LUNE")?.tier).toBe(2);
    expect(findEntry("autonome", "LUNE")).toBeNull();
    expect(findEntry("debutant", "ami")).toBeNull();
  });
});

describe("noms des lettres (décision 12 : la lettre est dite par son nom)", () => {
  it("26 noms, de A à Z", () => {
    expect(Object.keys(LETTER_NAMES)).toEqual([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]);
    expect(LETTER_NAMES.M).toBe("emme");
    expect(LETTER_NAMES.W).toBe("double vé");
    expect(LETTER_NAMES.Y).toBe("i grec");
    for (const n of Object.values(LETTER_NAMES)) expect(n).toMatch(/^[a-zéè ]+$/);
  });

  it("letterName et spell", () => {
    expect(letterName("M")).toBe("emme");
    expect(letterName("m")).toBe("emme");
    expect(letterName("?")).toBe("?");
    expect(spell("AMI")).toBe("a, emme, i");
    expect(spell("LEA")).toBe("elle, e, a");
    expect(spell("")).toBe("");
  });
});

describe("prénom écrit avec les lettres (décision 14 : sans accent)", () => {
  it("accents retirés, capitales", () => {
    expect(nameWord("Léa")).toBe("LEA");
    expect(nameWord("Chloé")).toBe("CHLOE");
    expect(nameWord("  Zoë ")).toBe("ZOE");
    expect(nameWord("tom")).toBe("TOM");
    expect(nameWord("Maximilien")).toBe("MAXIMILIEN");
  });

  it("prénom qui ne s'écrit pas avec 2 à 10 lettres A–Z : null", () => {
    for (const n of ["Joueur 1", "Anne-Sophie", "X", "", "   ", "Maximiliennes", "Lou Ann"]) expect(nameWord(n)).toBeNull();
    expect(nameWord(null)).toBeNull();
  });
});

describe("tirage d'un mot", () => {
  it("déterministe, dans le palier, selon la formule de la conception", () => {
    for (const level of ["debutant", "autonome"] as const) {
      for (const tier of TIERS) {
        const candidates = wordList(level).filter((e) => e.tier === tier);
        for (const seed of [0, 1, 7, 42, 1234, 999_999, 31_000_000, 2 ** 40 + 3]) {
          const w = pickWord(level, tier, new Set(), seed);
          expect(w).toBe(candidates[expectedIndex(seed, tier, candidates.length)]);
          expect(pickWord(level, tier, new Set(), seed)).toBe(w);
        }
      }
    }
  });

  it("varie avec la graine", () => {
    const got = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) got.add(pickWord("debutant", 2, new Set(), seed).text);
    expect(got.size).toBeGreaterThan(3);
  });

  it("exclusions, puis replis : paliers voisins, toute la liste hors exclusions, toute la liste", () => {
    const tier1 = DEBUTANT_WORDS.filter((e) => e.tier === 1).map((e) => e.text);
    const tier2 = DEBUTANT_WORDS.filter((e) => e.tier === 2).map((e) => e.text);
    const tier3 = DEBUTANT_WORDS.filter((e) => e.tier === 3).map((e) => e.text);
    // Un mot exclu n'est jamais tiré.
    for (let seed = 0; seed < 30; seed++) {
      const ex = new Set(tier1.slice(0, 5));
      expect(pickWord("debutant", 1, ex, seed).text).toBe(tier1[5]);
    }
    // Palier 1 épuisé : palier 2 (voisin).
    const w1 = pickWord("debutant", 1, new Set(tier1), 9);
    expect(tier2).toContain(w1.text);
    // Palier 2 épuisé : paliers 1 et 3 (voisins), dans l'ordre de la liste.
    const neighbours = [...tier1, ...tier3];
    for (let seed = 0; seed < 20; seed++) {
      const w = pickWord("debutant", 2, new Set(tier2), seed);
      expect(w).toBe(DEBUTANT_WORDS.filter((e) => e.tier !== 2)[expectedIndex(seed, 2, neighbours.length)]);
    }
    // Paliers 2 et 3 épuisés depuis le palier 3 : le reste de la liste (palier 1).
    expect(tier1).toContain(pickWord("debutant", 3, new Set([...tier2, ...tier3]), 5).text);
    // Tout est exclu : toute la liste (jamais d'échec).
    const all = new Set(DEBUTANT_WORDS.map((e) => e.text));
    const w = pickWord("debutant", 3, all, 5);
    expect(w).toBe(DEBUTANT_WORDS[expectedIndex(5, 3, DEBUTANT_WORDS.length)]);
    // Graine bizarre : un mot quand même.
    expect(pickWord("autonome", 2, new Set(), Number.NaN).tier).toBe(2);
    expect(pickWord("autonome", 2, new Set(), -17).tier).toBe(2);
  });
});

describe("gabarits", () => {
  const vars: WordVars = {
    MOT: "AMI",
    mot: "ami",
    Mot: "Ami",
    lettres: "a, emme, i",
    phrase: "Pixel est ton ami.",
    n: "3",
    nLettres: "trois",
    L: "M",
    nom: "emme",
    nomChoisi: "pé",
    rang: "deuxième",
    prenom: "Léa",
    liste: "ami, sol",
    nMots: "deux",
    ou: "devant toi",
    astuce: "",
  };
  const KEYS = Object.keys(vars).map((k) => `{${k}}`).join(" ");

  it("fillWord remplace chaque clé ; aucune accolade quand toutes les clés sont fournies", () => {
    const t: ChildText = { debutant: KEYS, autonome: `Écris ${KEYS}.` };
    const f = fillWord(t, vars);
    for (const s of [f.debutant, f.autonome]) expect(s).not.toMatch(/[{}]/);
    expect(fillWord({ debutant: "Écris {MOT}.", autonome: `Écris le mot${NBSP}: {mot}.` }, vars)).toEqual({
      debutant: "Écris AMI.",
      autonome: `Écris le mot${NBSP}: ami.`,
    });
  });

  it("une clé absente reste telle quelle ; une variable vide ne laisse pas d'espace en trop", () => {
    expect(fillWord({ debutant: "Lettre {L}.", autonome: "Lettre {L}, rang {rang}." }, { L: "B" })).toEqual({
      debutant: "Lettre B.",
      autonome: "Lettre B, rang {rang}.",
    });
    expect(fillWord({ debutant: "Indice. {astuce}", autonome: "Mot {mot}. {phrase} {Mot}." }, { astuce: "", mot: "nom", phrase: "", Mot: "Nom" })).toEqual({
      debutant: "Indice.",
      autonome: "Mot nom. Nom.",
    });
    // Une valeur avec « $ » est recopiée telle quelle.
    expect(fillWord({ debutant: "{L}", autonome: "{L}" }, { L: "$&" }).debutant).toBe("$&");
  });

  it("forme dite d'un mot : say de la liste, prénom tel qu'enregistré, sinon minuscules", () => {
    expect(sayWord("PIXEL", null)).toBe("Pixel");
    expect(sayWord("AMI", "Léa")).toBe("ami");
    expect(sayWord("LEA", " Léa ")).toBe("Léa");
    expect(sayWord("ZORRO", null)).toBe("zorro");
  });

  it("variables d'un mot : niveau, prénom, astuce écrite ou dite", () => {
    expect(wordVars("debutant", "AMI", "Léa")).toEqual({
      MOT: "AMI",
      mot: "ami",
      Mot: "Ami",
      lettres: "a, emme, i",
      phrase: "Pixel est ton ami.",
      n: "3",
      nLettres: "trois",
      prenom: "Léa",
      astuce: "",
    });
    const lampe = wordVars("autonome", "LAMPE", null);
    expect(lampe.astuce).toBe(`Devant la lettre P, le son «${NBSP}an${NBSP}» s'écrit avec un M.`);
    expect(wordVars("autonome", "LAMPE", null, true).astuce).toBe("Devant la lettre pé, le son an s'écrit avec un emme.");
    expect(lampe.nLettres).toBe("cinq");
    expect(lampe.prenom).toBe("");
    // Prénom : forme dite telle qu'enregistrée, pas de phrase.
    const lea = wordVars("autonome", "LEA", "Léa");
    expect({ mot: lea.mot, Mot: lea.Mot, phrase: lea.phrase, lettres: lea.lettres, nLettres: lea.nLettres }).toEqual({
      mot: "Léa",
      Mot: "Léa",
      phrase: "",
      lettres: "elle, e, a",
      nLettres: "trois",
    });
    // Un mot de l'autre liste (niveau changé) garde sa phrase.
    expect(wordVars("autonome", "AMI", null).phrase).toBe("Pixel est ton ami.");
    // « une » au féminin (lettres).
    expect(wordVars("debutant", "SOL", null).nLettres).toBe("trois");
  });

  it("chaque entrée est utilisable dans les gabarits sans accolade restante", () => {
    const entries: WordEntry[] = [...DEBUTANT_WORDS, ...AUTONOME_WORDS];
    for (const e of entries) {
      const level = DEBUTANT_WORDS.includes(e) ? "debutant" : "autonome";
      const v = wordVars(level, e.text, null, true);
      const f = fillWord({ debutant: `Écris {mot}${NBSP}: {lettres}.`, autonome: `Écris le mot${NBSP}: {mot}. {phrase} {Mot}. {astuce}` }, v);
      expect(f.debutant + f.autonome).not.toMatch(/[{}]/);
      expect(f.autonome).not.toMatch(/ {2}| $/);
    }
  });
});
