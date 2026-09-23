import { BlockId, HOTBAR_BLOCKS, isPlantId } from "../engine/blocks";
import { DAY_CYCLE_MS, formatHour, phaseForHour, skyState, solarTime, type SkyState } from "../engine/dayNight";
import { blockBox, boxesIntersect } from "../engine/physics";
import { raycast, type RayHit } from "../engine/raycast";
import { generateWorld, randomSeed, worldTypeName, parseWorldType, type GeneratedWorld, type WorldTypeId } from "../engine/terrain";
import type { World } from "../engine/World";
import { Speech } from "../edu/speech";
import { Keyboard } from "../input/Keyboard";
import { MAX_DELTA_PX } from "../input/mouseFilter";
import { MouseLook } from "../input/MouseLook";
import { TouchControls } from "../input/TouchControls";
import { SceneView } from "../render/SceneView";
import { showFatalError } from "../ui/fatal";
import { HOUR_PRESETS, Hud } from "../ui/Hud";
import { Player } from "./Player";
import { formatUrlOptions, parseSeed, parseUrlOptions } from "./urlOptions";

const REACH = 6;
export const VERSION = "J1";
/** Rayon autour du joueur qui doit être construit avant de retirer l'écran de chargement (blocs). */
const LOADING_RADIUS = 40;
/** Budget de maillage par image (ms) : large pendant le chargement, réduit ensuite. */
const MESH_BUDGET_LOADING_MS = 14;
const MESH_BUDGET_MS = 5;
const FAST_TIME = 20;

const HINT_TOUCH = "Doigt gauche : bouger · doigt droit : regarder · tapoter : agir";
const HINT_MOUSE =
  "Clique pour capturer la souris · ZQSD bouger · Espace sauter ou nager · Maj plonger\nClic gauche casser · clic droit poser · 1-9 choisir un bloc · Échap libérer";
const HINT_MOUSE_FALLBACK =
  "Glisse en tenant le bouton pour regarder · ZQSD bouger · Espace sauter ou nager\nClic bref gauche casser · clic bref droit poser · 1-9 choisir un bloc";

interface PixelRequest {
  fx: number;
  fy: number;
  resolve: (rgba: number[]) => void;
}

/**
 * Assemble tout : monde, rendu, joueur, entrées, HUD, boucle de jeu.
 * J1 : monde généré par type et graine, jour/nuit, eau. Pas encore de
 * sauvegarde (J4) ni de missions (J5).
 */
export class Game {
  world: World;
  player: Player;
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

  private gen: GeneratedWorld;
  private selectedSlot = 0;
  private target: RayHit | null = null;
  private lastTime = performance.now();
  private frameTimes: number[] = [];
  private cpuTimes: number[] = [];
  private storageOk = "?";
  /** Phase du cycle jour/nuit en temps réel [0, 1). */
  private phase = phaseForHour(8);
  private timeScale = 1;
  private sky: SkyState = skyState(solarTime(this.phase));
  private nearSections = 1;
  private loading = true;
  private renderCalls = 0;
  private renderTriangles = 0;
  private readonly pixelRequests: PixelRequest[] = [];

  constructor(root: HTMLElement) {
    this.coarsePointer = TouchControls.primaryPointerIsTouch();
    this.touchUi = this.coarsePointer;

    const opts = parseUrlOptions(location.hash);
    this.gen = generateWorld(opts.type ?? "prairie", opts.seed ?? randomSeed());
    this.world = this.gen.world;
    if (opts.hour !== undefined) this.phase = phaseForHour(opts.hour);

    const canvas = document.createElement("canvas");
    canvas.className = "game";
    root.appendChild(canvas);

    this.view = new SceneView(canvas, this.world, this.coarsePointer);
    this.view.setRenderDistance(opts.distance ?? (this.coarsePointer ? 48 : 96));
    this.hud = new Hud(root, this.view.atlasCanvas);
    this.touch = new TouchControls(root);
    this.touch.enable(this.touchUi);
    this.keyboard = new Keyboard();
    this.mouse = new MouseLook(canvas);

    this.player = new Player(this.world);
    this.spawnPlayer();
    this.afterWorldChange();

    this.wireInputs();
    this.wirePanel();
    this.setSlot(0);
    this.testStorage();
    this.setupVoicePanel();
    this.exposeDebug();

    this.updateHint();
    this.hud.setDistance(this.view.renderDistance);
    this.hud.showMessage(`Bienvenue dans Cubes (prototype ${VERSION})`, 4000);

    requestAnimationFrame((t) => this.safeFrame(t));
  }

  private spawnPlayer(): void {
    const s = this.gen.spawn;
    this.player.setPosition(s.x, s.y, s.z);
    this.player.yaw = 0;
    this.player.pitch = 0;
  }

  /** Après la création d'un monde : adresse, panneau, écran de chargement. */
  private afterWorldChange(): void {
    this.hud.setWorldControls(this.gen.type, this.gen.seed);
    try {
      history.replaceState(null, "", formatUrlOptions(this.gen.type, this.gen.seed));
    } catch {
      // Adresse non modifiable (certains navigateurs en file://) : sans conséquence.
    }
    this.nearSections = Math.max(1, this.view.chunks.pendingNear(this.player.x, this.player.z, LOADING_RADIUS));
    this.loading = true;
  }

  newWorld(type: WorldTypeId, seed: number): void {
    this.gen = generateWorld(type, seed);
    this.world = this.gen.world;
    this.view.setWorld(this.world);
    this.player = new Player(this.world);
    this.spawnPlayer();
    this.target = null;
    this.afterWorldChange();
    this.hud.showMessage(`Nouveau monde : ${worldTypeName(type)} (graine ${seed})`, 3000);
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

    // Adresse modifiée à la main (#monde=…&graine=…) : on régénère.
    window.addEventListener("hashchange", () => {
      const o = parseUrlOptions(location.hash);
      const type = o.type ?? this.gen.type;
      const seed = o.seed ?? this.gen.seed;
      if (type !== this.gen.type || seed !== this.gen.seed) this.newWorld(type, seed);
    });

    this.view.onContextChange((lost) => {
      this.hud.showMessage(lost ? "L'image s'est interrompue, le monde revient…" : "Le monde est revenu", 2500);
    });
  }

  private wirePanel(): void {
    const hud = this.hud;
    hud.newWorldButton.addEventListener("click", () => {
      const type = parseWorldType(hud.worldTypeSelect.value) ?? "prairie";
      let seed = parseSeed(hud.seedInput.value) ?? randomSeed();
      // Même type et même graine = le même monde : on en veut un autre.
      if (type === this.gen.type && seed === this.gen.seed) seed = randomSeed();
      this.newWorld(type, seed);
    });
    HOUR_PRESETS.forEach((p, i) => {
      hud.hourButtons[i]?.addEventListener("click", () => this.setHour(p.hour));
    });
    hud.fastTimeButton.addEventListener("click", () => {
      this.timeScale = this.timeScale === 1 ? FAST_TIME : 1;
      hud.setFastTime(this.timeScale !== 1);
    });
    hud.distanceSelect.addEventListener("change", () => {
      const d = Number(hud.distanceSelect.value);
      if (Number.isFinite(d)) this.view.setRenderDistance(d);
    });
  }

  setHour(hour: number): void {
    this.phase = phaseForHour(hour);
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
    const w = this.world;
    const id = w.get(x, y, z);
    if (y === 0 && !isPlantId(id)) {
      this.hud.showMessage("Le sol tout en bas ne se casse pas");
      return;
    }
    if (!w.set(x, y, z, BlockId.Air)) return;
    // Une fleur posée sur le bloc cassé tombe avec lui.
    if (isPlantId(w.get(x, y + 1, z))) w.set(x, y + 1, z, BlockId.Air);
    this.hud.showMessage(`${isPlantId(id) ? "Cueilli" : "Cassé"} : ${this.hud.blockName(id)}`, 1200);
  }

  private placeBlock(): void {
    if (!this.target) return;
    const t = this.target;
    const w = this.world;
    // Viser une fleur et poser : le bloc prend sa place.
    const onPlant = isPlantId(w.get(t.x, t.y, t.z));
    const x = onPlant ? t.x : t.x + t.nx;
    const y = onPlant ? t.y : t.y + t.ny;
    const z = onPlant ? t.z : t.z + t.nz;
    if (!w.inBounds(x, y, z)) {
      this.hud.showMessage("Trop loin : le monde s'arrête ici");
      return;
    }
    if (boxesIntersect(blockBox(x, y, z), this.player.box())) {
      this.hud.showMessage("Pas de place ici : tu es dedans !", 1500);
      return;
    }
    const id = this.selectedBlock();
    if (w.set(x, y, z, id)) this.hud.showMessage(`Posé : ${this.hud.blockName(id)}`, 1200);
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

  /** Accès pour les tests de fumée (et la curiosité de l'adulte, depuis la console du navigateur). */
  private exposeDebug(): void {
    const api = {
      version: VERSION,
      state: () => ({
        type: this.gen.type,
        seed: this.gen.seed,
        spawn: this.gen.spawn,
        player: { x: this.player.x, y: this.player.y, z: this.player.z, onGround: this.player.onGround, inWater: this.player.inWater, headInWater: this.player.headInWater },
        hour: this.sky.hour,
        night: this.sky.night,
        brightness: this.sky.brightness,
        loading: this.loading,
        pending: this.view.chunks.stats.pending,
        faces: this.view.chunks.stats.faces,
        calls: this.renderCalls,
        triangles: this.renderTriangles,
        contextLost: this.view.contextLost,
        contextLosses: this.view.contextLosses,
        renderDistance: this.view.renderDistance,
        target: this.target ? { ...this.target } : null,
        slot: this.selectedSlot,
      }),
      setHour: (h: number) => this.setHour(h),
      /** Oriente le regard (degrés ; cap 0 = vers −Z, inclinaison positive = vers le haut). */
      look: (yawDeg: number, pitchDeg: number) => {
        this.player.yaw = (yawDeg * Math.PI) / 180;
        this.player.pitch = (pitchDeg * Math.PI) / 180;
      },
      teleport: (x: number, y: number, z: number) => this.player.setPosition(x, y, z),
      block: (x: number, y: number, z: number) => this.world.get(x, y, z),
      standY: (x: number, z: number) => this.world.findStandingY(x, z),
      newWorld: (type: WorldTypeId, seed: number) => this.newWorld(type, seed),
      /** Couleur d'un pixel de l'image (fx, fy dans [0, 1], depuis le haut à gauche), lue juste après le rendu. */
      samplePixel: (fx: number, fy: number) => new Promise<number[]>((resolve) => this.pixelRequests.push({ fx, fy, resolve })),
      loseContext: () => this.view.renderer.forceContextLoss(),
      restoreContext: () => this.view.renderer.forceContextRestore(),
    };
    (window as unknown as { cubesDebug: typeof api }).cubesDebug = api;
  }

  private frame(now: number): void {
    const t0 = performance.now();
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
      down: this.keyboard.isDown("ShiftLeft") || this.keyboard.isDown("ShiftRight"),
    });

    // Caméra
    const eye = this.player.eye();
    this.view.camera.position.set(eye.x, eye.y, eye.z);
    this.view.camera.rotation.order = "YXZ";
    this.view.camera.rotation.set(this.player.pitch, this.player.yaw, 0);

    // Jour et nuit, eau
    this.phase = (this.phase + (dt * 1000 * this.timeScale) / DAY_CYCLE_MS) % 1;
    this.sky = skyState(solarTime(this.phase));
    this.view.setSky(this.sky);
    this.view.setUnderwater(this.player.headInWater);
    this.hud.setUnderwater(this.player.headInWater);

    // Visée
    this.target = raycast(this.world, eye, this.player.lookDir(), REACH);
    if (this.target) this.view.setHighlight(this.target.x, this.target.y, this.target.z);
    else this.view.hideHighlight();

    // Monde : sections à (re)mailler, les plus proches d'abord
    const pendingNear = this.view.chunks.pendingNear(this.player.x, this.player.z, LOADING_RADIUS);
    this.loading = pendingNear > 0;
    this.view.chunks.update(eye.x, eye.y, eye.z, this.loading ? MESH_BUDGET_LOADING_MS : MESH_BUDGET_MS);
    this.hud.setLoading(this.loading ? 1 - pendingNear / this.nearSections : null);

    // Rendu
    this.view.render();
    const info = this.view.renderer.info.render;
    this.renderCalls = info.calls;
    this.renderTriangles = info.triangles;
    this.servePixelRequests();

    this.cpuTimes.push(performance.now() - t0);
    if (this.cpuTimes.length > 60) this.cpuTimes.shift();
    this.updateStats(now, dt);
    requestAnimationFrame((n) => this.safeFrame(n));
  }

  private servePixelRequests(): void {
    if (this.pixelRequests.length === 0 || this.view.contextLost) return;
    const gl = this.view.renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    for (const r of this.pixelRequests.splice(0)) {
      const x = Math.min(w - 1, Math.max(0, Math.floor(r.fx * w)));
      const y = Math.min(h - 1, Math.max(0, Math.floor((1 - r.fy) * h)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      r.resolve(Array.from(px));
    }
  }

  private updateStats(now: number, dt: number): void {
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    // Mise à jour de l'affichage 4 fois par seconde
    if (Math.floor(now / 250) === Math.floor((now - dt * 1000) / 250)) return;
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const frameAvg = avg(this.frameTimes);
    const worst = Math.max(...this.frameTimes);
    const cpuAvg = avg(this.cpuTimes);
    const cpuWorst = Math.max(...this.cpuTimes);
    const p = this.player;
    const deg = (r: number) => Math.round((r * 180) / Math.PI);
    const cap = ((deg(p.yaw) % 360) + 360) % 360;
    const cs = this.view.chunks.stats;
    const w = this.world;
    const where = p.headInWater ? "sous l'eau" : p.inWater ? "dans l'eau" : p.onGround ? "sol" : "air";
    this.hud.setInfo(
      `${Math.round(1000 / frameAvg)} i/s  (moy. ${frameAvg.toFixed(1)} ms, pire ${worst.toFixed(0)} ms, calcul ${cpuAvg.toFixed(1)} ms)\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  ${where}  regard ${cap}° ${deg(p.pitch)}°\n` +
        `faces ${cs.faces}  sections ${cs.visibleSections}/${cs.sections}  bloc : ${this.hud.blockName(this.selectedBlock())}\n` +
        `${worldTypeName(this.gen.type)} · graine ${this.gen.seed} · ${formatHour(this.sky.hour)}  ${VERSION}`,
    );
    const g = this.view.gpu;
    const ml = this.mouse;
    this.hud.setDiagnostics(
      [
        `Version : ${VERSION}`,
        `Monde : ${worldTypeName(this.gen.type)}, graine ${this.gen.seed}, ${w.sizeX}×${w.sizeY}×${w.sizeZ}, arbres ${this.gen.stats.trees}, fleurs ${this.gen.stats.flowers}, cactus ${this.gen.stats.cacti}`,
        `Rendu : distance ${this.view.renderDistance} blocs, sections affichées ${cs.visibleSections}/${cs.sections}, en attente ${cs.pending}, appels ${this.renderCalls}, triangles ${this.renderTriangles}`,
        `Calcul par image (hors attente de l'écran) : moy. ${cpuAvg.toFixed(1)} ms, pire ${cpuWorst.toFixed(1)} ms`,
        `Heure : ${formatHour(this.sky.hour)} (${this.sky.night ? "nuit" : "jour"}), vitesse ×${this.timeScale}`,
        `Adresse : ${location.protocol}//${location.host || "(fichier local)"}`,
        `Navigateur : ${navigator.userAgent}`,
        `Écran : ${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio}× (rendu ${g.pixelRatio}×)`,
        `Tactile : pointeur principal ${this.coarsePointer ? "doigt" : "souris"}, interface tactile ${
          this.touchUi ? "affichée" : "masquée"
        } (${navigator.maxTouchPoints} points)`,
        `WebGL2 : ${g.webgl2 ? "oui" : "non"} — ${g.renderer}`,
        `Pointer Lock : ${ml.supported ? "disponible" : "absent"}, ${ml.locked ? "actif" : "inactif"}${ml.inFallback() ? ", mode repli" : ""}, captures ${ml.locks}, écartés ${
          ml.rejectedSettle
        } après capture et ${ml.rejectedLarge} trop grands (> ${MAX_DELTA_PX} px), plus grand reçu ${ml.maxDelta} px${ml.lastError ? `, erreur : ${ml.lastError}` : ""}`,
        `Contexte 3D : ${this.view.contextLost ? "perdu" : "ok"}, perdu ${this.view.contextLosses} fois`,
        `Stockage local : ${this.storageOk}`,
        `Synthèse vocale : ${this.speech.supported ? "disponible" : "absente"}`,
      ].join("\n"),
    );
  }
}
