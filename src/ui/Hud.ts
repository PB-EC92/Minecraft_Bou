import { blockDef, type BlockId } from "../engine/blocks";
import { INVENTORY_SLOTS, type Stack } from "../engine/inventory";
import { WORLD_TYPES, type WorldTypeId } from "../engine/terrain";
import { READING_LEVELS } from "../edu/texts";
import { tileIcon } from "../render/textures";

/** Distances de rendu proposées dans le panneau (blocs). */
export const RENDER_DISTANCES = [32, 48, 64, 96, 128] as const;

/** Heures proposées dans le panneau. */
export const HOUR_PRESETS: readonly { label: string; hour: number }[] = [
  { label: "Matin", hour: 8 },
  { label: "Midi", hour: 12 },
  { label: "Soir", hour: 18 },
  { label: "Nuit", hour: 23 },
];

/**
 * Interface superposée au canvas : réticule et anneau de casse, infos
 * (images/s), message, barre d'inventaire à 9 cases avec compteurs (J2),
 * écran de chargement, voile sous l'eau, panneau « Tests » (réglages du
 * prototype). DOM natif, pas de framework.
 */
export class Hud {
  readonly root: HTMLDivElement;
  readonly info: HTMLDivElement;
  readonly message: HTMLDivElement;
  readonly hotbar: HTMLDivElement;
  readonly panel: HTMLDivElement;
  readonly panelToggle: HTMLButtonElement;
  readonly hint: HTMLDivElement;
  readonly diag: HTMLDivElement;
  readonly voiceSelect: HTMLSelectElement;
  readonly voiceText: HTMLTextAreaElement;
  readonly voiceResult: HTMLDivElement;
  readonly speakButton: HTMLButtonElement;
  readonly fullscreenButton: HTMLButtonElement;
  readonly lockButton: HTMLButtonElement;
  readonly worldTypeSelect: HTMLSelectElement;
  readonly seedInput: HTMLInputElement;
  readonly newWorldButton: HTMLButtonElement;
  readonly hourButtons: HTMLButtonElement[] = [];
  readonly fastTimeButton: HTMLButtonElement;
  readonly distanceSelect: HTMLSelectElement;
  readonly levelSelect: HTMLSelectElement;
  readonly voiceToggle: HTMLInputElement;
  readonly soundToggle: HTMLInputElement;
  readonly fillBagButton: HTMLButtonElement;
  readonly clearBagButton: HTMLButtonElement;

  private readonly breakRing: HTMLDivElement;
  private readonly slotName: HTMLDivElement;
  private slotNameTimer = 0;
  /** Contenu affiché de chaque case (pour ne redessiner que ce qui change). */
  private readonly shown: (Stack | null)[] = [];
  private readonly icons = new Map<BlockId, HTMLCanvasElement>();
  private readonly loading: HTMLDivElement;
  private readonly loadingText: HTMLDivElement;
  private readonly underwater: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private messageTimer = 0;
  private readonly selectHandlers: ((index: number) => void)[] = [];

  constructor(
    parent: HTMLElement,
    private readonly atlas: HTMLCanvasElement,
    version: string,
  ) {
    this.root = document.createElement("div");
    this.root.className = "hud";

    this.underwater = this.div("underwater");
    this.root.appendChild(this.underwater);

    const crosshair = this.div("crosshair");
    this.root.appendChild(crosshair);
    this.breakRing = this.div("break-ring");
    this.root.appendChild(this.breakRing);

    this.info = this.div("info");
    this.root.appendChild(this.info);

    this.message = this.div("message");
    this.root.appendChild(this.message);

    this.hint = this.div("hint");
    this.root.appendChild(this.hint);

    this.slotName = this.div("slot-name");
    this.root.appendChild(this.slotName);

    this.hotbar = this.div("hotbar");
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slot = this.div("slot empty");
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);
      slot.appendChild(key);
      const count = document.createElement("span");
      count.className = "count";
      slot.appendChild(count);
      this.shown.push(null);
      const select = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        for (const h of this.selectHandlers) h(i);
      };
      slot.addEventListener("mousedown", select);
      slot.addEventListener("touchstart", select, { passive: false });
      slot.addEventListener("animationend", () => slot.classList.remove("pulse"));
      this.hotbar.appendChild(slot);
      this.slots.push(slot);
    }
    this.root.appendChild(this.hotbar);

    this.loading = this.div("loading");
    this.loadingText = this.div("loading-text");
    this.loading.appendChild(this.loadingText);
    this.root.appendChild(this.loading);

    // ---------- Panneau « Tests » ----------
    this.panelToggle = this.button("Tests");
    this.panelToggle.classList.add("panel-toggle");
    this.root.appendChild(this.panelToggle);

    this.panel = this.div("panel");
    this.panel.appendChild(this.title(`Prototype ${version} — tests techniques`));

    const rowScreen = this.row();
    this.fullscreenButton = this.button("Plein écran");
    this.lockButton = this.button("Capturer la souris");
    rowScreen.append(this.fullscreenButton, this.lockButton);
    this.panel.appendChild(rowScreen);

    this.panel.appendChild(this.title("Jeu"));
    const rowLevel = this.row();
    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Lecture ";
    this.levelSelect = document.createElement("select");
    this.levelSelect.setAttribute("aria-label", "Niveau de lecture");
    for (const l of READING_LEVELS) {
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.name;
      this.levelSelect.appendChild(o);
    }
    levelLabel.appendChild(this.levelSelect);
    rowLevel.appendChild(levelLabel);
    this.panel.appendChild(rowLevel);
    const rowToggles = this.row();
    this.voiceToggle = this.checkbox("Lire les messages à voix haute", rowToggles);
    this.soundToggle = this.checkbox("Sons", rowToggles);
    this.panel.appendChild(rowToggles);
    const rowBag = this.row();
    this.fillBagButton = this.button("Remplir le sac (20 de chaque)");
    this.clearBagButton = this.button("Vider le sac");
    rowBag.append(this.fillBagButton, this.clearBagButton);
    this.panel.appendChild(rowBag);

    this.panel.appendChild(this.title("Monde"));
    const rowWorld = this.row();
    this.worldTypeSelect = document.createElement("select");
    this.worldTypeSelect.setAttribute("aria-label", "Type de monde");
    for (const t of WORLD_TYPES) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      this.worldTypeSelect.appendChild(o);
    }
    this.seedInput = document.createElement("input");
    this.seedInput.type = "number";
    this.seedInput.min = "1";
    this.seedInput.max = "999999";
    this.seedInput.placeholder = "graine (vide = au hasard)";
    this.seedInput.setAttribute("aria-label", "Graine");
    this.newWorldButton = this.button("Nouveau monde");
    rowWorld.append(this.worldTypeSelect, this.seedInput, this.newWorldButton);
    this.panel.appendChild(rowWorld);

    this.panel.appendChild(this.title("Heure"));
    const rowTime = this.row();
    for (const p of HOUR_PRESETS) {
      const b = this.button(p.label);
      this.hourButtons.push(b);
      rowTime.appendChild(b);
    }
    this.fastTimeButton = this.button("Temps ×20");
    rowTime.appendChild(this.fastTimeButton);
    this.panel.appendChild(rowTime);

    this.panel.appendChild(this.title("Distance de rendu"));
    const rowDist = this.row();
    this.distanceSelect = document.createElement("select");
    this.distanceSelect.setAttribute("aria-label", "Distance de rendu");
    for (const d of RENDER_DISTANCES) {
      const o = document.createElement("option");
      o.value = String(d);
      o.textContent = `${d} blocs`;
      this.distanceSelect.appendChild(o);
    }
    rowDist.appendChild(this.distanceSelect);
    this.panel.appendChild(rowDist);

    this.panel.appendChild(this.title("Voix (synthèse vocale)"));
    this.voiceSelect = document.createElement("select");
    this.voiceSelect.setAttribute("aria-label", "Voix");
    this.panel.appendChild(this.voiceSelect);
    this.voiceText = document.createElement("textarea");
    this.voiceText.value = "Bonjour ! Je suis ton compagnon. Bienvenue dans Cubes. Ramasse six bois et quatre pierres.";
    this.panel.appendChild(this.voiceText);
    const rowVoice = this.row();
    this.speakButton = this.button("Tester la voix");
    rowVoice.appendChild(this.speakButton);
    this.panel.appendChild(rowVoice);
    this.voiceResult = this.div("");
    this.panel.appendChild(this.voiceResult);

    this.panel.appendChild(this.title("Diagnostic"));
    this.diag = this.div("diag");
    this.panel.appendChild(this.diag);

    this.root.appendChild(this.panel);

    this.panelToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.panel.classList.toggle("open");
    });

    // Empêche les interactions du panneau de déclencher le jeu (clavier compris : saisie de la graine).
    for (const ev of ["mousedown", "mouseup", "touchstart", "touchend", "touchmove", "keydown", "keyup"]) {
      this.panel.addEventListener(ev, (e) => e.stopPropagation());
    }

    parent.appendChild(this.root);
  }

  private div(className: string): HTMLDivElement {
    const d = document.createElement("div");
    if (className) d.className = className;
    return d;
  }

  private row(): HTMLDivElement {
    return this.div("row");
  }

  private title(text: string): HTMLHeadingElement {
    const h = document.createElement("h2");
    h.textContent = text;
    return h;
  }

  private checkbox(label: string, parent: HTMLElement): HTMLInputElement {
    const l = document.createElement("label");
    l.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    l.append(input, document.createTextNode(` ${label}`));
    parent.appendChild(l);
    return input;
  }

  private button(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = label;
    return b;
  }

  onSelectSlot(h: (index: number) => void): void {
    this.selectHandlers.push(h);
  }

  setSelectedSlot(index: number): void {
    this.slots.forEach((s, i) => s.classList.toggle("selected", i === index));
  }

  /** Met à jour les cases de la barre (icône, compteur) ; seules celles qui ont changé sont redessinées. */
  setInventory(stacks: readonly (Stack | null)[]): void {
    this.slots.forEach((el, i) => {
      const next = stacks[i] ?? null;
      const prev = this.shown[i] ?? null;
      if (prev?.id === next?.id && prev?.count === next?.count) return;
      this.shown[i] = next ? { ...next } : null;
      if (prev?.id !== next?.id) {
        el.querySelector("canvas")?.remove();
        if (next) el.prepend(this.icon(next.id));
      }
      el.classList.toggle("empty", next === null);
      el.title = next ? blockDef(next.id).name : "case vide";
      const count = el.querySelector(".count");
      if (count) count.textContent = next ? String(next.count) : "";
    });
  }

  /** Petite animation sur une case qui vient de recevoir un bloc. */
  pulseSlot(index: number): void {
    const el = this.slots[index];
    if (!el) return;
    el.classList.remove("pulse");
    void el.offsetWidth; // relance l'animation
    el.classList.add("pulse");
  }

  /** Nom du bloc tenu, affiché brièvement au-dessus de la barre (entraînement à la lecture). */
  showSlotName(text: string, durationMs = 1800): void {
    this.slotName.textContent = text;
    this.slotName.classList.add("visible");
    window.clearTimeout(this.slotNameTimer);
    this.slotNameTimer = window.setTimeout(() => this.slotName.classList.remove("visible"), durationMs);
  }

  /** Anneau de casse autour du réticule : progression [0, 1], ou null pour le masquer. */
  setBreakProgress(progress: number | null): void {
    const on = progress !== null && progress > 0;
    this.breakRing.classList.toggle("visible", on);
    if (on) this.breakRing.style.setProperty("--p", progress.toFixed(3));
  }

  private icon(id: BlockId): HTMLCanvasElement {
    let base = this.icons.get(id);
    if (!base) {
      base = tileIcon(this.atlas, blockDef(id).tiles.side);
      this.icons.set(id, base);
    }
    // Chaque case a son propre canvas (un élément DOM ne peut être à deux endroits).
    const c = document.createElement("canvas");
    c.width = base.width;
    c.height = base.height;
    c.getContext("2d")?.drawImage(base, 0, 0);
    return c;
  }

  setInfo(text: string): void {
    this.info.textContent = text;
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  setDiagnostics(text: string): void {
    this.diag.textContent = text;
  }

  setWorldControls(type: WorldTypeId, seed: number): void {
    this.worldTypeSelect.value = type;
    this.seedInput.value = String(seed);
  }

  setDistance(blocks: number): void {
    this.distanceSelect.value = String(blocks);
  }

  setFastTime(on: boolean): void {
    this.fastTimeButton.classList.toggle("on", on);
    this.fastTimeButton.textContent = on ? "Temps normal" : "Temps ×20";
  }

  /** Écran « Construction du monde… » ; null pour le masquer. */
  setLoading(progress: number | null): void {
    this.loading.classList.toggle("visible", progress !== null);
    if (progress !== null) this.loadingText.textContent = `Construction du monde… ${Math.round(progress * 100)} %`;
  }

  setUnderwater(on: boolean): void {
    this.underwater.classList.toggle("visible", on);
  }

  setVoices(voices: SpeechSynthesisVoice[], selectedUri: string | null): void {
    this.voiceSelect.innerHTML = "";
    if (voices.length === 0) {
      const o = document.createElement("option");
      o.textContent = "Aucune voix disponible";
      this.voiceSelect.appendChild(o);
      return;
    }
    for (const v of voices) {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = `${v.name} (${v.lang})${v.localService ? "" : " — en ligne"}`;
      if (v.voiceURI === selectedUri) o.selected = true;
      this.voiceSelect.appendChild(o);
    }
  }

  showMessage(text: string, durationMs = 2500): void {
    this.message.textContent = text;
    this.message.classList.add("visible");
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => this.message.classList.remove("visible"), durationMs);
  }

  blockName(id: BlockId): string {
    return blockDef(id).name;
  }
}
