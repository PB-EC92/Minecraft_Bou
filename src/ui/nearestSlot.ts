/**
 * Case de la barre la plus proche d'un toucher (J3, fonction pure) : toute la
 * surface de la barre choisit une case, marges et espaces compris (un doigt
 * posé entre deux cases ne « rate » plus).
 */
export function nearestSlot(x: number, centers: readonly number[]): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const c = centers[i];
    if (c === undefined) continue;
    const d = Math.abs(x - c);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
