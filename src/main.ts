import "./style.css";
import { Game } from "./game/Game";

const root = document.getElementById("app");
if (!root) throw new Error("Élément #app introuvable");

try {
  new Game(root);
} catch (err) {
  // Écran d'erreur lisible (ex. WebGL indisponible) plutôt qu'une page vide.
  const pre = document.createElement("pre");
  pre.style.cssText = "padding:16px;color:#fff;background:#402;white-space:pre-wrap;font-size:14px";
  pre.textContent = `Le jeu n'a pas pu démarrer.\n\n${err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err)}`;
  root.appendChild(pre);
  throw err;
}
