import { NIGHT_LENGTHS, exportFileName, savedLabel, type NightLength, type Profile, type Settings, type WorldSave } from "../save/saveFormat";
import type { SaveStore } from "../save/SaveStore";
import { WORLD_TYPES, worldTypeName, type WorldTypeId } from "../engine/terrain";
import { AVATARS, avatarDef } from "../game/avatars";
import { CHOOSE_AVATAR, CHOOSE_SLOT, CHOOSE_WORLD_TYPE, READING_LEVELS, WHO_PLAYS, pick, type ChildText, type ReadingLevel } from "../edu/texts";
import { avatarIcon } from "./avatarIcon";
import { campaignDone, progressLabel } from "../edu/missions";

/** Durée de l'appui long qui ouvre le mode parent (plan : trois secondes). */
export const PARENT_HOLD_MS = 3000;

export interface HomeCallbacks {
  /** Lancer une partie : monde enregistré (save) ou nouveau monde du type choisi. */
  play(profile: Profile, slot: number, save: WorldSave | null, type: WorldTypeId | null): void;
  /** Lire une consigne à voix haute pour ce profil (si sa voix est active). */
  speak(text: ChildText, profile: Profile): void;
  /** Réglages ou profils modifiés en mode parent. */
  settingsChanged(settings: Settings): void;
}

/**
 * Écran d'accueil (J4), en DOM natif : premier réglage par l'adulte (prénoms,
 * niveaux de lecture), « Qui joue ? », choix du personnage, trois emplacements
 * de monde par enfant, choix du type d'un nouveau monde, et mode parent (appui
 * long de trois secondes sur l'engrenage). Les écrans des enfants n'ont que de
 * gros boutons illustrés ; les textes suivent le niveau de lecture du profil.
 */
export class HomeScreen {
  readonly root: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private profiles: Profile[] | null = null;
  private holdTimer: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly store: SaveStore,
    private readonly cb: HomeCallbacks,
  ) {
    this.root = document.createElement("div");
    this.root.className = "home";
    this.content = document.createElement("div");
    this.content.className = "home-content";
    this.root.appendChild(this.content);
    // Les touchers et le clavier de l'accueil ne pilotent pas le jeu qui attend derrière.
    for (const ev of ["mousedown", "mouseup", "touchstart", "touchend", "touchmove", "keydown", "keyup", "wheel"]) {
      this.root.addEventListener(ev, (e) => e.stopPropagation());
    }
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Affiche l'accueil : premier réglage si aucun profil, sinon « Qui joue ? ». */
  show(): void {
    this.root.hidden = false;
    this.profiles = this.store.loadProfiles();
    if (this.profiles) this.showProfiles();
    else this.showSetup(true);
  }

  /** Avertissement en haut de l'écran affiché (J7 : « Ton monde est ouvert ailleurs ») ; disparaît au changement d'écran. */
  notice(text: string): void {
    const n = this.div("home-warning");
    n.textContent = text;
    this.content.prepend(n);
  }

  hide(): void {
    this.root.hidden = true;
    this.cancelHold();
  }

  // ---------- Écrans des enfants ----------

  private showProfiles(): void {
    const profiles = this.profiles;
    if (!profiles) return;
    this.clear("home-profiles");
    this.heading(pick(WHO_PLAYS, "debutant"));
    const row = this.div("home-row");
    for (const p of profiles) {
      const card = this.card(() => {
        if (p.avatar === null) this.showAvatars(p, true);
        else this.showSlots(p);
      });
      card.classList.add("profile-card");
      card.dataset.profile = p.id;
      card.appendChild(avatarIcon(avatarDef(p.avatar), 120));
      if (p.avatar === null) card.classList.add("no-avatar");
      const name = this.div("card-name");
      name.textContent = p.name;
      card.appendChild(name);
      row.appendChild(card);
    }
    this.content.appendChild(row);
    this.content.appendChild(this.parentGear());
  }

  private showAvatars(p: Profile, thenSlots: boolean): void {
    this.clear("home-avatars");
    this.backButton(() => (thenSlots ? this.showProfiles() : this.showSlots(p)));
    this.heading(pick(CHOOSE_AVATAR, p.level));
    this.cb.speak(CHOOSE_AVATAR, p);
    const grid = this.div("home-grid");
    AVATARS.forEach((a, i) => {
      const card = this.card(() => {
        p.avatar = i;
        this.saveProfiles();
        this.showSlots(p);
      });
      card.classList.add("avatar-card");
      card.setAttribute("aria-label", a.name);
      card.dataset.avatar = String(i);
      if (p.avatar === i) card.classList.add("selected");
      card.appendChild(avatarIcon(a, 96));
      grid.appendChild(card);
    });
    this.content.appendChild(grid);
  }

  private showSlots(p: Profile): void {
    this.clear("home-slots");
    this.backButton(() => this.showProfiles());
    const who = this.card(() => this.showAvatars(p, false));
    who.classList.add("who-card");
    who.setAttribute("aria-label", `Changer de personnage (${p.name})`);
    who.appendChild(avatarIcon(avatarDef(p.avatar), 64));
    const name = this.div("card-name");
    name.textContent = p.name;
    who.appendChild(name);
    this.content.appendChild(who);
    this.heading(pick(CHOOSE_SLOT, p.level));
    this.cb.speak(CHOOSE_SLOT, p);
    const row = this.div("home-row");
    const worlds = this.store.worlds(p.id);
    worlds.forEach((w, slot) => {
      const card = this.card(() => {
        if (w) this.cb.play(p, slot, w, null);
        else this.showWorldTypes(p, slot);
      });
      card.classList.add("slot-card");
      card.dataset.slot = String(slot);
      if (w) {
        card.classList.add(`wt-${w.type}`);
        const t = this.div("card-name");
        t.textContent = capitalize(worldTypeName(w.type));
        card.appendChild(t);
        const d = this.div("card-date");
        d.textContent = savedLabel(w.savedAt, Date.now());
        card.appendChild(d);
        // Mission réussie dans ce monde (J6) : une étoile, sans mot à lire.
        if (campaignDone(w.mission)) {
          const star = this.div("card-star");
          star.textContent = "★";
          star.setAttribute("aria-label", "mission réussie");
          card.appendChild(star);
        }
      } else {
        card.classList.add("empty");
        const plus = this.div("card-plus");
        plus.textContent = "+";
        card.appendChild(plus);
        const t = this.div("card-name");
        t.textContent = "Nouveau";
        card.appendChild(t);
      }
      row.appendChild(card);
    });
    this.content.appendChild(row);
  }

  private showWorldTypes(p: Profile, slot: number): void {
    this.clear("home-types");
    this.backButton(() => this.showSlots(p));
    this.heading(pick(CHOOSE_WORLD_TYPE, p.level));
    this.cb.speak(CHOOSE_WORLD_TYPE, p);
    const grid = this.div("home-grid");
    for (const t of WORLD_TYPES.filter((w) => w.forChildren)) {
      const card = this.card(() => this.cb.play(p, slot, null, t.id));
      card.classList.add("type-card", `wt-${t.id}`);
      card.dataset.type = t.id;
      const n = this.div("card-name");
      n.textContent = capitalize(t.name);
      card.appendChild(n);
      grid.appendChild(card);
    }
    this.content.appendChild(grid);
  }

  // ---------- Adulte ----------

  /** Engrenage du mode parent : appui long de trois secondes (un anneau se remplit). */
  private parentGear(): HTMLElement {
    const wrap = this.div("parent-gear-wrap");
    const gear = document.createElement("button");
    gear.type = "button";
    gear.className = "parent-gear";
    gear.setAttribute("aria-label", "Mode parent (garder appuyé 3 secondes)");
    gear.innerHTML =
      '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
    const start = (e: Event) => {
      e.preventDefault();
      this.cancelHold();
      gear.classList.add("pressing");
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null;
        gear.classList.remove("pressing");
        this.showSetup(false);
      }, PARENT_HOLD_MS);
    };
    const stop = () => {
      this.cancelHold();
      gear.classList.remove("pressing");
    };
    gear.addEventListener("pointerdown", start);
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) gear.addEventListener(ev, stop);
    gear.addEventListener("contextmenu", (e) => e.preventDefault());
    wrap.appendChild(gear);
    const hint = this.div("parent-hint");
    hint.textContent = "Adulte : garder appuyé 3 s";
    wrap.appendChild(hint);
    return wrap;
  }

  private cancelHold(): void {
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  /** Réglages de l'adulte. first : premier lancement (pas encore de profils). */
  private showSetup(first: boolean): void {
    this.clear("home-parent");
    const profiles = this.profiles ?? defaultEditable();
    const settings = this.store.loadSettings();
    this.heading(first ? "Bienvenue ! Réglages de l'adulte" : "Mode parent");
    const form = this.div("parent-form");

    const section = (title: string) => {
      const h = document.createElement("h3");
      h.textContent = title;
      form.appendChild(h);
    };

    section("Les deux joueurs");
    const rows = profiles.map((p, i) => {
      const r = this.div("parent-row");
      const name = document.createElement("input");
      name.type = "text";
      name.maxLength = 16;
      name.value = first ? "" : p.name;
      name.placeholder = `Prénom ${i + 1}`;
      name.setAttribute("aria-label", `Prénom du joueur ${i + 1}`);
      const level = document.createElement("select");
      level.setAttribute("aria-label", `Lecture du joueur ${i + 1}`);
      for (const l of READING_LEVELS) {
        const o = document.createElement("option");
        o.value = l.id;
        o.textContent = l.name;
        level.appendChild(o);
      }
      level.value = p.level;
      const voiceLabel = document.createElement("label");
      voiceLabel.className = "check";
      const voice = document.createElement("input");
      voice.type = "checkbox";
      voice.checked = p.voice;
      voice.setAttribute("aria-label", `Voix du joueur ${i + 1}`);
      voiceLabel.append(voice, " voix");
      level.addEventListener("change", () => {
        voice.checked = level.value === "debutant";
      });
      r.append(name, level, voiceLabel);
      form.appendChild(r);
      return { p, name, level, voice };
    });

    section("Nuit");
    const night = document.createElement("select");
    night.setAttribute("aria-label", "Durée de la nuit");
    for (const n of NIGHT_LENGTHS) {
      const o = document.createElement("option");
      o.value = n.id;
      o.textContent = n.name;
      night.appendChild(o);
    }
    night.value = settings.night;
    form.appendChild(night);

    section("Créatures");
    const creaturesLabel = document.createElement("label");
    creaturesLabel.className = "check";
    const creatures = document.createElement("input");
    creatures.type = "checkbox";
    creatures.checked = settings.creatures;
    creatures.setAttribute("aria-label", "Grignotes actives");
    creaturesLabel.append(creatures, " Grignotes actives (la nuit, elles chipent un bloc ; une lampe les éloigne)");
    form.appendChild(creaturesLabel);

    section("Tests");
    const devLabel = document.createElement("label");
    devLabel.className = "check";
    const devTools = document.createElement("input");
    devTools.type = "checkbox";
    devTools.checked = settings.devTools;
    devTools.setAttribute("aria-label", "Panneau Tests visible");
    devLabel.append(devTools, " Afficher le panneau « Tests » et les infos techniques pendant les parties (pour l'adulte)");
    form.appendChild(devLabel);

    const status = this.div("parent-status");

    if (!first) {
      // Progression de chacun (J6) : tutoriel, puis étape de la mission dans chaque monde.
      section("Progression");
      for (const p of profiles) {
        const h = this.div("parent-who");
        h.textContent = `${p.name} : tutoriel ${p.tutorialDone ? "fait" : "pas encore fait"}`;
        form.appendChild(h);
        const list = document.createElement("ul");
        list.className = "parent-progress";
        this.store.worlds(p.id).forEach((w, slot) => {
          if (!w) return;
          const li = document.createElement("li");
          li.textContent = `Monde ${slot + 1} (${worldTypeName(w.type)}) : ${progressLabel(w.mission)}`;
          list.appendChild(li);
        });
        if (list.childElementCount > 0) form.appendChild(list);
      }

      section("Mondes enregistrés");
      for (const p of profiles) {
        const r = this.div("parent-row");
        const label = document.createElement("span");
        label.textContent = `${p.name} :`;
        r.appendChild(label);
        this.store.worlds(p.id).forEach((w, slot) => {
          const b = this.adultButton(w ? `${slot + 1}. ${worldTypeName(w.type)} (${savedLabel(w.savedAt, Date.now())}) — effacer` : `${slot + 1}. vide`);
          b.disabled = !w;
          b.addEventListener("click", () => {
            if (!window.confirm(`Effacer le monde ${slot + 1} de ${p.name} ? C'est définitif (sauf fichier exporté).`)) return;
            this.store.deleteWorld(p.id, slot);
            this.showSetup(false);
          });
          r.appendChild(b);
        });
        form.appendChild(r);
      }

      section("Sauvegarde");
      const where = this.div("parent-note");
      where.textContent =
        `Les mondes sont enregistrés dans ce navigateur, pour ce fichier : ${decodeURIComponent(location.pathname) || location.href}. ` +
        "Sous Firefox, une copie du jeu ailleurs ou renommée ne les retrouverait pas : remplacer le fichier au même endroit, sous le même nom, " +
        "et exporter avant chaque mise à jour.";
      form.appendChild(where);
      const r = this.div("parent-row");
      const exp = this.adultButton("Exporter (fichier)");
      exp.addEventListener("click", () => this.exportFile(status));
      const impLabel = document.createElement("label");
      impLabel.className = "btn";
      impLabel.textContent = "Importer un fichier…";
      const imp = document.createElement("input");
      imp.type = "file";
      imp.accept = ".json,application/json";
      imp.hidden = true;
      imp.setAttribute("aria-label", "Importer une sauvegarde");
      imp.addEventListener("change", () => {
        const f = imp.files?.[0];
        if (f) this.importFile(f, status);
        imp.value = "";
      });
      impLabel.appendChild(imp);
      r.append(exp, impLabel);
      form.appendChild(r);
    }

    const actions = this.div("parent-row");
    const save = this.adultButton(first ? "C'est parti !" : "Enregistrer et fermer");
    save.classList.add("primary");
    save.addEventListener("click", () => {
      const next: Profile[] = rows.map(({ p, name, level, voice }, i) => ({
        id: p.id,
        name: name.value.replace(/\s+/g, " ").trim().slice(0, 16) || `Joueur ${i + 1}`,
        level: level.value as ReadingLevel,
        voice: voice.checked,
        avatar: p.avatar,
        tutorialDone: p.tutorialDone,
      }));
      const r = this.store.saveProfiles(next);
      const s: Settings = { night: night.value as NightLength, creatures: creatures.checked, devTools: devTools.checked };
      this.store.saveSettings(s);
      this.cb.settingsChanged(s);
      this.profiles = next;
      this.showProfiles();
      // Stockage indisponible : on joue quand même (rien ne sera retrouvé à la prochaine ouverture), l'adulte est prévenu.
      if (!r.ok) {
        const warn = this.div("home-warning");
        warn.textContent = `Adulte : ${r.error} Les parties ne seront pas retrouvées.`;
        this.content.appendChild(warn);
      }
    });
    actions.appendChild(save);
    if (!first) {
      const cancel = this.adultButton("Fermer sans enregistrer");
      cancel.addEventListener("click", () => this.showProfiles());
      actions.appendChild(cancel);
    }
    form.appendChild(actions);
    form.appendChild(status);
    this.content.appendChild(form);
  }

  private exportFile(status: HTMLElement): void {
    const data = this.store.exportAll(Date.now());
    if (!data) {
      status.textContent = "Rien à exporter.";
      return;
    }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = exportFileName(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    status.textContent = `Fichier « ${a.download} » créé (dossier des téléchargements).`;
  }

  private importFile(file: File, status: HTMLElement): void {
    if (!window.confirm("Remplacer les profils et tous les mondes par ceux du fichier ?")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = this.store.importAll(String(reader.result ?? ""));
      if (!r.ok) {
        status.textContent = r.error;
        return;
      }
      this.profiles = this.store.loadProfiles();
      this.cb.settingsChanged(this.store.loadSettings());
      this.showSetup(false);
      const st = this.content.querySelector(".parent-status");
      if (st) st.textContent = "Sauvegarde importée.";
    };
    reader.onerror = () => {
      status.textContent = "Lecture du fichier impossible.";
    };
    reader.readAsText(file);
  }

  // ---------- Outils ----------

  private saveProfiles(): void {
    if (this.profiles) this.store.saveProfiles(this.profiles);
  }

  private clear(screen: string): void {
    this.cancelHold();
    this.content.replaceChildren();
    this.content.className = `home-content ${screen}`;
  }

  private heading(text: string): void {
    const h = document.createElement("h1");
    h.textContent = text;
    this.content.appendChild(h);
  }

  private backButton(onClick: () => void): void {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "home-back";
    b.setAttribute("aria-label", "Retour");
    b.textContent = "←";
    b.addEventListener("click", onClick);
    this.content.appendChild(b);
  }

  private card(onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "home-card";
    b.addEventListener("click", onClick);
    return b;
  }

  private adultButton(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = label;
    return b;
  }

  private div(className: string): HTMLDivElement {
    const d = document.createElement("div");
    d.className = className;
    return d;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Profils de départ du premier réglage (lecteur débutant avec voix, lecteur autonome sans). */
function defaultEditable(): Profile[] {
  return [
    { id: "p1", name: "", level: "debutant", voice: true, avatar: null, tutorialDone: false },
    { id: "p2", name: "", level: "autonome", voice: false, avatar: null, tutorialDone: false },
  ];
}

