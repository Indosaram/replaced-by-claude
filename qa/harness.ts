import { renderCard } from "../src/card.ts";
import { shareCard } from "../src/share.ts";

const login = "torvalds";
const label = "4h 12m";

const blob = await renderCard({
  login,
  label,
  line: "Your linux repo is impressive, but 12 repos is a light snack for me.",
  facts: "12 public repos \u00b7 267,000 stars",
  autograph: true,
});

(document.getElementById("card") as HTMLImageElement).src = URL.createObjectURL(blob);
(window as any).__blob = blob;

document.getElementById("share")!.addEventListener("click", () => {
  shareCard({
    blob,
    blobPromise: Promise.resolve(blob),
    login,
    label,
    onHint: (m) => (document.getElementById("hint")!.textContent = m),
  });
});

(window as any).__ready = true;
