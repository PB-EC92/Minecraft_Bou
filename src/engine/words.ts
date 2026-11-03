import { BlockId, isLetterId, isOpaqueId, isPlantId, isSolidId, isTargetableId, letterChar } from "./blocks";
import { raycast, type Targets, type Vec3 } from "./raycast";

/**
 * Lecture des mots écrits en blocs-lettres (mission 2 « Les mots », V2 lot 1). Pur : ni DOM, ni Three.js.
 *
 * Un bloc-lettre porte sa lettre sur ses quatre côtés (dessus et dessous en planches). Sur une face latérale,
 * la coordonnée u de la texture croît vers la droite de qui se tient devant : la lettre n'est jamais en miroir.
 * Une rangée de lettres se lit donc dans un sens depuis un côté, et dans l'autre sens depuis le côté opposé :
 * - rangée sur X : vers +X depuis le côté +Z, vers −X depuis le côté −Z ;
 * - rangée sur Z : vers +Z depuis le côté −X, vers −Z depuis le côté +X ;
 * - dans tous les cas, le côté de lecture vaut n = (−dz, dx) pour un sens (dx, dz) ;
 * - une colonne (au moins deux lettres empilées) se lit de haut en bas, d'où que l'on regarde ;
 * - une lettre seule (sans voisine sur X ni sur Z) donne les quatre lectures d'une lettre : elles servent au
 *   meilleur essai (`best`), jamais à valider un mot.
 * Une suite de lettres s'arrête au premier bloc qui n'est pas une lettre (air, eau, pierre…) : c'est l'espace
 * entre deux mots.
 */

/** Case du monde (x, y, z). */
export type Cell = readonly [number, number, number];

/** Ce que le moteur lit du monde (World convient). Hors du monde, `get` n'est jamais appelé. */
export interface BlockReader {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  get(x: number, y: number, z: number): number;
}

/** Sens de lecture : un pas d'une lettre à la suivante. */
export type Dir = readonly [dx: -1 | 0 | 1, dy: -1 | 0 | 1, dz: -1 | 0 | 1];

/** Une lecture : le texte, ses cases dans l'ordre de lecture, le sens, et le côté d'où on la lit (null : colonne). */
export interface Reading {
  text: string;
  cells: readonly Cell[];
  dir: Dir;
  side: { nx: number; nz: number } | null;
}

/** Un mot compte à partir de deux lettres. */
export const MIN_WORD = 2;

type Axis = "x" | "y" | "z";

const STEP: Readonly<Record<Axis, Dir>> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const BACK: Readonly<Record<Axis, Dir>> = { x: [-1, 0, 0], y: [0, -1, 0], z: [0, 0, -1] };
/** Les quatre côtés d'une colonne. */
const SIDES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inWorld(w: BlockReader, x: number, y: number, z: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < w.sizeX && y < w.sizeY && z < w.sizeZ;
}

function letterAt(w: BlockReader, x: number, y: number, z: number): boolean {
  return inWorld(w, x, y, z) && isLetterId(w.get(x, y, z));
}

function textOf(w: BlockReader, cells: readonly Cell[]): string {
  let s = "";
  for (const [x, y, z] of cells) s += letterChar(w.get(x, y, z)) ?? "";
  return s;
}

function reverse(s: string): string {
  return Array.from(s).reverse().join("");
}

/** Longueur du début commun de deux textes. */
function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/** Côté d'où se lit une rangée parcourue dans le sens (dx, dz) : n = (−dz, dx) (jamais −0). */
export function readingSide(dx: number, dz: number): { nx: number; nz: number } {
  return { nx: dz === 0 ? 0 : -dz, nz: dx === 0 ? 0 : dx };
}

function makeReading(w: BlockReader, cells: readonly Cell[], dir: Dir): Reading {
  return { text: textOf(w, cells), cells, dir, side: dir[1] !== 0 ? null : readingSide(dir[0], dir[2]) };
}

/**
 * Suite maximale de lettres passant par (x, y, z) le long d'un axe, par coordonnée croissante. Elle s'arrête au
 * bord du monde et au premier bloc qui n'est pas une lettre. Case de départ sans lettre : [].
 */
export function letterRun(w: BlockReader, x: number, y: number, z: number, axis: "x" | "y" | "z"): Cell[] {
  if (!letterAt(w, x, y, z)) return [];
  const [ax, ay, az] = STEP[axis];
  let back = 0;
  while (letterAt(w, x - ax * (back + 1), y - ay * (back + 1), z - az * (back + 1))) back++;
  const cells: Cell[] = [];
  for (let i = -back; letterAt(w, x + ax * i, y + ay * i, z + az * i); i++) cells.push([x + ax * i, y + ay * i, z + az * i]);
  return cells;
}

/** Les deux lectures d'une rangée horizontale : dans le sens des coordonnées croissantes, puis à rebours. */
function horizontalPair(w: BlockReader, run: readonly Cell[], axis: "x" | "z"): Reading[] {
  return [makeReading(w, run, STEP[axis]), makeReading(w, [...run].reverse(), BACK[axis])];
}

/**
 * Lectures passant par la case (x, y, z) : rangée sur X (deux sens), rangée sur Z (deux sens), colonne de haut en
 * bas (si au moins deux lettres). Une rangée d'une seule lettre ne compte que si la lettre est seule sur X et sur Z
 * (quatre lectures d'une lettre). Case sans lettre : [].
 */
export function readingsThrough(w: BlockReader, x: number, y: number, z: number): Reading[] {
  if (!letterAt(w, x, y, z)) return [];
  const rx = letterRun(w, x, y, z, "x");
  const rz = letterRun(w, x, y, z, "z");
  const ry = letterRun(w, x, y, z, "y");
  const alone = rx.length === 1 && rz.length === 1;
  const out: Reading[] = [];
  if (rx.length >= MIN_WORD || alone) out.push(...horizontalPair(w, rx, "x"));
  if (rz.length >= MIN_WORD || alone) out.push(...horizontalPair(w, rz, "z"));
  if (ry.length >= MIN_WORD) out.push(makeReading(w, [...ry].reverse(), BACK.y));
  return out;
}

/** Toutes les lectures dont une case est dans la boîte [x0, x1] × [y0, y1] × [z0, z1] (déjà bornée au monde). */
function readingsInBox(w: BlockReader, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Reading[] {
  const out: Reading[] = [];
  const seen = new Set<string>();
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!isLetterId(w.get(x, y, z))) continue;
        for (const r of readingsThrough(w, x, y, z)) {
          const c = r.cells[0]!;
          const key = `${r.dir[0]},${r.dir[1]},${r.dir[2]}|${c[0]},${c[1]},${c[2]}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(r);
        }
      }
    }
  }
  return out;
}

/** Les faces des cases tournées vers (nx, nz) sont toutes dessinées : voisine dans le monde et non opaque. */
function sideVisible(w: BlockReader, cells: readonly Cell[], nx: number, nz: number): boolean {
  for (const [x, y, z] of cells) {
    const ax = x + nx;
    const az = z + nz;
    // Le maillage ne dessine pas les faces tournées vers l'extérieur du monde.
    if (ax < 0 || az < 0 || ax >= w.sizeX || az >= w.sizeZ) return false;
    if (isOpaqueId(w.get(ax, y, az))) return false;
  }
  return true;
}

/**
 * Lecture lisible : rangée, chaque face du côté de lecture est dessinée (voisine dans le monde, ni pleine ni
 * opaque : l'air, l'eau, les fleurs et le verre laissent lire) ; colonne, un des quatre côtés est visible en entier.
 */
export function isVisible(w: BlockReader, r: Reading): boolean {
  if (r.cells.length === 0) return false;
  if (r.side) return sideVisible(w, r.cells, r.side.nx, r.side.nz);
  return SIDES.some(([nx, nz]) => sideVisible(w, r.cells, nx, nz));
}

/** Centre horizontal des cases (milieu des blocs). */
function centre(r: Reading): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const c of r.cells) {
    x += c[0];
    z += c[2];
  }
  const n = Math.max(1, r.cells.length);
  return { x: x / n + 0.5, z: z / n + 0.5 };
}

/** L'enfant est du côté de lecture (toujours vrai pour une colonne). */
export function facesViewer(r: Reading, viewer: { x: number; z: number }): boolean {
  if (!r.side) return true;
  if (r.cells.length === 0) return false;
  const c = centre(r);
  return (viewer.x - c.x) * r.side.nx + (viewer.z - c.z) * r.side.nz > 0;
}

/** Noyaux successifs d'un texte dont on retire, au début ou à la fin, des mots connus (le plus long d'abord). */
function coreSteps(text: string, known: readonly string[]): { text: string; start: number }[] {
  const words = [...new Set(known)].filter((k) => k.length > 0).sort((a, b) => b.length - a.length);
  const out: { text: string; start: number }[] = [];
  let s = 0;
  let e = text.length;
  for (;;) {
    let cut = false;
    for (const k of words) {
      // Il doit rester au moins une lettre.
      if (e - s <= k.length) continue;
      if (text.startsWith(k, s)) {
        s += k.length;
        cut = true;
        break;
      }
      if (text.endsWith(k, e)) {
        e -= k.length;
        cut = true;
        break;
      }
    }
    if (!cut) return out;
    out.push({ text: text.slice(s, e), start: s });
  }
}

/**
 * Retire de façon répétée, au début ou à la fin du texte, tout mot déjà connu (le plus long d'abord), tant qu'il
 * reste au moins une lettre : « AMILUNE » avec [AMI] donne « LUNE ». start = décalage du noyau dans le texte.
 */
export function stripKnown(text: string, known: readonly string[]): { text: string; start: number } {
  const steps = coreSteps(text, known);
  return steps[steps.length - 1] ?? { text, start: 0 };
}

/** Comparaison d'un texte lu avec le mot attendu (avancement de l'enfant). */
export type WordMatch =
  | { kind: "exact"; have: number }
  /** Le texte commence par le mot (lettres en trop après). */
  | { kind: "extra"; have: number }
  /** Le mot est plus loin dans le texte (lettres en trop avant). */
  | { kind: "inside"; have: number; at: number }
  /** Tout le texte est le début du mot. */
  | { kind: "prefix"; have: number }
  /** Début commun de `have` lettres (au moins une), puis une lettre différente. */
  | { kind: "wrong"; have: number; got: string; want: string }
  | { kind: "none"; have: 0 };

export function matchWord(text: string, target: string): WordMatch {
  if (text.length === 0 || target.length === 0) return { kind: "none", have: 0 };
  if (text === target) return { kind: "exact", have: target.length };
  if (text.startsWith(target)) return { kind: "extra", have: target.length };
  const at = text.indexOf(target, 1);
  if (at > 0) return { kind: "inside", have: target.length, at };
  const p = commonPrefix(text, target);
  if (p === text.length) return { kind: "prefix", have: p };
  if (p >= 1) return { kind: "wrong", have: p, got: text.charAt(p), want: target.charAt(p) };
  return { kind: "none", have: 0 };
}

export type DiagnosisKind = "exact" | "prefix" | "missing" | "extra" | "wrong" | "swap" | "far";

/**
 * Écart entre un essai et le mot (dictée) : exact ; prefix (l'essai est le début du mot) ; missing (une lettre
 * manque ; at = première place possible) ; extra (une lettre en trop ; at = sa place) ; wrong (une seule lettre
 * différente ; at) ; swap (deux voisines échangées ; at = la première) ; far (tout le reste). at = null sinon.
 */
export function diagnose(attempt: string, target: string): { kind: DiagnosisKind; at: number | null } {
  if (attempt === target) return { kind: "exact", at: null };
  if (target.startsWith(attempt)) return { kind: "prefix", at: null };
  const n = attempt.length;
  const m = target.length;
  if (n === m - 1) {
    for (let i = 0; i < m; i++) {
      if (target.slice(0, i) + target.slice(i + 1) === attempt) return { kind: "missing", at: i };
    }
  }
  if (n === m + 1) {
    for (let i = 0; i < n; i++) {
      if (attempt.slice(0, i) + attempt.slice(i + 1) === target) return { kind: "extra", at: i };
    }
  }
  if (n === m) {
    const diffs: number[] = [];
    for (let i = 0; i < n && diffs.length <= 2; i++) if (attempt.charAt(i) !== target.charAt(i)) diffs.push(i);
    const [a, b] = diffs;
    if (diffs.length === 1 && a !== undefined) return { kind: "wrong", at: a };
    if (
      diffs.length === 2 &&
      a !== undefined &&
      b === a + 1 &&
      attempt.charAt(a) === target.charAt(b) &&
      attempt.charAt(b) === target.charAt(a)
    ) {
      return { kind: "swap", at: a };
    }
  }
  return { kind: "far", at: null };
}

/** Ce que le jeu sait de l'écriture du mot attendu, après une pose ou une casse. */
export interface WritingState {
  /** Lecture visible égale au mot (cases réduites au mot), ou null. */
  found: Reading | null;
  /** Le mot trouvé se lit du côté où se tient l'enfant. */
  foundFacing: boolean;
  /** Trouvé en retirant un mot déjà écrit, collé au nouveau (pas d'espace entre les deux). */
  glued: boolean;
  /**
   * Bonnes lettres, mais aucune face de lecture visible (un bloc les cache), et l'enfant ne les voit pas non plus à
   * l'envers de son côté (sinon c'est reversed).
   */
  hidden: boolean;
  /** Colonne qui se lit juste de bas en haut (au moins deux lettres), mais pas de haut en bas. */
  tower: boolean;
  /**
   * Au moins deux lettres justes, mais lues seulement de l'autre côté (écrit de droite à gauche pour l'enfant) : la
   * face de lecture se voit, ou, cachée derrière, les lettres se voient à l'envers du côté de l'enfant.
   */
  reversed: boolean;
  /** Meilleur essai visible du côté de l'enfant (le plus long début juste), ou null. */
  best: { reading: Reading; match: WordMatch } | null;
}

interface Candidate {
  reading: Reading;
  glued: boolean;
  /** Mot déjà écrit (dans un sens ou dans l'autre) : ce n'est pas un essai pour le mot attendu. */
  old: boolean;
  visible: boolean;
  facing: boolean;
  /** Cosinus de l'angle entre le côté de lecture et la direction de l'enfant (1 pour une colonne). */
  cos: number;
  dist: number;
  order: number;
}

const RANK: Readonly<Record<WordMatch["kind"], number>> = { exact: 3, extra: 2, inside: 2, prefix: 1, wrong: 1, none: 0 };

/**
 * Évalue l'écriture du mot `target` autour de l'enfant (boîte around ± radius, ± height en y) : chaque lecture
 * est comparée telle quelle, puis (si elle n'est pas exacte) privée des mots déjà écrits collés (`previous`, lus dans
 * un sens ou dans l'autre : « IMALUNE » avec [AMI] donne LUNE), un mot après l'autre ; chaque noyau intermédiaire
 * compte (« SOLSOLEIL » avec [SOL] donne SOLEIL avant EIL).
 * Les lectures qui sont un mot déjà écrit, dans un sens ou dans l'autre, ne comptent ni comme essai (best), ni
 * pour reversed et tower : seulement pour retrouver le mot attendu.
 */
export function evaluateWriting(
  w: BlockReader,
  around: { x: number; y: number; z: number },
  target: string,
  viewer: { x: number; z: number },
  previous: readonly string[],
  radius = 12,
  height = 8,
): WritingState {
  const ax = Math.floor(around.x);
  const ay = Math.floor(around.y);
  const az = Math.floor(around.z);
  const readings = readingsInBox(
    w,
    Math.max(0, ax - radius),
    Math.min(w.sizeX - 1, ax + radius),
    Math.max(0, ay - height),
    Math.min(w.sizeY - 1, ay + height),
    Math.max(0, az - radius),
    Math.min(w.sizeZ - 1, az + radius),
  );
  const oldWords = new Set(previous.filter((p) => p !== target));
  // Un mot déjà écrit peut être collé au nouveau dans un sens ou dans l'autre (lu de l'autre côté, il est à l'envers).
  const known = [...previous, ...previous.map(reverse)].filter((k) => k !== target);
  const cands: Candidate[] = [];
  const add = (reading: Reading, glued: boolean, old: boolean) => {
    const c = centre(reading);
    const vx = viewer.x - c.x;
    const vz = viewer.z - c.z;
    const len = Math.hypot(vx, vz);
    const cos = reading.side ? (len > 1e-9 ? (vx * reading.side.nx + vz * reading.side.nz) / len : 0) : 1;
    cands.push({
      reading,
      glued,
      old: old || oldWords.has(reading.text),
      visible: isVisible(w, reading),
      facing: facesViewer(reading, viewer),
      cos,
      dist: len,
      order: cands.length,
    });
  };
  for (const r of readings) {
    const old = r.text !== target && (oldWords.has(r.text) || oldWords.has(reverse(r.text)));
    add(r, false, old);
    if (r.text === target) continue;
    for (const step of coreSteps(r.text, known)) {
      const end = step.start + step.text.length;
      add({ text: step.text, cells: r.cells.slice(step.start, end), dir: r.dir, side: r.side }, true, old);
    }
  }

  // Le mot : une lecture visible égale au mot (jamais une lettre seule), de préférence face à l'enfant,
  // puis la plus proche.
  const equal = cands.filter((c) => c.reading.text === target && c.reading.cells.length >= MIN_WORD);
  let foundC: Candidate | null = null;
  for (const c of equal) {
    if (!c.visible) continue;
    if (
      !foundC ||
      (c.facing && !foundC.facing) ||
      (c.facing === foundC.facing && (c.dist < foundC.dist || (c.dist === foundC.dist && c.order < foundC.order)))
    ) {
      foundC = c;
    }
  }
  const found = foundC?.reading ?? null;

  // Meilleur essai : visible, face à l'enfant ; le plus long début juste, puis exact > en trop > début ou erreur,
  // puis le noyau privé d'un mot déjà écrit (ses lettres ne sont pas à revoir), puis le plus proche, puis le plus en
  // face (lettre seule : le sens qui regarde le plus l'enfant).
  let best: { c: Candidate; match: WordMatch } | null = null;
  for (const c of cands) {
    if (c.old || !c.visible || !c.facing) continue;
    const match = matchWord(c.reading.text, target);
    if (!best) {
      best = { c, match };
      continue;
    }
    const d =
      match.have - best.match.have ||
      RANK[match.kind] - RANK[best.match.kind] ||
      Number(c.glued) - Number(best.c.glued) ||
      best.c.dist - c.dist ||
      c.cos - best.c.cos ||
      best.c.order - c.order;
    if (d > 0) best = { c, match };
  }

  const tower =
    !found &&
    readings.some((r) => {
      if (r.side !== null) return false;
      if (oldWords.has(r.text) || oldWords.has(reverse(r.text))) return false;
      return commonPrefix(reverse(r.text), target) >= MIN_WORD && commonPrefix(r.text, target) < MIN_WORD;
    });

  // Lecture de l'autre côté dont les lettres se voient du côté de l'enfant (à l'envers pour lui), même si la face
  // de lecture, derrière, est cachée (mot écrit de droite à gauche contre un mur).
  const seenBackwards = (c: Candidate) =>
    !c.facing && c.reading.side !== null && sideVisible(w, c.reading.cells, -c.reading.side.nx, -c.reading.side.nz);
  const reversed =
    !found &&
    (best === null || best.match.have === 0) &&
    cands.some((c) => !c.old && !c.facing && commonPrefix(c.reading.text, target) >= MIN_WORD && (c.visible || seenBackwards(c)));

  return {
    found,
    foundFacing: found ? foundC!.facing : false,
    glued: found ? foundC!.glued : false,
    // Caché : le mot est là, mais l'enfant ne le voit ni de face ni à l'envers (sinon, c'est « de gauche à droite »).
    hidden: !found && equal.some((c) => !seenBackwards(c)),
    tower,
    reversed,
    best: best ? { reading: best.c.reading, match: best.match } : null,
  };
}

/**
 * Case de la lettre d'indice `have` le long de la lecture (cells[have], sinon la case après la dernière lettre),
 * avec free = rien de plein n'y est posé. null si have = 0 (le jeu trace alors une ligne avec planLine) ou hors du monde.
 */
export function nextCell(w: BlockReader, r: Reading, have: number): { cell: Cell; free: boolean } | null {
  if (have <= 0) return null;
  let cell: Cell | undefined = r.cells[have];
  if (!cell) {
    const last = r.cells[have - 1];
    if (!last) return null;
    cell = [last[0] + r.dir[0], last[1] + r.dir[1], last[2] + r.dir[2]];
  }
  if (!inWorld(w, cell[0], cell[1], cell[2])) return null;
  return { cell, free: !isSolidId(w.get(cell[0], cell[1], cell[2])) };
}

/**
 * Cases claires des lettres qui restent à poser : cells[have − 1] + dir × k, pour k = 1 … length − have, tant
 * qu'elles sont dans le monde et libres (arrêt à la première case pleine).
 */
export function ghostCells(w: BlockReader, r: Reading, have: number, length: number): Cell[] {
  const base = r.cells[have - 1];
  if (!base) return [];
  const out: Cell[] = [];
  for (let k = 1; k <= length - have; k++) {
    const c: Cell = [base[0] + r.dir[0] * k, base[1] + r.dir[1] * k, base[2] + r.dir[2] * k];
    if (!inWorld(w, c[0], c[1], c[2]) || isSolidId(w.get(c[0], c[1], c[2]))) break;
    out.push(c);
  }
  return out;
}

/** Champ horizontal par défaut si celui reçu n'est pas utilisable (degrés). */
const DEFAULT_HFOV = 60;

/** Visée de l'enfant : position de l'œil et portée (REACH du jeu). */
export interface Aim {
  eye: Vec3;
  reach: number;
}

/** Les six voisins d'une case, le dessous d'abord (le sol sous la case est la visée la plus courante). */
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
];

/** Points visés sur une face (coordonnées dans la face) : le milieu, puis vers les coins. */
const FACE_POINTS: readonly (readonly [number, number])[] = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
];

/**
 * L'enfant peut-il poser un bloc dans la case `cell` (air ou fleur) sans bouger, comme le jeu pose : une visée depuis
 * l'œil, à portée, dont le premier bloc touché est un voisin de la case, par sa face tournée vers elle (ou la fleur
 * de la case, que le bloc remplace) ? On essaie quelques points de chaque face voisine. `filled` : cases déjà
 * remplies (les lettres posées avant celle-ci), comptées comme des blocs pleins.
 */
export function canAimAt(w: BlockReader, aim: Aim, cell: Cell, filled: readonly Cell[] = []): boolean {
  const isFilled = (x: number, y: number, z: number) => filled.some((c) => c[0] === x && c[1] === y && c[2] === z);
  const targets: Targets = {
    isTargetable: (x, y, z) => isFilled(x, y, z) || (inWorld(w, x, y, z) && isTargetableId(w.get(x, y, z))),
  };
  const [x, y, z] = cell;
  const { eye, reach } = aim;
  for (const [ox, oy, oz] of NEIGHBOURS) {
    if (!targets.isTargetable(x + ox, y + oy, z + oz)) continue;
    for (const [u, v] of FACE_POINTS) {
      // Point de la face commune à la case et à ce voisin.
      const px = ox !== 0 ? x + (ox > 0 ? 1 : 0) : x + u;
      const py = oy !== 0 ? y + (oy > 0 ? 1 : 0) : y + (ox !== 0 ? u : v);
      const pz = oz !== 0 ? z + (oz > 0 ? 1 : 0) : z + v;
      const dir = { x: px - eye.x, y: py - eye.y, z: pz - eye.z };
      if (Math.hypot(dir.x, dir.y, dir.z) > reach) continue;
      const hit = raycast(targets, eye, dir, reach);
      if (!hit) continue;
      if (hit.x + hit.nx === x && hit.y + hit.ny === y && hit.z + hit.nz === z) return true;
      // Une fleur dans la case : la viser, c'est poser à sa place.
      if (hit.x === x && hit.y === y && hit.z === z && isPlantId(w.get(x, y, z))) return true;
    }
  }
  return false;
}

/** Écart de la ligne sur le côté, dans un sens puis dans l'autre (cases). */
const MAX_SHIFT = 12;

/**
 * Ligne de cases claires devant l'enfant pour un mot de `length` lettres, quand rien n'est encore écrit :
 * - sur l'axe dominant du regard f, lue de gauche à droite pour l'enfant (sens d = (−f.z, f.x)), sa face de lecture
 *   tournée vers lui ;
 * - toutes les cases à la même hauteur, dans l'air ou une fleur (ni eau, ni bloc plein), chacune posée sur un bloc
 *   opaque qui n'est pas un bloc-lettre (jamais sur un mot déjà écrit) ;
 * - chaque case se pose depuis là où il est (canAimAt : visée depuis l'œil, à portée, les lettres d'avant posées) :
 *   jamais derrière un mot déjà écrit ou un mur, ni hors de portée.
 * Le mot écrit dans ces cases doit se lire de face et seul (voir isVisible et readingsThrough) :
 * - la case voisine côté enfant (−f) est dans le monde et n'est pas opaque (sinon la face de lecture n'est pas
 *   dessinée : rigole d'un cran, tronc, mot déjà écrit juste devant) ;
 * - aucune lettre juste derrière une case (+f), ni juste avant la première ou après la dernière (sens d) : le mot
 *   ne se colle à aucune lettre déjà posée.
 * D'abord centrée sur l'axe, à une distance où tout le mot tient dans le champ horizontal (minD … minD + 3) ; pour
 * chaque distance, les hauteurs des pieds, un cran plus bas, un cran plus haut. Sinon (un mot déjà écrit devant,
 * place trop loin), décalée sur le côté, plus près ou plus loin : sa première case (celle à remplir d'abord) est dans
 * le champ autour du regard, la suite peut en sortir (l'enfant tourne la tête en écrivant). Aucune place : null
 * (pas de cases claires, seulement la consigne ; le jeu réessaie quand l'enfant tourne la tête ou se déplace).
 */
export function planLine(
  w: BlockReader,
  feet: { x: number; y: number; z: number },
  yaw: number,
  length: number,
  hfovDeg: number,
  aim: Aim,
): { cells: Cell[]; dir: Dir } | null {
  if (!Number.isInteger(length) || length < 1) return null;
  const hfov = Number.isFinite(hfovDeg) && hfovDeg > 0 && hfovDeg < 180 ? hfovDeg : DEFAULT_HFOV;
  const lx = -Math.sin(yaw);
  const lz = -Math.cos(yaw);
  if (!Number.isFinite(lx) || !Number.isFinite(lz)) return null;
  // Axe dominant du regard, puis sens de lecture (la droite de l'enfant).
  const fx = Math.abs(lx) >= Math.abs(lz) ? Math.sign(lx) : 0;
  const fz = fx === 0 ? Math.sign(lz) : 0;
  const dx = fz === 0 ? 0 : -fz;
  const dz = fx;
  const dir: Dir = [dx as -1 | 0 | 1, 0, dz as -1 | 0 | 1];
  const tanHalf = Math.tan((hfov * Math.PI) / 360);
  const minD = Math.min(7, Math.max(2, Math.ceil((length / 2 + 0.5) / tanHalf)));
  const bx = Math.floor(feet.x);
  const bz = Math.floor(feet.z);
  const y0 = Math.floor(feet.y);
  const back = Math.floor((length - 1) / 2);
  const heights = [y0, y0 - 1, y0 + 1];

  /** Cases de la ligne à `dist` sur l'axe, décalée de `shift` cases vers la droite, à la hauteur y ; null si refusée. */
  const lineAt = (dist: number, shift: number, y: number): Cell[] | null => {
    const sx = bx + fx * dist + dx * (shift - back);
    const sz = bz + fz * dist + dz * (shift - back);
    // Rien de collé aux deux bouts de la ligne.
    if (letterAt(w, sx - dx, y, sz - dz) || letterAt(w, sx + dx * length, y, sz + dz * length)) return null;
    const cells: Cell[] = [];
    for (let i = 0; i < length; i++) {
      const x = sx + dx * i;
      const z = sz + dz * i;
      if (!inWorld(w, x, y, z) || y < 1) return null;
      const id = w.get(x, y, z);
      if (id !== BlockId.Air && !isPlantId(id)) return null;
      const below = w.get(x, y - 1, z);
      if (!isOpaqueId(below) || isLetterId(below)) return null;
      // Face de lecture dessinée (côté enfant), et pas de lettre juste derrière.
      if (!inWorld(w, x - fx, y, z - fz) || isOpaqueId(w.get(x - fx, y, z - fz))) return null;
      if (letterAt(w, x + fx, y, z + fz)) return null;
      cells.push([x, y, z]);
    }
    // Chaque case se pose depuis l'œil, dans l'ordre de l'écriture (les lettres d'avant déjà posées).
    for (let i = 0; i < cells.length; i++) if (!canAimAt(w, aim, cells[i]!, cells.slice(0, i))) return null;
    return cells;
  };

  // 1) Centrée sur l'axe, le mot entier dans le champ.
  for (let dist = minD; dist <= minD + 3; dist++) {
    for (const y of heights) {
      const cells = lineAt(dist, 0, y);
      if (cells) return { cells, dir };
    }
  }

  // 2) Décalée sur le côté, autour du regard : la première case dans le champ. Distances de la plus proche de minD
  //    à la plus lointaine (pas plus près que 3 blocs, pour ne pas baisser les yeux), écarts du plus petit au plus grand.
  const ahead = lx * fx + lz * fz;
  const gazeSlope = ahead > 0 ? (lx * dx + lz * dz) / ahead : 0;
  const cosHalf = Math.cos((hfov * Math.PI) / 360);
  const inView = (x: number, z: number) => {
    const vx = x + 0.5 - aim.eye.x;
    const vz = z + 0.5 - aim.eye.z;
    const n = Math.hypot(vx, vz);
    return n > 0 && (vx * lx + vz * lz) / n >= cosHalf - 1e-9;
  };
  const lo = Math.min(minD, 3);
  const hi = minD + 3;
  const dists: number[] = [minD];
  for (let k = 1; minD - k >= lo || minD + k <= hi; k++) {
    if (minD - k >= lo) dists.push(minD - k);
    if (minD + k <= hi) dists.push(minD + k);
  }
  for (const dist of dists) {
    // Écart qui centre la ligne sur le regard à cette distance.
    const s0 = Math.round(dist * gazeSlope);
    for (let k = 0; k <= MAX_SHIFT; k++) {
      for (const shift of k === 0 ? [s0] : [s0 + k, s0 - k]) {
        // Première case : avant tout le reste, dans le champ autour du regard.
        if (!inView(bx + fx * dist + dx * (shift - back), bz + fz * dist + dz * (shift - back))) continue;
        for (const y of heights) {
          const cells = lineAt(dist, shift, y);
          if (cells) return { cells, dir };
        }
      }
    }
  }
  return null;
}

/**
 * Tous les mots (lectures d'au moins deux lettres, dans les deux sens et les colonnes) déjà présents dans le monde,
 * visibilité ignorée. Sert seulement à écarter ces mots au tirage (un parcours du monde par étape).
 */
export function presentWords(w: BlockReader): Set<string> {
  const out = new Set<string>();
  for (const r of readingsInBox(w, 0, w.sizeX - 1, 0, w.sizeY - 1, 0, w.sizeZ - 1)) {
    if (r.cells.length >= MIN_WORD) out.add(r.text);
  }
  return out;
}
