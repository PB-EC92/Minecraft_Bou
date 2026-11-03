import { describe, expect, it } from "vitest";
import { ordinalWord } from "../../src/edu/counting";
import { NBSP, type ChildText } from "../../src/edu/texts";
import { fillWord, letterName, wordVars, type WordVars } from "../../src/edu/wordLists";
import * as wt from "../../src/edu/wordTexts";
import { fillSaid, recapList, recapVars, recapWordLabel, type SaidTemplate } from "../../src/edu/wordTexts";

/** Remplace l'espace insécable par une espace ordinaire, pour lire les attendus simplement. */
const plain = (s: string) => s.replaceAll(NBSP, " ");
const plainText = (t: ChildText): ChildText => ({ debutant: plain(t.debutant), autonome: plain(t.autonome) });

/** Nombre de mots : morceaux séparés par des espaces qui contiennent une lettre ou un chiffre (comme counting.test). */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const isChildText = (v: unknown): v is ChildText => typeof v === "object" && v !== null && "debutant" in v && "autonome" in v;
const isSaid = (v: unknown): v is SaidTemplate => typeof v === "object" && v !== null && "text" in v && isChildText((v as SaidTemplate).text);

/** Tous les gabarits exportés par wordTexts.ts, sous forme { text, spoken? }. */
const TEMPLATES: [string, SaidTemplate][] = Object.entries(wt).flatMap(([name, v]): [string, SaidTemplate][] => {
  if (isSaid(v)) return [[name, v]];
  if (isChildText(v)) return [[name, { text: v }]];
  return [];
});

/** Dits seulement, jamais affichés : pas de règle de longueur (liste variable, ou une seule forme). */
const SPOKEN_ONLY = new Set(["LISTEN_AGAIN", "RECAP_SPOKEN"]);
/** Affichés seulement, jamais lus. */
const NEVER_READ = new Set(["TRAY_TITLE", "TRAY_KEYBOARD", "LETTERS_HINT", "NO_VOICE_COPY"]);
/** Suffixe de l'aide d'écran : pas une phrase (ni majuscule, ni ponctuation finale). */
const NOT_A_SENTENCE = new Set(["LETTERS_HINT"]);

const RECAP_DEB = ["AMI", "LUNE", "TOIT", "LEA"];
const RECAP_AUT = ["LAMPE", "CABANE", "PLANCHE", "LEA"];

/** Variables d'une lettre (lettre attendue M, lettre choisie par erreur P). */
const letterVars = (rang: number): WordVars => ({
  L: "M",
  nom: letterName("M"),
  nomChoisi: letterName("P"),
  rang: ordinalWord(rang),
  ou: wt.PLACE_WHERE.ghost,
});

/** Variables d'un débutant qui écrit AMI, d'un autonome qui écrit LAMPE (prénom Léa) ; formes écrites et dites. */
const DEB: WordVars = { ...wordVars("debutant", "AMI", "Léa"), ...letterVars(2), ...recapVars(RECAP_DEB, "debutant", "Léa") };
const DEB_SPOKEN: WordVars = { ...DEB, ...wordVars("debutant", "AMI", "Léa", true) };
const AUT: WordVars = { ...wordVars("autonome", "LAMPE", "Léa"), ...letterVars(3), ...recapVars(RECAP_AUT, "autonome", "Léa") };
const AUT_SPOKEN: WordVars = { ...AUT, ...wordVars("autonome", "LAMPE", "Léa", true) };

/** Texte affiché à chaque niveau, une fois rempli. */
const shown = (t: SaidTemplate): ChildText => ({ debutant: fillWord(t.text, DEB).debutant, autonome: fillWord(t.text, AUT).autonome });
/** Texte lu à chaque niveau (forme dite, sinon forme écrite), une fois rempli. */
const read = (t: SaidTemplate): ChildText => {
  const s = t.spoken ?? t.text;
  return { debutant: fillWord(s, DEB_SPOKEN).debutant, autonome: fillWord(s, AUT_SPOKEN).autonome };
};

/** Typographie commune : espace insécable devant ! ? : ; et dans les guillemets, pas d'espace double, pas d'accolade. */
function expectTypography(s: string) {
  expect(s).not.toMatch(/ [!?:;]/);
  expect(s).not.toMatch(/\S[!?:;]/);
  expect(s).not.toMatch(/«(?! )|(?<! )»/);
  expect(s).not.toMatch(/ {2}|^\s|\s$/);
  expect(s).not.toMatch(/[{}]/);
}

/** Formulations qui accorderaient un mot au genre de l'enfant (« appuyé » se dit du clic, pas de l'enfant). */
const GENDERED = /(?<!\p{L})(prête?s?|contente?s?|fatiguée?s?|perdue?s?|coincée?s?|seule?s?|assise?s?|appuyée?s?)(?!\p{L})/iu;

describe("textes de la mission 2 (wordTexts.ts)", () => {
  it("sont tous là", () => {
    expect(TEMPLATES.map(([n]) => n).sort()).toEqual(
      [
        "M2_INTRO",
        "MISSION_2_TOMORROW",
        "M2_STEP_LETTER",
        "M2_STEP_LETTER_TOUCH",
        "M2_STEP0_HINT",
        "M2_STEP_WORD",
        "M2_STEP_WORD_COPY",
        "M2_STEP_NAME",
        "M2_STEP_NAME_COPY",
        "TRAY_TITLE",
        "TRAY_KEYBOARD",
        "TRAY_WRONG_PICK",
        "LETTER_IN_HAND_TOUCH",
        "LETTER_IN_HAND_MOUSE",
        "GHOST_LINE",
        "NEXT_LETTER",
        "GIVE_LETTER",
        "WRONG_LETTER",
        "BREAK_TIP_TOUCH",
        "BREAK_TIP_MOUSE",
        "EXTRA_LETTER",
        "SPACE_BETWEEN",
        "LEFT_TO_RIGHT",
        "READ_OTHER_SIDE",
        "HIDDEN_WORD",
        "TOWER",
        "WORD_DONE",
        "WORD_DONE_NAME",
        "DICT_WRONG",
        "DICT_MISSING",
        "DICT_SWAP",
        "DICT_FAR",
        "LISTEN_AGAIN",
        "DICT_HELP_COUNT",
        "DICT_HELP_FIRST",
        "DICT_HELP_MORE",
        "DICT_HELP_ALL",
        "NO_VOICE_COPY",
        "M2_OUTRO",
        "RECAP_SPOKEN",
        "LETTERS_HINT",
      ].sort(),
    );
  });

  for (const [name, t] of TEMPLATES) {
    if (SPOKEN_ONLY.has(name)) continue;
    it(`${name} : affiché (AMI / LAMPE), deux variantes, débutant ≤ 5 mots et plus court, typographie`, () => {
      const s = shown(t);
      expect(s.debutant.trim().length).toBeGreaterThan(0);
      expect(s.autonome.trim().length).toBeGreaterThan(0);
      expect(words(s.debutant)).toBeLessThanOrEqual(5);
      expect(s.debutant.length).toBeLessThan(s.autonome.length);
      for (const v of [s.debutant, s.autonome]) {
        expectTypography(v);
        if (!NOT_A_SENTENCE.has(name)) {
          expect(v).toMatch(/^[\p{Lu}\p{N}]/u);
          expect(v).toMatch(/[.!?]$/);
        }
      }
    });
  }

  for (const [name, t] of TEMPLATES) {
    if (NEVER_READ.has(name)) continue;
    it(`${name} : forme lue sans chiffre ni « ABC », lettres par leur nom, mots en minuscules`, () => {
      const r = read(t);
      for (const v of [r.debutant, r.autonome]) {
        expect(v.trim().length).toBeGreaterThan(0);
        expect(v).not.toMatch(/\d/);
        expect(v).not.toMatch(/ABC/);
        expectTypography(v);
      }
      // Décision 12 : une lettre est dite par son nom ({nom}) ; un mot par sa forme dite ({mot}, {lettres}, {prenom}).
      const raw = t.spoken ?? t.text;
      expect(raw.debutant + raw.autonome).not.toMatch(/\{(MOT|L)\}/);
    });
  }

  it("aucun texte ne parle de la lampe ni des Grignotes (décision 6) ; formulations neutres en genre", () => {
    for (const [, t] of TEMPLATES) {
      for (const v of [t.text, ...(t.spoken ? [t.spoken] : [])]) {
        for (const s of [v.debutant, v.autonome]) {
          expect(s).not.toMatch(/lampe|grignote|lumi[eè]re/i);
          expect(s.replaceAll("clic gauche appuyé", "")).not.toMatch(GENDERED);
        }
      }
    }
  });

  it("consignes : touche zéro et « a, bé, cé » à l'oral, aucun chiffre dans le conseil", () => {
    expect(plainText(wt.M2_STEP_LETTER.text).debutant).toBe("Appuie sur 0, puis pose.");
    expect(wt.M2_STEP_LETTER.spoken?.debutant).toBe("Appuie sur la touche zéro, choisis une lettre, puis pose-la avec le clic droit.");
    expect(wt.M2_STEP_LETTER.spoken?.autonome).toContain("a, bé, cé");
    expect(wt.M2_STEP_LETTER_TOUCH.spoken?.debutant).toBe("Touche la case a, bé, cé, puis pose une lettre.");
    expect(wt.M2_STEP_LETTER_TOUCH.spoken?.autonome).toBe(wt.M2_STEP_LETTER_TOUCH.text.autonome.replace("ABC", "a, bé, cé"));
    expect(plainText(wt.M2_STEP0_HINT.spoken!)).toEqual({
      debutant: plain(wt.M2_STEP0_HINT.text.debutant).replace("ABC", "a, bé, cé"),
      autonome: wt.M2_STEP0_HINT.text.autonome.replace("ABC", "a, bé, cé"),
    });
    expect(wt.M2_STEP0_HINT.text.debutant + wt.M2_STEP0_HINT.text.autonome).not.toMatch(/\d/);
  });

  it("consigne d'un mot : copie épelée pour le débutant, dictée pour l'autonome", () => {
    expect(plainText(fillSaid(wt.M2_STEP_WORD, DEB_SPOKEN).spoken).debutant).toBe("Écris ami : a, emme, i.");
    expect(plain(fillWord(wt.M2_STEP_WORD.spoken!, AUT_SPOKEN).autonome)).toBe("Écris le mot : lampe. La lampe éclaire ton abri. Lampe.");
    expect(fillWord(wt.M2_STEP_WORD.text, AUT).autonome).toBe("Écris le mot que j'ai dit.");
    expect(plain(fillWord(wt.M2_STEP_WORD_COPY.text, AUT).autonome)).toBe("Recopie le mot : LAMPE.");
    // Prénom : forme dite telle qu'enregistrée, épelée ; sans accent à l'écrit.
    const lea = wordVars("debutant", "LEA", "Léa", true);
    expect(plain(fillWord(wt.M2_STEP_NAME.spoken!, lea).debutant)).toBe("Écris ton prénom : Léa. elle, e, a.");
    expect(plain(fillWord(wt.M2_STEP_NAME_COPY.text, wordVars("autonome", "LEA", "Léa")).autonome)).toBe(
      "Pour finir, écris ton prénom avec les lettres. Les lettres n'ont pas d'accent : écris LEA.",
    );
  });

  it("réussite : épelé, le mot, puis sa phrase ; le prénom tel qu'enregistré", () => {
    const done = fillSaid(wt.WORD_DONE, DEB, DEB_SPOKEN);
    expect(plain(done.text.debutant)).toBe("Tu as écrit AMI !");
    expect(plain(done.spoken.debutant)).toBe("a, emme, i : ami ! Bravo ! Pixel est ton ami.");
    expect(plain(fillSaid(wt.WORD_DONE, AUT).spoken.autonome)).toBe("Bravo ! Tu as écrit lampe.");
    const lea = wordVars("debutant", "LEA", "Léa", true);
    expect(plain(fillSaid(wt.WORD_DONE_NAME, lea).spoken.debutant)).toBe("elle, e, a : Léa ! Bravo !");
    expect(wt.WORD_DONE_NAME.text).toBe(wt.WORD_DONE.text);
  });

  it("aide et indices : lettre par son nom à l'oral, astuce écrite ou dite", () => {
    const first = { ...AUT, L: "L", nom: letterName("L") };
    const firstSpoken = { ...AUT_SPOKEN, L: "L", nom: letterName("L") };
    const f = fillSaid(wt.DICT_HELP_FIRST, first, firstSpoken);
    expect(plain(f.text.autonome)).toBe("Indice : le mot commence par la lettre L. Devant la lettre P, le son « an » s'écrit avec un M.");
    expect(plain(f.spoken.autonome)).toBe("Indice : le mot commence par la lettre elle. Devant la lettre pé, le son an s'écrit avec un emme.");
    // Sans astuce : rien après la phrase.
    const sable = { ...wordVars("autonome", "SABLE", null), L: "S", nom: "esse" };
    expect(plain(fillWord(wt.DICT_HELP_FIRST.text, sable).autonome)).toBe("Indice : le mot commence par la lettre S.");
    expect(plain(fillWord(wt.DICT_HELP_COUNT.spoken!, AUT_SPOKEN).autonome)).toBe("Indice : le mot a cinq lettres. Je le redis : lampe.");
    expect(plain(fillWord(wt.DICT_HELP_MORE.spoken!, AUT_SPOKEN).autonome)).toBe("Indice : la troisième lettre est un emme.");
    expect(plain(fillWord(wt.NEXT_LETTER.spoken!, DEB_SPOKEN).debutant)).toBe("Maintenant, la lettre emme !");
    expect(plain(fillWord(wt.TRAY_WRONG_PICK.spoken!, DEB_SPOKEN).debutant)).toBe("Ça, c'est un pé. Cherche la lettre emme.");
    expect(plain(fillWord(wt.GIVE_LETTER.spoken!, { ...DEB_SPOKEN, ou: wt.PLACE_WHERE.ahead }).debutant)).toBe(
      "Voici la lettre emme ! Pose-la devant toi.",
    );
    expect(plain(fillWord(wt.WRONG_LETTER.text, AUT).autonome)).toBe(
      "Presque ! La troisième lettre doit être un M : casse celle-ci et pose un M.",
    );
    expect(plain(fillWord(wt.LISTEN_AGAIN, AUT_SPOKEN).autonome)).toBe("Écoute bien : lampe.");
    expect(wt.PLACE_WHERE).toEqual({ ghost: "dans la case claire", ahead: "devant toi" });
  });

  it("aide de l'écran et libellé de la case", () => {
    expect(plainText(wt.LETTERS_HINT)).toEqual({ debutant: "0 : lettres", autonome: "0 ou case ABC : lettres" });
    expect(wt.LETTERS_LABEL).toBe("ABC");
  });
});

describe("récapitulatif de la mission 2", () => {
  it("liste dite : mots en minuscules, prénom tel qu'enregistré, « et » avant le dernier pour l'autonome", () => {
    expect(recapList(RECAP_DEB, "debutant", "Léa")).toBe("ami, lune, toit, Léa");
    expect(recapList(["LAMPE", "CABANE", "PLANCHE", "TOM"], "autonome", "Tom")).toBe("lampe, cabane, planche et Tom");
    expect(recapList(["PIXEL", "SABLE"], "autonome", null)).toBe("Pixel et sable");
    expect(recapList(["LAMPE"], "autonome", null)).toBe("lampe");
    expect(recapList([], "debutant", null)).toBe("");
  });

  it("phrase dite remplie", () => {
    expect(recapVars(RECAP_AUT, "autonome", "Léa")).toEqual({ liste: "lampe, cabane, planche et Léa", nMots: "quatre" });
    expect(plain(fillWord(wt.RECAP_SPOKEN, DEB).debutant)).toBe("Tu as écrit : ami, lune, toit, Léa.");
    expect(plain(fillWord(wt.RECAP_SPOKEN, AUT).autonome)).toBe("Tu as écrit quatre mots : lampe, cabane, planche et Léa.");
  });

  it("libellés de l'écran (sans variante) : « ami », « lampe (5 lettres) », le prénom avec ses accents", () => {
    expect(recapWordLabel("AMI", "debutant", "Léa")).toBe("ami");
    expect(recapWordLabel("LEA", "debutant", "Léa")).toBe("Léa");
    expect(recapWordLabel("LAMPE", "autonome", null)).toBe("lampe (5 lettres)");
    expect(recapWordLabel("CHLOE", "autonome", "Chloé")).toBe("Chloé (5 lettres)");
  });

  it("fillSaid : forme dite par défaut = forme écrite ; variables dites à part", () => {
    const t: ChildText = { debutant: "Le {MOT}.", autonome: "Le mot {MOT}." };
    expect(fillSaid(t, { MOT: "SOL" })).toEqual({
      text: { debutant: "Le SOL.", autonome: "Le mot SOL." },
      spoken: { debutant: "Le SOL.", autonome: "Le mot SOL." },
    });
    const s: SaidTemplate = { text: { debutant: "{astuce}", autonome: "{astuce}" }, spoken: { debutant: "Dit {astuce}", autonome: "Dit {astuce}" } };
    expect(fillSaid(s, { astuce: "écrit" }, { astuce: "dit" })).toEqual({
      text: { debutant: "écrit", autonome: "écrit" },
      spoken: { debutant: "Dit dit", autonome: "Dit dit" },
    });
  });
});
