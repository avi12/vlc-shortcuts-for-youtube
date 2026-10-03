import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";

export enum VolumeDirection {
  Louder = 1,
  Quieter = -1
}

// YouTube's own volume keys step by the same 5% as VLC and show YouTube's volume bezel
export function stepVolume({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  dispatchYoutubeHotkey({
    player,
    hotkey: direction === VolumeDirection.Louder ? YOUTUBE_HOTKEYS.volumeUp : YOUTUBE_HOTKEYS.volumeDown
  });
}

export function toggleMute(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.mute
  });
}
