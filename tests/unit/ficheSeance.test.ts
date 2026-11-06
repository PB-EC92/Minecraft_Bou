import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { craftText } from "../../src/edu/craftTexts";
import { MISSION_2, wordStatsLines } from "../../src/edu/missions";
import { BlockId } from "../../src/engine/blocks";
import { VERSION } from "../../src/game/identity";
import { slotHoldInfoLabel } from "../../src/input/slotHold";

/**
 * La fiche de séance imprimable (docs/FICHE-SEANCE.html) cite les libellés du jeu entre « … » : chacun doit exister
 * dans le jeu tel qu'écrit, sans quoi Pierre chercherait un bouton ou un texte qui n'existe pas.
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Espaces insécables (`${NBSP}` des textes de l'enfant, U+00A0, U+202F) ramenés à une espace simple. */
const normalize = (s: string): string =>
  s
    .replace(/\$\{NBSP\}/g, " ")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ");

function sourceText(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out += sourceText(p);
    else if (name.endsWith(".ts")) out += `${readFileSync(p, "utf8")}\n`;
  }
  return out;
}

/** Libellés entre « … » de la fiche, les plus intérieurs d'abord (« Afficher le panneau « Tests » … » donne « Tests »). */
function ficheQuotes(html: string): string[] {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  text = normalize(text);
  const quotes: string[] = [];
  const inner = /«([^«»]*)»/;
  for (let m = inner.exec(text); m; m = inner.exec(text)) {
    const q = (m[1] ?? "").trim();
    quotes.push(q);
    // Le libellé intérieur reste dans le texte (sans ses guillemets) : le libellé extérieur se lit ensuite en entier.
    text = `${text.slice(0, m.index)}\u0001 ${q} \u0002${text.slice(m.index + m[0].length)}`;
  }
  return quotes.map((q) => q.replace(/\u0001/g, "«").replace(/\u0002/g, "»"));
}

/** Textes calculés par le jeu (pas écrits tels quels dans le code) : produits par les mêmes fonctions. */
const missionDone = { id: MISSION_2.id, step: MISSION_2.steps.length, counts: {}, words: ["AMI"], wordStats: { words: [], totalMs: 90_000 } };
const COMPUTED: Record<string, () => string[]> = {
  "1.1-rc2": () => [VERSION],
  "appui 0,8 s": () => [slotHoldInfoLabel(800)],
  "2 + 2 = 4 planches !": () => [craftText(BlockId.Planks, 2, 2).text.debutant],
  "Durée de la mission 2 (les mots) : …": () => wordStatsLines(missionDone),
  "Monde N, temps par mot (jeu actif) :": () => ["Monde 1, temps par mot (jeu actif) :"],
};
/** Ce dernier libellé est écrit `Monde ${slot + 1}, temps par mot…` : sa partie fixe doit être dans le code. */
const FIXED_PART: Record<string, string> = { "Monde N, temps par mot (jeu actif) :": ", temps par mot (jeu actif) :" };

/** Renvois à docs/RETOURS.md (titres de ses sections), pas des libellés du jeu. */
const RETOURS_TITLES = ["J8 / V2 lot 1", "Recette V1", "Séance du … — J8"];

describe("fiche de séance : libellés cités", () => {
  const html = readFileSync(join(ROOT, "docs/FICHE-SEANCE.html"), "utf8");
  const src = normalize(sourceText(join(ROOT, "src")));
  const quotes = [...new Set(ficheQuotes(html))];

  it("la fiche cite bien des libellés (lecture de la fiche)", () => {
    expect(quotes.length).toBeGreaterThan(20);
    expect(quotes).toContain("Tests");
    expect(quotes).toContain("Afficher le panneau « Tests » et les infos techniques pendant les parties (pour l'adulte)");
  });

  it("chaque libellé entre « … » existe dans le jeu (ou est un titre de RETOURS.md)", () => {
    const retours = normalize(readFileSync(join(ROOT, "docs/RETOURS.md"), "utf8"));
    const missing: string[] = [];
    for (const q of quotes) {
      if (RETOURS_TITLES.includes(q)) {
        if (!retours.includes(q)) missing.push(`${q} (RETOURS.md)`);
        continue;
      }
      const computed = COMPUTED[q];
      if (computed) {
        const prefix = q.replace(/ …$/, "");
        if (!computed().some((t) => normalize(t).replace(/^Monde \d+/, "Monde N").startsWith(prefix.replace(/^Monde \d+/, "Monde N")))) {
          missing.push(`${q} (calculé : ${computed().join(" | ")})`);
        }
        const fixed = FIXED_PART[q];
        if (fixed && !src.includes(fixed)) missing.push(`${q} (partie fixe absente du code)`);
        continue;
      }
      // Libellé tronqué par « … » dans la fiche : son début doit exister tel quel.
      const ok = src.includes(q) || (q.endsWith("…") && src.includes(q.slice(0, -1).trimEnd()));
      if (!ok) missing.push(q);
    }
    expect(missing).toEqual([]);
  });
});
