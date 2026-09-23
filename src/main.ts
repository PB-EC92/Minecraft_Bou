import "./style.css";
import { Game } from "./game/Game";
import { showFatalError } from "./ui/fatal";

const root = document.getElementById("app");
if (!root) throw new Error("Élément #app introuvable");

try {
  new Game(root);
} catch (err) {
  // Ex. WebGL indisponible : écran lisible plutôt qu'une page vide.
  showFatalError(err);
  throw err;
}
