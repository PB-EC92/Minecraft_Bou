import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { advancePhase, DAY_CYCLE_MS, DAY_SHARE, phaseForHour, skyState, solarTime } from "../../src/engine/dayNight";
import { Inventory, isInventoryBlockId } from "../../src/engine/inventory";
import { generateWorld, GENERATOR_VERSION } from "../../src/engine/terrain";
import { World } from "../../src/engine/World";
import { AVATARS, avatarDef } from "../../src/game/avatars";
import { THIRD_PERSON_DISTANCE, thirdPersonCamera } from "../../src/game/thirdPerson";
import {
  cleanName,
  DEFAULT_SETTINGS,
  defaultProfiles,
  EXPORT_FUTURE_TOLERANCE_MS,
  EXPORT_REMINDER_DAYS,
  exportFileName,
  exportStatus,
  KEYS,
  MAX_NAME_LENGTH,
  parseExport,
  parseLastExport,
  parseProfiles,
  parseSettings,
  parseWorldSave,
  SAVE_VERSION,
  savedLabel,
  SLOT_HOLD_SETTINGS,
  WORLD_SLOTS,
  type WorldSave,
} from "../../src/save/saveFormat";
import { applyDiff, diffBlocks, fromBase64, toBase64 } from "../../src/save/worldDiff";

/** Égalité rapide de deux tableaux d'octets (toEqual est très lent sur un million d'éléments). */
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

describe("écart d'un monde avec son origine", () => {
  it("aller-retour : seuls les blocs changés, restitués à l'identique", () => {
    const base = new Uint8Array(100_000);
    for (let i = 0; i < base.length; i++) base[i] = i % 7;
    const cur = base.slice();
    cur[0] = 9;
    cur[5] = 1;
    cur[127] = 3;
    cur[128] = 4;
    cur[99_999] = 12;
    const d = diffBlocks(base, cur);
    expect(d.length).toBeLessThan(20);
    const back = base.slice();
    expect(applyDiff(back, d)).toBe(5);
    expect(back).toEqual(cur);
  });

  it("aucun changement : écart vide", () => {
    const a = new Uint8Array(10).fill(2);
    expect(diffBlocks(a, a.slice()).length).toBe(0);
    expect(applyDiff(a, new Uint8Array(0))).toBe(0);
  });

  it("grands écarts d'indice (plus d'un million de blocs)", () => {
    const base = new Uint8Array(1_048_576);
    const cur = base.slice();
    cur[1_048_575] = 5;
    cur[200_000] = 2;
    const back = base.slice();
    expect(applyDiff(back, diffBlocks(base, cur))).toBe(2);
    expect(same(back, cur)).toBe(true);
  });

  it("écart illisible ou hors du monde : -1", () => {
    expect(applyDiff(new Uint8Array(10), Uint8Array.from([0x85]))).toBe(-1); // tronqué
    expect(applyDiff(new Uint8Array(10), Uint8Array.from([20, 1]))).toBe(-1); // hors du monde
    expect(applyDiff(new Uint8Array(10), Uint8Array.from([0, 1]))).toBe(-1); // écart nul
    expect(applyDiff(new Uint8Array(10), Uint8Array.from([1, 200]), isInventoryBlockId)).toBe(-1); // bloc inconnu
  });

  it("tailles différentes : erreur", () => {
    expect(() => diffBlocks(new Uint8Array(2), new Uint8Array(3))).toThrow();
  });

  it("base64 aller-retour, et refus d'une chaîne invalide", () => {
    const b = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 31) % 256);
    expect(fromBase64(toBase64(b))).toEqual(b);
    expect(fromBase64("***")).toBeNull();
  });

  it("un vrai monde modifié se restaure depuis sa graine", () => {
    const g = generateWorld("ile", 4242);
    const base = g.world.data.slice();
    g.world.set(10, 30, 10, 4);
    g.world.set(64, 1, 64, 0);
    const edits = toBase64(diffBlocks(base, g.world.data));
    const again = generateWorld("ile", 4242);
    expect(applyDiff(again.world.data, fromBase64(edits)!)).toBe(2);
    expect(same(again.world.data, g.world.data)).toBe(true);
  });
});

/** Empreinte FNV-1a des blocs : change dès qu'un seul bloc généré change. */
function fnv(data: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

describe("empreinte du terrain (sauvegardes)", () => {
  it("le générateur donne toujours le même monde pour une graine", () => {
    // Si ce test échoue après une modification du générateur : les mondes sauvegardés ne se
    // régénèrent plus à l'identique. Incrémenter GENERATOR_VERSION, garder l'ancien générateur
    // pour les anciennes sauvegardes (ou les convertir), puis mettre à jour les empreintes.
    expect(GENERATOR_VERSION).toBe(2);
    const prints = (v: number) =>
      Object.fromEntries((["prairie", "ile", "montagne", "desert"] as const).map((t) => [t, fnv(generateWorld(t, 1234, v).world.data)]));
    // Version 1 (J1 à J4) : doit rester identique pour toujours (mondes enregistrés).
    expect(prints(1)).toEqual({ prairie: 4017609397, ile: 1218948170, montagne: 34442716, desert: 3537223237 });
    expect(prints(2)).toEqual(prints(GENERATOR_VERSION));
    expect(prints(2)).toEqual({ prairie: 1543607028, ile: 2014596441, montagne: 3244624905, desert: 2224779137 });
  });

  it("version 2 : des pierres brillantes en surface ; version 1 : aucune", () => {
    for (const t of ["prairie", "ile", "montagne", "desert"] as const) {
      const g2 = generateWorld(t, 77, 2);
      const g1 = generateWorld(t, 77, 1);
      expect(g2.stats.glowStones, t).toBeGreaterThanOrEqual(5);
      expect(g1.stats.glowStones, t).toBe(0);
      expect(g1.world.data.includes(15)).toBe(false);
      // Une pierre brillante a toujours de l'air au-dessus (visible, atteignable).
      const w = g2.world;
      for (let i = 0; i < w.data.length; i++) {
        if (w.data[i] !== 15) continue;
        expect(w.data[i + w.sizeX * w.sizeZ] ?? 0).toBe(0);
      }
    }
  });
});

describe("profils, réglages, mondes enregistrés", () => {
  it("premier lancement : pas de profils", () => {
    expect(parseProfiles(null, AVATARS.length)).toBeNull();
    expect(parseProfiles({}, AVATARS.length)).toBeNull();
    expect(parseProfiles({ profiles: [{}] }, AVATARS.length)).toBeNull();
  });

  it("lit deux profils et répare les valeurs abîmées", () => {
    const p = parseProfiles(
      { profiles: [{ name: "  Léa  ", level: "debutant", avatar: 2 }, { name: "", level: "xx", voice: true, avatar: 99 }] },
      AVATARS.length,
    )!;
    expect(p[0]).toEqual({ id: "p1", name: "Léa", level: "debutant", voice: true, avatar: 2, tutorialDone: false, craftSeen: false });
    expect(p[1]).toEqual({ id: "p2", name: "Joueur 2", level: "autonome", voice: true, avatar: null, tutorialDone: false, craftSeen: false });
  });

  it("tutoriel fait (J6) : seul true compte, absent avant le J6", () => {
    const p = parseProfiles({ profiles: [{ name: "Léa", tutorialDone: true }, { name: "Tom", tutorialDone: "oui" }] }, AVATARS.length)!;
    expect(p.map((x) => x.tutorialDone)).toEqual([true, false]);
  });

  it("prénom borné et nettoyé", () => {
    expect(cleanName("a".repeat(40), "x").length).toBe(MAX_NAME_LENGTH);
    expect(cleanName("  Tom   Pouce ", "x")).toBe("Tom Pouce");
    expect(cleanName(42, "x")).toBe("x");
  });

  it("réglages : nuit normale par défaut", () => {
    expect(parseSettings(null)).toEqual({ night: "normale", creatures: true, devTools: false, slotHoldMs: 1000 });
    expect(parseSettings({ night: "courte" })).toEqual({ night: "courte", creatures: true, devTools: false, slotHoldMs: 1000 });
    expect(parseSettings({ night: "jamais", creatures: false })).toEqual({ night: "normale", creatures: false, devTools: false, slotHoldMs: 1000 });
    // J7 : panneau Tests masqué pendant les parties des enfants, sauf choix de l'adulte.
    expect(parseSettings({ devTools: true }).devTools).toBe(true);
    expect(parseSettings({ devTools: "oui" }).devTools).toBe(false);
  });

  it("réglage de l'appui long qui vide une case : 0,8 s, 1 s ou 1,2 s ; absent ou invalide → 1 s", () => {
    expect(DEFAULT_SETTINGS.slotHoldMs).toBe(1000);
    expect(SLOT_HOLD_SETTINGS.map((d) => d.id)).toEqual([800, 1000, 1200]);
    for (const ms of [800, 1000, 1200] as const) expect(parseSettings({ slotHoldMs: ms }).slotHoldMs).toBe(ms);
    for (const bad of [undefined, null, 0, 900, 1100, 2000, -800, "800", "0,8", true, NaN, Infinity, [800], { ms: 800 }]) {
      expect(parseSettings({ night: "courte", slotHoldMs: bad })).toEqual({ night: "courte", creatures: true, devTools: false, slotHoldMs: 1000 });
    }
    // Réglages enregistrés par la 1.1-rc (sans ce champ) : 1 s.
    expect(parseSettings({ night: "courte", creatures: false, devTools: true })).toEqual({ night: "courte", creatures: false, devTools: true, slotHoldMs: 1000 });
    // Aller-retour par le stockage (JSON).
    expect(parseSettings(JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, slotHoldMs: 800 }))).slotHoldMs).toBe(800);
  });

  it("un réglage d'appui relu par la lecture de la 1.1-rc (champs connus seulement) est ignoré sans dégât", () => {
    // Documentation, pas une preuve : copie à la main de parseSettings de la 1.1-rc (commit 22b4bb4,
    // src/save/saveFormat.ts, l. 137 à 143 ; NIGHT_LENGTHS l. 45 à 49 ; isObj l. 95), comparée à ce code lors de la
    // relecture. Elle ne garde que nuit, Grignotes et devTools. Ce qui protège vraiment le format : le cas suivant.
    const rcParseSettings = (raw: unknown) => {
      const d = { night: "normale", creatures: true, devTools: false };
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ...d };
      const r = raw as Record<string, unknown>;
      return {
        night: ["normale", "courte", "aucune"].includes(r.night as string) ? r.night : d.night,
        creatures: typeof r.creatures === "boolean" ? r.creatures : d.creatures,
        devTools: typeof r.devTools === "boolean" ? r.devTools : d.devTools,
      };
    };
    const saved = JSON.parse(JSON.stringify({ night: "aucune", creatures: false, devTools: true, slotHoldMs: 800 }));
    expect(rcParseSettings(saved)).toEqual({ night: "aucune", creatures: false, devTools: true });
    expect(parseSettings(saved).slotHoldMs).toBe(800);
  });

  it("format inchangé par le réglage d'appui : même clé, même version, export relu avec tous ses réglages", () => {
    // La 1.1-rc lit la même clé et la même version : ajouter un champ ne demande ni migration ni nouvelle version.
    expect(KEYS.settings).toBe("cubes:reglages");
    expect(SAVE_VERSION).toBe(1);
    // Export d'une 1.1 (réglage d'appui compris) relu par le code actuel : rien ne se perd.
    const withHold = { night: "courte", creatures: false, devTools: true, slotHoldMs: 1200 };
    const f = parseExport(JSON.parse(JSON.stringify({ app: "cubes", version: 1, exportedAt: 5, profiles: { profiles: defaultProfiles() }, settings: withHold, worlds: {} })), AVATARS.length)!;
    expect(f.settings).toEqual(withHold);
    expect(f.version).toBe(SAVE_VERSION);
    // Export d'une 1.1-rc (sans le champ) : les trois réglages relus, appui à 1 s.
    const rc = parseExport({ app: "cubes", version: 1, profiles: { profiles: defaultProfiles() }, settings: { night: "aucune", creatures: false, devTools: true }, worlds: {} }, AVATARS.length)!;
    expect(rc.settings).toEqual({ night: "aucune", creatures: false, devTools: true, slotHoldMs: 1000 });
  });

  const world = {
    version: 1,
    gen: 1,
    type: "ile",
    seed: 12,
    edits: "",
    player: { x: 1, y: 2, z: 3, yaw: 0.5, pitch: -0.2 },
    inventory: { slots: [[3, 5], null, [999, 1]] },
    phase: 1.25,
    savedAt: 1000,
  };

  it("monde : lu, cases inconnues vidées, phase ramenée dans [0, 1)", () => {
    const w = parseWorldSave(world)!;
    expect(w.type).toBe("ile");
    expect(w.inventory.slots).toEqual([[3, 5], null, null]);
    expect(w.phase).toBeCloseTo(0.25);
  });

  it("cadeau en attente (J6) : gardé s'il est valide, ignoré sinon", () => {
    expect(parseWorldSave({ ...world, reward: { block: 16, count: 5 } })!.reward).toEqual({ block: 16, count: 5 });
    expect(parseWorldSave({ ...world, reward: { block: 16, count: 500 } })!.reward).toEqual({ block: 16, count: 99 });
    for (const bad of [{ block: 0, count: 5 }, { block: 16, count: 0 }, { block: 999, count: 1 }, { block: 16, count: 1.5 }, "x", null]) {
      expect(parseWorldSave({ ...world, reward: bad })!.reward).toBeUndefined();
    }
    expect(parseWorldSave(world)!.reward).toBeUndefined();
    expect(parseWorldSave({ ...world, celebrate: true })!.celebrate).toBe(true);
    expect(parseWorldSave({ ...world, celebrate: "oui" })!.celebrate).toBeUndefined();
  });

  it("monde inutilisable : null", () => {
    expect(parseWorldSave(null)).toBeNull();
    expect(parseWorldSave({ ...world, type: "lune" })).toBeNull();
    expect(parseWorldSave({ ...world, seed: "12" })).toBeNull();
    expect(parseWorldSave({ ...world, player: { x: 1 } })).toBeNull();
  });

  it("export : seuls les mondes des deux profils et des trois emplacements", () => {
    const f = parseExport(
      {
        app: "cubes",
        version: 1,
        profiles: { profiles: defaultProfiles() },
        settings: { night: "aucune" },
        worlds: { [KEYS.world("p1", 0)]: world, [KEYS.world("p2", 2)]: world, "cubes:monde:p9:0": world, [KEYS.world("p1", 1)]: { bad: 1 } },
      },
      AVATARS.length,
    )!;
    expect(Object.keys(f.worlds).sort()).toEqual([KEYS.world("p1", 0), KEYS.world("p2", 2)].sort());
    expect(f.settings.night).toBe("aucune");
    expect(parseExport({ app: "autre" }, AVATARS.length)).toBeNull();
  });

  it("clés préfixées cubes:, trois emplacements", () => {
    expect(WORLD_SLOTS).toBe(3);
    for (const k of [KEYS.profiles, KEYS.settings, KEYS.world("p1", 0), KEYS.lastExport]) expect(k.startsWith("cubes:")).toBe(true);
    expect(KEYS.lastExport).toBe("cubes:dernier-export");
  });

  it("nom du fichier d'export et date de la vignette", () => {
    expect(exportFileName(new Date(2026, 8, 4))).toBe("cubes-sauvegarde-2026-09-04.json");
    const now = new Date(2026, 8, 24, 15).getTime();
    expect(savedLabel(new Date(2026, 8, 24, 9).getTime(), now)).toBe("aujourd'hui");
    expect(savedLabel(new Date(2026, 8, 23, 22).getTime(), now)).toBe("hier");
    expect(savedLabel(new Date(2026, 8, 12, 9).getTime(), now)).toBe("12/09");
    expect(savedLabel(0, now)).toBe("");
  });
});

describe("durée de la nuit (mode parent)", () => {
  const nightStart = DAY_SHARE + 0.01;
  it("normale : même vitesse le jour et la nuit", () => {
    expect(advancePhase(0.1, DAY_CYCLE_MS / 100, 1, "normale")).toBeCloseTo(0.11);
    expect(advancePhase(nightStart, DAY_CYCLE_MS / 100, 1, "normale")).toBeCloseTo(nightStart + 0.01);
  });
  it("courte : la nuit passe trois fois plus vite, pas le jour", () => {
    expect(advancePhase(0.1, DAY_CYCLE_MS / 100, 1, "courte")).toBeCloseTo(0.11);
    expect(advancePhase(nightStart, DAY_CYCLE_MS / 100, 1, "courte")).toBeCloseTo(nightStart + 0.03);
  });
  it("aucune : jamais de nuit pleine", () => {
    let p = phaseForHour(8);
    for (let i = 0; i < 2000; i++) {
      p = advancePhase(p, 1000, 1, "aucune");
      expect(skyState(solarTime(p)).night).toBe(false);
    }
  });
});

describe("avatars", () => {
  it("six dessins, couleurs valides", () => {
    expect(AVATARS.length).toBe(6);
    for (const a of AVATARS) for (const c of [a.skin, a.hair, a.shirt, a.pants, a.shoes]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("index inconnu : le premier", () => {
    expect(avatarDef(null)).toBe(AVATARS[0]);
    expect(avatarDef(42)).toBe(AVATARS[0]);
    expect(avatarDef(3)).toBe(AVATARS[3]);
  });
});

describe("caméra à la troisième personne", () => {
  it("en plein air : reculée de la distance entière, derrière le regard", () => {
    const w = World.createFlat(32, 16, 32, 4);
    const eye = { x: 16, y: 6, z: 16 };
    const c = thirdPersonCamera(w, eye, 0, 0); // regard vers -Z : caméra vers +Z
    expect(c.distance).toBeCloseTo(THIRD_PERSON_DISTANCE, 1);
    expect(c.z).toBeGreaterThan(eye.z + 3.5);
    expect(c.x).toBeCloseTo(eye.x);
  });
  it("un mur derrière : la caméra reste devant le mur", () => {
    const w = World.createFlat(32, 16, 32, 4);
    for (let y = 4; y < 10; y++) for (let x = 10; x < 22; x++) w.set(x, y, 18, 1);
    const eye = { x: 16.5, y: 6, z: 16.5 };
    const c = thirdPersonCamera(w, eye, 0, 0);
    expect(c.z).toBeLessThan(18);
    expect(c.distance).toBeLessThan(1.5);
  });
  it("sous un plafond bas : la caméra n'entre pas dans le plafond", () => {
    const w = World.createFlat(32, 16, 32, 4);
    for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) w.set(x, 6, z, 1); // plafond à 2 blocs du sol
    const c = thirdPersonCamera(w, { x: 16.5, y: 5.62, z: 16.5 }, 0, 0);
    expect(c.y).toBeLessThan(6);
    expect(c.distance).toBeGreaterThan(3);
  });
  it("mur en escalier vu en diagonale : la caméra ne se faufile pas entre deux blocs qui se touchent par un coin (J7)", () => {
    const w = World.createFlat(32, 16, 32, 4);
    for (let k = 2; k < 30; k++) for (let y = 4; y < 9; y++) w.set(k, y, k, 3); // blocs (k, k) : un mur en diagonale
    const eye = { x: 9, y: 5.6, z: 13 }; // d'un côté du mur (x < z) ; en reculant, le rayon passe par le coin (11, 11)
    const c = thirdPersonCamera(w, eye, (3 * Math.PI) / 4, 0);
    expect(c.x).toBeLessThan(c.z); // reste du même côté
    expect(c.distance).toBeLessThan(2.9);
    expect(c.distance).toBeGreaterThan(1.5);
  });
  it("regard vers le haut : la caméra passe sous le regard sans entrer dans le sol", () => {
    const w = World.createFlat(32, 16, 32, 4);
    const c = thirdPersonCamera(w, { x: 16, y: 5.6, z: 16 }, 0, 1.2);
    expect(c.y).toBeGreaterThanOrEqual(4);
  });
});

/** Stockage en mémoire ; failOn : clé dont l'écriture échoue (stockage plein). */
function memoryStorage(failOn: (key: string) => boolean = () => false) {
  const m = new Map<string, string>();
  const storage = {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => m.get(k) ?? null,
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => {
      if (failOn(k)) throw new Error("QuotaExceededError");
      m.set(k, v);
    },
  } as Storage;
  return { storage, m };
}

describe("import tout ou rien (J7)", () => {
  const world = (seed: number) => ({
    version: 1, gen: 2, type: "ile", seed, edits: "", player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 },
    inventory: { slots: [] }, phase: 0.2, savedAt: 1,
  });

  it("une écriture qui échoue au milieu : profils, réglages et mondes reviennent à l'état d'avant", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    let failing = false;
    const { storage, m } = memoryStorage((k) => failing && k === "cubes:monde:p2:0");
    const store = new SaveStore(storage);
    store.saveProfiles(defaultProfiles());
    store.saveSettings({ night: "courte", creatures: false, devTools: false, slotHoldMs: 1000 });
    store.saveWorld("p1", 0, parseWorldSave(world(11))!);
    store.saveWorld("p1", 2, parseWorldSave(world(12))!);
    const before = new Map(m);
    const file = {
      app: "cubes", version: 1, exportedAt: 2,
      profiles: [{ name: "Léa", level: "debutant", avatar: 1 }, { name: "Tom", level: "autonome", avatar: 2 }],
      settings: { night: "normale", creatures: true },
      worlds: { "cubes:monde:p1:0": world(21), "cubes:monde:p2:0": world(22) },
    };
    failing = true;
    const r = store.importAll(JSON.stringify(file));
    expect(r.ok).toBe(false);
    expect(new Map(m)).toEqual(before);
    // Sans échec, l'import remplace tout (le monde 3 de Léa, absent du fichier, est effacé).
    failing = false;
    expect(store.importAll(JSON.stringify(file)).ok).toBe(true);
    expect(store.loadWorld("p1", 0)?.seed).toBe(21);
    expect(store.loadWorld("p1", 2)).toBeNull();
    expect(store.loadProfiles()?.[0]?.name).toBe("Léa");
  });

  it("stockage devenu inutilisable pendant l'import : aucune clé qui existait n'est effacée, l'adulte est prévenu (relecture J7)", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    let broken = false;
    let writes = 0;
    const { storage, m } = memoryStorage(() => broken && ++writes > 2); // deux écritures passent, puis plus rien
    const store = new SaveStore(storage);
    store.saveProfiles(defaultProfiles());
    store.saveWorld("p1", 0, parseWorldSave(world(11))!);
    store.saveWorld("p2", 1, parseWorldSave(world(12))!);
    broken = true;
    const file = { app: "cubes", version: 1, exportedAt: 2, profiles: [{ name: "Léa" }, { name: "Tom" }], settings: {}, worlds: { "cubes:monde:p1:0": world(21) } };
    const r = store.importAll(JSON.stringify(file));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("pas pu être remis");
    // Les mondes d'avant sont toujours là (l'ancienne restauration commençait par tout effacer).
    expect(JSON.parse(m.get("cubes:monde:p1:0")!).seed).toBe(11);
    expect(JSON.parse(m.get("cubes:monde:p2:1")!).seed).toBe(12);
  });

  it("copies de secours : exportées puis réimportées (le message à l'adulte le promet, relecture J7)", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const a = new SaveStore(memoryStorage().storage);
    a.saveProfiles(defaultProfiles());
    a.saveWorld("p1", 0, parseWorldSave(world(11))!);
    a.backupWorld("p1", 0, parseWorldSave(world(99))!);
    const exported = a.exportAll(5)!;
    expect(exported.backups?.["cubes:monde:p1:0:secours"]?.seed).toBe(99);
    const { storage, m } = memoryStorage();
    const b = new SaveStore(storage);
    expect(b.importAll(JSON.stringify(exported)).ok).toBe(true);
    expect(JSON.parse(m.get("cubes:monde:p1:0:secours")!).seed).toBe(99);
    // Un export plus ancien, sans copies de secours, reste lisible.
    const old = { ...exported };
    delete old.backups;
    expect(parseExport(JSON.parse(JSON.stringify(old)), AVATARS.length)?.backups).toBeUndefined();
  });
});

const NB = " ";
const DAY = 86_400_000;
/** Dimanche 1er novembre 2026, 15 h (heure locale). */
const NOW = new Date(2026, 10, 1, 15).getTime();

/** Monde enregistré minimal (forme écrite par le jeu). */
const savedWorld = (seed: number) => ({
  version: 1, gen: 2, type: "ile", seed, edits: "", player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 },
  inventory: { slots: [] }, phase: 0.2, savedAt: 1,
});

/** Fichier d'export (texte) daté de exportedAt, avec un monde pour Léa. */
const exportText = (exportedAt: number) =>
  JSON.stringify({
    app: "cubes", version: 1, exportedAt,
    profiles: [{ name: "Léa" }, { name: "Tom" }], settings: {}, worlds: { "cubes:monde:p1:0": savedWorld(21) },
  });

describe("date du dernier export (V2)", () => {
  it("parseLastExport : seule une date valide est lue, sans jamais lever", () => {
    expect(parseLastExport({ at: 1234 })).toBe(1234);
    expect(parseLastExport(JSON.parse(JSON.stringify({ at: NOW })))).toBe(NOW);
    const bad = [null, undefined, "x", "1234", 42, [], [1234], {}, { at: 0 }, { at: -5 }, { at: "1234" }, { at: Number.NaN }, { at: Infinity }, { at: null }];
    for (const raw of bad) expect(parseLastExport(raw)).toBeNull();
    const trap = new Proxy({}, { get() { throw new Error("piège"); } });
    expect(parseLastExport(trap)).toBeNull();
    const revoked = Proxy.revocable({ at: 5 }, {});
    revoked.revoke();
    expect(parseLastExport(revoked.proxy)).toBeNull();
  });

  it("les quatre libellés : jamais, aujourd'hui, hier, il y a N jours (date JJ/MM/AAAA)", () => {
    expect(exportStatus(null, NOW, 0).label).toBe(`Dernier export${NB}: jamais.`);
    const today = exportStatus(new Date(2026, 10, 1, 9).getTime(), NOW, 1);
    expect(today.label).toBe(`Dernier export${NB}: aujourd'hui (01/11/2026).`);
    expect(today.days).toBe(0);
    const yesterday = exportStatus(new Date(2026, 9, 31, 22).getTime(), NOW, 1);
    expect(yesterday.label).toBe(`Dernier export${NB}: hier (31/10/2026).`);
    expect(yesterday.days).toBe(1);
    const nine = exportStatus(new Date(2026, 9, 23, 10).getTime(), NOW, 1);
    expect(nine.label).toBe(`Dernier export${NB}: il y a 9 jours (23/10/2026).`);
    expect(nine.days).toBe(9);
  });

  it("jamais exporté alors qu'il y a des mondes : rappel", () => {
    expect(exportStatus(null, NOW, 2)).toEqual({
      at: null,
      days: null,
      due: true,
      label: `Dernier export${NB}: jamais.`,
      reminder:
        `Rappel${NB}: les mondes des enfants n'ont encore jamais été exportés. ` +
        "Un fichier d'export les protège si le navigateur est vidé ou si le fichier du jeu change de place.",
    });
  });

  it("plus de 7 jours : rappel ; 7 jours pile : pas de rappel", () => {
    expect(EXPORT_REMINDER_DAYS).toBe(7);
    const nine = new Date(2026, 9, 23, 10).getTime();
    expect(exportStatus(nine, NOW, 1)).toEqual({
      at: nine,
      days: 9,
      due: true,
      label: `Dernier export${NB}: il y a 9 jours (23/10/2026).`,
      reminder:
        `Rappel${NB}: dernier export il y a 9 jours. ` +
        "Un fichier d'export protège les mondes des enfants si le navigateur est vidé ou si le fichier du jeu change de place.",
    });
    expect(exportStatus(NOW - 7 * DAY - 1, NOW, 1).due).toBe(true);
    const seven = exportStatus(NOW - 7 * DAY, NOW, 3);
    expect(seven.due).toBe(false);
    expect(seven.reminder).toBeNull();
    expect(seven.days).toBe(7);
    expect(seven.label).toBe(`Dernier export${NB}: il y a 7 jours (25/10/2026).`);
  });

  it("aucun monde : jamais de rappel", () => {
    for (const at of [null, NOW - 40 * DAY, NOW]) {
      expect(exportStatus(at, NOW, 0).due).toBe(false);
      expect(exportStatus(at, NOW, 0).reminder).toBeNull();
    }
  });

  // Ce cas remplace « horloge reculée : compte pour aujourd'hui, sans rappel », qui figeait le défaut (constat 12 de
  // la revue du J8) : une date d'export de 40 jours dans le futur cachait le rappel jusqu'à ce que l'horloge la
  // rattrape, avec le libellé « aujourd'hui » pendant tout ce temps.
  it("export daté du futur : moins d'un jour d'avance, compté pour aujourd'hui ; plus d'un jour, date incertaine avec rappel", () => {
    expect(EXPORT_FUTURE_TOLERANCE_MS).toBe(DAY);
    for (const ahead of [1, 3 * 3_600_000, DAY]) {
      expect(exportStatus(NOW + ahead, NOW, 2)).toEqual({
        at: NOW,
        days: 0,
        due: false,
        label: `Dernier export${NB}: aujourd'hui (01/11/2026).`,
        reminder: null,
      });
    }
    const uncertain = {
      at: null,
      days: null,
      due: true,
      label: `Dernier export${NB}: date incertaine (l'horloge de l'ordinateur a changé).`,
      reminder:
        `Rappel${NB}: la date du dernier export est incertaine (l'horloge de l'ordinateur a changé). ` +
        "Un fichier d'export protège les mondes des enfants si le navigateur est vidé ou si le fichier du jeu change de place.",
    };
    expect(exportStatus(NOW + DAY + 1, NOW, 2)).toEqual(uncertain);
    // Horloge en avance de 40 jours pendant l'export, remise à l'heure : le rappel est là tout de suite, et chaque
    // jour jusqu'à ce que l'horloge rattrape la date (avant : « aujourd'hui », sans rappel, pendant 40 jours).
    const at = NOW + 40 * DAY;
    for (const d of [0, 1, 7, 20, 38]) expect(exportStatus(at, NOW + d * DAY, 1)).toEqual(uncertain);
    // Aucun monde : la date reste incertaine, mais pas de rappel.
    expect(exportStatus(at, NOW, 0)).toMatchObject({ due: false, reminder: null, label: uncertain.label });
    // Un nouvel export (date du jour) remet tout d'aplomb.
    expect(exportStatus(NOW, NOW, 2)).toMatchObject({ at: NOW, days: 0, due: false, reminder: null });
  });

  it("textes pour l'adulte : espace insécable devant « : », jamais d'espace simple devant la ponctuation", () => {
    for (const s of [exportStatus(null, NOW, 1), exportStatus(NOW - 9 * DAY, NOW, 1), exportStatus(NOW + 40 * DAY, NOW, 1)]) {
      for (const t of [s.label, s.reminder ?? ""]) {
        expect(t).toContain(`${NB}:`);
        expect(t).not.toMatch(/ [:;!?]/);
      }
    }
  });
});

describe("SaveStore : dernier export et nombre de mondes (V2)", () => {
  it("markExported puis lastExportAt ; date invalide refusée ; donnée abîmée lue comme « jamais »", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const { storage, m } = memoryStorage();
    const store = new SaveStore(storage);
    expect(store.lastExportAt()).toBeNull();
    expect(store.markExported(NOW)).toEqual({ ok: true });
    expect(store.lastExportAt()).toBe(NOW);
    expect(JSON.parse(m.get(KEYS.lastExport)!)).toEqual({ at: NOW });
    for (const bad of [0, -1, Number.NaN, Infinity]) expect(store.markExported(bad).ok).toBe(false);
    expect(store.lastExportAt()).toBe(NOW);
    m.set(KEYS.lastExport, "{abîmé");
    expect(store.lastExportAt()).toBeNull();
    m.set(KEYS.lastExport, JSON.stringify({ at: "hier" }));
    expect(store.lastExportAt()).toBeNull();
    // Stockage indisponible : jamais exporté, et l'écriture le dit.
    expect(new SaveStore(null).lastExportAt()).toBeNull();
    expect(new SaveStore(null).markExported(NOW).ok).toBe(false);
  });

  it("worldCount : mondes des deux profils, sans les copies de secours", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const { storage, m } = memoryStorage();
    const store = new SaveStore(storage);
    expect(store.worldCount()).toBe(0);
    // Avant le premier réglage (pas de profils enregistrés) : p1 et p2 par défaut.
    store.saveWorld("p1", 0, parseWorldSave(savedWorld(1))!);
    expect(store.worldCount()).toBe(1);
    store.saveProfiles(defaultProfiles());
    store.saveWorld("p2", 2, parseWorldSave(savedWorld(2))!);
    store.backupWorld("p1", 1, parseWorldSave(savedWorld(3))!);
    expect(store.worldCount()).toBe(2);
    m.set(KEYS.world("p1", 1), "abîmé"); // illisible : n'est pas un monde
    m.set("cubes:monde:p3:0", JSON.stringify(savedWorld(4))); // profil inconnu
    expect(store.worldCount()).toBe(2);
    expect(new SaveStore(null).worldCount()).toBe(0);
  });

  it("importAll : date du fichier retenue si elle est plus récente, jamais dans le futur", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const store = new SaveStore(memoryStorage().storage);
    expect(store.importAll(exportText(NOW - 3 * DAY), NOW)).toEqual({ ok: true });
    expect(store.lastExportAt()).toBe(NOW - 3 * DAY);
    // Fichier plus ancien : la date retenue ne recule pas.
    expect(store.importAll(exportText(NOW - 10 * DAY), NOW).ok).toBe(true);
    expect(store.lastExportAt()).toBe(NOW - 3 * DAY);
    // Fichier plus récent.
    expect(store.importAll(exportText(NOW - DAY), NOW).ok).toBe(true);
    expect(store.lastExportAt()).toBe(NOW - DAY);
    // Fichier daté du futur (horloge d'un autre appareil) : ramené à maintenant.
    expect(store.importAll(exportText(NOW + 5 * DAY), NOW).ok).toBe(true);
    expect(store.lastExportAt()).toBe(NOW);
    // Maintenant par défaut : l'horloge du navigateur.
    const other = new SaveStore(memoryStorage().storage);
    const before = Date.now();
    expect(other.importAll(exportText(before + 30 * DAY)).ok).toBe(true);
    expect(other.lastExportAt()).toBeGreaterThanOrEqual(before);
    expect(other.lastExportAt()).toBeLessThanOrEqual(Date.now());
    // Fichier sans date : rien n'est retenu.
    const undated = new SaveStore(memoryStorage().storage);
    expect(undated.importAll(JSON.stringify({ app: "cubes", profiles: [{ name: "Léa" }, { name: "Tom" }] }), NOW).ok).toBe(true);
    expect(undated.lastExportAt()).toBeNull();
  });

  it("importAll qui échoue : la date ne bouge pas, et le tout ou rien du J7 reste intact", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    let failing = false;
    const { storage, m } = memoryStorage((k) => failing && k === "cubes:monde:p1:0");
    const store = new SaveStore(storage);
    store.saveProfiles(defaultProfiles());
    store.saveWorld("p1", 0, parseWorldSave(savedWorld(11))!);
    store.markExported(NOW - 20 * DAY);
    const before = new Map(m);
    failing = true;
    expect(store.importAll(exportText(NOW - DAY), NOW).ok).toBe(false);
    expect(new Map(m)).toEqual(before);
    expect(store.lastExportAt()).toBe(NOW - 20 * DAY);
    // Fichier illisible, ou d'un autre jeu : rien ne change non plus.
    expect(store.importAll("pas du json", NOW).ok).toBe(false);
    expect(store.importAll(JSON.stringify({ app: "autre", exportedAt: NOW }), NOW).ok).toBe(false);
    expect(new Map(m)).toEqual(before);
  });

  it("importAll réussi même si la date ne peut pas être écrite", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const store = new SaveStore(memoryStorage((k) => k === KEYS.lastExport).storage);
    expect(store.importAll(exportText(NOW - DAY), NOW)).toEqual({ ok: true });
    expect(store.loadWorld("p1", 0)?.seed).toBe(21);
    expect(store.lastExportAt()).toBeNull();
  });

  it("la date du dernier export n'entre pas dans le fichier d'export (format inchangé)", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const store = new SaveStore(memoryStorage().storage);
    store.saveProfiles(defaultProfiles());
    store.saveWorld("p1", 0, parseWorldSave(savedWorld(5))!);
    store.markExported(NOW - DAY);
    const file = store.exportAll(NOW)!;
    expect(JSON.stringify(file)).not.toContain("dernier-export");
    expect(Object.keys(file).sort()).toEqual(["app", "exportedAt", "profiles", "settings", "version", "worlds"]);
    expect(file.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(1);
  });
});

describe("marteau découvert (V2, craftSeen)", () => {
  it("absent → faux ; seul true compte ; faux dans les profils par défaut", () => {
    const p = parseProfiles({ profiles: [{ name: "Léa", craftSeen: true }, { name: "Tom", craftSeen: "oui" }] }, AVATARS.length)!;
    expect(p.map((x) => x.craftSeen)).toEqual([true, false]);
    const old = parseProfiles({ profiles: [{ name: "Léa" }, { name: "Tom" }] }, AVATARS.length)!;
    expect(old.map((x) => x.craftSeen)).toEqual([false, false]);
    expect(defaultProfiles().map((x) => x.craftSeen)).toEqual([false, false]);
  });

  it("vrai relu ; gardé par un export puis un import", async () => {
    const { SaveStore } = await import("../../src/save/SaveStore");
    const a = new SaveStore(memoryStorage().storage);
    const profiles = defaultProfiles();
    profiles[0]!.craftSeen = true;
    a.saveProfiles(profiles);
    expect(a.loadProfiles()?.map((x) => x.craftSeen)).toEqual([true, false]);
    a.saveWorld("p1", 0, parseWorldSave(savedWorld(8))!);
    const b = new SaveStore(memoryStorage().storage);
    expect(b.importAll(JSON.stringify(a.exportAll(NOW)), NOW).ok).toBe(true);
    expect(b.loadProfiles()?.map((x) => x.craftSeen)).toEqual([true, false]);
  });
});

describe("compatibilité avec la 1.0-rc et blocs du lot 1 (V2)", () => {
  /** Monde tel que l'écrit la 1.0-rc (mission en cours, cadeau en attente, félicitations à montrer). */
  function rcWorld(): WorldSave {
    const base = new Uint8Array(4096);
    const cur = base.slice();
    cur[10] = BlockId.Planks;
    cur[200] = BlockId.Lamp;
    cur[3000] = BlockId.Fence;
    return {
      version: 1,
      gen: 2,
      type: "prairie",
      seed: 31,
      edits: toBase64(diffBlocks(base, cur)),
      player: { x: 64.5, y: 20, z: 70.25, yaw: 1.2, pitch: -0.3 },
      inventory: { slots: [[6, 6], [3, 4], [13, 1], [16, 5], null, [14, 2], null, null, null] },
      phase: 0.4,
      savedAt: new Date(2026, 9, 30, 18).getTime(),
      mission: { id: "abri", step: 3, counts: { "place:any": 4, walk: 12.5 } },
      reward: { block: 16, count: 5 },
      celebrate: true,
    };
  }

  it("un monde de la 1.0-rc est relu à l'identique", () => {
    const save = rcWorld();
    expect(parseWorldSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it("un monde enregistré pendant le soir retenu est relu à la même phase (il reste figé)", () => {
    for (const h of [17, 17.5]) {
      const phase = phaseForHour(h);
      expect(parseWorldSave(JSON.parse(JSON.stringify({ ...savedWorld(1), phase })))!.phase).toBe(phase);
    }
  });

  it("profils et fichier d'export de la 1.0-rc : relus, marteau pas encore découvert", async () => {
    const rcProfiles = [
      { id: "p1", name: "Léa", level: "debutant", voice: true, avatar: 1, tutorialDone: true },
      { id: "p2", name: "Tom", level: "autonome", voice: false, avatar: 3, tutorialDone: false },
    ];
    const p = parseProfiles(JSON.parse(JSON.stringify({ version: 1, profiles: rcProfiles })), AVATARS.length);
    expect(p).toEqual(rcProfiles.map((x) => ({ ...x, craftSeen: false })));
    const { SaveStore } = await import("../../src/save/SaveStore");
    const store = new SaveStore(memoryStorage().storage);
    const file = {
      app: "cubes", version: 1, exportedAt: NOW - 2 * DAY, profiles: rcProfiles,
      settings: { night: "courte", creatures: true, devTools: false }, worlds: { [KEYS.world("p1", 0)]: rcWorld() },
    };
    expect(store.importAll(JSON.stringify(file), NOW).ok).toBe(true);
    expect(store.loadWorld("p1", 0)).toEqual(rcWorld());
    expect(store.lastExportAt()).toBe(NOW - 2 * DAY);
  });

  it("un écart avec du verre et des lettres (octets 17 à 43) est encodé, puis relu à l'identique avec le filtre de Game.loadSave", () => {
    const loadFilter = (id: number) => id === BlockId.Air || isInventoryBlockId(id); // comme Game.loadSave
    const g = generateWorld("ile", 4242);
    const base = g.world.data.slice();
    for (let id = BlockId.Glass; id <= BlockId.LetterZ; id++) g.world.set(20 + id, 40, 30, id);
    g.world.set(64, 1, 64, BlockId.Air);
    const edits = toBase64(diffBlocks(base, g.world.data));
    const save = parseWorldSave({ ...savedWorld(4242), edits })!;
    expect(save.edits).toBe(edits);
    const again = generateWorld("ile", 4242);
    expect(applyDiff(again.world.data, fromBase64(save.edits)!, loadFilter)).toBe(BlockId.LetterZ - BlockId.Glass + 2);
    expect(same(again.world.data, g.world.data)).toBe(true);
    // Un octet au-delà du registre reste refusé (le jeu garderait une copie de secours et régénérerait le monde).
    expect(applyDiff(new Uint8Array(10), Uint8Array.from([1, BlockId.LetterZ + 1]), loadFilter)).toBe(-1);
  });

  it("un sac contenant du verre est relu", () => {
    const slots = [[BlockId.Glass, 12], [BlockId.Planks, 3], null, [BlockId.Fence, 1]];
    const save = parseWorldSave(JSON.parse(JSON.stringify({ ...savedWorld(7), inventory: { slots } })))!;
    expect(save.inventory.slots).toEqual(slots);
    const inv = Inventory.fromJSON(save.inventory);
    expect(inv.slot(0)).toEqual({ id: BlockId.Glass, count: 12 });
    expect(inv.count(BlockId.Glass)).toBe(12);
    expect(inv.count(BlockId.Fence)).toBe(1);
  });
});
