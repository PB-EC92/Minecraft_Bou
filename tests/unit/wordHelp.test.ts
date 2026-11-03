import { describe, expect, it } from "vitest";
import {
  COPY_GIVE_MS,
  COPY_LINE_MS,
  COPY_NEXT_GHOST_MS,
  COPY_REPEAT_MS,
  COPY_SAY_NEXT_MS,
  DICT_STAGE_MS,
  wordHelp,
  type HelpInput,
  type HelpOutput,
  type HelpSay,
} from "../../src/edu/wordHelp";

const input = (o: Partial<HelpInput>): HelpInput => ({
  mode: "copy",
  firstWord: false,
  length: 4,
  have: 0,
  stage: 0,
  revealed: 0,
  prevMs: 0,
  ms: 0,
  newTry: false,
  ...o,
});

/**
 * Fait tourner l'aide comme le jeu : une image toutes les `dt` ms, horloge sans progrès qui repart à 0 quand `have`
 * augmente (copie) ou quand l'aide le demande (dictée). Renvoie ce qui est dit, avec l'horloge du moment.
 */
function run(
  start: Partial<HelpInput>,
  totalMs: number,
  dt = 100,
  events: { at: number; have?: number; newTry?: boolean }[] = [],
): { said: { at: number; say: HelpSay; ms: number }[]; last: HelpOutput } {
  let state = input(start);
  let clock = 0;
  let last = wordHelp(state);
  const said: { at: number; say: HelpSay; ms: number }[] = [];
  for (let t = dt; t <= totalMs; t += dt) {
    const ev = events.find((e) => e.at === t);
    let have = state.have;
    let prevMs = clock;
    if (ev?.have !== undefined && ev.have > have) {
      // Progrès : l'horloge sans progrès repart de 0 à cette image.
      have = ev.have;
      prevMs = 0;
      clock = 0;
    } else clock += dt;
    last = wordHelp({ ...state, have, prevMs, ms: clock, newTry: ev?.newTry === true });
    if (last.say) said.push({ at: t, say: last.say, ms: clock });
    if (last.resetClock) clock = 0;
    state = { ...state, have, mode: last.mode, stage: last.stage, revealed: last.revealed };
  }
  return { said, last };
}

describe("aide de la copie", () => {
  it("modèle toujours entier, lettre suivante entourée ; rien d'autre au départ", () => {
    const o = wordHelp(input({}));
    expect(o).toEqual({
      mode: "copy",
      stage: 0,
      revealed: 0,
      resetClock: false,
      say: null,
      show: { model: "full", revealed: 4, nextRing: true, ghostLine: false, ghostNext: false, trayGlow: false },
    });
  });

  it("seuils : 15 s fantôme et anneau, 25 s lettre suivante, 30 s (rien posé) ligne de fantômes, 50 s lettre donnée, puis toutes les 30 s", () => {
    expect(wordHelp(input({ prevMs: 14_900, ms: 15_000 })).show).toMatchObject({ ghostNext: true, trayGlow: true, ghostLine: false });
    expect(wordHelp(input({ prevMs: 14_900, ms: 15_000 })).stage).toBe(1);
    expect(wordHelp(input({ prevMs: 14_800, ms: 14_900 })).stage).toBe(0);
    expect(wordHelp(input({ stage: 1, prevMs: 24_900, ms: 25_000 })).say).toBe("next");
    const line = wordHelp(input({ stage: 1, prevMs: 29_900, ms: 30_000 }));
    expect(line.say).toBe("ghosts");
    expect(line.stage).toBe(2);
    expect(line.show).toMatchObject({ ghostLine: true, ghostNext: true, trayGlow: true });
    expect(wordHelp(input({ stage: 2, prevMs: 49_900, ms: 50_000 })).say).toBe("give");
    expect(wordHelp(input({ stage: 2, prevMs: 79_900, ms: 80_000 })).say).toBe("next");
    expect(wordHelp(input({ stage: 2, prevMs: 109_950, ms: 110_050 })).say).toBe("next");
    expect(wordHelp(input({ stage: 2, prevMs: 95_000, ms: 95_100 })).say).toBeNull();
    // Un seuil est franchi quand prevMs < seuil ≤ ms : pas deux fois.
    expect(wordHelp(input({ stage: 1, prevMs: 25_000, ms: 25_100 })).say).toBeNull();
    expect([COPY_NEXT_GHOST_MS, COPY_SAY_NEXT_MS, COPY_LINE_MS, COPY_GIVE_MS, COPY_REPEAT_MS]).toEqual([15_000, 25_000, 30_000, 50_000, 30_000]);
  });

  it("à 30 s, la ligne de fantômes seulement si rien n'est posé", () => {
    const o = wordHelp(input({ stage: 1, have: 2, prevMs: 29_900, ms: 30_000 }));
    expect(o.say).toBeNull();
    expect(o.stage).toBe(1);
    expect(o.show.ghostLine).toBe(false);
  });

  it("deux seuils dans la même image : give > ghosts > next", () => {
    expect(wordHelp(input({ prevMs: 0, ms: 60_000 })).say).toBe("give");
    expect(wordHelp(input({ prevMs: 20_000, ms: 31_000 })).say).toBe("ghosts");
    expect(wordHelp(input({ have: 1, prevMs: 20_000, ms: 31_000 })).say).toBe("next");
    expect(wordHelp(input({ prevMs: 0, ms: 60_000 })).stage).toBe(2);
  });

  it("déroulé complet : ce qui est dit, et quand", () => {
    const { said, last } = run({}, 120_000);
    expect(said.map((s) => [s.say, s.at])).toEqual([
      ["next", 25_000],
      ["ghosts", 30_000],
      ["give", 50_000],
      ["next", 80_000],
      ["next", 110_000],
    ]);
    expect(last.stage).toBe(2);
  });

  it("une lettre juste remet l'horloge à 0 : la suivante repart de 15 s, sans ligne de fantômes (déjà commencée)", () => {
    const { said } = run({}, 70_000, 100, [{ at: 20_000, have: 1 }]);
    expect(said.map((s) => [s.say, s.at])).toEqual([
      ["next", 45_000],
      ["give", 70_000],
    ]);
  });

  it("le mot 1 commence au palier 2 (fantômes et anneau d'emblée)", () => {
    const o = wordHelp(input({ firstWord: true }));
    expect(o.stage).toBe(2);
    expect(o.show).toMatchObject({ model: "full", nextRing: true, ghostLine: true, ghostNext: true, trayGlow: true });
  });

  it("le palier ne redescend jamais", () => {
    expect(wordHelp(input({ stage: 2, have: 3, prevMs: 0, ms: 100 })).stage).toBe(2);
    expect(wordHelp(input({ stage: 1, prevMs: 14_900, ms: 15_000 })).stage).toBe(1);
    const { last } = run({ stage: 2 }, 10_000, 100, [{ at: 5_000, have: 2 }]);
    expect(last.stage).toBe(2);
  });
});

describe("aide de la dictée", () => {
  const dict = (o: Partial<HelpInput>) => wordHelp(input({ mode: "dictation", length: 5, ...o }));

  it("rien au départ : ni modèle, ni fantômes, ni anneau", () => {
    const o = dict({ ms: 29_900, prevMs: 29_800 });
    expect(o).toEqual({
      mode: "dictation",
      stage: 0,
      revealed: 0,
      resetClock: false,
      say: null,
      show: { model: "none", revealed: 0, nextRing: false, ghostLine: false, ghostNext: false, trayGlow: false },
    });
  });

  it("30 s ou un essai : les cases, puis la première lettre, puis une lettre de plus", () => {
    const count = dict({ prevMs: 29_900, ms: 30_000 });
    expect(count).toMatchObject({ mode: "dictation", stage: 1, revealed: 0, resetClock: true, say: "count" });
    expect(count.show.model).toBe("boxes");
    const first = dict({ stage: 1, newTry: true, ms: 3_000, prevMs: 2_900 });
    expect(first).toMatchObject({ stage: 2, revealed: 1, resetClock: true, say: "first" });
    // L'enfant a déjà deux lettres justes : la « première lettre » en dévoile autant.
    expect(dict({ stage: 1, have: 2, ms: 30_000, prevMs: 29_900 }).revealed).toBe(2);
    const more = dict({ stage: 2, revealed: 1, ms: 30_000, prevMs: 29_900 });
    expect(more).toMatchObject({ stage: 3, revealed: 2, say: "more" });
    // Toujours au moins une lettre de plus que ce que l'enfant a déjà juste.
    expect(dict({ stage: 3, revealed: 2, have: 3, newTry: true }).revealed).toBe(4);
    for (const o of [count, first, more]) {
      expect(o.show).toMatchObject({ nextRing: false, ghostLine: false, ghostNext: false, trayGlow: false });
      expect(o.show.revealed).toBe(o.revealed);
    }
    expect(DICT_STAGE_MS).toBe(30_000);
  });

  it("mot entier dévoilé : 'all', passage en copie (palier 1), jamais d'échec", () => {
    const o = dict({ stage: 5, revealed: 4, ms: 30_000, prevMs: 29_900 });
    expect(o).toMatchObject({ mode: "copy", stage: 1, revealed: 5, say: "all", resetClock: true });
    expect(o.show).toMatchObject({ model: "full", revealed: 5, nextRing: true, ghostNext: true, trayGlow: true, ghostLine: false });
    // Au premier mot, la copie commence au palier 2 (comme toute copie du premier mot).
    expect(dict({ firstWord: true, stage: 5, revealed: 4, newTry: true }).stage).toBe(2);
  });

  it("déroulé : on arrive toujours au mot entier, puis l'aide de la copie prend le relais", () => {
    const { said, last } = run({ mode: "dictation", length: 5 }, 400_000);
    const kinds = said.map((s) => s.say);
    expect(kinds.slice(0, 6)).toEqual(["count", "first", "more", "more", "more", "all"]);
    expect(said.slice(0, 6).map((s) => s.at)).toEqual([30_000, 60_000, 90_000, 120_000, 150_000, 180_000]);
    expect(last.mode).toBe("copy");
    // Après le passage en copie, l'aide de la copie (horloge remise à 0) : lettre suivante à 25 s, etc.
    expect(said[6]).toMatchObject({ say: "next", at: 205_000 });
    expect(kinds.slice(6)).toContain("give");
  });

  it("chaque essai fait monter l'aide (et remet l'horloge à 0)", () => {
    const { said } = run({ mode: "dictation", length: 6 }, 40_000, 100, [
      { at: 5_000, newTry: true },
      { at: 8_000, newTry: true },
      { at: 9_000, newTry: true },
    ]);
    expect(said.map((s) => [s.say, s.at])).toEqual([
      ["count", 5_000],
      ["first", 8_000],
      ["more", 9_000],
      ["more", 39_000],
    ]);
  });

  it("le palier ne redescend jamais, les lettres dévoilées non plus", () => {
    const o = dict({ stage: 3, revealed: 3, have: 0, ms: 100, prevMs: 0 });
    expect(o.stage).toBe(3);
    expect(o.revealed).toBe(3);
  });
});

describe("sans mot", () => {
  it("longueur nulle : rien à montrer ni à dire", () => {
    const o = wordHelp(input({ length: 0, prevMs: 0, ms: 60_000 }));
    expect(o.say).toBeNull();
    expect(o.show.model).toBe("none");
  });
});
