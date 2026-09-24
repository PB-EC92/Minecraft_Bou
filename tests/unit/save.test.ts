import { describe, expect, it } from "vitest";
import { advancePhase, DAY_CYCLE_MS, DAY_SHARE, phaseForHour, skyState, solarTime } from "../../src/engine/dayNight";
import { isInventoryBlockId } from "../../src/engine/inventory";
import { generateWorld, GENERATOR_VERSION } from "../../src/engine/terrain";
import { World } from "../../src/engine/World";
import { AVATARS, avatarDef } from "../../src/game/avatars";
import { THIRD_PERSON_DISTANCE, thirdPersonCamera } from "../../src/game/thirdPerson";
import {
  cleanName,
  defaultProfiles,
  exportFileName,
  KEYS,
  MAX_NAME_LENGTH,
  parseExport,
  parseProfiles,
  parseSettings,
  parseWorldSave,
  savedLabel,
  WORLD_SLOTS,
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
    expect(GENERATOR_VERSION).toBe(1);
    const prints = Object.fromEntries(
      (["prairie", "ile", "montagne", "desert"] as const).map((t) => [t, fnv(generateWorld(t, 1234).world.data)]),
    );
    expect(prints).toEqual({ prairie: 4017609397, ile: 1218948170, montagne: 34442716, desert: 3537223237 });
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
    expect(p[0]).toEqual({ id: "p1", name: "Léa", level: "debutant", voice: true, avatar: 2 });
    expect(p[1]).toEqual({ id: "p2", name: "Joueur 2", level: "autonome", voice: true, avatar: null });
  });

  it("prénom borné et nettoyé", () => {
    expect(cleanName("a".repeat(40), "x").length).toBe(MAX_NAME_LENGTH);
    expect(cleanName("  Tom   Pouce ", "x")).toBe("Tom Pouce");
    expect(cleanName(42, "x")).toBe("x");
  });

  it("réglages : nuit normale par défaut", () => {
    expect(parseSettings(null)).toEqual({ night: "normale" });
    expect(parseSettings({ night: "courte" })).toEqual({ night: "courte" });
    expect(parseSettings({ night: "jamais" })).toEqual({ night: "normale" });
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
    for (const k of [KEYS.profiles, KEYS.settings, KEYS.world("p1", 0)]) expect(k.startsWith("cubes:")).toBe(true);
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
  it("regard vers le haut : la caméra passe sous le regard sans entrer dans le sol", () => {
    const w = World.createFlat(32, 16, 32, 4);
    const c = thirdPersonCamera(w, { x: 16, y: 5.6, z: 16 }, 0, 1.2);
    expect(c.y).toBeGreaterThanOrEqual(4);
  });
});
