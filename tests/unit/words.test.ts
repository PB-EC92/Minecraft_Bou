import { describe, expect, it } from "vitest";
import { BlockId, isLetterId, isOpaqueId, isPlantId, letterBlockId, letterChar, LETTERS } from "../../src/engine/blocks";
import {
  canAimAt,
  diagnose,
  evaluateWriting,
  facesViewer,
  ghostCells,
  isVisible,
  letterRun,
  matchWord,
  MIN_WORD,
  nextCell,
  planLine,
  presentWords,
  readingSide,
  readingsThrough,
  stripKnown,
  type Reading,
} from "../../src/engine/words";
import { raycast, REACH } from "../../src/engine/raycast";
import { generateWorld } from "../../src/engine/terrain";
import { World } from "../../src/engine/World";
import { PLAYER } from "../../src/game/Player";

/** Monde plat de 32 × 16 × 32, surface à y = 4 (les lettres se posent à y = 4). */
const flat = () => World.createFlat(32, 16, 32, 4);

/** Écrit `text` en blocs-lettres à partir de (x, y, z), une lettre par pas `step`. */
function write(w: World, text: string, x: number, y: number, z: number, step: readonly [number, number, number] = [1, 0, 0]) {
  for (let i = 0; i < text.length; i++) {
    const id = letterBlockId(text.charAt(i));
    if (id === null) throw new Error(`pas une lettre : ${text.charAt(i)}`);
    w.set(x + step[0] * i, y + step[1] * i, z + step[2] * i, id);
  }
}

/** Visée de l'enfant debout en `at` : l'œil à la hauteur du jeu, la portée du jeu. */
const aimFrom = (at: { x: number; y: number; z: number }) => ({ eye: { x: at.x, y: at.y + PLAYER.eyeHeight, z: at.z }, reach: REACH });

/** Enfant debout devant le côté +Z d'une rangée posée à z = 10 (il lit vers +X). */
const SOUTH = { x: 11.5, y: 4, z: 15 };

describe("blocs-lettres (registre)", () => {
  it("isLetterId : 18 à 43 seulement, entiers", () => {
    expect(isLetterId(17)).toBe(false);
    expect(isLetterId(44)).toBe(false);
    expect(isLetterId(18.5)).toBe(false);
    expect(isLetterId(18)).toBe(true);
    expect(isLetterId(43)).toBe(true);
  });

  it("letterBlockId et letterChar : aller-retour de A à Z ; le reste ne donne rien", () => {
    for (const c of LETTERS) expect(letterChar(letterBlockId(c)!)).toBe(c);
    for (const bad of ["a", "É", "1", "AB", ""]) expect(letterBlockId(bad)).toBeNull();
    expect(letterChar(BlockId.Stone)).toBeNull();
  });
});

describe("lectures d'une rangée, d'une colonne, d'une lettre seule", () => {
  it("le côté de lecture vaut (−dz, dx)", () => {
    expect(readingSide(1, 0)).toEqual({ nx: 0, nz: 1 });
    expect(readingSide(-1, 0)).toEqual({ nx: 0, nz: -1 });
    expect(readingSide(0, 1)).toEqual({ nx: -1, nz: 0 });
    expect(readingSide(0, -1)).toEqual({ nx: 1, nz: 0 });
  });

  it("rangée sur X : CHAT se lit vers +X depuis +Z, et TAHC vers −X depuis −Z", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 10);
    expect(letterRun(w, 12, 4, 10, "x")).toEqual([
      [10, 4, 10],
      [11, 4, 10],
      [12, 4, 10],
      [13, 4, 10],
    ]);
    expect(letterRun(w, 12, 4, 11, "x")).toEqual([]);
    const rs = readingsThrough(w, 11, 4, 10);
    expect(rs).toHaveLength(2);
    expect(rs[0]).toMatchObject({ text: "CHAT", dir: [1, 0, 0], side: { nx: 0, nz: 1 } });
    expect(rs[0]!.cells[0]).toEqual([10, 4, 10]);
    expect(rs[1]).toMatchObject({ text: "TAHC", dir: [-1, 0, 0], side: { nx: 0, nz: -1 } });
    expect(rs[1]!.cells[0]).toEqual([13, 4, 10]);
    // Devant le côté +Z, on lit CHAT ; devant le côté −Z, TAHC.
    expect(facesViewer(rs[0]!, SOUTH)).toBe(true);
    expect(facesViewer(rs[1]!, SOUTH)).toBe(false);
    expect(facesViewer(rs[1]!, { x: 11.5, z: 5 })).toBe(true);
  });

  it("rangée sur Z : vers +Z depuis −X, vers −Z depuis +X", () => {
    const w = flat();
    write(w, "LUNE", 10, 4, 10, [0, 0, 1]);
    const rs = readingsThrough(w, 10, 4, 12);
    expect(rs).toHaveLength(2);
    expect(rs[0]).toMatchObject({ text: "LUNE", dir: [0, 0, 1], side: { nx: -1, nz: 0 } });
    expect(rs[1]).toMatchObject({ text: "ENUL", dir: [0, 0, -1], side: { nx: 1, nz: 0 } });
    expect(facesViewer(rs[0]!, { x: 5, z: 11.5 })).toBe(true);
    expect(facesViewer(rs[1]!, { x: 5, z: 11.5 })).toBe(false);
    expect(facesViewer(rs[1]!, { x: 16, z: 11.5 })).toBe(true);
  });

  it("une colonne se lit seulement de haut en bas", () => {
    const w = flat();
    write(w, "PAL", 10, 6, 10, [0, -1, 0]); // P en haut, L en bas
    const columns = readingsThrough(w, 10, 5, 10).filter((r) => r.side === null);
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ text: "PAL", dir: [0, -1, 0] });
    expect(columns[0]!.cells[0]).toEqual([10, 6, 10]);
    expect(facesViewer(columns[0]!, { x: -100, z: -100 })).toBe(true);
  });

  it("colonne montée de bas en haut : tower ; colonne écrite de haut en bas : pas de tower", () => {
    const w = flat();
    write(w, "LAP", 10, 4, 10, [0, 1, 0]); // L en bas : se lit « PAL »
    const s = evaluateWriting(w, SOUTH, "LAPIN", SOUTH, []);
    expect(s.found).toBeNull();
    expect(s.tower).toBe(true);

    const w2 = flat();
    write(w2, "LAP", 10, 6, 10, [0, -1, 0]); // L en haut : se lit « LAP »
    const s2 = evaluateWriting(w2, SOUTH, "LAPIN", SOUTH, []);
    expect(s2.tower).toBe(false);
    expect(s2.best?.match).toEqual({ kind: "prefix", have: 3 });
    expect(s2.best?.reading.side).toBeNull();
  });

  it("une lettre seule donne quatre lectures d'une lettre, jamais un mot trouvé", () => {
    const w = flat();
    write(w, "L", 10, 4, 10);
    const rs = readingsThrough(w, 10, 4, 10);
    expect(rs.map((r) => r.text)).toEqual(["L", "L", "L", "L"]);
    expect(rs.map((r) => r.dir)).toEqual([
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]);
    const s = evaluateWriting(w, SOUTH, "L", SOUTH, []);
    expect(s.found).toBeNull();
    expect(s.hidden).toBe(false);
    expect(s.best?.match.kind).toBe("exact");
    expect(MIN_WORD).toBe(2);
  });

  it("une lettre seule : le meilleur essai suit le sens qui regarde le plus l'enfant", () => {
    const w = flat();
    write(w, "L", 10, 4, 10);
    // Enfant devant le côté +Z, un peu sur la droite : deux lectures lui font face.
    const s = evaluateWriting(w, SOUTH, "LAPIN", { x: 12, z: 15 }, []);
    expect(s.best?.match).toEqual({ kind: "prefix", have: 1 });
    expect(s.best?.reading.dir).toEqual([1, 0, 0]);
  });

  it("suite maximale : CHATS (lettre en trop après), XCHAT (avant) ; pierre ou air coupent la suite", () => {
    const w = flat();
    write(w, "CHATS", 10, 4, 10);
    expect(evaluateWriting(w, SOUTH, "CHAT", SOUTH, []).best?.match).toEqual({ kind: "extra", have: 4 });

    const w2 = flat();
    write(w2, "XCHAT", 10, 4, 10);
    const s2 = evaluateWriting(w2, SOUTH, "CHAT", SOUTH, []);
    expect(s2.found).toBeNull();
    expect(s2.best?.match).toEqual({ kind: "inside", have: 4, at: 1 });

    const w3 = flat();
    write(w3, "CH", 10, 4, 10);
    w3.set(12, 4, 10, BlockId.Stone);
    write(w3, "AT", 13, 4, 10);
    expect(readingsThrough(w3, 10, 4, 10)[0]!.text).toBe("CH");
    expect(readingsThrough(w3, 14, 4, 10)[0]!.text).toBe("AT");
    expect(evaluateWriting(w3, SOUTH, "CHAT", SOUTH, []).found).toBeNull();

    const w4 = flat();
    write(w4, "CH", 10, 4, 10);
    write(w4, "AT", 13, 4, 10); // une case d'air entre les deux
    expect(readingsThrough(w4, 11, 4, 10)[0]!.text).toBe("CH");
    expect(evaluateWriting(w4, SOUTH, "CHAT", SOUTH, []).found).toBeNull();
  });

  it("croisement en L : deux mots partagent une lettre", () => {
    const w = flat();
    // Le C du coin finit LAC (vers +X, lu depuis +Z) et commence CHAT (vers −Z, lu depuis +X) : ses deux faces de
    // lecture restent libres (A et H sont sur les deux autres côtés).
    write(w, "LAC", 8, 4, 10);
    write(w, "CHAT", 10, 4, 10, [0, 0, -1]);
    expect(readingsThrough(w, 10, 4, 10).map((r) => r.text)).toEqual(["LAC", "CAL", "TAHC", "CHAT"]);
    const lac = evaluateWriting(w, SOUTH, "LAC", { x: 9.5, z: 15 }, []);
    expect(lac.found?.text).toBe("LAC");
    expect(lac.foundFacing).toBe(true);
    const chat = evaluateWriting(w, SOUTH, "CHAT", { x: 15, z: 9 }, ["LAC"]);
    expect(chat.found?.text).toBe("CHAT");
    expect(chat.found?.side).toEqual({ nx: 1, nz: 0 });
    expect(chat.foundFacing).toBe(true);
  });
});

describe("visibilité des faces de lecture", () => {
  const chat = (w: World): { south: Reading; north: Reading } => {
    write(w, "CHAT", 10, 4, 10);
    const [south, north] = readingsThrough(w, 10, 4, 10);
    return { south: south!, north: north! };
  };

  it("un bloc opaque devant une lettre rend la lecture de ce côté illisible", () => {
    const w = flat();
    const { south, north } = chat(w);
    expect(isVisible(w, south)).toBe(true);
    w.set(11, 4, 11, BlockId.Stone);
    expect(isVisible(w, south)).toBe(false);
    expect(isVisible(w, north)).toBe(true);
  });

  it("eau, fleur, air ou verre devant : lisible", () => {
    for (const id of [BlockId.Water, BlockId.FlowerRed, BlockId.Air, BlockId.Glass]) {
      const w = flat();
      const { south } = chat(w);
      w.set(11, 4, 11, id);
      expect(isOpaqueId(id)).toBe(false);
      expect(isVisible(w, south)).toBe(true);
    }
  });

  it("au bord du monde : illisible de ce côté (la face n'est pas dessinée)", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 31); // z = 31 : dernière rangée du monde
    const [south, north] = readingsThrough(w, 10, 4, 31);
    expect(isVisible(w, south!)).toBe(false);
    expect(isVisible(w, north!)).toBe(true);
  });

  it("colonne : il suffit d'un côté visible", () => {
    const w = flat();
    write(w, "LA", 10, 5, 10, [0, -1, 0]);
    const col = readingsThrough(w, 10, 5, 10).find((r) => r.side === null)!;
    // Trois côtés couverts en entier : le côté −Z suffit.
    for (const [x, z] of [
      [11, 10],
      [9, 10],
      [10, 11],
    ] as const) {
      w.set(x, 4, z, BlockId.Stone);
      w.set(x, 5, z, BlockId.Stone);
    }
    expect(isVisible(w, col)).toBe(true);
    // Une seule case couverte du côté −Z : plus aucun côté n'est lisible en entier.
    w.set(10, 4, 9, BlockId.Stone);
    expect(isVisible(w, col)).toBe(false);
  });
});

describe("comparaison avec le mot attendu", () => {
  it("matchWord : les six cas", () => {
    expect(matchWord("LAPIN", "LAPIN")).toEqual({ kind: "exact", have: 5 });
    expect(matchWord("LAPINS", "LAPIN")).toEqual({ kind: "extra", have: 5 });
    expect(matchWord("XLAPIN", "LAPIN")).toEqual({ kind: "inside", have: 5, at: 1 });
    expect(matchWord("LAP", "LAPIN")).toEqual({ kind: "prefix", have: 3 });
    expect(matchWord("LAM", "LAPIN")).toEqual({ kind: "wrong", have: 2, got: "M", want: "P" });
    expect(matchWord("ZUT", "LAPIN")).toEqual({ kind: "none", have: 0 });
  });

  it("diagnose (dictée de LAMPE) : exact, prefix, missing, extra, wrong, swap, far", () => {
    expect(diagnose("LAMPE", "LAMPE")).toEqual({ kind: "exact", at: null });
    expect(diagnose("LAM", "LAMPE")).toEqual({ kind: "prefix", at: null });
    expect(diagnose("LAPE", "LAMPE")).toEqual({ kind: "missing", at: 2 });
    expect(diagnose("AMPE", "LAMPE")).toEqual({ kind: "missing", at: 0 });
    expect(diagnose("LAMMPE", "LAMPE")).toEqual({ kind: "extra", at: 2 });
    expect(diagnose("LANPE", "LAMPE")).toEqual({ kind: "wrong", at: 2 });
    expect(diagnose("LMAPE", "LAMPE")).toEqual({ kind: "swap", at: 1 });
    expect(diagnose("TOTOR", "LAMPE")).toEqual({ kind: "far", at: null });
    expect(diagnose("LNAPE", "LAMPE")).toEqual({ kind: "far", at: null }); // deux lettres fausses, non échangées
  });

  it("stripKnown : retire les mots déjà écrits collés, au début ou à la fin, le plus long d'abord", () => {
    expect(stripKnown("AMILUNE", ["AMI"])).toEqual({ text: "LUNE", start: 3 });
    expect(stripKnown("LUNEAMI", ["AMI"])).toEqual({ text: "LUNE", start: 0 });
    expect(stripKnown("AMIAMILUNE", ["AMI"])).toEqual({ text: "LUNE", start: 6 });
    expect(stripKnown("LACUNE", ["LA", "LAC"])).toEqual({ text: "UNE", start: 3 });
    // Il reste toujours au moins une lettre.
    expect(stripKnown("AMI", ["AMI"])).toEqual({ text: "AMI", start: 0 });
    expect(stripKnown("SOLEIL", ["SOL"])).toEqual({ text: "EIL", start: 3 });
    expect(stripKnown("CHAT", [])).toEqual({ text: "CHAT", start: 0 });
  });

  it("SOLEIL après SOL : le texte brut est évalué d'abord (trouvé, pas collé)", () => {
    const w = flat();
    write(w, "SOLEIL", 8, 4, 10);
    const s = evaluateWriting(w, SOUTH, "SOLEIL", SOUTH, ["SOL"]);
    expect(s.found?.text).toBe("SOLEIL");
    expect(s.glued).toBe(false);
    // Collé derrière SOL : le noyau intermédiaire SOLEIL compte (avant EIL).
    const w2 = flat();
    write(w2, "SOLSOLEIL", 5, 4, 10);
    const s2 = evaluateWriting(w2, SOUTH, "SOLEIL", SOUTH, ["SOL"]);
    expect(s2.found?.cells[0]).toEqual([8, 4, 10]);
    expect(s2.glued).toBe(true);
  });
});

describe("evaluateWriting", () => {
  it("mot écrit de droite à gauche vu de l'enfant : trouvé, mais pas de son côté", () => {
    const w = flat();
    write(w, "TAHC", 10, 4, 10); // se lit CHAT depuis −Z
    const s = evaluateWriting(w, SOUTH, "CHAT", SOUTH, []);
    expect(s.found?.text).toBe("CHAT");
    expect(s.found?.dir).toEqual([-1, 0, 0]);
    expect(s.foundFacing).toBe(false);
  });

  it("deux lettres justes lisibles seulement de l'autre côté : reversed", () => {
    const w = flat();
    write(w, "HC", 10, 4, 10);
    const s = evaluateWriting(w, SOUTH, "CHAT", SOUTH, []);
    expect(s.found).toBeNull();
    expect(s.best?.match.have).toBe(0);
    expect(s.reversed).toBe(true);
    // Écrit dans le bon sens : pas de reversed.
    const w2 = flat();
    write(w2, "CH", 10, 4, 10);
    expect(evaluateWriting(w2, SOUTH, "CHAT", SOUTH, []).reversed).toBe(false);
  });

  it("mot collé à un mot déjà écrit : trouvé, collé, cases réduites au mot", () => {
    const w = flat();
    write(w, "AMILUNE", 5, 4, 10);
    const s = evaluateWriting(w, SOUTH, "LUNE", SOUTH, ["AMI"]);
    expect(s.found?.text).toBe("LUNE");
    expect(s.found?.cells).toEqual([
      [8, 4, 10],
      [9, 4, 10],
      [10, 4, 10],
      [11, 4, 10],
    ]);
    expect(s.glued).toBe(true);
    // Avec un espace : trouvé, pas collé.
    const w2 = flat();
    write(w2, "AMI", 4, 4, 10);
    write(w2, "LUNE", 8, 4, 10);
    const s2 = evaluateWriting(w2, SOUTH, "LUNE", SOUTH, ["AMI"]);
    expect(s2.found?.text).toBe("LUNE");
    expect(s2.glued).toBe(false);
  });

  it("mot collé à l'arrière d'un mot déjà écrit (lu à l'envers de ce côté) : trouvé, collé, de face", () => {
    const w = flat();
    // AMI en x = 10 à 12 (lu depuis +Z) ; depuis le nord, la rangée se lit IMA puis LUNE (de x = 9 à 6).
    write(w, "ENULAMI", 6, 4, 10);
    const north = { x: 9.5, y: 4, z: 5 };
    const s = evaluateWriting(w, north, "LUNE", north, ["AMI"]);
    expect(s.found?.text).toBe("LUNE");
    expect(s.found?.cells).toEqual([
      [9, 4, 10],
      [8, 4, 10],
      [7, 4, 10],
      [6, 4, 10],
    ]);
    expect(s.glued).toBe(true);
    expect(s.foundFacing).toBe(true);
  });

  it("lettre en trop après un mot collé : le meilleur essai est le noyau, même près du mot déjà écrit", () => {
    const w = flat();
    write(w, "AMILUNES", 5, 4, 10);
    for (const x of [8.5, 11.5]) {
      const viewer = { x, y: 4, z: 15 };
      const s = evaluateWriting(w, viewer, "LUNE", viewer, ["AMI"]);
      expect(s.found, `x = ${x}`).toBeNull();
      expect(s.best?.reading.text, `x = ${x}`).toBe("LUNES");
      expect(s.best?.match).toEqual({ kind: "extra", have: 4 });
    }
  });

  it("mot écrit de droite à gauche contre un bloc (sa face de lecture cachée derrière) : reversed, pas hidden", () => {
    const w = flat();
    write(w, "IMA", 10, 4, 10); // AMI se lit depuis −Z, où une pierre cache une lettre
    w.set(11, 4, 9, BlockId.Stone);
    const s = evaluateWriting(w, SOUTH, "AMI", SOUTH, []);
    expect(s.found).toBeNull();
    expect(s.hidden).toBe(false);
    expect(s.reversed).toBe(true);
    // Sans la pierre : trouvé, lu de l'autre côté.
    w.set(11, 4, 9, BlockId.Air);
    expect(evaluateWriting(w, SOUTH, "AMI", SOUTH, [])).toMatchObject({ foundFacing: false, hidden: false });
    // Lettres cachées des deux côtés : hidden, d'où que l'on regarde.
    for (let x = 10; x <= 12; x++) {
      w.set(x, 4, 9, BlockId.Stone);
      w.set(x, 4, 11, BlockId.Stone);
    }
    expect(evaluateWriting(w, SOUTH, "AMI", SOUTH, [])).toMatchObject({ found: null, hidden: true, reversed: false });
  });

  it("mot couvert par des blocs : hidden, pas trouvé", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 10);
    for (let x = 10; x <= 13; x++) w.set(x, 4, 11, BlockId.Stone);
    const s = evaluateWriting(w, SOUTH, "CHAT", SOUTH, []);
    expect(s.found).toBeNull();
    expect(s.hidden).toBe(true);
    // Une seule face couverte suffit à le cacher.
    const w2 = flat();
    write(w2, "CHAT", 10, 4, 10);
    w2.set(12, 4, 11, BlockId.Planks);
    expect(evaluateWriting(w2, SOUTH, "CHAT", SOUTH, []).hidden).toBe(true);
    // Derrière une vitre : lisible.
    w2.set(12, 4, 11, BlockId.Glass);
    expect(evaluateWriting(w2, SOUTH, "CHAT", SOUTH, []).found?.text).toBe("CHAT");
  });

  it("deux mots trouvés : celui qui fait face à l'enfant d'abord, même plus loin", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 4); // lu depuis +Z : face à l'enfant, loin
    write(w, "TAHC", 10, 4, 12); // lu depuis −Z : dos à l'enfant, proche
    const s = evaluateWriting(w, SOUTH, "CHAT", SOUTH, []);
    expect(s.found?.cells[0]).toEqual([10, 4, 4]);
    expect(s.foundFacing).toBe(true);
  });

  it("meilleure tentative : le plus long début juste, puis la plus proche", () => {
    const w = flat();
    write(w, "LA", 10, 4, 10); // proche
    write(w, "LAP", 10, 4, 4); // plus loin, plus avancé
    const s = evaluateWriting(w, SOUTH, "LAPIN", SOUTH, []);
    expect(s.best?.match).toEqual({ kind: "prefix", have: 3 });
    expect(s.best?.reading.cells[0]).toEqual([10, 4, 4]);

    const w2 = flat();
    write(w2, "LA", 10, 4, 4);
    write(w2, "LA", 10, 4, 10);
    const s2 = evaluateWriting(w2, SOUTH, "LAPIN", SOUTH, []);
    expect(s2.best?.match.have).toBe(2);
    expect(s2.best?.reading.cells[0]).toEqual([10, 4, 10]);
  });

  it("un mot déjà écrit n'est pas un essai pour le mot suivant", () => {
    const w = flat();
    write(w, "LAC", 10, 4, 10);
    // Vu de l'autre côté, LAC se lit CAL ; avec LAPIN à écrire, ni essai ni « à l'envers ».
    const s = evaluateWriting(w, SOUTH, "LAPIN", { x: 11.5, z: 5 }, ["LAC"]);
    expect(s.best).toBeNull();
    expect(s.reversed).toBe(false);
  });

  it("la boîte lit toute rangée dont une case est à portée", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 10);
    expect(evaluateWriting(w, { x: 25.5, y: 4, z: 10.5 }, "CHAT", { x: 25.5, z: 15 }, []).found?.text).toBe("CHAT");
    expect(evaluateWriting(w, { x: 26.5, y: 4, z: 10.5 }, "CHAT", { x: 26.5, z: 15 }, []).found).toBeNull();
  });
});

describe("case suivante et cases claires", () => {
  it("nextCell : case libre après la dernière lettre juste", () => {
    const w = flat();
    write(w, "LA", 10, 4, 10);
    const s = evaluateWriting(w, SOUTH, "LAPIN", SOUTH, []);
    expect(nextCell(w, s.best!.reading, 2)).toEqual({ cell: [12, 4, 10], free: true });
    expect(nextCell(w, s.best!.reading, 0)).toBeNull();
  });

  it("nextCell : la case de la mauvaise lettre n'est pas libre", () => {
    const w = flat();
    write(w, "LAM", 10, 4, 10);
    const s = evaluateWriting(w, SOUTH, "LAPIN", SOUTH, []);
    expect(s.best?.match).toEqual({ kind: "wrong", have: 2, got: "M", want: "P" });
    expect(nextCell(w, s.best!.reading, 2)).toEqual({ cell: [12, 4, 10], free: false });
  });

  it("nextCell : hors du monde → null", () => {
    const w = flat();
    write(w, "LA", 30, 4, 10); // x = 30 et 31 : la suite sortirait du monde
    const r = readingsThrough(w, 30, 4, 10)[0]!;
    expect(r.text).toBe("LA");
    expect(nextCell(w, r, 2)).toBeNull();
  });

  it("ghostCells : les cases des lettres restantes, jusqu'à la première case pleine", () => {
    const w = flat();
    write(w, "LA", 10, 4, 10);
    const r = readingsThrough(w, 10, 4, 10)[0]!;
    expect(ghostCells(w, r, 2, 5)).toEqual([
      [12, 4, 10],
      [13, 4, 10],
      [14, 4, 10],
    ]);
    w.set(13, 4, 10, BlockId.Stone);
    expect(ghostCells(w, r, 2, 5)).toEqual([[12, 4, 10]]);
    expect(ghostCells(w, r, 0, 5)).toEqual([]);
  });
});

describe("planLine : où écrire quand rien n'est encore posé", () => {
  const feet = { x: 16.5, y: 4, z: 16.5 };
  const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.3];

  it("4 orientations : une ligne au sol, à une même hauteur, lue de gauche à droite par l'enfant", () => {
    for (const yaw of yaws) {
      const w = flat();
      const plan = planLine(w, feet, yaw, 4, 60, aimFrom(feet));
      expect(plan, `yaw ${yaw}`).not.toBeNull();
      const { cells, dir } = plan!;
      expect(cells).toHaveLength(4);
      // Le sens de lecture est la droite de l'enfant (caméra : avant (−sin, −cos), droite (cos, −sin)).
      expect(dir[0]).toBe(Math.round(Math.cos(yaw)) || 0);
      expect(dir[2]).toBe(Math.round(-Math.sin(yaw)) || 0);
      for (let i = 0; i < cells.length; i++) {
        const [x, y, z] = cells[i]!;
        expect(y).toBe(4);
        expect(w.get(x, y, z)).toBe(BlockId.Air);
        expect(isOpaqueId(w.get(x, y - 1, z))).toBe(true);
        expect([x, z]).toEqual([cells[0]![0] + dir[0] * i, cells[0]![2] + dir[2] * i]);
      }
      // Écrit dans ces cases, le mot est trouvé, face à l'enfant.
      cells.forEach(([x, y, z], i) => w.set(x, y, z, letterBlockId("LUNE".charAt(i))!));
      const s = evaluateWriting(w, feet, "LUNE", feet, []);
      expect(s.found?.text, `yaw ${yaw}`).toBe("LUNE");
      expect(s.foundFacing).toBe(true);
    }
  });

  it("un mot de 4 lettres tient dans un champ de 60°", () => {
    for (const yaw of yaws.slice(0, 4)) {
      const w = flat();
      const { cells } = planLine(w, feet, yaw, 4, 60, aimFrom(feet))!;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      for (const [x, , z] of cells) {
        for (const [cx, cz] of [
          [x, z],
          [x + 1, z],
          [x, z + 1],
          [x + 1, z + 1],
        ] as const) {
          const vx = cx - feet.x;
          const vz = cz - feet.z;
          const angle = (Math.acos((vx * fx + vz * fz) / Math.hypot(vx, vz)) * 180) / Math.PI;
          expect(angle).toBeLessThanOrEqual(30);
        }
      }
    }
  });

  it("sol plus bas d'un cran devant l'enfant : la ligne descend d'un cran", () => {
    const w = flat();
    for (let x = 0; x < 32; x++) for (let z = 0; z <= 13; z++) w.set(x, 3, z, BlockId.Air);
    const plan = planLine(w, feet, 0, 4, 60, aimFrom(feet))!;
    expect(plan.cells.every((c) => c[1] === 3)).toBe(true);
  });

  /** Écrit `text` dans les cases de la ligne, puis vérifie qu'il est trouvé de face, dans ces cases-là. */
  function writeOnLine(w: World, plan: { cells: readonly (readonly [number, number, number])[] }, text: string, at = feet, previous: string[] = []) {
    plan.cells.forEach(([x, y, z], i) => w.set(x, y, z, letterBlockId(text.charAt(i))!));
    const s = evaluateWriting(w, at, text, at, previous);
    expect(s.found?.text, text).toBe(text);
    expect(s.foundFacing, text).toBe(true);
    expect(s.found?.cells, text).toEqual(plan.cells);
    return s;
  }

  it("rigole d'un cran sous la ligne : pas de ligne au fond (la face de lecture serait cachée), le mot est lisible", () => {
    const w = flat();
    for (let x = 0; x < 32; x++) w.set(x, 3, 11, BlockId.Air); // la rangée z = 11, où irait la ligne
    const plan = planLine(w, feet, 0, 4, 60, aimFrom(feet))!;
    expect(plan).not.toBeNull();
    for (const [x, y, z] of plan.cells) {
      expect(y).toBe(4);
      expect(isOpaqueId(w.get(x, y, z + 1))).toBe(false); // côté enfant (+Z) : la face se dessine
    }
    writeOnLine(w, plan, "LUNE");
  });

  it("tronc juste devant une case : la ligne recule, le mot est lisible", () => {
    const w = flat();
    w.set(16, 4, 12, BlockId.Log);
    w.set(16, 5, 12, BlockId.Log);
    const plan = planLine(w, feet, 0, 4, 60, aimFrom(feet))!;
    expect(plan.cells.some(([x, , z]) => x === 16 && z === 11)).toBe(false);
    writeOnLine(w, plan, "LUNE");
  });

  it("lettre juste derrière une case, ou au bout de la ligne : la ligne s'en écarte, chaque lettre posée est un début juste", () => {
    // Sans écart, la ligne irait en z = 11, x = 15 à 18.
    for (const [x, z] of [
      [15, 10], // derrière la première case
      [14, 11], // avant la première case
      [19, 11], // après la dernière
    ] as const) {
      const w = flat();
      w.set(x, 4, z, letterBlockId("Q")!);
      const plan = planLine(w, feet, 0, 4, 60, aimFrom(feet))!;
      expect(plan, `Q en ${x}, ${z}`).not.toBeNull();
      plan.cells.forEach(([cx, cy, cz], i) => {
        w.set(cx, cy, cz, letterBlockId("LUNE".charAt(i))!);
        const s = evaluateWriting(w, feet, "LUNE", feet, []);
        if (i < 3) expect(s.best?.match, `Q en ${x}, ${z} : ${i + 1} lettre(s)`).toEqual({ kind: "prefix", have: i + 1 });
        else expect(s.found?.cells, `Q en ${x}, ${z}`).toEqual(plan.cells);
      });
    }
  });

  /**
   * L'enfant, l'œil à 1,62 au-dessus des pieds, peut-il poser un bloc dans la case c (règles du jeu, Game.placeLetter :
   * la visée touche à portée un bloc voisin de c par sa face tournée vers c ; si le bloc touché est une fleur, la
   * lettre se pose à sa place) ? Indépendant du moteur : une grille de 7 × 7 points sur chaque face voisine. `filled` :
   * lettres déjà posées (comptées comme des blocs pleins).
   */
  function canPlaceIn(w: World, at: { x: number; y: number; z: number }, c: readonly [number, number, number], filled: readonly (readonly [number, number, number])[] = []): boolean {
    const eye = { x: at.x, y: at.y + PLAYER.eyeHeight, z: at.z };
    const isFilled = (x: number, y: number, z: number) => filled.some((f) => f[0] === x && f[1] === y && f[2] === z);
    const targets = { isTargetable: (x: number, y: number, z: number) => isFilled(x, y, z) || w.isTargetable(x, y, z) };
    const [x, y, z] = c;
    const grid = [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9];
    for (const [ox, oy, oz] of [
      [0, -1, 0],
      [0, 1, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as const) {
      if (!targets.isTargetable(x + ox, y + oy, z + oz)) continue;
      for (const u of grid) {
        for (const v of grid) {
          const p =
            ox !== 0
              ? { x: x + (ox > 0 ? 1 : 0), y: y + u, z: z + v }
              : oy !== 0
                ? { x: x + u, y: y + (oy > 0 ? 1 : 0), z: z + v }
                : { x: x + u, y: y + v, z: z + (oz > 0 ? 1 : 0) };
          const hit = raycast(targets, eye, { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z }, REACH);
          if (!hit) continue;
          // Une fleur touchée : la lettre prend sa place (dans c seulement si c'est la fleur de c).
          const onPlant = !isFilled(hit.x, hit.y, hit.z) && isPlantId(w.get(hit.x, hit.y, hit.z));
          const put = onPlant ? [hit.x, hit.y, hit.z] : [hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz];
          if (put[0] === x && put[1] === y && put[2] === z) return true;
        }
      }
    }
    return false;
  }

  /** Chaque case de la ligne se pose depuis `at`, lettre après lettre, de gauche à droite (les précédentes posées). */
  function expectReachable(w: World, at: { x: number; y: number; z: number }, cells: readonly (readonly [number, number, number])[], label: string) {
    cells.forEach((c, i) => expect(canPlaceIn(w, at, c, cells.slice(0, i)), `${label} : case ${i + 1} (${c.join(", ")})`).toBe(true));
  }

  it("ligne libre, champ étroit : chaque case est à portée de la visée (pas au-delà de REACH)", () => {
    for (const hfov of [60, 40]) {
      for (const yaw of yaws) {
        const plan = planLine(flat(), feet, yaw, 4, hfov, aimFrom(feet))!;
        expect(plan, `champ ${hfov}°, cap ${yaw}`).not.toBeNull();
        expectReachable(flat(), feet, plan.cells, `champ ${hfov}°, cap ${yaw}`);
      }
    }
  });

  it("mur juste devant l'enfant, sol libre derrière : pas de ligne cachée derrière le mur (null, la consigne seule)", () => {
    const w = flat();
    for (let x = 0; x < 32; x++) for (let y = 4; y <= 6; y++) w.set(x, y, 13, BlockId.Stone);
    expect(planLine(w, feet, 0, 4, 60, aimFrom(feet))).toBeNull();
  });

  it("mot 2 après le mot 1 écrit devant, depuis la même place : pas de ligne derrière le mot 1 ; en tournant la tête, une ligne qui se vise et se lit", () => {
    // Le cas relevé : SOL écrit à 4 blocs, puis PUMA, que la ligne mettait juste derrière SOL (cachée, hors de portée).
    for (const yaw of [Math.PI, 0, Math.PI / 2, -Math.PI / 2]) {
      const label = `cap ${yaw.toFixed(2)}`;
      const w = flat();
      const first = planLine(w, feet, yaw, 3, 60, aimFrom(feet))!;
      writeOnLine(w, first, "SOL");
      // Même regard : soit rien (consigne seule), soit une ligne dont chaque case se vise d'ici.
      const same = planLine(w, feet, yaw, 4, 60, aimFrom(feet));
      if (same) expectReachable(w, feet, same.cells, `${label}, même regard`);
      // La tête tournée d'un quart de tour, d'un côté ou de l'autre : une ligne qui se vise, et PUMA s'y lit.
      for (const turn of [Math.PI / 2, -Math.PI / 2]) {
        const v = flat();
        writeOnLine(v, first, "SOL");
        const plan = planLine(v, feet, yaw + turn, 4, 60, aimFrom(feet));
        expect(plan, `${label}, tourné de ${turn.toFixed(2)}`).not.toBeNull();
        expectReachable(v, feet, plan!.cells, `${label}, tourné de ${turn.toFixed(2)}`);
        writeOnLine(v, plan!, "PUMA", feet, ["SOL"]);
      }
    }
  });

  it("regard en biais (25° à droite de l'axe), un mot déjà écrit au milieu : la ligne se décale du côté du regard, sa première case dans le champ", () => {
    const w = flat();
    // Un mot de 3 lettres à 3 blocs, au milieu (x 15 à 17, z = 13), l'enfant en (16,5 ; 16,5).
    write(w, "SOL", 15, 4, 13);
    const yaw = (-25 * Math.PI) / 180; // la droite de l'enfant est +X
    const plan = planLine(w, feet, yaw, 3, 60, aimFrom(feet));
    expect(plan).not.toBeNull();
    expectReachable(w, feet, plan!.cells, "en biais");
    const [x0, , z0] = plan!.cells[0]!;
    const vx = x0 + 0.5 - feet.x;
    const vz = z0 + 0.5 - feet.z;
    const angle = (Math.acos((vx * -Math.sin(yaw) + vz * -Math.cos(yaw)) / Math.hypot(vx, vz)) * 180) / Math.PI;
    expect(angle).toBeLessThanOrEqual(30);
    expect(x0).toBeGreaterThan(17);
    writeOnLine(w, plan!, "AMI", feet, ["SOL"]);
  });

  it("enchaînement depuis la même place : AMI, puis LUNE, puis LOUP, chaque case visée et posée depuis là, lettre après lettre, et trouvé", () => {
    for (const hfov of [60, 40]) {
      for (const yaw0 of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const label = `champ ${hfov}°, cap ${yaw0.toFixed(2)}`;
        const w = flat();
        const previous: string[] = [];
        for (const word of ["AMI", "LUNE", "LOUP"]) {
          // Pas de ligne là où il regarde (mots déjà écrits devant) : l'enfant tourne la tête, sans bouger les pieds.
          let plan: ReturnType<typeof planLine> = null;
          for (const turn of [0, -15, 15, -30, 30, -45, 45, -60, 60, -90, 90]) {
            plan = planLine(w, feet, yaw0 + (turn * Math.PI) / 180, word.length, hfov, aimFrom(feet));
            if (plan) break;
          }
          expect(plan, `${label} : ${word}`).not.toBeNull();
          // Aucune case sur une lettre ni contre une lettre : la ligne ne touche pas les mots déjà écrits.
          for (const [x, y, z] of plan!.cells) {
            expect(isLetterId(w.get(x, y - 1, z)), `${label} : ${word}`).toBe(false);
          }
          // Chaque case se vise depuis l'œil, à portée, avec les lettres d'avant déjà posées.
          expectReachable(w, feet, plan!.cells, `${label} : ${word}`);
          // Lettre après lettre : chaque lettre posée dans sa case compte (début juste qui s'allonge).
          plan!.cells.forEach(([x, y, z], i) => {
            w.set(x, y, z, letterBlockId(word.charAt(i))!);
            const s = evaluateWriting(w, feet, word, feet, previous);
            if (i < word.length - 1) expect(s.best?.match.have, `${label} : ${word.slice(0, i + 1)}`).toBe(i + 1);
          });
          writeOnLine(w, plan!, word, feet, previous);
          previous.push(word);
        }
      }
    }
  });

  /** Angle (degrés, à plat) entre le regard de cap `yaw` et le milieu de la case c, vu de `at`. */
  const angleTo = (at: { x: number; z: number }, yaw: number, c: readonly [number, number, number]) => {
    const vx = c[0] + 0.5 - at.x;
    const vz = c[2] + 0.5 - at.z;
    return (Math.acos((vx * -Math.sin(yaw) + vz * -Math.cos(yaw)) / Math.hypot(vx, vz)) * 180) / Math.PI;
  };

  it("mot long (8 à 10 lettres, le prénom) regardé droit devant, sol plat : une ligne devant l'enfant, posable case après case, en partie dans le champ, lue de face", () => {
    // Le cas relevé : MAXIMILIEN, regard droit devant, aucune ligne (la première case, à portée, sort du champ de 60°).
    const at = { x: 16.5, y: 4, z: 16.5 };
    for (const name of ["MATHILDE", "CHARLOTTE", "MAXIMILIEN"]) {
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const label = `${name}, cap ${yaw.toFixed(2)}`;
        const w = flat();
        const plan = planLine(w, at, yaw, name.length, 60, aimFrom(at));
        expect(plan, label).not.toBeNull();
        expect(plan!.cells, label).toHaveLength(name.length);
        // Devant lui, sur l'axe du regard, et au moins une case dans le champ.
        for (const [x, , z] of plan!.cells) expect((x + 0.5 - at.x) * -Math.sin(yaw) + (z + 0.5 - at.z) * -Math.cos(yaw), label).toBeGreaterThan(1);
        expect(Math.min(...plan!.cells.map((c) => angleTo(at, yaw, c))), label).toBeLessThanOrEqual(30);
        expectReachable(w, at, plan!.cells, label);
        writeOnLine(w, plan!, name, at);
      }
    }
  });

  it("mot long, regard en biais (10° à 45° d'un côté ou de l'autre) : toujours une ligne posable, et en biais d'au moins 30°, sa première case près du regard", () => {
    const at = { x: 16.5, y: 4, z: 16.5 };
    for (const deg of [-45, -40, -30, -20, -10, 10, 20, 30, 40, 45]) {
      const yaw = (deg * Math.PI) / 180;
      const label = `MAXIMILIEN, regard à ${deg}°`;
      const w = flat();
      const plan = planLine(w, at, yaw, 10, 60, aimFrom(at));
      expect(plan, label).not.toBeNull();
      expect(Math.min(...plan!.cells.map((c) => angleTo(at, yaw, c))), label).toBeLessThanOrEqual(30);
      if (Math.abs(deg) >= 30) expect(angleTo(at, yaw, plan!.cells[0]!), label).toBeLessThanOrEqual(30);
      expectReachable(w, at, plan!.cells, label);
      writeOnLine(w, plan!, "MAXIMILIEN", at);
    }
  });

  it("canAimAt : une fleur voisine n'est pas un appui (le jeu pose la lettre à la place de la fleur, à côté de la case)", () => {
    // Le cas relevé : une fleur juste devant la case cache le sol ; la visée touche cette fleur par sa face tournée
    // vers la case, mais le jeu pose alors la lettre à la place de la fleur.
    const at = { x: 16.5, y: 4, z: 16.5 };
    const cell = [16, 4, 13] as const;
    const w = flat();
    for (const [x, z] of [
      [16, 14],
      [15, 13],
      [17, 13],
      [16, 12],
    ] as const)
      w.set(x, 4, z, BlockId.FlowerRed);
    expect(canPlaceIn(w, at, cell)).toBe(false);
    expect(canAimAt(w, aimFrom(at), [...cell])).toBe(false);
    // La même case, des pierres à la place des fleurs : elles sont des appuis.
    const stones = flat();
    for (const [x, z] of [
      [16, 14],
      [15, 13],
      [17, 13],
      [16, 12],
    ] as const)
      stones.set(x, 4, z, BlockId.Stone);
    expect(canPlaceIn(stones, at, cell)).toBe(true);
    expect(canAimAt(stones, aimFrom(at), [...cell])).toBe(true);
    // Une fleur dans la case elle-même : la viser, c'est poser à sa place.
    const own = flat();
    own.set(16, 4, 13, BlockId.FlowerYellow);
    expect(canAimAt(own, aimFrom(at), [...cell])).toBe(true);
  });

  it("prairie, graine 2 (cas relevé) : la ligne ne compte plus sur une fleur voisine, chaque case se pose", () => {
    const w = generateWorld("prairie", 2).world;
    const at = { x: 55.5, y: 23, z: 73.5 };
    // La case (57, 23, 78) avait une fleur pour seul appui visable (en +x) : elle n'est plus jugée posable d'ici.
    expect(isPlantId(w.get(58, 23, 78))).toBe(true);
    expect(canAimAt(w, aimFrom(at), [57, 23, 78])).toBe(false);
    expect(canPlaceIn(w, at, [57, 23, 78])).toBe(false);
    const plan = planLine(w, at, 3.65, 5, 60, aimFrom(at));
    expect(plan).not.toBeNull();
    expectReachable(w, at, plan!.cells, "prairie 2");
  });

  it("mondes générés : chaque ligne proposée se pose case après case selon la règle du jeu (fleurs comprises), et le mot s'y lit de face", () => {
    let lines = 0;
    const WORD = "MAXIMILIEN";
    for (const type of ["prairie", "desert"] as const) {
      for (const seed of [1, 2, 3]) {
        const w = generateWorld(type, seed).world;
        for (let k = 0; k < 40; k++) {
          const bx = 6 + ((k * 37) % (w.sizeX - 12));
          const bz = 6 + ((k * 53) % (w.sizeZ - 12));
          // Pieds sur le premier bloc solide sous le ciel.
          let y = w.sizeY - 2;
          while (y > 1 && !(isOpaqueId(w.get(bx, y - 1, bz)) && w.get(bx, y, bz) === BlockId.Air && w.get(bx, y + 1, bz) === BlockId.Air)) y--;
          if (y <= 1) continue;
          const at = { x: bx + 0.5, y, z: bz + 0.5 };
          for (const [i, yaw] of [0, 1.1, 2.3, -2, 3.65].entries()) {
            const len = 3 + ((k + i) % 8);
            const plan = planLine(w, at, yaw, len, 60, aimFrom(at));
            if (!plan) continue;
            lines++;
            const label = `${type} ${seed}, pieds ${bx},${y},${bz}, cap ${yaw}, ${len} lettres`;
            expectReachable(w, at, plan.cells, label);
            // Écrit dans ses cases, le mot se lit de face, dans ces cases-là ; puis le monde est remis comme avant.
            const word = WORD.slice(0, len);
            const before = plan.cells.map(([x, cy, z]) => w.get(x, cy, z));
            plan.cells.forEach(([x, cy, z], i) => w.set(x, cy, z, letterBlockId(word.charAt(i))!));
            const s = evaluateWriting(w, at, word, at, []);
            expect(s.found?.cells, label).toEqual(plan.cells);
            expect(s.foundFacing, label).toBe(true);
            plan.cells.forEach(([x, cy, z], i) => w.set(x, cy, z, before[i]!));
          }
        }
      }
    }
    expect(lines).toBeGreaterThan(100);
  });

  it("aucune place (vide, mur, eau) : null", () => {
    expect(planLine(new World(32, 16, 32), feet, 0, 4, 60, aimFrom(feet))).toBeNull();

    const wall = flat();
    for (let x = 0; x < 32; x++) for (let z = 0; z <= 14; z++) for (let y = 4; y <= 5; y++) wall.set(x, y, z, BlockId.Stone);
    expect(planLine(wall, feet, 0, 4, 60, aimFrom(feet))).toBeNull();

    const sea = flat();
    for (let x = 0; x < 32; x++) for (let z = 0; z <= 14; z++) sea.set(x, 4, z, BlockId.Water);
    expect(planLine(sea, feet, 0, 4, 60, aimFrom(feet))).toBeNull();
  });
});

describe("presentWords", () => {
  it("les mots du monde dans les deux sens et les colonnes, pas les lettres seules", () => {
    const w = flat();
    write(w, "CHAT", 10, 4, 10);
    write(w, "LA", 20, 5, 20, [0, -1, 0]); // colonne : L en haut
    write(w, "X", 5, 4, 5);
    expect(presentWords(w)).toEqual(new Set(["CHAT", "TAHC", "LA"]));
  });
});
