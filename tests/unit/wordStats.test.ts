import { describe, expect, it } from "vitest";
import { MISSION_1, MISSION_2, MissionRunner, progressLabel, resumeMission, starsEarned, wordStatsLines, type MissionView } from "../../src/edu/missions";
import {
  WORD_HELP_KINDS,
  WORD_HELP_LABELS,
  failsLabel,
  formatDuration,
  helpsLabel,
  readWordStats,
  wordStatLine,
  wordStatsJSON,
} from "../../src/edu/wordStats";

const none: MissionView = { count: () => 0 };
const ctx = { level: "debutant" as const, name: "Léa", seed: 1234, exclude: new Set<string>() };

/** Mission 2 à l'étape du premier mot, mot préparé et relevé commencé (comme le fait le jeu). */
function atFirstWord(): { m: MissionRunner; word: string } {
  const m = new MissionRunner(MISSION_2, { id: "mots", step: 1, counts: {} });
  const word = m.prepare(ctx)!;
  m.beginWordStats(word, "copy");
  return { m, word };
}

describe("temps par mot de la mission 2 : textes pour l'adulte", () => {
  it("durées lisibles", () => {
    expect(formatDuration(0)).toBe("0 s");
    expect(formatDuration(-5)).toBe("0 s");
    expect(formatDuration(Number.NaN)).toBe("0 s");
    expect(formatDuration(400)).toBe("0 s");
    expect(formatDuration(500)).toBe("1 s");
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(59_499)).toBe("59 s");
    expect(formatDuration(60_000)).toBe("1 min");
    expect(formatDuration(80_000)).toBe("1 min 20 s");
    expect(formatDuration(3_599_000)).toBe("59 min 59 s");
    expect(formatDuration(3_600_000)).toBe("1 h");
    expect(formatDuration(3_900_000)).toBe("1 h 5 min");
  });

  it("essais et aides", () => {
    expect(failsLabel(0)).toBe("aucun essai non réussi");
    expect(failsLabel(1)).toBe("1 essai non réussi");
    expect(failsLabel(3)).toBe("3 essais non réussis");
    expect(helpsLabel({})).toBe("sans aide");
    expect(helpsLabel({ ghostLine: 1 })).toBe("aide : ligne");
    // Ordre fixe (celui de WORD_HELP_KINDS), quel que soit l'ordre d'arrivée ; « ×n » au-delà d'une fois.
    expect(helpsLabel({ nextLetter: 2, ghostLine: 1, nextGhost: 1 })).toBe("aides : case, ligne, lettre dite ×2");
    for (const k of WORD_HELP_KINDS) expect(WORD_HELP_LABELS[k].length).toBeGreaterThan(0);
  });

  it("ligne d'un mot", () => {
    expect(wordStatLine({ word: "AMI", mode: "copy", ms: 80_000, fails: 2, helps: { nextGhost: 1, ghostLine: 1 } })).toBe(
      "AMI (copie) : 1 min 20 s, 2 essais non réussis, aides : case, ligne",
    );
    expect(wordStatLine({ word: "LUNE", mode: "dictation", ms: 40_000, fails: 0, helps: {} }, true)).toBe(
      "LUNE (dictée, en cours) : 40 s, aucun essai non réussi, sans aide",
    );
  });
});

describe("temps par mot de la mission 2 : relevé (MissionRunner)", () => {
  it("rien n'est relevé ni enregistré hors d'une étape d'écriture", () => {
    const m = new MissionRunner(MISSION_2);
    m.beginWordStats("AMI", "copy"); // étape 0 : poser une lettre
    m.noteActiveTime(5000, true);
    m.noteWordFail();
    m.noteWordHelp("ghostLine");
    expect(m.wordStats).toEqual({ words: [], current: null, totalMs: null });
    expect(m.toJSON()).not.toHaveProperty("wordStats");
    // Mission 1 : jamais d'écriture.
    const m1 = new MissionRunner(MISSION_1);
    m1.beginWordStats("AMI", "copy");
    m1.noteActiveTime(1000, true);
    expect(m1.toJSON()).not.toHaveProperty("wordStats");
  });

  it("durée active : seul le temps signalé compte (une pause n'appelle pas noteActiveTime) ; le total commence à la première consigne", () => {
    const { m, word } = atFirstWord();
    // Avant la consigne (writing faux) : ni le mot ni la mission.
    m.noteActiveTime(3000, false);
    expect(m.wordStats.current).toMatchObject({ word, mode: "copy", ms: 0 });
    expect(m.wordStats.totalMs).toBeNull();
    // Consigne dite : le mot et la mission.
    m.noteActiveTime(1000, true);
    m.noteActiveTime(500, true);
    // Valeurs ignorées.
    m.noteActiveTime(-200, true);
    m.noteActiveTime(Number.NaN, true);
    m.noteActiveTime(Number.POSITIVE_INFINITY, true);
    expect(m.wordStats.current?.ms).toBe(1500);
    expect(m.wordStats.totalMs).toBe(1500);
    // Essais et aides.
    m.noteWordFail();
    m.noteWordFail();
    m.noteWordHelp("nextGhost");
    m.noteWordHelp("nextLetter");
    m.noteWordHelp("nextLetter");
    expect(m.wordStats.current).toEqual({ word, mode: "copy", ms: 1500, fails: 2, helps: { nextGhost: 1, nextLetter: 2 } });
    // Mot trouvé : le mot ne compte plus (validation à l'image suivante) ; la mission, oui.
    m.noteWord(word);
    m.noteActiveTime(700, true);
    m.noteWordFail();
    m.noteWordHelp("giveLetter");
    expect(m.wordStats.current).toEqual({ word, mode: "copy", ms: 1500, fails: 2, helps: { nextGhost: 1, nextLetter: 2 } });
    expect(m.wordStats.totalMs).toBe(2200);
    m.noteActiveTime(700, false);
    expect(m.wordStats.totalMs).toBe(2900);
    // Étape validée : le relevé rejoint les mots finis.
    expect(m.update(none)).toEqual({ kind: "step", index: 2 });
    expect(m.wordStats.words).toEqual([{ word, mode: "copy", ms: 1500, fails: 2, helps: { nextGhost: 1, nextLetter: 2 } }]);
    expect(m.wordStats.current).toBeNull();
    // Entre deux mots (bravo, consigne suivante) : la mission seulement.
    m.noteActiveTime(2000, false);
    expect(m.wordStats.totalMs).toBe(4900);
  });

  it("de bout en bout : quatre mots, total jusqu'aux félicitations, plus rien ensuite", () => {
    const { m } = atFirstWord();
    const modes = ["copy", "copy", "dictation", "dictation"] as const;
    const words: string[] = [];
    for (let i = 0; i < 4; i++) {
      const word = m.prepare(ctx)!;
      m.beginWordStats(word, modes[i]!);
      m.noteActiveTime(10_000 * (i + 1), true);
      m.noteWord(word);
      words.push(word);
      m.update(none);
      m.noteActiveTime(1000, false); // bravo, consigne suivante
    }
    expect(m.done).toBe(true);
    const s = m.wordStats;
    expect(s.words.map((w) => [w.word, w.mode, w.ms])).toEqual(words.map((w, i) => [w, modes[i], 10_000 * (i + 1)]));
    // 10 + 20 + 30 + 40 s d'écriture et 3 s entre les mots ; après le dernier mot, seulement tant que celebrating.
    expect(s.totalMs).toBe(100_000 + 3000);
    m.noteActiveTime(1500, false, true); // fin dite, félicitations pas encore montrées
    expect(m.wordStats.totalMs).toBe(104_500);
    m.noteActiveTime(60_000, false, false); // jeu libre après les félicitations
    m.noteActiveTime(60_000, true, false);
    expect(m.wordStats.totalMs).toBe(104_500);
    const lines = wordStatsLines(JSON.parse(JSON.stringify(m.toJSON())));
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe(`${words[0]} (copie) : 10 s, aucun essai non réussi, sans aide`);
    expect(lines[3]).toBe(`${words[3]} (dictée) : 40 s, aucun essai non réussi, sans aide`);
    expect(lines[4]).toBe(
      "Durée de la mission 2 (les mots) : 1 min 45 s de jeu actif (de la première consigne d'écriture aux félicitations)",
    );
  });

  it("sauvegarde et reprise en cours de mot : le temps déjà passé, les essais et les aides sont gardés", () => {
    const { m, word } = atFirstWord();
    m.noteActiveTime(42_000, true);
    m.noteWordFail();
    m.noteWordHelp("ghostLine");
    const saved = JSON.parse(JSON.stringify(m.toJSON()));
    expect(saved.wordStats).toEqual({
      words: [],
      current: { word, mode: "copy", ms: 42_000, fails: 1, helps: { ghostLine: 1 } },
      totalMs: 42_000,
    });
    const again = new MissionRunner(MISSION_2, saved);
    expect(again.prepare(ctx)).toBe(word);
    // Le jeu rappelle beginWordStats à la reprise (mode recalculé) : le relevé du même mot est gardé, mode compris.
    again.beginWordStats(word, "dictation");
    again.noteActiveTime(8000, true);
    expect(again.wordStats.current).toEqual({ word, mode: "copy", ms: 50_000, fails: 1, helps: { ghostLine: 1 } });
    expect(again.wordStats.totalMs).toBe(50_000);
    expect(wordStatsLines(again.toJSON())).toEqual([
      `${word} (copie, en cours) : 50 s, 1 essai non réussi, aide : ligne`,
      "Durée de la mission 2 (les mots) jusqu'ici : 50 s de jeu actif (depuis la première consigne d'écriture)",
    ]);
  });

  it("un autre mot à la reprise (niveau de lecture changé) : relevé neuf ; relevé d'une étape qui n'écrit pas : oublié", () => {
    const { m, word } = atFirstWord();
    m.noteActiveTime(5000, true);
    const saved = JSON.parse(JSON.stringify(m.toJSON()));
    const again = new MissionRunner(MISSION_2, saved);
    const other = word === "AMI" ? "LUNE" : "AMI";
    again.beginWordStats(other, "dictation");
    expect(again.wordStats.current).toEqual({ word: other, mode: "dictation", ms: 0, fails: 0, helps: {} });
    expect(again.wordStats.totalMs).toBe(5000);
    // Mot enregistré différent du relevé : relevé oublié à la lecture.
    expect(new MissionRunner(MISSION_2, { ...saved, word: other }).wordStats.current).toBeNull();
    // Étape 0 (pas d'écriture) avec un relevé en cours : oublié.
    expect(new MissionRunner(MISSION_2, { ...saved, step: 0 }).wordStats.current).toBeNull();
  });
});

describe("temps par mot de la mission 2 : lecture robuste et compatibilité", () => {
  const good = { word: "AMI", mode: "copy", ms: 1000, fails: 0, helps: {} };

  it("absent ou d'une autre forme : relevé vide, jamais d'erreur", () => {
    const empty = { words: [], current: null, totalMs: null };
    for (const raw of [undefined, null, 3, "x", [], [good], true]) expect(readWordStats(raw)).toEqual(empty);
    expect(readWordStats({ words: "x", current: 4, totalMs: "12" })).toEqual(empty);
  });

  it("entrées abîmées ignorées une à une ; aides inconnues ou abîmées ignorées ; dix étapes au plus", () => {
    const r = readWordStats({
      words: [
        good,
        { ...good, word: "ami" },
        { ...good, word: "A" },
        { ...good, mode: "lecture" },
        { ...good, ms: -1 },
        { ...good, ms: Number.NaN },
        { ...good, ms: 1e12 },
        { ...good, fails: 1.5 },
        { ...good, fails: -1 },
        { ...good, word: "LUNE", helps: { ghostLine: 2, magie: 3, nextGhost: -1, nextLetter: 0.5, giveLetter: 0 } },
        null,
        "AMI",
      ],
      current: { ...good, word: "TOIT", fails: 2 },
      totalMs: 5000,
    });
    expect(r.words).toEqual([good, { ...good, word: "LUNE", helps: { ghostLine: 2 } }]);
    expect(r.current).toEqual({ ...good, word: "TOIT", fails: 2 });
    expect(r.totalMs).toBe(5000);
    expect(readWordStats({ words: Array.from({ length: 15 }, () => good) }).words).toHaveLength(10);
    expect(readWordStats({ totalMs: -3 }).totalMs).toBeNull();
    expect(readWordStats({ totalMs: Number.POSITIVE_INFINITY }).totalMs).toBeNull();
  });

  it("un relevé abîmé ne change rien au reste de la progression (étape, compteurs, mots, mot en cours)", () => {
    const base = { id: "mots", step: 2, counts: { help: 1 }, words: ["SOL"], word: "MOTO" };
    for (const wordStats of [undefined, null, 7, "x", { words: [{ word: 3 }], current: [], totalMs: "a" }]) {
      const m = new MissionRunner(MISSION_2, { ...base, wordStats });
      expect(m.stepIndex).toBe(2);
      expect(m.words).toEqual(["SOL"]);
      expect(m.target).toBe("MOTO");
      expect(m.help()).toEqual({ stage: 1, revealed: 0, copy: false });
      expect(m.toJSON()).toEqual(base); // relevé vide : rien d'enregistré
      expect(progressLabel(m.toJSON())).toBe(progressLabel(base));
      expect(wordStatsLines({ ...base, wordStats })).toEqual([]);
    }
  });

  it("le champ wordStats ne change ni la reprise, ni les étoiles, ni la progression pour l'adulte (lecture d'avant ce champ)", () => {
    // La 1.1-rc ne relit que id, step, counts, words et word : sans le champ, tout est identique.
    const { m, word } = atFirstWord();
    m.noteActiveTime(12_000, true);
    m.noteWordHelp("nextGhost");
    const withStats = JSON.parse(JSON.stringify(m.toJSON()));
    expect(withStats.wordStats).toBeDefined();
    const { wordStats: _ignored, ...without } = withStats;
    expect(without).toEqual({ id: "mots", step: 1, counts: {}, word });
    for (const done of [false, true]) {
      expect(resumeMission(withStats, done)).toMatchObject({ def: MISSION_2, fresh: false });
      expect(resumeMission(without, done)).toMatchObject({ def: MISSION_2, fresh: false });
    }
    expect(starsEarned(withStats)).toBe(starsEarned(without));
    expect(progressLabel(withStats)).toBe(progressLabel(without));
    const a = new MissionRunner(MISSION_2, withStats);
    const b = new MissionRunner(MISSION_2, without);
    expect([a.stepIndex, a.target, a.words, a.help()]).toEqual([b.stepIndex, b.target, b.words, b.help()]);
  });

  it("forme enregistrée : durées arrondies à la milliseconde, rien quand le relevé est vide", () => {
    expect(wordStatsJSON({ words: [], current: null, totalMs: null })).toBeUndefined();
    expect(
      wordStatsJSON({ words: [{ word: "AMI", mode: "copy", ms: 1000.4, fails: 0, helps: {} }], current: null, totalMs: 1000.6 }),
    ).toEqual({ words: [{ word: "AMI", mode: "copy", ms: 1000, fails: 0, helps: {} }], totalMs: 1001 });
  });

  it("mode parent : rien pour une mission sans relevé, ou une progression inconnue", () => {
    expect(wordStatsLines(undefined)).toEqual([]);
    expect(wordStatsLines({ id: "abri", step: 3, counts: {} })).toEqual([]);
    expect(wordStatsLines({ id: "inconnue", wordStats: { totalMs: 5 } })).toEqual([]);
    // Mission 2 finie dans la 1.1-rc (sans relevé) : rien non plus.
    expect(wordStatsLines({ id: "mots", step: 5, counts: {}, words: ["AMI", "LUNE", "TOIT", "LEA"] })).toEqual([]);
  });

  it("mission finie : l'étape en cours n'est plus montrée, la durée totale est dite « aux félicitations »", () => {
    const saved = {
      id: "mots",
      step: 5,
      counts: {},
      words: ["AMI"],
      wordStats: { words: [{ word: "AMI", mode: "dictation", ms: 61_000, fails: 3, helps: { wordBoxes: 1, firstLetter: 1, toCopy: 1 } }], totalMs: 75_000 },
    };
    expect(wordStatsLines(saved)).toEqual([
      "AMI (dictée) : 1 min 1 s, 3 essais non réussis, aides : cases du mot, 1re lettre, passé en copie",
      "Durée de la mission 2 (les mots) : 1 min 15 s de jeu actif (de la première consigne d'écriture aux félicitations)",
    ]);
  });
});
