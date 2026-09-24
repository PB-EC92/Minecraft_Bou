/**
 * Casse progressive (J2) : on garde l'appui sur un bloc et une barre se
 * remplit ; le bloc casse quand la durée propre à son type est atteinte
 * (`breakDurationMs` dans blocks.ts).
 *
 * Module pur (ni DOM ni Three.js) : le jeu appelle `BreakTracker.update` à
 * chaque image avec l'état de l'appui et le bloc visé, puis agit sur le
 * résultat (« done » → tenter la casse dans le monde).
 *
 * Points d'attention :
 * - en gardant l'appui après une casse, la cible suivante attend un court
 *   écart (`REPEAT_GAP_MS`) avant de progresser : on ne « creuse » pas un
 *   tunnel sans le vouloir ;
 * - si le jeu refuse la casse (ex. couche du bas), le bloc reste visé : un
 *   verrou empêche de renvoyer « done » en boucle tant qu'on ne vise pas
 *   ailleurs ou qu'on ne relâche pas.
 */

/** Position entière d'un bloc dans le monde. */
export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/** Délai minimal entre deux casses successives en gardant l'appui (ms). */
export const REPEAT_GAP_MS = 150;

/**
 * Résultat d'une image :
 * - idle : rien en cours (pas d'appui, pas de cible, ou verrou après une casse) ;
 * - progress : casse en cours, 0 ≤ progress < 1 (0 pendant l'écart de répétition) ;
 * - done : la casse du bloc `pos` est terminée, au jeu de l'appliquer.
 */
export type BreakStep =
  | { kind: "idle" }
  | { kind: "progress"; progress: number }
  | { kind: "done"; pos: BlockPos };

/** Plafond de la progression renvoyée : la barre n'affiche jamais « plein » avant « done ». */
const MAX_PROGRESS = 0.999;

/** Vrai si les deux positions désignent le même bloc (x, y, z). */
export function samePos(a: BlockPos, b: BlockPos): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function copyPos(p: BlockPos): BlockPos {
  return { x: p.x, y: p.y, z: p.z };
}

/** Progression bornée à [0, 0.999] ; durée ≤ 0 : 0 (la casse est immédiate dès que elapsed ≥ 0). */
function progressOf(elapsed: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  const p = elapsed / durationMs;
  if (!(p > 0)) return 0;
  return p < MAX_PROGRESS ? p : MAX_PROGRESS;
}

/**
 * Suit l'appui maintenu sur un bloc, image après image, et dit quand il casse.
 * Une instance par joueur ; `reset()` à la perte de focus ou au changement de monde.
 */
export class BreakTracker {
  /** Bloc en cours de casse (null : rien en cours, y compris pendant le verrou). */
  private current: BlockPos | null = null;
  /** Temps d'appui accumulé sur `current` (ms), négatif pendant l'écart de répétition. */
  private elapsed = 0;
  /** Durée demandée à la dernière mise à jour (sert au calcul de `progress`). */
  private duration = 0;
  /** Bloc dont la casse vient d'être signalée : plus de « done » tant qu'il reste visé. */
  private locked: BlockPos | null = null;
  /** Une casse a été terminée pendant l'appui en cours (active l'écart de répétition). */
  private brokeThisHold = false;

  /** Progression de la casse en cours, dans [0, 0.999] ; 0 si rien en cours. */
  get progress(): number {
    if (this.current === null) return 0;
    return progressOf(this.elapsed, this.duration);
  }

  /** Bloc en cours de casse (copie), ou null si rien en cours. */
  get target(): BlockPos | null {
    return this.current === null ? null : copyPos(this.current);
  }

  /**
   * À appeler à chaque image.
   * @param holding appui maintenu (bouton, doigt) en ce moment
   * @param target bloc visé, ou null
   * @param durationMs durée de casse du bloc visé (`breakDurationMs`), ≤ 0 = immédiat
   * @param dtMs temps écoulé depuis l'image précédente (négatif ou non fini → 0)
   */
  update(holding: boolean, target: BlockPos | null, durationMs: number, dtMs: number): BreakStep {
    if (!holding || target === null) {
      this.reset();
      return { kind: "idle" };
    }
    const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    // Durée invalide (NaN) : traitée comme immédiate plutôt que de bloquer l'enfant.
    const duration = Number.isNaN(durationMs) ? 0 : durationMs;

    if (this.locked !== null) {
      if (samePos(this.locked, target)) return { kind: "idle" };
      this.locked = null;
    }

    if (this.current === null || !samePos(this.current, target)) {
      this.current = copyPos(target);
      this.elapsed = this.brokeThisHold ? -REPEAT_GAP_MS : 0;
    }
    this.elapsed += dt;
    this.duration = duration;

    const finished = duration <= 0 ? this.elapsed >= 0 : this.elapsed >= duration;
    if (finished) {
      const pos = copyPos(this.current);
      this.locked = copyPos(this.current);
      this.current = null;
      this.elapsed = 0;
      this.brokeThisHold = true;
      return { kind: "done", pos };
    }
    return { kind: "progress", progress: progressOf(this.elapsed, duration) };
  }

  /** Oublie tout : casse en cours, verrou et écart de répétition. */
  reset(): void {
    this.current = null;
    this.elapsed = 0;
    this.duration = 0;
    this.locked = null;
    this.brokeThisHold = false;
  }
}
