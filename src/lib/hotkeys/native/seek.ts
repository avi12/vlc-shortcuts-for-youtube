import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS, YOUTUBE_SEEK_SECONDS } from "@/lib/youtube-keymap";

const SEEK_OVERLAY_DURATION_SELECTOR = ".ytp-seek-overlay-duration";
const SIGNED_SECONDS_PATTERN = /^([+−-])\s*(\d+)$/;
const MINUS_SIGN = "−";

let pendingCorrectionSeconds = 0;

function findVisibleOverlayDuration(player: YoutubePlayer) {
  for (const elDuration of player.querySelectorAll(SEEK_OVERLAY_DURATION_SELECTOR)) {
    const isShowingSeconds = elDuration.checkVisibility() && SIGNED_SECONDS_PATTERN.test(elDuration.textContent.trim());
    if (isShowingSeconds) {
      return elDuration;
    }
  }
  return null;
}

function correctOverlayText(player: YoutubePlayer) {
  const elDuration = findVisibleOverlayDuration(player);
  const match = elDuration?.textContent.trim().match(SIGNED_SECONDS_PATTERN);
  if (!elDuration || !match) {
    return;
  }

  const [, sign, digits] = match;
  const youtubeSeconds = sign === "+" ? Number(digits) : -Number(digits);
  const seconds = youtubeSeconds + pendingCorrectionSeconds;
  elDuration.textContent = `${seconds < 0 ? MINUS_SIGN : "+"} ${Math.abs(seconds)}`;
}

function planPresses(seconds: number) {
  const isForward = seconds > 0;
  const distance = Math.abs(seconds);
  const isLongStep = distance % YOUTUBE_SEEK_SECONDS.long === 0;
  if (isLongStep) {
    return {
      hotkey: isForward ? YOUTUBE_HOTKEYS.seekForwardLong : YOUTUBE_HOTKEYS.seekBackwardLong,
      count: distance / YOUTUBE_SEEK_SECONDS.long,
      stepSeconds: YOUTUBE_SEEK_SECONDS.long
    };
  }

  return {
    hotkey: isForward ? YOUTUBE_HOTKEYS.seekForwardShort : YOUTUBE_HOTKEYS.seekBackwardShort,
    count: Math.ceil(distance / YOUTUBE_SEEK_SECONDS.short),
    stepSeconds: YOUTUBE_SEEK_SECONDS.short
  };
}

// Every jump is made of YouTube's own seek presses, so YouTube's seek overlay shows it. A jump off
// YouTube's step (VLC's 3 seconds) rides on the nearest press, the remainder is applied silently and
// the running total in YouTube's own overlay element is corrected to match
export function seekNatively({ player, seconds }: {
  player: YoutubePlayer;
  seconds: number;
}) {
  const isBurstStart = findVisibleOverlayDuration(player) === null;
  if (isBurstStart) {
    pendingCorrectionSeconds = 0;
  }

  const { hotkey, count, stepSeconds } = planPresses(seconds);
  dispatchYoutubeHotkey({
    player,
    hotkey,
    count
  });

  const correctionSeconds = seconds - Math.sign(seconds) * count * stepSeconds;
  if (correctionSeconds !== 0) {
    pendingCorrectionSeconds += correctionSeconds;
    player.seekTo(player.getCurrentTime() + correctionSeconds, true);
  }

  if (pendingCorrectionSeconds !== 0) {
    requestAnimationFrame(() => correctOverlayText(player));
  }
}
