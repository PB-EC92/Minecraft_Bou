import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import {
  CAMPAIGN,
  campaignDone,
  MISSION_1,
  MissionRunner,
  nextMission,
  progressLabel,
  resumeMission,
  SHELTER_PARTS,
  stepText,
  TUTORIAL,
  type MissionView,
} from "../../src/edu/missions";
import type { ShelterCheck } from "../../src/engine/shelter";
import { COMPANION_TELEPORT, companionGoal, stepCompanion } from "../../src/game/companion";

const bag = (counts: Partial<Record<BlockId, number>>): MissionView => ({ count: (id) => counts[id] ?? 0 });
const shelterView = (c: ShelterCheck): MissionView => ({ count: () => 0, shelter: () => c });

describe("moteur de missions", () => {
  it("mission 1 : troncs, pierres, abri, lampe trouvée, lampe posée, Grignotes qui fuient la lampe", () => {
    const m = new MissionRunner(MISSION_1);
    expect(m.stepIndex).toBe(0);
    expect(m.progress(bag({ [BlockId.Log]: 2 }))).toEqual({ have: 2, need: 6 });
    expect(m.update(bag({ [BlockId.Log]: 5 }))).toBeNull();
    expect(m.update(bag({ [BlockId.Log]: 7 }))).toEqual({ kind: "step", index: 1 });
    expect(m.progress(bag({ [BlockId.Log]: 7 }))).toEqual({ have: 0, need: 4 });
    expect(m.update(bag({ [BlockId.Stone]: 4 }))).toEqual({ kind: "step", index: 2 });
    // Abri : il faut le toit, trois murs, et qu'il soit fait par l'enfant.
    expect(m.current()?.goal.kind).toBe("shelter");
    expect(m.progress(bag({}))).toEqual({ have: 0, need: SHELTER_PARTS });
    expect(m.update(shelterView({ roof: false, walls: 4, own: true, ok: false }))).toBeNull();
    expect(m.progress(shelterView({ roof: false, walls: 4, own: true, ok: false }))).toEqual({ have: 3, need: 4 });
    expect(m.progress(shelterView({ roof: true, walls: 3, own: false, ok: false }))).toEqual({ have: 3, need: 4 });
    expect(m.update(shelterView({ roof: true, walls: 3, own: true, ok: true }))).toEqual({ kind: "step", index: 3 });
    expect(m.update(bag({ [BlockId.Lamp]: 1 }))).toEqual({ kind: "step", index: 4 });
    // Les blocs posés avant l'étape ne comptent pas.
    expect(m.progress(bag({}))).toEqual({ have: 0, need: 1 });
    m.notePlaced(BlockId.Dirt);
    expect(m.update(bag({}))).toBeNull();
    m.notePlaced(BlockId.Lamp);
    expect(m.update(bag({}))).toEqual({ kind: "step", index: 5 });
    // Dernière étape : voir une Grignote fuir la lampe.
    expect(m.update(bag({}))).toBeNull();
    m.noteSignal("lamp-scare");
    expect(m.update(bag({}))).toEqual({ kind: "done" });
    expect(m.done).toBe(true);
    expect(m.current()).toBeNull();
    expect(m.update(bag({}))).toBeNull();
  });

  it("un signal hors de l'étape qui l'attend est ignoré", () => {
    const m = new MissionRunner(MISSION_1);
    m.noteSignal("lamp-scare");
    expect(m.toJSON().counts).toEqual({});
  });

  it("tutoriel : marcher (pas les téléportations : le jeu borne chaque pas), casser, poser", () => {
    const m = new MissionRunner(TUTORIAL);
    expect(m.current()?.goal).toEqual({ kind: "walk", distance: 5 });
    m.noteBroken(BlockId.Dirt); // compté pour l'étape en cours, puis remis à zéro à l'étape suivante
    m.noteWalked(2.4);
    m.noteWalked(Number.NaN);
    m.noteWalked(-3);
    expect(m.progress(bag({}))).toEqual({ have: 2, need: 5 });
    m.noteWalked(2.7);
    expect(m.update(bag({}))).toEqual({ kind: "step", index: 1 });
    expect(m.progress(bag({}))).toEqual({ have: 0, need: 1 });
    m.noteBroken(BlockId.FlowerRed);
    expect(m.update(bag({}))).toEqual({ kind: "step", index: 2 });
    m.notePlaced(BlockId.FlowerRed);
    expect(m.update(bag({}))).toEqual({ kind: "done" });
  });

  it("une étape à la fois, même si plusieurs objectifs sont déjà atteints", () => {
    const m = new MissionRunner(MISSION_1);
    const full = bag({ [BlockId.Log]: 9, [BlockId.Stone]: 9 });
    expect(m.update(full)).toEqual({ kind: "step", index: 1 });
    expect(m.update(full)).toEqual({ kind: "step", index: 2 });
    expect(m.update(full)).toBeNull();
  });

  it("progression enregistrée puis relue ; donnée abîmée ou d'une autre mission : départ", () => {
    const m = new MissionRunner(TUTORIAL);
    m.noteWalked(5);
    m.update(bag({}));
    m.noteWalked(1.23456);
    const saved = JSON.parse(JSON.stringify(m.toJSON()));
    expect(saved).toEqual({ id: "tuto", step: 1, counts: { walk: 1.23 } });
    const again = new MissionRunner(TUTORIAL, saved);
    expect(again.stepIndex).toBe(1);
    expect(new MissionRunner(MISSION_1, { id: "autre", step: 3 }).stepIndex).toBe(0);
    expect(new MissionRunner(MISSION_1, { id: "abri", step: 99 }).done).toBe(true);
    expect(new MissionRunner(MISSION_1, "n'importe quoi").stepIndex).toBe(0);
    expect(new MissionRunner(MISSION_1, { id: "abri", step: 4, counts: { "place:13": -1, "place:any": "x" } }).toJSON().counts).toEqual({});
  });

  it("sauvegarde du J5 : ancien compteur « placed » relu, étapes 0 à 4 inchangées, mission finie au J5 → dernière étape du J6", () => {
    const j5 = { id: "abri", step: 4, placed: { any: 2, "3": 2 } };
    const m = new MissionRunner(MISSION_1, j5);
    expect(m.current()?.goal).toEqual({ kind: "place", block: BlockId.Lamp, count: 1 });
    expect(m.toJSON().counts).toEqual({ "place:any": 2, "place:3": 2 });
    const finishedInJ5 = new MissionRunner(MISSION_1, { id: "abri", step: 5, placed: {} });
    expect(finishedInJ5.done).toBe(false);
    expect(finishedInJ5.current()?.goal.kind).toBe("watch");
  });

  it("campagne : tutoriel d'abord, sauté si l'enfant l'a déjà fait ; reprise de la mission enregistrée", () => {
    expect(resumeMission(undefined, false)).toEqual({ def: TUTORIAL, saved: undefined, fresh: true });
    expect(resumeMission(undefined, true)).toEqual({ def: MISSION_1, saved: undefined, fresh: true });
    const inTuto = { id: "tuto", step: 1, counts: {} };
    expect(resumeMission(inTuto, false)).toEqual({ def: TUTORIAL, saved: inTuto, fresh: false });
    // Tutoriel fini entre-temps dans un autre monde : on passe à la mission 1.
    expect(resumeMission(inTuto, true).def).toBe(MISSION_1);
    const inAbri = { id: "abri", step: 2, counts: {} };
    expect(resumeMission(inAbri, false)).toEqual({ def: MISSION_1, saved: inAbri, fresh: false });
    expect(resumeMission({ id: "inconnue" }, false).def).toBe(TUTORIAL);
    // Tutoriel fini dans ce monde mais profil pas enregistré : la mission 1 suit quand même (jamais bloqué).
    expect(resumeMission({ id: "tuto", step: 3, counts: {} }, false)).toEqual({ def: MISSION_1, saved: undefined, fresh: true });
    // Mission 1 finie : reste finie (jeu libre).
    const doneAbri = { id: "abri", step: 6, counts: {} };
    expect(resumeMission(doneAbri, true)).toEqual({ def: MISSION_1, saved: doneAbri, fresh: false });
    expect(nextMission(TUTORIAL)).toBe(MISSION_1);
    expect(nextMission(MISSION_1)).toBeNull();
    expect(CAMPAIGN).toEqual([TUTORIAL, MISSION_1]);
  });

  it("étoile et libellés pour l'adulte", () => {
    expect(campaignDone({ id: "abri", step: MISSION_1.steps.length })).toBe(true);
    expect(campaignDone({ id: "abri", step: 2 })).toBe(false);
    expect(campaignDone({ id: "tuto", step: 3 })).toBe(false);
    expect(campaignDone(null)).toBe(false);
    expect(progressLabel(undefined)).toBe("pas encore commencé");
    expect(progressLabel({ id: "tuto", step: 1 })).toBe("tutoriel : étape 2 sur 3 (casser un bloc)");
    expect(progressLabel({ id: "abri", step: 2 })).toBe("mission 1 (l'abri) : étape 3 sur 6 (construire un abri et y entrer)");
    expect(progressLabel({ id: "abri", step: 6 })).toBe("mission 1 (l'abri) réussie");
    // Tutoriel fini : le monde reprendra à la mission 1 (relecture J6 : pas de « tutoriel réussie »).
    expect(progressLabel({ id: "tuto", step: 3 })).toBe("mission 1 (l'abri) : étape 1 sur 6 (ramasser 6 troncs)");
  });

  it("consigne selon l'appareil : variante au doigt quand elle existe", () => {
    const walk = TUTORIAL.steps[0]!;
    expect(stepText(walk, false).text.debutant).toContain("Z");
    expect(stepText(walk, true).text.debutant).toContain("rond");
    const logs = MISSION_1.steps[0]!;
    expect(stepText(logs, true)).toEqual({ text: logs.text, spoken: logs.spoken });
  });

  it("textes : deux variantes, la débutante plus courte ; forme dite sans chiffres ; libellé pour l'adulte", () => {
    for (const def of CAMPAIGN) {
      for (const t of [def.intro, def.outro]) expect(t.debutant.length).toBeLessThan(t.autonome.length);
      for (const s of def.steps) {
        expect(s.label.length).toBeGreaterThan(0);
        for (const v of [s, ...(s.touch ? [s.touch] : [])]) {
          expect(v.text.debutant.length).toBeLessThan(v.text.autonome.length);
          if (v.spoken) expect(v.spoken.debutant).not.toMatch(/\d/);
          // Sans forme dite, la forme écrite est lue : pas de chiffre au-delà de 1 (« 5 blocs » serait lu au masculin).
          else expect(v.text.debutant).not.toMatch(/[2-9]/);
        }
      }
    }
    expect(TUTORIAL.intro.debutant).toContain("Pixel");
    expect(MISSION_1.reward).toEqual({ block: BlockId.Rainbow, count: 5 });
  });
});

describe("compagnon Pixel", () => {
  const w = () => World.createFlat(32, 16, 32, 4);

  it("sa place : devant l'enfant (visible) et sur sa gauche", () => {
    const g = companionGoal({ x: 16, z: 16 }, 0); // regard vers -Z : devant = -Z, gauche = -X
    expect(g.z).toBeLessThan(16);
    expect(g.x).toBeLessThan(16);
  });

  it("il la rejoint en trottinant, puis s'arrête", () => {
    let c = { x: 10.5, y: 4, z: 10.5, yaw: 0, moving: false };
    const player = { x: 16, y: 4, z: 16 };
    const goal = companionGoal(player, 0);
    for (let i = 0; i < 100; i++) c = stepCompanion(c, goal, player, w(), 0.05);
    expect(Math.hypot(c.x - goal.x, c.z - goal.z)).toBeLessThan(0.7);
    expect(c.moving).toBe(false);
  });

  it("resté trop loin : il réapparaît près de l'enfant", () => {
    const player = { x: 16, y: 4, z: 16 };
    const goal = companionGoal(player, 0);
    const c = stepCompanion({ x: 1, y: 4, z: 1 + COMPANION_TELEPORT * 2, yaw: 0, moving: false }, goal, player, w(), 0.05);
    expect(Math.hypot(c.x - goal.x, c.z - goal.z)).toBeLessThan(0.01);
  });

  it("un mur de deux blocs l'arrête (il réapparaîtra si l'enfant s'éloigne)", () => {
    const world = w();
    for (let z = 0; z < 32; z++) for (let y = 4; y < 6; y++) world.set(14, y, z, BlockId.Stone);
    let c = { x: 12.5, y: 4, z: 16.5, yaw: 0, moving: false };
    const player = { x: 18, y: 4, z: 16 };
    for (let i = 0; i < 40; i++) c = stepCompanion(c, { x: 17, z: 16.5 }, player, world, 0.05);
    expect(c.x).toBeLessThan(14);
  });
});
