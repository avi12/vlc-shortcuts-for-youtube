import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS, YOUTUBE_SEEK_SECONDS } from "@/lib/youtube-keymap";

// YouTube keeps both direction overlays laid out and fades the idle one to opacity 0
enum SeekOverlayDurationSelector {
  Forward = ".ytp-seek-overlay-animation-forward .ytp-seek-overlay-duration",
  Backward = ".ytp-seek-overlay-animation-back .ytp-seek-overlay-duration"
}

const SIGNED_SECONDS_PATTERN = /^([+−-])\s*(\d+)$/;
const MINUS_SIGN = "−";

let pendingCorrectionSeconds = 0;

function findOverlayDuration({ player, isForward }: {
  player: YoutubePlayer;
  isForward: boolean;
}) {
  return player.querySelector(isForward ? SeekOverlayDurationSelector.Forward : SeekOverlayDurationSelector.Backward);
}

function isOverlayShowing({ player, isForward }: {
  player: YoutubePlayer;
  isForward: boolean;
}) {
  const elDuration = findOverlayDuration({
    player,
    isForward
  });
  return elDuration !== null
    && elDuration.checkVisibility({
      opacityProperty: true
    })
    && SIGNED_SECONDS_PATTERN.test(elDuration.textContent.trim());
}

function correctOverlayText({ player, isForward }: {
  player: YoutubePlayer;
  isForward: boolean;
}) {
  const elDuration = findOverlayDuration({
    player,
    isForward
  });
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
// the running total in YouTube's own overlay element is corrected to match. Shorts ignores YouTube's seek
// keys and has no seek overlay, so there the jump is silent
export function seekNatively({ player, seconds }: {
  player: YoutubePlayer;
  seconds: number;
}) {
  const isForward = seconds > 0;
  const isBurstStart = !isOverlayShowing({
    player,
    isForward
  });
  if (isBurstStart) {
    pendingCorrectionSeconds = 0;
  }

  const { hotkey, count, stepSeconds } = planPresses(seconds);
  const isPressed = dispatchYoutubeHotkey({
    player,
    hotkey,
    count,
    fallback: () => player.seekTo(player.getCurrentTime() + seconds, true)
  });
  if (!isPressed) {
    return;
  }

  const correctionSeconds = seconds - Math.sign(seconds) * count * stepSeconds;
  if (correctionSeconds !== 0) {
    pendingCorrectionSeconds += correctionSeconds;
    player.seekTo(player.getCurrentTime() + correctionSeconds, true);
  }

  if (pendingCorrectionSeconds !== 0) {
    requestAnimationFrame(() => correctOverlayText({
      player,
      isForward
    }));
  }
}
