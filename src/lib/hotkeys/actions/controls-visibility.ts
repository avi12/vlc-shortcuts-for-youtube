import { showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import type { YoutubePlayer } from "@/lib/player";

// YouTube fades its controls by putting the player into its own autohide state, styled and
// animated by YouTube's stylesheet. Ctrl+H holds the player in that state: any mouse movement makes
// YouTube leave it, so it is re-entered before the next paint until Ctrl+H is pressed again
const YOUTUBE_AUTOHIDE_CLASS = "ytp-autohide";

enum ControlsStatus {
  Hidden = "Controls hidden",
  Shown = "Controls shown"
}

const observerByPlayer = new Map<YoutubePlayer, MutationObserver>();

function holdAutohide(player: YoutubePlayer) {
  if (player.classList.contains(YOUTUBE_AUTOHIDE_CLASS)) {
    return;
  }

  player.classList.add(YOUTUBE_AUTOHIDE_CLASS);
}

function hideControls(player: YoutubePlayer) {
  player.hideControls?.();
  holdAutohide(player);
  const observer = new MutationObserver(() => holdAutohide(player));
  observer.observe(player, {
    attributes: true,
    attributeFilter: ["class"]
  });
  observerByPlayer.set(player, observer);
}

function showControls(player: YoutubePlayer) {
  observerByPlayer.get(player)?.disconnect();
  observerByPlayer.delete(player);
  player.classList.remove(YOUTUBE_AUTOHIDE_CLASS);
  player.showControls?.();
}

export function toggleControls(player: YoutubePlayer) {
  const isHidden = observerByPlayer.has(player);
  if (isHidden) {
    showControls(player);
  } else {
    hideControls(player);
  }

  showStatusInNativeBezel({
    player,
    text: isHidden ? ControlsStatus.Shown : ControlsStatus.Hidden
  });
}

export function showAllControls() {
  for (const player of observerByPlayer.keys()) {
    showControls(player);
  }
}
