import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { getVideo, isPlaying, isShortsPlayer, type YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

const START_SECONDS = 0;

// Shorts' own next/previous buttons; its player swallows the arrow keys Shorts otherwise moves with
enum ShortsNavigationButton {
  Next = "#navigation-button-down button",
  Previous = "#navigation-button-up button"
}

export function togglePlayPause(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.playPause
  });
}

// VLC's stop: YouTube's own pause (with its bezel), then back to the start
export function stop(player: YoutubePlayer) {
  if (isPlaying(player)) {
    togglePlayPause(player);
  }

  player.seekTo(START_SECONDS, true);
}

function clickShortsNavigation(button: ShortsNavigationButton) {
  document.querySelector<HTMLElement>(button)?.click();
}

// On Shorts the next and previous video are the next and previous short
export function playNext(player: YoutubePlayer) {
  if (isShortsPlayer(player)) {
    clickShortsNavigation(ShortsNavigationButton.Next);
    return;
  }

  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.next
  });
}

export function playPrevious(player: YoutubePlayer) {
  if (isShortsPlayer(player)) {
    clickShortsNavigation(ShortsNavigationButton.Previous);
    return;
  }

  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.previous
  });
}

export function toggleLoop(player: YoutubePlayer) {
  const elVideo = getVideo(player);
  if (!elVideo) {
    return;
  }

  elVideo.loop = !elVideo.loop;
  player.setLoopVideo?.(elVideo.loop);
}

export function toggleFullscreen(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.fullscreen
  });
}
