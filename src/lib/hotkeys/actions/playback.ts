import { seekNatively } from "@/lib/hotkeys/native/seek";
import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { getVideo, isPlaying, type YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

const START_SECONDS = 0;

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

export function playNext(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.next
  });
}

export function playPrevious(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.previous
  });
}

export function jump({ player, seconds }: {
  player: YoutubePlayer;
  seconds: number;
}) {
  seekNatively({
    player,
    seconds
  });
}

export function toggleLoop(player: YoutubePlayer) {
  const elVideo = getVideo();
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
