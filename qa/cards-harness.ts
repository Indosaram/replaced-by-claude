import { renderCard, type CardInput } from "../src/card.ts";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Renders one card with the production renderCard and returns the PNG as base64. */
(window as any).__render = async (input: CardInput): Promise<string> => {
  const blob = await renderCard(input);
  return toBase64(new Uint8Array(await blob.arrayBuffer()));
};

(window as any).__ready = true;
