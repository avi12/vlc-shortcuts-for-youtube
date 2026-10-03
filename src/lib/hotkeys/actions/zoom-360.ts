import { holdYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

// YouTube zooms for as long as its key is held, so the zoom lasts as long as the viewer holds VLC's key
export function zoomIn360(player: YoutubePlayer) {
  return holdYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.zoomIn360
  });
}

export function zoomOut360(player: YoutubePlayer) {
  return holdYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.zoomOut360
  });
}
