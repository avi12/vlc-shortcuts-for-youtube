import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

const BEZEL_TEXT_SELECTOR = ".ytp-bezel-text";
const BEZEL_SELECTOR = ".ytp-bezel";
const SPEED_LABEL_PREFIX = "Speed is ";

// YouTube has no key for an off-preset rate, so one of its own speed presses brings up its native
// speed bezel; the exact rate is then applied and written into that same bezel. Shorts has neither speed
// keys nor a speed bezel, so there the rate is applied silently
export function showRateInNativeBezel({ player, applyRate }: {
  player: YoutubePlayer;
  applyRate: () => number;
}) {
  const rates = player.getAvailablePlaybackRates();
  const isAtFastest = player.getPlaybackRate() >= Math.max(...rates);
  const isPressed = dispatchYoutubeHotkey({
    player,
    hotkey: isAtFastest ? YOUTUBE_HOTKEYS.slower : YOUTUBE_HOTKEYS.faster,
    fallback: applyRate
  });
  if (!isPressed) {
    return;
  }

  const rate = applyRate();
  requestAnimationFrame(() => {
    const elText = player.querySelector(BEZEL_TEXT_SELECTOR);
    if (elText) {
      elText.textContent = `${rate}x`;
    }

    player.querySelector(BEZEL_SELECTOR)?.setAttribute("aria-label", `${SPEED_LABEL_PREFIX}${rate}`);
  });
}
