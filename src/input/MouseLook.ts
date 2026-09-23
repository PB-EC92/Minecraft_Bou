import { classifyMouseDelta, isClick, LOCK_SETTLE_MS } from "./mouseFilter";

export type MouseAction = "break" | "place";

/**
 * Regard à la souris.
 *
 * Mode normal : un clic sur le monde capture la souris (Pointer Lock) ;
 * Échap la libère. Souris capturée : clic gauche = casser, clic droit = poser.
 *
 * Mode repli (capture indisponible ou refusée) : glisser en maintenant le
 * bouton pour regarder ; un clic bref sans glisser casse (gauche) ou pose
 * (droit). Le repli est actif si l'API est absente, ou tant que la dernière
 * tentative de capture a échoué (chaque clic la retente).
 */
export class MouseLook {
  yawDelta = 0;
  pitchDelta = 0;
  locked = false;
  readonly supported: boolean;
  /** Dernier message d'erreur de Pointer Lock (diagnostic). */
  lastError = "";
  /** Mouvements écartés par le filtre (diagnostic) : juste après une capture, ou trop grands. */
  rejectedSettle = 0;
  rejectedLarge = 0;
  /** Plus grand déplacement reçu en un événement, souris capturée (px, diagnostic). */
  maxDelta = 0;
  /** Nombre de captures réussies (diagnostic). */
  locks = 0;

  get rejectedMoves(): number {
    return this.rejectedSettle + this.rejectedLarge;
  }

  private lockFailed = false;
  private ignoreUntil = 0;
  private readonly actionHandlers: ((a: MouseAction) => void)[] = [];
  private readonly lockHandlers: ((locked: boolean) => void)[] = [];

  private dragging = false;
  private dragButton = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTime = 0;
  private dragMoved = 0;
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
      // On retente la capture à chaque clic : un refus peut être passager
      // (Chrome refuse une recapture pendant ~1 s après Échap).
      if (this.supported) this.requestLock();
      this.dragging = true;
      this.dragButton = e.button;
      this.dragStartX = this.lastDragX = e.clientX;
      this.dragStartY = this.lastDragY = e.clientY;
      this.dragStartTime = performance.now();
      this.dragMoved = 0;
    });

    window.addEventListener("mouseup", (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.locked || !this.inFallback()) return;
      const moved = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
      if (isClick(Math.max(moved, this.dragMoved), performance.now() - this.dragStartTime)) {
        if (this.dragButton === 0) this.emit("break");
        else if (this.dragButton === 2) this.emit("place");
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.locked) {
        const verdict = classifyMouseDelta(e.movementX, e.movementY, performance.now(), this.ignoreUntil);
        if (verdict !== "invalid") this.maxDelta = Math.max(this.maxDelta, Math.abs(e.movementX), Math.abs(e.movementY));
        if (verdict !== "ok") {
          if (verdict === "large") this.rejectedLarge++;
          else this.rejectedSettle++;
          return;
        }
        this.yawDelta -= e.movementX * this.sensitivity;
        this.pitchDelta -= e.movementY * this.sensitivity;
      } else if (this.dragging) {
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        this.dragMoved = Math.max(this.dragMoved, Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY));
        this.yawDelta -= dx * this.sensitivity * 1.5;
        this.pitchDelta -= dy * this.sensitivity * 1.5;
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.lockFailed = false;
        this.locks++;
        this.ignoreUntil = performance.now() + LOCK_SETTLE_MS;
        this.dragging = false; // le clic qui a servi à capturer n'est pas une action
      }
      for (const h of this.lockHandlers) h(this.locked);
    });
    document.addEventListener("pointerlockerror", () => {
      this.fail("pointerlockerror");
    });
  }

  /** Vrai si le mode repli (glisser + clic bref) est actif : API absente ou dernière capture refusée. */
  inFallback(): boolean {
    return !this.supported || this.lockFailed;
  }

  requestLock(): void {
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: false }) as unknown;
      if (p instanceof Promise) p.catch((err: unknown) => this.fail(String(err)));
    } catch (err) {
      this.fail(String(err));
    }
  }

  private fail(reason: string): void {
    this.lastError = reason;
    this.lockFailed = true;
    this.locked = false;
    for (const h of this.lockHandlers) h(false);
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
