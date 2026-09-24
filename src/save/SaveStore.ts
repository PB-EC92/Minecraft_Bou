import { AVATARS } from "../game/avatars";
import {
  KEYS,
  parseExport,
  parseProfiles,
  parseSettings,
  parseWorldSave,
  SAVE_VERSION,
  WORLD_SLOTS,
  type ExportFile,
  type Profile,
  type Settings,
  type WorldSave,
} from "./saveFormat";

/**
 * Stockage des sauvegardes dans le stockage local du navigateur (J4). Toutes
 * les lectures passent par les fonctions parse* (données abîmées ignorées) ;
 * toute écriture renvoie un résultat au lieu de lever (stockage plein ou
 * bloqué : le jeu continue, l'adulte est prévenu en mode parent).
 *
 * Firefox rattacherait ce stockage au chemin exact du fichier (non vérifié) :
 * une copie du jeu ailleurs, ou renommée, ne retrouverait pas les mondes. Le
 * mode parent affiche donc le chemin du fichier et propose l'export.
 */
export type WriteResult = { ok: true } | { ok: false; error: string };

export class SaveStore {
  constructor(private readonly storage: Storage | null = SaveStore.localStorageOrNull()) {}

  static localStorageOrNull(): Storage | null {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  get available(): boolean {
    return this.storage !== null;
  }

  loadProfiles(): Profile[] | null {
    return parseProfiles(this.readJson(KEYS.profiles), AVATARS.length);
  }

  saveProfiles(profiles: Profile[]): WriteResult {
    return this.write(KEYS.profiles, { version: SAVE_VERSION, profiles });
  }

  loadSettings(): Settings {
    return parseSettings(this.readJson(KEYS.settings));
  }

  saveSettings(settings: Settings): WriteResult {
    return this.write(KEYS.settings, settings);
  }

  loadWorld(profileId: string, slot: number): WorldSave | null {
    return parseWorldSave(this.readJson(KEYS.world(profileId, slot)));
  }

  saveWorld(profileId: string, slot: number, save: WorldSave): WriteResult {
    return this.write(KEYS.world(profileId, slot), save);
  }

  deleteWorld(profileId: string, slot: number): void {
    try {
      this.storage?.removeItem(KEYS.world(profileId, slot));
    } catch {
      // Stockage bloqué : rien à effacer.
    }
  }

  /** Les trois emplacements d'un profil (null = vide). */
  worlds(profileId: string): (WorldSave | null)[] {
    return Array.from({ length: WORLD_SLOTS }, (_, s) => this.loadWorld(profileId, s));
  }

  /** Tout ce qui est enregistré, pour le fichier d'export. */
  exportAll(now: number): ExportFile | null {
    const profiles = this.loadProfiles();
    if (!profiles) return null;
    const worlds: Record<string, WorldSave> = {};
    for (const p of profiles) {
      this.worlds(p.id).forEach((w, s) => {
        if (w) worlds[KEYS.world(p.id, s)] = w;
      });
    }
    return { app: "cubes", version: SAVE_VERSION, exportedAt: now, profiles, settings: this.loadSettings(), worlds };
  }

  /**
   * Remplace tout par le contenu d'un fichier d'export (texte JSON). Les mondes
   * absents du fichier sont effacés. Renvoie une erreur lisible si le fichier
   * n'est pas une sauvegarde de Cubes.
   */
  importAll(text: string): WriteResult {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: "Ce fichier n'est pas une sauvegarde de Cubes (format illisible)." };
    }
    const file = parseExport(raw, AVATARS.length);
    if (!file) return { ok: false, error: "Ce fichier n'est pas une sauvegarde de Cubes." };
    const r = this.saveProfiles(file.profiles);
    if (!r.ok) return r;
    this.saveSettings(file.settings);
    for (const p of file.profiles) {
      for (let s = 0; s < WORLD_SLOTS; s++) {
        const w = file.worlds[KEYS.world(p.id, s)];
        if (w) {
          const wr = this.saveWorld(p.id, s, w);
          if (!wr.ok) return wr;
        } else this.deleteWorld(p.id, s);
      }
    }
    return { ok: true };
  }

  private readJson(key: string): unknown {
    try {
      const s = this.storage?.getItem(key);
      return s ? (JSON.parse(s) as unknown) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): WriteResult {
    if (!this.storage) return { ok: false, error: "Stockage local indisponible dans ce navigateur." };
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Enregistrement impossible (${String(err)}).` };
    }
  }
}
