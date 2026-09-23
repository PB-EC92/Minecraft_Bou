export type MouseAction = "break" | "place";

/**
 * Regard à la souris via Pointer Lock. Un clic sur le canvas capture la
 * souris ; Échap la libère. Clic gauche = casser, clic droit = poser.
 * Si Pointer Lock n'est pas disponible (ou refusé), un mode de repli
 * « cliquer-glisser pour regarder » prend le relais.
 */
export class MouseLook {
  yawDelta = 0;
  pitchDelta = 0;
  locked = false;
  readonly supported: boolean;
  /** Dernier message d'erreur de Pointer Lock (diagnostic J0). */
  lastError = "";
  fallbackDragging = false;

  private readonly actionHandlers: ((a: MouseAction) => void)[] = [];
  private readonly lockHandlers: ((locked: boolean) => void)[] = [];
  private lastDragX = 0;
  private lastDragY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly sensitivity = 0.0022,
  ) {
    this.supported = "requestPointerLock" in canvas;

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("mousedown", (e) => {
      if (this.locked) {
        if (e.button === 0) this.emit("break");
        else if (e.button === 2) this.emit("place");
        return;
      }
      if (this.supported) {
        this.requestLock();
      }
      // Repli : glisser pour regarder
      this.fallbackDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      this.fallbackDragging = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (this.locked) {
        this.yawDelta -= e.movementX * this.sensitivity;
        this.pitchDelta -= e.movementY * this.sensitivity;
      } else if (this.fallbackDragging) {
        this.yawDelta -= (e.clientX - this.lastDragX) * this.sensitivity * 1.5;
        this.pitchDelta -= (e.clientY - this.lastDragY) * this.sensitivity * 1.5;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      for (const h of this.lockHandlers) h(this.locked);
    });
    document.addEventListener("pointerlockerror", () => {
      this.lastError = "pointerlockerror";
      this.locked = false;
      for (const h of this.lockHandlers) h(false);
    });
  }

  requestLock(): void {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false }) as unknown;
      if (p instanceof Promise) p.catch((err: unknown) => (this.lastError = String(err)));
    } catch (err) {
      this.lastError = String(err);
    }
  }

  /** Consomme et remet à zéro les deltas accumulés depuis la dernière image. */
  consume(): { yaw: number; pitch: number } {
    const r = { yaw: this.yawDelta, pitch: this.pitchDelta };
    this.yawDelta = 0;
    this.pitchDelta = 0;
    return r;
  }

  onAction(h: (a: MouseAction) => void): void {
    this.actionHandlers.push(h);
  }

  onLockChange(h: (locked: boolean) => void): void {
    this.lockHandlers.push(h);
  }

  private emit(a: MouseAction): void {
    for (const h of this.actionHandlers) h(a);
  }
}
