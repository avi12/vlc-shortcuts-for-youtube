import { togglePlayPause } from "@/lib/hotkeys/actions/playback";
import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { isPlaying, type YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

// VLC's next frame pauses first; YouTube's own frame key only steps while paused
export function stepFrame(player: YoutubePlayer) {
  if (isPlaying(player)) {
    togglePlayPause(player);
  }

  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.nextFrame
  });
}
