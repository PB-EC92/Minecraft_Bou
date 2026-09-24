/**
 * Écart d'un monde par rapport à son monde d'origine (J4, fonctions pures).
 * Un monde se régénère à l'identique à partir de son type et de sa graine : on
 * n'enregistre donc que les blocs changés par l'enfant. Format binaire compact :
 * pour chaque bloc changé, l'écart d'indice avec le précédent (entier variable,
 * 7 bits par octet) puis le nouvel identifiant (un octet). Quelques kilo-octets
 * même pour une grande construction, loin des limites du stockage local.
 */

/** Blocs de current qui diffèrent de base (tableaux de même longueur). */
export function diffBlocks(base: Uint8Array, current: Uint8Array): Uint8Array {
  if (base.length !== current.length) throw new RangeError("Mondes de tailles différentes");
  const out: number[] = [];
  let prev = -1;
  for (let i = 0; i < current.length; i++) {
    const v = current[i]!;
    if (v === base[i]) continue;
    let delta = i - prev;
    prev = i;
    while (delta >= 0x80) {
      out.push((delta & 0x7f) | 0x80);
      delta = Math.floor(delta / 0x80);
    }
    out.push(delta, v);
  }
  return Uint8Array.from(out);
}

/**
 * Applique un écart à target (modifié sur place). Renvoie le nombre de blocs
 * écrits, ou -1 si l'écart est illisible (tronqué, indice hors du monde) : dans
 * ce cas target peut avoir été modifié en partie, l'appelant repart du monde d'origine.
 */
export function applyDiff(target: Uint8Array, diff: Uint8Array, isValidId: (id: number) => boolean = () => true): number {
  let i = 0;
  let pos = -1;
  let n = 0;
  while (i < diff.length) {
    let delta = 0;
    let mul = 1;
    for (;;) {
      if (i >= diff.length || mul > 2 ** 35) return -1;
      const b = diff[i++]!;
      delta += (b & 0x7f) * mul;
      if (b < 0x80) break;
      mul *= 0x80;
    }
    if (delta < 1 || i >= diff.length) return -1;
    pos += delta;
    const id = diff[i++]!;
    if (pos >= target.length || !isValidId(id)) return -1;
    target[pos] = id;
    n++;
  }
  return n;
}

/** Octets → base64 (pour le stockage local et le fichier d'export). */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

/** base64 → octets, ou null si la chaîne n'est pas du base64 valide. */
export function fromBase64(s: string): Uint8Array | null {
  try {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
