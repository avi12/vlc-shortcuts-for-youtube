import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS, YOUTUBE_VOLUME_STEP } from "@/lib/youtube-keymap";

const MIN_VOLUME = 0;
const MAX_VOLUME = 100;

export enum VolumeDirection {
  Louder = 1,
  Quieter = -1
}

function stepVolumeSilently({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  const volume = player.getVolume() + direction * YOUTUBE_VOLUME_STEP;
  player.unMute();
  player.setVolume(Math.min(Math.max(volume, MIN_VOLUME), MAX_VOLUME));
}

// YouTube's own volume keys step by the same 5% as VLC and show YouTube's volume bezel
export function stepVolume({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  dispatchYoutubeHotkey({
    player,
    hotkey: direction === VolumeDirection.Louder ? YOUTUBE_HOTKEYS.volumeUp : YOUTUBE_HOTKEYS.volumeDown,
    fallback: () => stepVolumeSilently({
      player,
      direction
    })
  });
}

export function toggleMute(player: YoutubePlayer) {
  dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.mute
  });
}
