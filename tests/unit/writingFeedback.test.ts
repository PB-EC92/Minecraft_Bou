import { describe, expect, it } from "vitest";
import {
  DICT_FEEDBACK_FULL_MS,
  DICT_FEEDBACK_IDLE_MS,
  feedbackDue,
  LEFT_TO_RIGHT_EVERY_MS,
  newFeedbackMemory,
  writingFeedback,
} from "../../src/edu/writingFeedback";
import { letterBlockId } from "../../src/engine/blocks";
import { evaluateWriting, type Reading, type WritingState } from "../../src/engine/words";
import { World } from "../../src/engine/World";

/** Enfant devant le côté +Z d'une rangée posée à z = 10 (il lit vers +X). */
const SOUTH = { x: 11.5, y: 4, z: 15 };

/** État de l'écriture de `target` quand `text` est posé de x = 10 vers +X, à z = 10, sur un monde plat. */
function stateOf(text: string, target: string, previous: readonly string[] = []): WritingState {
  const w = World.createFlat(32, 16, 32, 4);
  for (let i = 0; i < text.length; i++) w.set(10 + i, 4, 10, letterBlockId(text.charAt(i))!);
  return evaluateWriting(w, SOUTH, target, SOUTH, previous);
}

const LUNE: Reading = {
  text: "LUNE",
  cells: [
    [10, 4, 10],
    [11, 4, 10],
    [12, 4, 10],
    [13, 4, 10],
  ],
  dir: [1, 0, 0],
  side: { nx: 0, nz: 1 },
};

function state(p: Partial<WritingState>): WritingState {
  return { found: null, foundFacing: false, glued: false, hidden: false, tower: false, reversed: false, best: null, ...p };
}

describe("feedbackDue (dictée : quand répondre)", () => {
  it("1,5 s après la dernière pose si la longueur du mot est atteinte, 8 s sinon (au moins 2 lettres)", () => {
    expect(DICT_FEEDBACK_FULL_MS).toBe(1500);
    expect(DICT_FEEDBACK_IDLE_MS).toBe(8000);
    expect(feedbackDue(5, 5, 1499)).toBe(false);
    expect(feedbackDue(5, 5, 1500)).toBe(true);
    expect(feedbackDue(6, 5, 1500)).toBe(true);
    expect(feedbackDue(4, 5, 1500)).toBe(false);
    expect(feedbackDue(4, 5, 7999)).toBe(false);
    expect(feedbackDue(4, 5, 8000)).toBe(true);
    expect(feedbackDue(2, 5, 8000)).toBe(true);
    expect(feedbackDue(1, 5, 60000)).toBe(false);
  });
});

describe("writingFeedback : priorités et « une fois par … »", () => {
  it("mémoire neuve", () => {
    expect(newFeedbackMemory()).toEqual({ hiddenSaid: false, towerSaid: false, leftToRightAt: -Infinity, said: [] });
  });

  it("mot trouvé : rien à dire ici (le jeu dit bravo), même si le reste est vrai", () => {
    const m = newFeedbackMemory();
    const f = writingFeedback(
      state({ found: LUNE, foundFacing: false, glued: true, hidden: true, tower: true, reversed: true }),
      "copy",
      "LUNE",
      0,
      0,
      m,
    );
    expect(f).toMatchObject({ found: true, foundFacing: false, glued: true, key: null, wrongCells: [], have: 4, attempt: "LUNE" });
    expect(m).toEqual(newFeedbackMemory());
  });

  it("caché, puis colonne, puis à l'envers : un seul message, et jamais le suivant à la place", () => {
    const m = newFeedbackMemory();
    const s = state({ hidden: true, tower: true, reversed: true });
    expect(writingFeedback(s, "copy", "LUNE", 0, 0, m).key).toBe("HIDDEN_WORD");
    // Une fois par mot : rien la deuxième fois (pas de TOWER à la place).
    expect(writingFeedback(s, "copy", "LUNE", 1000, 0, m).key).toBeNull();
    const t = state({ tower: true, reversed: true });
    expect(writingFeedback(t, "copy", "LUNE", 2000, 0, m).key).toBe("TOWER");
    expect(writingFeedback(t, "dictation", "LUNE", 3000, 9000, m).key).toBeNull();
    // Mot suivant : nouvelle mémoire, le message revient.
    expect(writingFeedback(s, "copy", "LAPIN", 4000, 0, newFeedbackMemory()).key).toBe("HIDDEN_WORD");
  });

  it("de gauche à droite : au plus toutes les 15 s", () => {
    expect(LEFT_TO_RIGHT_EVERY_MS).toBe(15000);
    const m = newFeedbackMemory();
    const s = stateOf("HC", "CHAT");
    expect(s.reversed).toBe(true);
    expect(writingFeedback(s, "copy", "CHAT", 1000, 0, m).key).toBe("LEFT_TO_RIGHT");
    expect(writingFeedback(s, "copy", "CHAT", 15999, 0, m).key).toBeNull();
    expect(writingFeedback(s, "copy", "CHAT", 16000, 0, m).key).toBe("LEFT_TO_RIGHT");
    expect(writingFeedback(s, "dictation", "CHAT", 20000, 9000, m).key).toBeNull();
  });
});

describe("writingFeedback : copie", () => {
  it("mauvaise lettre : WRONG_LETTER avec la lettre attendue et son rang, une case orange", () => {
    const m = newFeedbackMemory();
    const s = stateOf("LAM", "LAPIN");
    const f = writingFeedback(s, "copy", "LAPIN", 0, 0, m);
    expect(f).toMatchObject({ key: "WRONG_LETTER", vars: { L: "P", rang: 3 }, wrongCells: [[12, 4, 10]], have: 2, attempt: "LAM" });
    expect(f.newTry).toBe(false);
    // Une fois par couple position-lettre ; la case reste orange tant que la lettre est là.
    const again = writingFeedback(s, "copy", "LAPIN", 5000, 0, m);
    expect(again.key).toBeNull();
    expect(again.wrongCells).toEqual([[12, 4, 10]]);
    // Une autre mauvaise lettre à la même place : nouveau message.
    expect(writingFeedback(stateOf("LAX", "LAPIN"), "copy", "LAPIN", 6000, 0, m).key).toBe("WRONG_LETTER");
  });

  it("lettre en trop après ou avant le mot : EXTRA_LETTER, les lettres hors du mot en orange", () => {
    const m = newFeedbackMemory();
    const after = writingFeedback(stateOf("LAPINS", "LAPIN"), "copy", "LAPIN", 0, 0, m);
    expect(after).toMatchObject({ key: "EXTRA_LETTER", wrongCells: [[15, 4, 10]], have: 5 });
    expect(writingFeedback(stateOf("LAPINS", "LAPIN"), "copy", "LAPIN", 1000, 0, m).key).toBeNull();
    const before = writingFeedback(stateOf("XLAPIN", "LAPIN"), "copy", "LAPIN", 2000, 0, m);
    expect(before).toMatchObject({ key: "EXTRA_LETTER", wrongCells: [[10, 4, 10]] });
  });

  it("début juste : rien à dire, rien en orange", () => {
    const f = writingFeedback(stateOf("LAP", "LAPIN"), "copy", "LAPIN", 0, 0, newFeedbackMemory());
    expect(f).toMatchObject({ found: false, key: null, wrongCells: [], have: 3, attempt: "LAP" });
  });
});

describe("writingFeedback : dictée", () => {
  it("lettre manquante : rien avant 8 s sans pose, puis DICT_MISSING une fois, avec newTry", () => {
    const m = newFeedbackMemory();
    const s = stateOf("LAPE", "LAMPE");
    expect(writingFeedback(s, "dictation", "LAMPE", 0, 1500, m).key).toBeNull();
    expect(writingFeedback(s, "dictation", "LAMPE", 0, 7999, m).key).toBeNull();
    const f = writingFeedback(s, "dictation", "LAMPE", 0, 8000, m);
    expect(f).toMatchObject({ key: "DICT_MISSING", newTry: true, wrongCells: [] });
    const again = writingFeedback(s, "dictation", "LAMPE", 0, 20000, m);
    expect(again).toMatchObject({ key: null, newTry: false });
  });

  it("longueur atteinte : 1,5 s suffit ; une lettre fausse (avec son rang), échangées, en trop, très loin", () => {
    const m = newFeedbackMemory();
    expect(writingFeedback(stateOf("LANPE", "LAMPE"), "dictation", "LAMPE", 0, 1499, m).key).toBeNull();
    const wrong = writingFeedback(stateOf("LANPE", "LAMPE"), "dictation", "LAMPE", 0, 1500, m);
    expect(wrong).toMatchObject({ key: "DICT_WRONG", vars: { rang: 3 }, newTry: true, wrongCells: [] });
    expect(writingFeedback(stateOf("LMAPE", "LAMPE"), "dictation", "LAMPE", 0, 1500, m)).toMatchObject({
      key: "DICT_SWAP",
      newTry: true,
      wrongCells: [],
    });
    expect(writingFeedback(stateOf("LAMMPE", "LAMPE"), "dictation", "LAMPE", 0, 1500, m)).toMatchObject({
      key: "EXTRA_LETTER",
      newTry: true,
      wrongCells: [],
    });
    expect(writingFeedback(stateOf("TOTOR", "LAMPE"), "dictation", "LAMPE", 0, 1500, m)).toMatchObject({
      key: "DICT_FAR",
      newTry: true,
      wrongCells: [],
    });
  });

  it("début juste ou une seule lettre : jamais de retour", () => {
    const m = newFeedbackMemory();
    expect(writingFeedback(stateOf("LAM", "LAMPE"), "dictation", "LAMPE", 0, 60000, m)).toMatchObject({ key: null, newTry: false, have: 3 });
    expect(writingFeedback(stateOf("Z", "LAMPE"), "dictation", "LAMPE", 0, 60000, m)).toMatchObject({ key: null, newTry: false });
    expect(m.said).toEqual([]);
  });
});

describe("writingFeedback : have et attempt", () => {
  it("longueur du mot s'il est trouvé, sinon le meilleur début juste, sinon 0", () => {
    const m = newFeedbackMemory();
    expect(writingFeedback(stateOf("LUNE", "LUNE"), "copy", "LUNE", 0, 0, m)).toMatchObject({ found: true, have: 4, attempt: "LUNE" });
    expect(writingFeedback(stateOf("LU", "LUNE"), "copy", "LUNE", 0, 0, m)).toMatchObject({ have: 2, attempt: "LU" });
    expect(writingFeedback(state({}), "copy", "LUNE", 0, 0, m)).toMatchObject({ have: 0, attempt: null, key: null });
    // Collé à un mot déjà écrit : l'essai est le noyau.
    expect(writingFeedback(stateOf("AMILU", "LUNE", ["AMI"]), "copy", "LUNE", 0, 0, m)).toMatchObject({ have: 2, attempt: "LU" });
  });
});
