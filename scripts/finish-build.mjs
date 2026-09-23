// Après `vite build` : renomme dist/index.html en dist/cubes.html (nom du
// fichier livré) et affiche sa taille. Exécuté par `npm run build`.
import { renameSync, statSync, existsSync } from "node:fs";

const src = "dist/index.html";
const dst = "dist/cubes.html";
if (!existsSync(src)) {
  console.error(`Fichier ${src} introuvable : le build a-t-il réussi ?`);
  process.exit(1);
}
renameSync(src, dst);
const kb = statSync(dst).size / 1024;
console.log(`→ ${dst} (${kb.toFixed(0)} ko)`);
