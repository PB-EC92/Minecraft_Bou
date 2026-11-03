import { describe, expect, it } from "vitest";
import {
  TRAY_SLOP_PX,
  syllableGroups,
  tapTarget,
  trayKeyAction,
  trayKeyLetter,
  trayModelCells,
  type TrayKey,
} from "../../src/ui/LetterTray";

const key = (code: string, k: string, mods: Partial<TrayKey> = {}): TrayKey => ({
  code,
  key: k,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe("boîte à lettres : lettre tapée au clavier", () => {
  it("met la lettre en capitale", () => {
    expect(trayKeyLetter("m")).toBe("M");
    expect(trayKeyLetter("M")).toBe("M");
    expect(trayKeyLetter("a")).toBe("A");
    expect(trayKeyLetter("z")).toBe("Z");
  });

  it("retire les accents (AZERTY : é, è, ç de la rangée des chiffres)", () => {
    expect(trayKeyLetter("é")).toBe("E");
    expect(trayKeyLetter("É")).toBe("E");
    expect(trayKeyLetter("è")).toBe("E");
    expect(trayKeyLetter("ê")).toBe("E");
    expect(trayKeyLetter("ç")).toBe("C");
    expect(trayKeyLetter("à")).toBe("A");
    expect(trayKeyLetter("ï")).toBe("I");
    // Accent décomposé (lettre + diacritique combinant) : même résultat.
    expect(trayKeyLetter("é")).toBe("E");
  });

  it("refuse tout ce qui n'est pas une seule lettre de A à Z", () => {
    for (const k of ["", " ", "1", "0", "&", "Escape", "Enter", "Tab", "Shift", "Dead", "Unidentified", "œ", "ß", "æ", "AB", "€"]) {
      expect(trayKeyLetter(k), k).toBeNull();
    }
  });
});

describe("boîte à lettres : action d'une touche", () => {
  it("Échap, 0 et 0 du pavé ferment, par la position de la touche", () => {
    expect(trayKeyAction(key("Escape", "Escape"))).toEqual({ kind: "close" });
    expect(trayKeyAction(key("Numpad0", "0"))).toEqual({ kind: "close" });
    // AZERTY : la touche du 0 écrit « à » sans Maj ; elle ferme, elle ne choisit pas A.
    expect(trayKeyAction(key("Digit0", "à"))).toEqual({ kind: "close" });
    // Avec Maj, la même touche écrit « 0 » : elle ferme aussi.
    expect(trayKeyAction(key("Digit0", "0"))).toEqual({ kind: "close" });
  });

  it("une lettre se lit par ce qu'écrit la touche (pas sa position)", () => {
    // AZERTY : la touche KeyW écrit « z ».
    expect(trayKeyAction(key("KeyW", "z"))).toEqual({ kind: "pick", ch: "Z" });
    expect(trayKeyAction(key("KeyQ", "A"))).toEqual({ kind: "pick", ch: "A" });
    expect(trayKeyAction(key("Digit2", "é"))).toEqual({ kind: "pick", ch: "E" });
  });

  it("Tab parcourt les boutons", () => {
    expect(trayKeyAction(key("Tab", "Tab"))).toEqual({ kind: "tab" });
  });

  it("raccourcis, AltGr et composition ne choisissent rien", () => {
    expect(trayKeyAction(key("KeyR", "r", { ctrlKey: true }))).toEqual({ kind: "pass" });
    expect(trayKeyAction(key("KeyE", "€", { ctrlKey: true, altKey: true }))).toEqual({ kind: "pass" });
    expect(trayKeyAction(key("KeyA", "a", { metaKey: true }))).toEqual({ kind: "pass" });
    expect(trayKeyAction(key("KeyE", "e", { isComposing: true }))).toEqual({ kind: "pass" });
    // Même la fermeture attend la fin d'une composition.
    expect(trayKeyAction(key("Escape", "Escape", { isComposing: true }))).toEqual({ kind: "pass" });
  });

  it("tout le reste est avalé sans effet (Entrée et Espace gardent leur clic sur le bouton)", () => {
    for (const [code, k] of [
      ["Enter", "Enter"],
      ["Space", " "],
      ["Digit1", "&"],
      ["Digit1", "1"],
      ["ArrowUp", "ArrowUp"],
      ["ShiftLeft", "Shift"],
      ["BracketLeft", "Dead"],
      ["F5", "F5"],
    ] as const) {
      expect(trayKeyAction(key(code, k)), code).toEqual({ kind: "pass" });
    }
  });
});

describe("boîte à lettres : groupes de syllabes du modèle", () => {
  it("découpe le mot selon les longueurs", () => {
    expect(syllableGroups(5, [2, 3])).toEqual([
      [0, 1],
      [2, 3, 4],
    ]);
    expect(syllableGroups(3, [1, 1, 1])).toEqual([[0], [1], [2]]);
  });

  it("sans syllabes : un seul groupe", () => {
    expect(syllableGroups(4, [])).toEqual([[0, 1, 2, 3]]);
  });

  it("longueurs trop courtes : les lettres restantes forment un dernier groupe", () => {
    expect(syllableGroups(5, [2, 2])).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("longueurs trop longues : s'arrête au bout du mot", () => {
    expect(syllableGroups(3, [2, 3])).toEqual([[0, 1], [2]]);
    expect(syllableGroups(2, [2, 3])).toEqual([[0, 1]]);
  });

  it("ignore les longueurs qui ne sont pas des entiers positifs", () => {
    expect(syllableGroups(4, [0, -1, 1.5, Number.NaN, 2])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("mot vide : aucun groupe", () => {
    expect(syllableGroups(0, [2])).toEqual([]);
    expect(syllableGroups(-3, [])).toEqual([]);
  });
});

describe("boîte à lettres : cases du modèle", () => {
  it("copie : les lettres du mot, groupées par syllabe, avec leur état", () => {
    const cells = trayModelCells({
      letters: [
        { ch: "L", state: "done" },
        { ch: "A", state: "next" },
        { ch: "M", state: "todo" },
        { ch: "P", state: "todo" },
        { ch: "E", state: "todo" },
      ],
      syllables: [2, 3],
    });
    expect(cells).toEqual([
      [
        { letter: "L", state: "done" },
        { letter: "A", state: "next" },
      ],
      [
        { letter: "M", state: "todo" },
        { letter: "P", state: "todo" },
        { letter: "E", state: "todo" },
      ],
    ]);
  });

  it("dictée : une case vide ne montre jamais sa lettre, même donnée", () => {
    const cells = trayModelCells({
      letters: [
        { ch: "C", state: "done" },
        { ch: "H", state: "box" },
        { ch: null, state: "box" },
      ],
      syllables: [],
    });
    expect(cells).toEqual([
      [
        { letter: "C", state: "done" },
        { letter: null, state: "box" },
        { letter: null, state: "box" },
      ],
    ]);
  });

  it("une lettre absente ou hors A–Z devient une case vide", () => {
    const cells = trayModelCells({
      letters: [
        { ch: null, state: "todo" },
        { ch: "é", state: "next" },
        { ch: "AB", state: "done" },
        { ch: "Z", state: "next" },
      ],
      syllables: [4],
    });
    expect(cells.flat()).toEqual([
      { letter: null, state: "box" },
      { letter: null, state: "box" },
      { letter: null, state: "box" },
      { letter: "Z", state: "next" },
    ]);
  });

  it("modèle vide : aucune case", () => {
    expect(trayModelCells({ letters: [], syllables: [2] })).toEqual([]);
  });
});

describe("boîte à lettres : cible d'un toucher", () => {
  it("un toucher sans glissé agit sur la cible de départ", () => {
    expect(tapTarget("A", "A", 0)).toBe("A");
    expect(tapTarget("A", "A", TRAY_SLOP_PX)).toBe("A");
  });

  it("levé entre deux cibles (écart entre les lettres) : garde la cible de départ", () => {
    expect(tapTarget("A", null, 8)).toBe("A");
  });

  it("glissé au-delà du seuil : rien", () => {
    expect(tapTarget("A", "A", TRAY_SLOP_PX + 0.5)).toBeNull();
    expect(tapTarget("A", null, 40)).toBeNull();
    expect(tapTarget("A", "A", Number.NaN)).toBeNull();
  });

  it("levé sur une autre cible (lettre voisine) : rien", () => {
    expect(tapTarget("A", "B", 12)).toBeNull();
  });

  it("posé hors de toute cible : rien", () => {
    expect(tapTarget(null, "A", 0)).toBeNull();
    expect(tapTarget(null, null, 0)).toBeNull();
  });
});
