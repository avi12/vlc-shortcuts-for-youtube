import { rewriteNativeBezelText, showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

const SPEED_LABEL_PREFIX = "Speed is ";

// Written the way YouTube's speed bezel writes it
export function formatRate(rate: number) {
  return `${rate}x`;
}

// YouTube has no key for an off-preset rate, so one of its own speed presses brings up its native
// speed bezel; the exact rate is then applied and written into that same bezel. A player that ignores
// YouTube's speed keys (Shorts, embeds) gets the rate applied directly and shown in YouTube's text pill
export function showRateInNativeBezel({ player, applyRate }: {
  player: YoutubePlayer;
  applyRate: () => number;
}) {
  const rates = player.getAvailablePlaybackRates();
  const isAtFastest = player.getPlaybackRate() >= Math.max(...rates);
  const isPressed = dispatchYoutubeHotkey({
    player,
    hotkey: isAtFastest ? YOUTUBE_HOTKEYS.slower : YOUTUBE_HOTKEYS.faster,
    fallback: () => showStatusInNativeBezel({
      player,
      text: formatRate(applyRate())
    })
  });
  if (!isPressed) {
    return;
  }

  const rate = applyRate();
  rewriteNativeBezelText({
    player,
    title: formatRate(rate),
    label: `${SPEED_LABEL_PREFIX}${rate}`
  });
}
