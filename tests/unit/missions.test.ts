import { describe, expect, it } from "vitest";
import { BlockId } from "../../src/engine/blocks";
import { World } from "../../src/engine/World";
import {
  CAMPAIGN,
  campaignDone,
  lampRevealed,
  lettersUnlocked,
  MAX_WORDS,
  MISSION_1,
  MISSION_2,
  MissionRunner,
  nextMission,
  progressLabel,
  resumeMission,
  SHELTER_PARTS,
  shelterPassed,
  starsEarned,
  stepText,
  TUTORIAL,
  wordsSeen,
  type MissionView,
  type WordContext,
} from "../../src/edu/missions";
import { NBSP } from "../../src/edu/texts";
import { DEBUTANT_WORDS, AUTONOME_WORDS, pickWord, wordList, wordVars } from "../../src/edu/wordLists";
import { M2_STEP_WORD, M2_STEP_WORD_COPY } from "../../src/edu/wordTexts";
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
    // Mission 1 finie (V2 lot 1) : la mission 2 suit (le jeu attend le matin pour la lancer).
    const doneAbri = { id: "abri", step: 6, counts: {} };
    expect(resumeMission(doneAbri, true)).toEqual({ def: MISSION_2, saved: undefined, fresh: true });
    // … sauf si l'écran de félicitations de la mission 1 n'a pas encore été montré : la mission 1 finie d'abord.
    expect(resumeMission(doneAbri, true, true)).toEqual({ def: MISSION_1, saved: doneAbri, fresh: false });
    // Le tutoriel n'a pas d'écran de félicitations : la suite, même avec celebratePending.
    expect(resumeMission({ id: "tuto", step: 3, counts: {} }, true, true).def).toBe(MISSION_1);
    // Mission 2 en cours, puis finie : elle reste (dernière de la campagne : jeu libre).
    const inWords = { id: "mots", step: 2, counts: {}, words: ["AMI"] };
    expect(resumeMission(inWords, true)).toEqual({ def: MISSION_2, saved: inWords, fresh: false });
    const doneWords = { id: "mots", step: 5, counts: {} };
    expect(resumeMission(doneWords, true)).toEqual({ def: MISSION_2, saved: doneWords, fresh: false });
    expect(resumeMission(doneWords, true, true)).toEqual({ def: MISSION_2, saved: doneWords, fresh: false });
    expect(nextMission(TUTORIAL)).toBe(MISSION_1);
    expect(nextMission(MISSION_1)).toBe(MISSION_2);
    expect(nextMission(MISSION_2)).toBeNull();
    expect(CAMPAIGN).toEqual([TUTORIAL, MISSION_1, MISSION_2]);
  });

  it("étoiles et libellés pour l'adulte", () => {
    // La campagne finit avec la mission 2 : l'abri seul ne la finit plus.
    expect(campaignDone({ id: "abri", step: MISSION_1.steps.length })).toBe(false);
    expect(campaignDone({ id: "mots", step: MISSION_2.steps.length })).toBe(true);
    expect(campaignDone({ id: "mots", step: 4 })).toBe(false);
    expect(campaignDone({ id: "abri", step: 2 })).toBe(false);
    expect(campaignDone({ id: "tuto", step: 3 })).toBe(false);
    expect(campaignDone(null)).toBe(false);
    // Étoiles : tutoriel 0, abri en cours 0, abri fini 1 (étoile d'un monde de la 1.0-rc gardée), mots en cours 1, mots finis 2.
    expect(starsEarned({ id: "tuto", step: 3 })).toBe(0);
    expect(starsEarned({ id: "abri", step: 2 })).toBe(0);
    expect(starsEarned({ id: "abri", step: 6 })).toBe(1);
    expect(starsEarned({ id: "mots", step: 0 })).toBe(1);
    expect(starsEarned({ id: "mots", step: 5 })).toBe(2);
    expect(starsEarned(undefined)).toBe(0);
    expect(starsEarned({ id: "inconnue", step: 9 })).toBe(0);
    expect(progressLabel(undefined)).toBe("pas encore commencé");
    expect(progressLabel({ id: "tuto", step: 1 })).toBe("tutoriel : étape 2 sur 3 (casser un bloc)");
    expect(progressLabel({ id: "abri", step: 2 })).toBe("mission 1 (l'abri) : étape 3 sur 6 (construire un abri et y entrer)");
    expect(progressLabel({ id: "abri", step: 6 })).toBe("mission 1 (l'abri) réussie, mission 2 (les mots) pas encore commencée");
    // Tutoriel fini : le monde reprendra à la mission 1 (relecture J6 : pas de « tutoriel réussie »).
    expect(progressLabel({ id: "tuto", step: 3 })).toBe("mission 1 (l'abri) : étape 1 sur 6 (ramasser 6 troncs)");
    // Mission 2 : les mots écrits suivent.
    expect(progressLabel({ id: "mots", step: 0 })).toBe("mission 2 (les mots) : étape 1 sur 5 (poser une première lettre (case ABC))");
    expect(progressLabel({ id: "mots", step: 3, counts: {}, words: ["AMI", "LUNE"] })).toBe(
      "mission 2 (les mots) : étape 4 sur 5 (écrire un troisième mot) — mots écrits : AMI, LUNE",
    );
    expect(progressLabel({ id: "mots", step: 5, counts: {}, words: ["AMI", "LUNE", "TOIT", "LEA"] })).toBe(
      "mission 2 (les mots) réussie — mots écrits : AMI, LUNE, TOIT, LEA",
    );
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
    // Conseils quand une étape n'avance plus (J7) : deux variantes, sans chiffre (ils sont lus tels quels).
    const hints = CAMPAIGN.flatMap((d) => d.steps.flatMap((s) => (s.hint ? [s.hint] : [])));
    expect(hints.length).toBeGreaterThanOrEqual(4);
    for (const h of hints) {
      expect(h.debutant.length).toBeLessThan(h.autonome.length);
      expect(h.debutant + h.autonome).not.toMatch(/\d/);
    }
    expect(MISSION_1.steps[1]!.hint!.debutant).toContain("Creuse");
    // Icône du bandeau : on cherche une pierre brillante (elle donne la lampe), relecture J7.
    expect(MISSION_1.steps[3]!.icon).toBe(BlockId.GlowStone);
    expect(MISSION_1.reward).toEqual({ block: BlockId.Rainbow, count: 5 });
  });
});

describe("mission 2 « Les mots » (V2 lot 1)", () => {
  const ctx = (o: Partial<WordContext> = {}): WordContext => ({ level: "debutant", name: "Léa", seed: 1234, exclude: new Set(), ...o });
  const none = bag({});

  it("définition : une lettre, trois mots de paliers 1 à 3, puis le prénom ; récapitulatif des mots et cadeau", () => {
    expect(MISSION_2.id).toBe("mots");
    expect(MISSION_2.name).toBe("mission 2 (les mots)");
    expect(MISSION_2.steps.map((s) => s.goal)).toEqual([
      { kind: "letter", count: 1 },
      { kind: "write", source: "list", tier: 1 },
      { kind: "write", source: "list", tier: 2 },
      { kind: "write", source: "list", tier: 3 },
      { kind: "write", source: "name", tier: 3 },
    ]);
    expect(MISSION_2.steps.map((s) => s.label)).toEqual([
      "poser une première lettre (case ABC)",
      "écrire un premier mot",
      "écrire un deuxième mot",
      "écrire un troisième mot",
      "écrire son prénom (ou un quatrième mot)",
    ]);
    expect(MISSION_2.recap).toEqual([{ words: true }]);
    expect(MISSION_2.reward).toEqual({ block: BlockId.Rainbow, count: 5 });
    const s0 = MISSION_2.steps[0]!;
    expect(s0.touch).toBeDefined();
    expect(s0.hint).toBeDefined();
    expect(s0.hintSpoken?.debutant).toContain("a, bé, cé");
    for (const s of MISSION_2.steps.slice(1)) expect(s.copy).toBeDefined();
  });

  it("de bout en bout : une lettre posée, trois mots, puis le prénom ; mots gardés par toJSON et relus", () => {
    const m = new MissionRunner(MISSION_2);
    expect(m.prepare(ctx())).toBeNull(); // pas une étape d'écriture
    expect(m.target).toBeNull();
    m.notePlaced(BlockId.Dirt);
    expect(m.update(none)).toBeNull();
    expect(m.progress(none)).toEqual({ have: 0, need: 1 });
    m.notePlaced(BlockId.LetterM);
    expect(m.toJSON().counts).toEqual({ "place:any": 2, "place:2": 1, [`place:${BlockId.LetterM}`]: 1, "place:letter": 1 });
    expect(m.update(none)).toEqual({ kind: "step", index: 1 });
    const written: string[] = [];
    for (const tier of [1, 2, 3] as const) {
      const w = m.prepare(ctx());
      expect(w).not.toBeNull();
      expect(DEBUTANT_WORDS.find((e) => e.text === w)?.tier).toBe(tier);
      expect(written).not.toContain(w);
      expect(m.target).toBe(w);
      expect(m.progress(none)).toEqual({ have: 0, need: 1 });
      m.noteWord("ZZZ"); // un autre mot : rien
      expect(m.update(none)).toBeNull();
      m.noteWord(w!);
      expect(m.progress(none)).toEqual({ have: 1, need: 1 });
      expect(m.update(none)).toEqual({ kind: "step", index: tier + 1 });
      written.push(w!);
      expect(m.words).toEqual(written);
      expect(m.target).toBeNull(); // le mot de l'étape suivante n'est pas encore fixé
    }
    // Étape 4 : le prénom, sans accent.
    expect(m.prepare(ctx())).toBe("LEA");
    const saved = JSON.parse(JSON.stringify(m.toJSON()));
    expect(saved).toEqual({ id: "mots", step: 4, counts: {}, words: written, word: "LEA" });
    const again = new MissionRunner(MISSION_2, saved);
    expect(again.words).toEqual(written);
    expect(again.target).toBe("LEA");
    again.noteWord("LEA");
    expect(again.update(none)).toEqual({ kind: "done" });
    expect(again.words).toEqual([...written, "LEA"]);
    expect(again.toJSON()).toEqual({ id: "mots", step: 5, counts: {}, words: [...written, "LEA"] });
    expect(again.target).toBeNull();
    // Mission finie : plus rien ne compte.
    again.noteWord("LEA");
    again.noteTry();
    expect(again.toJSON().counts).toEqual({});
  });

  it("prepare : mot du niveau et du palier, déterministe (graine × 31 + étape), hors des mots à éviter et déjà écrits", () => {
    const at = (step: number, extra: object = {}) => new MissionRunner(MISSION_2, { id: "mots", step, counts: {}, ...extra });
    for (const level of ["debutant", "autonome"] as const) {
      const w = at(2).prepare(ctx({ level, seed: 77 }));
      expect(w).toBe(pickWord(level, 2, new Set(["LEA"]), 77 * 31 + 2).text);
      expect(wordList(level).find((e) => e.text === w)?.tier).toBe(2);
      expect(at(2).prepare(ctx({ level, seed: 77 }))).toBe(w);
    }
    // Mots à éviter (présents dans le monde, écrits ailleurs) et mots déjà écrits dans cette mission.
    const tier1 = DEBUTANT_WORDS.filter((e) => e.tier === 1).map((e) => e.text);
    const m = at(1, { words: tier1.slice(0, 3) });
    expect(m.prepare(ctx({ exclude: new Set(tier1.slice(3, 5)) }))).toBe(tier1[5]);
  });

  it("prepare : mot enregistré gardé à la reprise, retiré si le niveau a changé", () => {
    const m = new MissionRunner(MISSION_2, { id: "mots", step: 1, counts: {}, word: "BOL" });
    expect(m.target).toBe("BOL");
    expect(m.prepare(ctx({ seed: 5 }))).toBe("BOL");
    // Niveau changé : BOL n'est pas dans la liste de l'autonome, un mot de sa liste le remplace.
    const n = new MissionRunner(MISSION_2, { id: "mots", step: 1, counts: {}, word: "BOL" });
    const w = n.prepare(ctx({ level: "autonome", seed: 5 }));
    expect(AUTONOME_WORDS.find((e) => e.text === w)?.tier).toBe(1);
    expect(n.toJSON().word).toBe(w);
    // Un mot enregistré pour une étape qui n'écrit pas : ignoré.
    expect(new MissionRunner(MISSION_2, { id: "mots", step: 0, counts: {}, word: "BOL" }).toJSON().word).toBeUndefined();
  });

  it("prepare, étape « prénom » : le prénom sans accent ; prénom inutilisable → un mot du palier 3", () => {
    const at4 = (extra: object = {}) => new MissionRunner(MISSION_2, { id: "mots", step: 4, counts: {}, ...extra });
    expect(at4().prepare(ctx({ name: "Chloé" }))).toBe("CHLOE");
    for (const name of ["Joueur 1", "Anne-Sophie", "X", "", null]) {
      const w = at4().prepare(ctx({ name, level: "autonome" }));
      expect(AUTONOME_WORDS.find((e) => e.text === w)?.tier).toBe(3);
    }
    // Prénom enregistré gardé ; prénom changé depuis : le nouveau.
    expect(at4({ word: "LEA" }).prepare(ctx({ name: "Léa" }))).toBe("LEA");
    expect(at4({ word: "LEA" }).prepare(ctx({ name: "Tom" }))).toBe("TOM");
    // Mot de liste enregistré (prénom inutilisable à l'époque) : gardé.
    expect(at4({ word: "TOIT" }).prepare(ctx({ name: "Tom" }))).toBe("TOIT");
  });

  it("prepare : le prénom n'est jamais tiré pour un mot de la liste (il validerait d'emblée l'étape « prénom »)", () => {
    // Un enfant qui s'appelle « Ami » : AMI n'est jamais demandé aux étapes 1 à 3.
    for (let seed = 1; seed <= 60; seed++) {
      const m = new MissionRunner(MISSION_2, { id: "mots", step: 1, counts: {} });
      expect(m.prepare(ctx({ name: "Ami", seed }))).not.toBe("AMI");
    }
  });

  it("essais et aide enregistrés pour l'étape d'écriture, relus à la reprise", () => {
    const m = new MissionRunner(MISSION_2, { id: "mots", step: 1, counts: {}, word: "SOL" });
    expect(m.help()).toEqual({ stage: 0, revealed: 0, copy: false });
    m.noteTry();
    m.noteTry();
    m.noteHelp({ stage: 3, revealed: 2.7, copy: true });
    expect(m.help()).toEqual({ stage: 3, revealed: 2, copy: true });
    const again = new MissionRunner(MISSION_2, JSON.parse(JSON.stringify(m.toJSON())));
    expect(again.toJSON().counts).toEqual({ tries: 2, help: 3, revealed: 2, copy: 1 });
    expect(again.help()).toEqual({ stage: 3, revealed: 2, copy: true });
    again.noteHelp({ stage: Number.NaN, revealed: -4, copy: false });
    expect(again.help()).toEqual({ stage: 0, revealed: 0, copy: false });
    // Hors d'une étape d'écriture : ignoré.
    const first = new MissionRunner(MISSION_2);
    first.noteTry();
    first.noteHelp({ stage: 1, revealed: 1, copy: true });
    first.noteWord("SOL");
    expect(first.toJSON().counts).toEqual({});
    // L'étape suivante repart de zéro.
    again.noteWord("SOL");
    again.update(none);
    expect(again.help()).toEqual({ stage: 0, revealed: 0, copy: false });
  });

  it("relecture robuste des mots écrits et du mot en cours", () => {
    const read = (extra: object) => new MissionRunner(MISSION_2, { id: "mots", step: 2, counts: {}, ...extra });
    expect(read({ words: "AMI" }).words).toEqual([]);
    expect(read({ words: ["AMI", 3, "lune", "LUNE", "AMI", "A", "ÉTÉ", "TOIT"] }).words).toEqual(["AMI", "LUNE", "TOIT"]);
    const many = Array.from({ length: 14 }, (_, i) => `MOT${"ABCDEFGHIJKLMN".charAt(i)}`);
    expect(read({ words: many }).words).toEqual(many.slice(0, MAX_WORDS));
    expect(MAX_WORDS).toBe(10);
    expect(read({ word: "lune" }).target).toBeNull();
    expect(read({ word: 42 }).target).toBeNull();
    expect(read({ word: "ABCDEFGHIJK" }).target).toBeNull();
    expect(read({ word: "LUNE" }).target).toBe("LUNE");
    // Format sans mots (J4 à J7) : rien à relire.
    expect(new MissionRunner(MISSION_1, { id: "abri", step: 2, counts: {} }).toJSON()).toEqual({ id: "abri", step: 2, counts: {} });
  });

  it("mots déjà vus dans les autres mondes du profil", () => {
    const seen = wordsSeen([
      { mission: { id: "mots", step: 3, counts: {}, words: ["AMI", "LUNE"] } },
      null,
      { mission: { id: "abri", step: 6, counts: {} } },
      { mission: { id: "mots", step: 1, words: ["TOIT", "bof", 7] } },
      { id: "mots", step: 2, words: ["SOL"] },
      "abîmé",
    ]);
    expect([...seen].sort()).toEqual(["AMI", "LUNE", "SOL", "TOIT"]);
    expect(wordsSeen([]).size).toBe(0);
  });

  it("la boîte à lettres s'ouvre à la mission 2", () => {
    expect(lettersUnlocked(null)).toBe(false);
    expect(lettersUnlocked(TUTORIAL)).toBe(false);
    expect(lettersUnlocked(MISSION_1)).toBe(false);
    expect(lettersUnlocked(MISSION_2)).toBe(true);
    expect(lettersUnlocked({ ...MISSION_2 })).toBe(false); // une mission hors campagne
  });

  it("consigne d'écriture : textes remplis, variante de copie pour le lecteur autonome, mot de liste à la place du prénom", () => {
    const step1 = MISSION_2.steps[1]!;
    const deb = stepText(step1, false, { mode: "copy", vars: wordVars("debutant", "AMI", "Léa", true) });
    expect(deb.text.debutant).toBe("Écris AMI.");
    expect(deb.spoken.debutant).toBe(`Écris ami${NBSP}: a, emme, i.`);
    const dict = stepText(step1, true, { mode: "dictation", vars: wordVars("autonome", "LAMPE", null, true) });
    expect(dict.text.autonome).toBe("Écris le mot que j'ai dit.");
    expect(dict.spoken.autonome).toBe(`Écris le mot${NBSP}: lampe. La lampe éclaire ton abri. Lampe.`);
    const copy = stepText(step1, false, { mode: "copy", vars: wordVars("autonome", "LAMPE", null) });
    expect(copy.text.autonome).toBe(`Recopie le mot${NBSP}: LAMPE.`);
    expect(copy.spoken.autonome).toBe(`Recopie le mot${NBSP}: lampe.`);
    expect(copy.text.debutant).toBe("Écris LAMPE."); // le débutant garde sa consigne
    // Prénom : copie si le prénom a des accents ; textes d'un mot de la liste si le prénom est inutilisable.
    const name = MISSION_2.steps[4]!;
    const lea = stepText(name, false, { mode: "copy", vars: wordVars("autonome", "LEA", "Léa") });
    expect(lea.text.autonome).toContain(`Les lettres n'ont pas d'accent${NBSP}: écris LEA.`);
    expect(stepText(name, false, { mode: "copy", vars: wordVars("debutant", "LEA", "Léa", true) }).spoken.debutant).toBe(
      `Écris ton prénom${NBSP}: Léa. elle, e, a.`,
    );
    const fallback = stepText(name, false, { mode: "dictation", vars: wordVars("autonome", "BISCUIT", null, true), nameFallback: true });
    expect(fallback.text).toEqual({ debutant: "Écris BISCUIT.", autonome: M2_STEP_WORD.text.autonome });
    const fallbackCopy = stepText(name, false, { mode: "copy", vars: wordVars("autonome", "BISCUIT", null), nameFallback: true });
    expect(fallbackCopy.text.autonome).toBe(M2_STEP_WORD_COPY.text.autonome.replace("{MOT}", "BISCUIT"));
    // Sans contexte : comportement d'avant (gabarits bruts) ; au doigt, la variante tactile de l'étape 0.
    expect(stepText(step1, false).text.debutant).toBe("Écris {MOT}.");
    expect(stepText(MISSION_2.steps[0]!, true).text.debutant).toBe("Touche ABC, pose une lettre.");
  });
});

describe("suites de recette (V2 lot 1)", () => {
  it("soir retenu à 17 h : tutoriel, trois premières étapes de la mission 1, toute la mission 2 (décisions 4 et 11)", () => {
    expect(TUTORIAL.steps.map((s) => s.holdEvening === true)).toEqual([true, true, true]);
    expect(MISSION_1.steps.map((s) => s.holdEvening === true)).toEqual([true, true, true, false, false, false]);
    expect(MISSION_2.steps.map((s) => s.holdEvening === true)).toEqual([true, true, true, true, true]);
  });

  it("abri passé (marteau acquis, même jamais présenté) : après l'étape abri de la mission 1, mission finie et mission 2 comprises", () => {
    const shelter = MISSION_1.steps.findIndex((s) => s.goal.kind === "shelter");
    expect(shelter).toBe(2);
    expect(shelterPassed(null, 0)).toBe(false);
    expect(shelterPassed(TUTORIAL, 0)).toBe(false);
    expect(shelterPassed(TUTORIAL, TUTORIAL.steps.length)).toBe(false); // tutoriel fini
    for (let i = 0; i <= shelter; i++) expect(shelterPassed(MISSION_1, i)).toBe(false); // l'étape abri : Pixel le présente
    for (let i = shelter + 1; i < MISSION_1.steps.length; i++) expect(shelterPassed(MISSION_1, i)).toBe(true);
    expect(shelterPassed(MISSION_1, MISSION_1.steps.length)).toBe(true); // mission 1 finie (monde de la 1.0-rc : step 6)
    expect(shelterPassed(MISSION_2, 0)).toBe(true);
    expect(shelterPassed(MISSION_2, MISSION_2.steps.length)).toBe(true);
    expect(shelterPassed({ ...MISSION_2 }, 0)).toBe(false); // une mission hors campagne
    // Même verdict que la progression relue d'une sauvegarde.
    expect(shelterPassed(MISSION_1, new MissionRunner(MISSION_1, { id: "abri", step: 6, counts: {} }).stepIndex)).toBe(true);
    expect(shelterPassed(MISSION_1, new MissionRunner(MISSION_1, { id: "abri", step: 2, counts: {} }).stepIndex)).toBe(false);
  });

  it("lampe à découvrir (décision 6) : pas d'indice avant de l'avoir vue agir", () => {
    expect(lampRevealed(null, false)).toBe(true);
    expect(lampRevealed(TUTORIAL, false)).toBe(false);
    expect(lampRevealed(TUTORIAL, true)).toBe(false);
    expect(lampRevealed(MISSION_1, false)).toBe(false);
    expect(lampRevealed(MISSION_1, true)).toBe(true);
    expect(lampRevealed(MISSION_2, false)).toBe(true);
    // La consigne « poser la lampe » ne dit plus pourquoi.
    const place = MISSION_1.steps[4]!;
    expect(place.goal).toEqual({ kind: "place", block: BlockId.Lamp, count: 1 });
    expect(place.text.autonome).toBe("Pose la lampe près de ton abri, pour y voir clair la nuit.");
    for (const s of [place.text, place.spoken ?? place.text, place.hint!]) {
      expect(s.debutant + s.autonome).not.toMatch(/Grignote|lumière/);
    }
    // Avant la dernière étape, aucune consigne de la mission 1 ne dit que la lampe éloigne les Grignotes.
    for (const s of MISSION_1.steps.slice(0, 5)) {
      for (const t of [s.text, s.spoken ?? s.text, s.hint ?? s.text]) expect(t.autonome).not.toMatch(/lumière|éloign/);
    }
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

  it("l'enfant nage au large : Pixel ne réapparaît pas dans l'eau, il attend ; près de la rive, il réapparaît sur la terre (J7)", () => {
    const world = w();
    for (let x = 4; x < 28; x++) for (let z = 4; z < 28; z++) world.set(x, 3, z, BlockId.Water);
    const far = { x: 1.5, y: 4, z: 1.5, yaw: 0, moving: false };
    const swimmer = { x: 16.5, y: 3.4, z: 16.5 };
    const c = stepCompanion(far, companionGoal(swimmer, 0), swimmer, world, 0.05);
    expect({ x: c.x, y: c.y, z: c.z }).toEqual({ x: far.x, y: far.y, z: far.z });
    const nearShore = { x: 5.5, y: 3.4, z: 16.5 };
    const goal = companionGoal(nearShore, 0); // regard vers −Z : sa place est dans l'eau
    expect(world.get(Math.floor(goal.x), 3, Math.floor(goal.z))).toBe(BlockId.Water);
    const c2 = stepCompanion(far, goal, nearShore, world, 0.05);
    expect(world.get(Math.floor(c2.x), Math.floor(c2.y) - 1, Math.floor(c2.z))).not.toBe(BlockId.Water);
    expect(world.get(Math.floor(c2.x), Math.floor(c2.y), Math.floor(c2.z))).toBe(BlockId.Air);
    expect(Math.hypot(c2.x - nearShore.x, c2.z - nearShore.z)).toBeLessThanOrEqual(3 * Math.SQRT2 + 0.01);
  });
});
