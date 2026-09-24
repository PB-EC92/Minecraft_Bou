import { BlockId, BLOCKS } from "./blocks";

/**
 * Inventaire du joueur (J2) : une rangée de cases, chacune contenant un seul
 * type de bloc et un compteur. Règle « une case par type » : un type de bloc
 * n'occupe jamais deux cases ; un nouveau type prend la première case vide.
 * Les blocs cassés sont ramassés avec `add`, poser un bloc consomme avec
 * `takeFrom`. Module pur (sans DOM ni Three.js), testé en Node.
 *
 * Le numéro de `version` augmente à chaque changement effectif : l'interface
 * (barre d'inventaire) ne se redessine que lorsqu'il change.
 *
 * Format de sauvegarde (J4) : `toJSON()` / `Inventory.fromJSON()`, une case
 * étant `[id, nombre]` ou `null`. `fromJSON` ne lève jamais d'exception.
 */

/** Nombre de cases par défaut (touches 1 à 9). */
export const INVENTORY_SLOTS = 9;

/** Nombre maximal de blocs d'un même type (une case). */
export const MAX_STACK = 99;

/** Contenu d'une case : un type de bloc et son nombre (toujours ≥ 1). */
export interface Stack {
  id: BlockId;
  count: number;
}

/**
 * Résultat d'un ajout.
 * - ok : `slot` = case utilisée, `count` = total dans la case après ajout, `added` = nombre réellement ajouté ;
 * - full : aucune case libre ni case de ce type (`slot` = null) ;
 * - max : la case de ce type est déjà à MAX_STACK (`slot` = cette case).
 */
export type AddResult =
  | { ok: true; slot: number; count: number; added: number }
  | { ok: false; reason: "full" | "max"; slot: number | null };

/** Forme sérialisable de l'inventaire : une entrée par case, `[id, nombre]` ou `null`. Format de sauvegarde J4. */
export interface InventoryData {
  slots: ([number, number] | null)[];
}

/**
 * Identifiant rangeable dans l'inventaire : entier, 0 < id < BLOCKS.length et
 * BLOCKS[id].id === id (l'air et les identifiants inconnus sont exclus).
 */
export function isInventoryBlockId(id: unknown): id is BlockId {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0 || id >= BLOCKS.length) return false;
  return BLOCKS[id]?.id === id;
}

/** Nombre demandé valide pour `add` / `takeFrom` : entier ≥ 1, ou +Infinity (« autant que possible »). */
function isAmount(n: number): boolean {
  return n === Infinity || (Number.isInteger(n) && n >= 1);
}

/** Borne un nombre de blocs à [1, MAX_STACK] (partie entière ; NaN → 1, +Infinity → MAX_STACK). */
function clampCount(count: number): number {
  if (Number.isNaN(count)) return 1;
  return Math.min(MAX_STACK, Math.max(1, Math.floor(count)));
}

/** Taille valide : entier ≥ 1. */
function isValidSize(size: number): boolean {
  return Number.isInteger(size) && size >= 1;
}

export class Inventory {
  /** Nombre de cases. */
  readonly size: number;
  private readonly cells: (Stack | null)[];
  private changes = 0;

  /**
   * Crée un inventaire vide de `size` cases (INVENTORY_SLOTS par défaut).
   * Lève une RangeError si `size` n'est pas un entier ≥ 1.
   */
  constructor(size: number = INVENTORY_SLOTS) {
    if (!isValidSize(size)) throw new RangeError(`Taille d'inventaire invalide : ${String(size)}`);
    this.size = size;
    this.cells = new Array<Stack | null>(size).fill(null);
  }

  /** Augmente de 1 à chaque changement effectif du contenu (jamais quand rien ne change). */
  get version(): number {
    return this.changes;
  }

  /** Copie du contenu de la case `i` ; null si elle est vide ou hors bornes. */
  slot(i: number): Stack | null {
    if (!this.inBounds(i)) return null;
    const c = this.cells[i];
    return c ? { id: c.id, count: c.count } : null;
  }

  /** Copies de toutes les cases (longueur = size, null pour une case vide). */
  slots(): (Stack | null)[] {
    return this.cells.map((c) => (c ? { id: c.id, count: c.count } : null));
  }

  /** Nombre de blocs de ce type dans l'inventaire (0 si absent). */
  count(id: BlockId): number {
    const i = this.indexOf(id);
    return i < 0 ? 0 : (this.cells[i]?.count ?? 0);
  }

  /** Case contenant ce type de bloc, ou -1 si absent. */
  indexOf(id: BlockId): number {
    return this.cells.findIndex((c) => c !== null && c.id === id);
  }

  /** Nombre total de blocs, tous types confondus. */
  totalBlocks(): number {
    let total = 0;
    for (const c of this.cells) if (c) total += c.count;
    return total;
  }

  /** Nombre de cases occupées. */
  usedSlots(): number {
    let used = 0;
    for (const c of this.cells) if (c) used++;
    return used;
  }

  /**
   * Ramasse `n` blocs (1 par défaut) : dans la case de ce type si elle existe,
   * sinon dans la première case vide. Ajoute min(n, MAX_STACK − nombre actuel).
   * Lève une RangeError pour l'air, un identifiant inconnu, ou un `n` qui
   * n'est pas un entier ≥ 1 (+Infinity accepté : remplit la case).
   */
  add(id: BlockId, n = 1): AddResult {
    if (!isInventoryBlockId(id)) throw new RangeError(`Bloc impossible à ranger : ${String(id)}`);
    if (!isAmount(n)) throw new RangeError(`Nombre de blocs invalide : ${String(n)}`);
    const existing = this.indexOf(id);
    if (existing >= 0) {
      const cell = this.cells[existing]!;
      if (cell.count >= MAX_STACK) return { ok: false, reason: "max", slot: existing };
      const added = Math.min(n, MAX_STACK - cell.count);
      cell.count += added;
      this.changes++;
      return { ok: true, slot: existing, count: cell.count, added };
    }
    const free = this.cells.indexOf(null);
    if (free < 0) return { ok: false, reason: "full", slot: null };
    const added = Math.min(n, MAX_STACK);
    this.cells[free] = { id, count: added };
    this.changes++;
    return { ok: true, slot: free, count: added, added };
  }

  /**
   * Retire min(n, nombre) blocs de la case `i` (1 par défaut) et renvoie leur
   * type ; null si la case est vide ou hors bornes. Une case tombée à 0
   * redevient vide. Lève une RangeError si `n` n'est pas un entier ≥ 1
   * (+Infinity accepté : vide la case).
   */
  takeFrom(i: number, n = 1): BlockId | null {
    if (!isAmount(n)) throw new RangeError(`Nombre de blocs invalide : ${String(n)}`);
    if (!this.inBounds(i)) return null;
    const cell = this.cells[i];
    if (!cell) return null;
    cell.count -= Math.min(n, cell.count);
    if (cell.count <= 0) this.cells[i] = null;
    this.changes++;
    return cell.id;
  }

  /** Vide toutes les cases. */
  clear(): void {
    if (this.usedSlots() === 0) return;
    this.cells.fill(null);
    this.changes++;
  }

  /**
   * Vide puis remplit dans l'ordre : `ids[k]` va dans la case k, avec `count`
   * blocs (borné à [1, MAX_STACK]). Tronqué à `size` cases. Un type déjà placé
   * est ignoré (une case par type) sans laisser de trou. Lève une RangeError,
   * avant toute modification, si un identifiant est l'air ou inconnu.
   */
  fill(ids: readonly BlockId[], count: number): void {
    for (const id of ids) if (!isInventoryBlockId(id)) throw new RangeError(`Bloc impossible à ranger : ${String(id)}`);
    const n = clampCount(count);
    const next: (Stack | null)[] = new Array<Stack | null>(this.size).fill(null);
    let k = 0;
    for (const id of ids) {
      if (k >= this.size) break;
      if (next.some((c) => c !== null && c.id === id)) continue;
      next[k++] = { id, count: n };
    }
    this.replaceAll(next);
  }

  /** Forme sérialisable (sauvegarde J4) : une entrée par case, `[id, nombre]` ou `null`. */
  toJSON(): InventoryData {
    return { slots: this.cells.map((c) => (c ? ([c.id, c.count] as [number, number]) : null)) };
  }

  /**
   * Reconstruit un inventaire de `size` cases (INVENTORY_SLOTS par défaut, ou
   * si `size` est invalide) à partir de données quelconques. Robuste : ignore
   * les entrées invalides (pas un tableau, id inconnu ou air, nombre non entier
   * ou ≤ 0), borne le nombre à MAX_STACK, fusionne un type en double dans sa
   * première case (la suivante reste vide), ne lit que les `size` premières
   * entrées. Chaque case garde sa position. Ne lève jamais d'exception ; des
   * données illisibles donnent un inventaire vide. Version de départ : 0.
   */
  static fromJSON(data: unknown, size?: number): Inventory {
    let inv: Inventory;
    try {
      inv = new Inventory(size !== undefined && isValidSize(size) ? size : INVENTORY_SLOTS);
    } catch {
      inv = new Inventory(); // taille démesurée : tableau impossible à allouer
    }
    try {
      if (typeof data !== "object" || data === null) return inv;
      const raw: unknown = (data as { slots?: unknown }).slots;
      if (!Array.isArray(raw)) return inv;
      const limit = Math.min(raw.length, inv.size);
      for (let i = 0; i < limit; i++) {
        const entry: unknown = raw[i];
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const id: unknown = entry[0];
        const count: unknown = entry[1];
        if (!isInventoryBlockId(id)) continue;
        if (typeof count !== "number" || !Number.isInteger(count) || count <= 0) continue;
        const first = inv.indexOf(id);
        if (first >= 0) {
          const cell = inv.cells[first]!;
          cell.count = Math.min(MAX_STACK, cell.count + count);
        } else {
          inv.cells[i] = { id, count: Math.min(MAX_STACK, count) };
        }
      }
      return inv;
    } catch {
      return new Inventory(inv.size);
    }
  }

  private inBounds(i: number): boolean {
    return Number.isInteger(i) && i >= 0 && i < this.size;
  }

  /** Remplace tout le contenu ; n'augmente la version que si quelque chose change. */
  private replaceAll(next: (Stack | null)[]): void {
    let changed = false;
    for (let i = 0; i < this.size; i++) {
      const a = this.cells[i] ?? null;
      const b = next[i] ?? null;
      if (a === null && b === null) continue;
      if (a === null || b === null || a.id !== b.id || a.count !== b.count) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    for (let i = 0; i < this.size; i++) this.cells[i] = next[i] ?? null;
    this.changes++;
  }
}
