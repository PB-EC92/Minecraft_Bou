import { BlockId, HOTBAR_BLOCKS } from "../engine/blocks";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { World } from "../engine/World";
import { Speech } from "../edu/speech";
import { Keyboard } from "../input/Keyboard";
import { MouseLook } from "../input/MouseLook";
import { TouchControls } from "../input/TouchControls";
import { SceneView } from "../render/SceneView";
import { showFatalError } from "../ui/fatal";
import { Hud } from "../ui/Hud";
import { Player } from "./Player";

const REACH = 6;
const WORLD_SIZE = 32;
const WORLD_HEIGHT = 16;
const GROUND = 4;
export const VERSION = "J0.1";

const HINT_TOUCH = "Doigt gauche : bouger · doigt droit : regarder · tapoter : agir";
const HINT_MOUSE =
  "Clique pour capturer la souris · ZQSD bouger · Espace sauter\nClic gauche casser · clic droit poser · 1-6 choisir un bloc · Échap libérer";
const HINT_MOUSE_FALLBACK =
  "Glisse en tenant le bouton pour regarder · ZQSD bouger · Espace sauter\nClic bref gauche casser · clic bref droit poser · 1-6 choisir un bloc";

/**
 * Assemble tout : monde, rendu, joueur, entrées, HUD, boucle de jeu.
 * J0 : un seul monde plat, pas de sauvegarde, pas de missions.
 */
export class Game {
  readonly world: World;
  readonly player: Player;
  readonly view: SceneView;
  readonly hud: Hud;
  readonly keyboard: Keyboard;
  readonly mouse: MouseLook;
  readonly touch: TouchControls;
  readonly speech = new Speech();
  /** Appareil dont le pointeur principal est le doigt (tablette) : fixé au démarrage. */
  readonly coarsePointer: boolean;
  /** Interface tactile affichée : au démarrage sur tablette, ou dès le premier toucher (PC tactile). */
  private touchUi: boolean;
  private stopped = false;

  private selectedSlot = 0;
  private target: RayHit | null = null;
  private lastTime = performance.now();
  private frameTimes: number[] = [];
  private faces = 0;
  private storageOk = "?";

  constructor(root: HTMLElement) {
    this.coarsePointer = TouchControls.primaryPointerIsTouch();
    this.touchUi = this.coarsePointer;

    this.world = World.createFlat(WORLD_SIZE, WORLD_HEIGHT, WORLD_SIZE, GROUND);
    this.buildTestStructures();

    const canvas = document.createElement("canvas");
    canvas.className = "game";
    root.appendChild(canvas);

    this.view = new SceneView(canvas, this.world, this.coarsePointer);
    this.hud = new Hud(root, this.view.atlasCanvas);
    this.touch = new TouchControls(root);
    this.touch.enable(this.touchUi);
    this.keyboard = new Keyboard();
    this.mouse = new MouseLook(canvas);

    this.player = new Player(this.world);
    const sx = WORLD_SIZE / 2;
    const sz = WORLD_SIZE / 2 + 4;
    // Au sol, jamais sur un feuillage ni dans un bloc (constat 3 de l'audit J0).
    this.player.setPosition(sx + 0.5, (this.world.findStandingY(sx, sz) ?? GROUND) + 0.01, sz + 0.5);

    this.wireInputs();
    this.setSlot(0);
    this.testStorage();
    this.setupVoicePanel();

    this.updateHint();
    this.hud.showMessage(`Bienvenue dans Cubes (prototype ${VERSION})`, 4000);

    requestAnimationFrame((t) => this.safeFrame(t));
  }

  private updateHint(): void {
    if (this.touchUi) this.hud.setHint(HINT_TOUCH);
    else this.hud.setHint(this.mouse.inFallback() ? HINT_MOUSE_FALLBACK : HINT_MOUSE);
  }

  /** Boucle protégée : une erreur affiche un écran lisible au lieu de figer le jeu en silence. */
  private safeFrame(now: number): void {
    if (this.stopped) return;
    try {
      this.frame(now);
    } catch (err) {
      this.stopped = true;
      showFatalError(err);
      throw err;
    }
  }

  /** Quelques éléments pour tester saut, collisions et visée. */
  private buildTestStructures(): void {
    const w = this.world;
    const cx = WORLD_SIZE / 2;
    const cz = WORLD_SIZE / 2;
    // Escalier de pierre
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k <= i; k++) w.set(cx - 6 + i, GROUND + k, cz - 3, BlockId.Stone);
    }
    // Petit mur de planches avec une ouverture
    for (let x = cx + 2; x < cx + 8; x++) {
      for (let y = GROUND; y < GROUND + 3; y++) {
        if (x === cx + 4 && y < GROUND + 2) continue;
        w.set(x, y, cz - 4, BlockId.Planks);
      }
    }
    // Un arbre, à l'écart du point d'apparition (x = cx, z = cz + 4)
    const tx = cx - 6;
    const tz = cz + 7;
    for (let y = GROUND; y < GROUND + 4; y++) w.set(tx, y, tz, BlockId.Log);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 3; dy <= 5; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + (dy - 3) > 4) continue;
          if (w.get(tx + dx, GROUND + dy, tz + dz) === BlockId.Air) {
            w.set(tx + dx, GROUND + dy, tz + dz, BlockId.Grass); // feuillage provisoire (bloc dédié en J1)
          }
        }
      }
    }
    // Un carré de sable
    for (let x = cx + 3; x < cx + 8; x++) for (let z = cz + 3; z < cz + 8; z++) w.set(x, GROUND - 1, z, BlockId.Sand);
  }

  private wireInputs(): void {
    this.keyboard.onPressed((code) => {
      const m = /^Digit([1-9])$/.exec(code);
      if (m) this.setSlot(Number(m[1]) - 1);
    });
    this.hud.onSelectSlot((i) => this.setSlot(i));

    this.mouse.onAction((a) => (a === "break" ? this.breakBlock() : this.placeBlock()));
    this.mouse.onLockChange((locked) => {
      this.hud.lockButton.textContent = locked ? "Souris capturée (Échap)" : "Capturer la souris";
      this.updateHint();
      if (locked || this.touchUi) return;
      this.hud.showMessage(
        this.mouse.inFallback() ? "Capture de la souris refusée : glisse pour regarder, clic bref pour agir" : "Clique sur le monde pour reprendre",
        2500,
      );
    });
    this.touch.onAction((mode) => (mode === "break" ? this.breakBlock() : this.placeBlock()));

    // PC à écran tactile : l'interface tactile n'apparaît qu'au premier vrai toucher.
    window.addEventListener(
      "touchstart",
      () => {
        if (this.touchUi) return;
        this.touchUi = true;
        this.touch.enable(true);
        this.updateHint();
      },
      { capture: true, passive: true },
    );

    this.hud.lockButton.addEventListener("click", () => this.mouse.requestLock());
    this.hud.fullscreenButton.addEventListener("click", () => this.toggleFullscreen());
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (orientation.lock) await orientation.lock("landscape").catch(() => undefined);
      }
    } catch (err) {
      this.hud.showMessage(`Plein écran impossible : ${String(err)}`);
    }
  }

  private setSlot(i: number): void {
    if (i < 0 || i >= HOTBAR_BLOCKS.length) return;
    this.selectedSlot = i;
    this.hud.setSelectedSlot(i);
  }

  private selectedBlock(): BlockId {
    return HOTBAR_BLOCKS[this.selectedSlot] ?? BlockId.Stone;
  }

  private breakBlock(): void {
    if (!this.target) return;
    const { x, y, z } = this.target;
    if (y === 0) {
      this.hud.showMessage("Le sol tout en bas ne se casse pas");
      return;
    }
    const id = this.world.get(x, y, z);
    if (this.world.set(x, y, z, BlockId.Air)) {
      this.hud.showMessage(`Cassé : ${this.hud.blockName(id)}`, 1200);
    }
  }

  private placeBlock(): void {
    if (!this.target) return;
    const x = this.target.x + this.target.nx;
    const y = this.target.y + this.target.ny;
    const z = this.target.z + this.target.nz;
    if (!this.world.inBounds(x, y, z)) {
      this.hud.showMessage("Trop loin : le monde s'arrête ici");
      return;
    }
    if (boxesIntersect(blockBox(x, y, z), this.player.box())) {
      this.hud.showMessage("Pas de place ici : tu es dedans !", 1500);
      return;
    }
    const id = this.selectedBlock();
    if (this.world.set(x, y, z, id)) this.hud.showMessage(`Posé : ${this.hud.blockName(id)}`, 1200);
  }

  private testStorage(): void {
    try {
      localStorage.setItem("cubes:test", String(Date.now()));
      this.storageOk = localStorage.getItem("cubes:test") ? "ok" : "lecture vide";
    } catch (err) {
      this.storageOk = `erreur : ${String(err)}`;
    }
  }

  private setupVoicePanel(): void {
    const hud = this.hud;
    hud.voiceResult.textContent = "Chargement des voix…";
    const refresh = () => {
      const fr = this.speech.frenchVoices();
      const all = this.speech.allVoices();
      const local = fr.filter((v) => v.localService).length;
      const list = fr.length > 0 ? fr : all;
      hud.setVoices(list, this.speech.pickVoice()?.voiceURI ?? null);
      hud.voiceResult.textContent = this.speech.supported
        ? `${fr.length} voix française(s) dont ${local} locale(s) (hors ligne), sur ${all.length} voix au total`
        : "Synthèse vocale non disponible dans ce navigateur";
    };
    void this.speech.whenReady().then(refresh);
    this.speech.onVoicesChanged(refresh);
    hud.voiceSelect.addEventListener("change", () => {
      this.speech.preferredVoiceUri = hud.voiceSelect.value || null;
    });
    hud.speakButton.addEventListener("click", async () => {
      hud.voiceResult.textContent = "Lecture…";
      const t0 = performance.now();
      const r = await this.speech.speak(hud.voiceText.value);
      const ms = Math.round(performance.now() - t0);
      hud.voiceResult.textContent = r.ok ? `Lecture terminée (${ms} ms)` : `Échec : ${r.error ?? "inconnu"}`;
    });
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Regard
    const m = this.mouse.consume();
    const t = this.touch.consumeLook();
    this.player.rotate(m.yaw + t.yaw, m.pitch + t.pitch);

    // Déplacement
    const kx = this.keyboard.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]);
    const kz = this.keyboard.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]);
    this.player.update(dt, {
      x: kx + this.touch.moveX,
      z: kz + this.touch.moveZ,
      jump: this.keyboard.isDown("Space") || this.touch.jumpPressed,
    });

    // Caméra
    const eye = this.player.eye();
    this.view.camera.position.set(eye.x, eye.y, eye.z);
    this.view.camera.rotation.order = "YXZ";
    this.view.camera.rotation.set(this.player.pitch, this.player.yaw, 0);

    // Visée
    this.target = raycast(this.world, eye, this.player.lookDir(), REACH);
    if (this.target) this.view.setHighlight(this.target.x, this.target.y, this.target.z);
    else this.view.hideHighlight();

    // Rendu
    const rebuilt = this.view.worldMesh.update();
    if (rebuilt >= 0) this.faces = rebuilt;
    this.view.render();

    this.updateStats(now, dt);
    requestAnimationFrame((n) => this.safeFrame(n));
  }

  private updateStats(now: number, dt: number): void {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    // Mise à jour de l'affichage 4 fois par seconde
    if (Math.floor(now / 250) === Math.floor((now - dt * 1000) / 250)) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const worst = Math.max(...this.frameTimes);
    const p = this.player;
    const deg = (r: number) => Math.round((r * 180) / Math.PI);
    const cap = ((deg(p.yaw) % 360) + 360) % 360;
    this.hud.setInfo(
      `${Math.round(1000 / avg)} i/s  (moy. ${avg.toFixed(1)} ms, pire ${worst.toFixed(0)} ms)\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ${p.onGround ? "sol" : "air"}  regard ${cap}° ${deg(p.pitch)}°\n` +
        `faces ${this.faces}  bloc : ${this.hud.blockName(this.selectedBlock())}  ${VERSION}`,
    );
    const g = this.view.gpu;
    this.hud.setDiagnostics(
      [
        `Adresse : ${location.protocol}//${location.host || "(fichier local)"}`,
        `Navigateur : ${navigator.userAgent}`,
        `Écran : ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}× (rendu ${g.pixelRatio}×)`,
        `Tactile : pointeur principal ${this.coarsePointer ? "doigt" : "souris"}, interface tactile ${
          this.touchUi ? "affichée" : "masquée"
        } (${navigator.maxTouchPoints} points)`,
        `WebGL2 : ${g.webgl2 ? "oui" : "non"} — ${g.renderer}`,
        `Pointer Lock : ${this.mouse.supported ? "disponible" : "absent"}, ${this.mouse.locked ? "actif" : "inactif"}${
          this.mouse.inFallback() ? ", mode repli" : ""
        }, mouvements écartés ${this.mouse.rejectedMoves}${this.mouse.lastError ? `, erreur : ${this.mouse.lastError}` : ""}`,
        `Stockage local : ${this.storageOk}`,
        `Synthèse vocale : ${this.speech.supported ? "disponible" : "absente"}`,
      ].join("\n"),
    );
  }
}
