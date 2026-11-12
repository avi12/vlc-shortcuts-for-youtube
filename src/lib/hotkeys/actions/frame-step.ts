import { togglePlayPause } from "@/lib/hotkeys/actions/playback";
import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { isPlaying, type YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

// The frame length YouTube's own frame keys step by
const FRAME_SECONDS = 1 / 30;

export enum FrameDirection {
  BACKWARD = -1,
  FORWARD = 1
}

const FRAME_HOTKEYS = {
  [FrameDirection.BACKWARD]: YOUTUBE_HOTKEYS.previousFrame,
  [FrameDirection.FORWARD]: YOUTUBE_HOTKEYS.nextFrame
};

// VLC's frame step pauses first; YouTube's own frame keys only step while paused, and Shorts has none
export function stepFrame({ player, direction }: {
  player: YoutubePlayer;
  direction: FrameDirection;
}) {
  if (isPlaying(player)) {
    togglePlayPause(player);
  }

  dispatchYoutubeHotkey({
    player,
    hotkey: FRAME_HOTKEYS[direction],
    fallback: () => player.seekTo(player.getCurrentTime() + direction * FRAME_SECONDS, true)
  });
}
