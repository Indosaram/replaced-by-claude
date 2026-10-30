import { SITE_URL } from "./config.ts";

export function shareText(login: string, label: string): string {
  return `Claude can replace me in ${label}. How long for you? ${SITE_URL}?u=${encodeURIComponent(login)} via @indo_yoon`;
}

export function intentUrl(text: string): string {
  return "https://x.com/intent/post?text=" + encodeURIComponent(text);
}

export function downloadCard(blob: Blob, login: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `replaced-by-claude-${login}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Must stay synchronous: every API below needs the user-activation of the click that called us.
export function shareCard(opts: {
  blob: Blob;
  blobPromise: Promise<Blob>;
  login: string;
  label: string;
  onHint: (m: string) => void;
}): void {
  const { blob, blobPromise, login, label, onHint } = opts;
  const text = shareText(login, label);
  const file = new File([blob], `replaced-by-claude-${login}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], text }).catch(() => {});
    return;
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]).then(
      () => onHint("Card copied. Paste it into the post (Cmd+V)."),
      () => onHint("Card downloaded. Attach it to your post."),
    );
  } else {
    onHint("Card downloaded. Attach it to your post.");
  }
  window.open(intentUrl(text), "_blank", "noopener");
  downloadCard(blob, login);
}
