/**
 * Suivi des touches par POSITION PHYSIQUE (KeyboardEvent.code) : « KeyW »
 * est la touche en haut à gauche du bloc de lettres, donc Z sur un clavier
 * AZERTY et W sur un QWERTY. Aucun réglage nécessaire.
 */
export class Keyboard {
  private readonly down = new Set<string>();
  private readonly pressedHandlers: ((code: string) => void)[] = [];

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      for (const h of this.pressedHandlers) h(e.code);
      // Évite le défilement de la page avec les flèches / espace.
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Appelé une fois à chaque enfoncement (pas de répétition). */
  onPressed(handler: (code: string) => void): void {
    this.pressedHandlers.push(handler);
  }

  /** Axe -1 / 0 / +1 à partir de deux touches. */
  axis(negative: string[], positive: string[]): number {
    let v = 0;
    if (negative.some((c) => this.down.has(c))) v -= 1;
    if (positive.some((c) => this.down.has(c))) v += 1;
    return v;
  }
}
