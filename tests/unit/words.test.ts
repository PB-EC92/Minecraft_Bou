import { describe, expect, it } from "vitest";
import { BlockId, isLetterId, isOpaqueId, letterBlockId, letterChar, LETTERS } from "../../src/engine/blocks";
import {
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
import { World } from "../../src/engine/World";

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
      const plan = planLine(w, feet, yaw, 4, 60);
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
      const { cells } = planLine(w, feet, yaw, 4, 60)!;
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
    const plan = planLine(w, feet, 0, 4, 60)!;
    expect(plan.cells.every((c) => c[1] === 3)).toBe(true);
  });

  it("aucune place (vide, mur, eau) : null", () => {
    expect(planLine(new World(32, 16, 32), feet, 0, 4, 60)).toBeNull();

    const wall = flat();
    for (let x = 0; x < 32; x++) for (let z = 0; z <= 14; z++) for (let y = 4; y <= 5; y++) wall.set(x, y, z, BlockId.Stone);
    expect(planLine(wall, feet, 0, 4, 60)).toBeNull();

    const sea = flat();
    for (let x = 0; x < 32; x++) for (let z = 0; z <= 14; z++) sea.set(x, 4, z, BlockId.Water);
    expect(planLine(sea, feet, 0, 4, 60)).toBeNull();
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
