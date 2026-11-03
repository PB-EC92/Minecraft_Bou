import { describe, expect, it } from "vitest";
import { craftToneClass, type CraftStatusTone } from "../../src/ui/CraftPanel";

describe("ligne d'état du panneau de fabrication (V2, relecture J8)", () => {
  it("classes de ton préfixées : jamais « info », « ok » ni « no » seules (« .info » est la ligne d'infos du HUD)", () => {
    const tones: CraftStatusTone[] = ["info", "ok", "no"];
    expect(tones.map(craftToneClass)).toEqual(["tone-info", "tone-ok", "tone-no"]);
    for (const t of tones) {
      expect(craftToneClass(t)).not.toBe(t);
      expect(craftToneClass(t)).toMatch(/^tone-[a-z]+$/);
    }
  });
});
