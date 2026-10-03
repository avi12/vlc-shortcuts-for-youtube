import type { YoutubePlayer } from "@/lib/player";

export const BEZEL_SELECTOR = ".ytp-bezel";
export const BEZEL_TEXT_SELECTOR = ".ytp-bezel-text";
// Hides the bezel's icon circle, so only YouTube's text pill shows - YouTube has no icon for these statuses
const TEXT_ONLY_CLASS = "vlc-controls-text-bezel";
// YouTube's own flag for a bezel without text, left on by its last icon-only bezel (play/pause, mute)
const YOUTUBE_TEXT_HIDDEN_CLASS = "ytp-bezel-text-hide";
// How long YouTube keeps its own bezel up
const BEZEL_VISIBLE_MS = 1000;

let hideTimer: ReturnType<typeof setTimeout> | undefined;
const watchedBezels = new WeakSet<Element>();

function hideBezel(elLayer: HTMLElement) {
  clearTimeout(hideTimer);
  elLayer.classList.remove(TEXT_ONLY_CLASS);
  elLayer.style.display = "none";
}

// YouTube writing its own bezel mid-status takes the layer back, icon included, and hides it on its own timer
function releaseWhenYoutubeTakesOver({ elBezel, elLayer }: {
  elBezel: Element;
  elLayer: HTMLElement;
}) {
  if (watchedBezels.has(elBezel)) {
    return;
  }

  watchedBezels.add(elBezel);
  new MutationObserver(() => {
    if (!elLayer.classList.contains(TEXT_ONLY_CLASS)) {
      return;
    }

    clearTimeout(hideTimer);
    elLayer.classList.remove(TEXT_ONLY_CLASS);
  }).observe(elBezel, {
    childList: true,
    subtree: true
  });
}

// Shows a status the way YouTube shows its volume and speed: its own bezel layer, with the text in its pill.
// Hiding the layer for a frame restarts YouTube's own fade animation. The embedded player has no bezel, so
// there it stays silent
export function showStatusInNativeBezel({ player, text }: {
  player: YoutubePlayer;
  text: string;
}) {
  const elBezel = player.querySelector(BEZEL_SELECTOR);
  const elText = player.querySelector(BEZEL_TEXT_SELECTOR);
  const elLayer = elBezel?.parentElement;
  if (!elBezel || !elText || !(elLayer instanceof HTMLElement)) {
    return;
  }

  releaseWhenYoutubeTakesOver({
    elBezel,
    elLayer
  });
  hideBezel(elLayer);
  elText.textContent = text;
  elBezel.setAttribute("aria-label", text);
  elLayer.classList.remove(YOUTUBE_TEXT_HIDDEN_CLASS);
  elLayer.classList.add(TEXT_ONLY_CLASS);
  requestAnimationFrame(() => elLayer.style.removeProperty("display"));
  hideTimer = setTimeout(() => hideBezel(elLayer), BEZEL_VISIBLE_MS);
}
