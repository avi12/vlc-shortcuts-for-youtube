import { rewriteNativeBezelText, showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import { getBoostedVolume, MAX_PLAYER_VOLUME, setBoostedVolume } from "@/lib/hotkeys/volume-boost";
import { dispatchYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_HOTKEYS, YOUTUBE_VOLUME_STEP } from "@/lib/youtube-keymap";

const MIN_VOLUME = 0;

export enum VolumeDirection {
  Louder = 1,
  Quieter = -1
}

// Written the way YouTube's volume bezel writes it
function formatVolume(volume: number) {
  return `${volume}%`;
}

function stepVolumeSilently({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  const volume = Math.min(
    Math.max(player.getVolume() + direction * YOUTUBE_VOLUME_STEP, MIN_VOLUME),
    MAX_PLAYER_VOLUME
  );
  player.unMute();
  player.setVolume(volume);
  showStatusInNativeBezel({
    player,
    text: formatVolume(volume)
  });
}

// Past 100% YouTube's volume-up key still brings up its volume bezel (it stays at 100%), which then shows the
// boosted volume. Changing the volume unmutes, as in VLC. Tells whether the boost took
function stepBoostedVolume({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  const volume = setBoostedVolume({
    player,
    volume: getBoostedVolume(player) + direction * YOUTUBE_VOLUME_STEP
  });
  if (volume === null) {
    return false;
  }

  player.unMute();

  const text = formatVolume(volume);
  const isPressed = dispatchYoutubeHotkey({
    player,
    hotkey: YOUTUBE_HOTKEYS.volumeUp,
    fallback: () => showStatusInNativeBezel({
      player,
      text
    })
  });
  if (isPressed) {
    rewriteNativeBezelText({
      player,
      title: text,
      label: text
    });
  }

  return true;
}

function isBoostStep({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  const isAtFullVolume = player.getVolume() >= MAX_PLAYER_VOLUME;
  const isBoosted = getBoostedVolume(player) > MAX_PLAYER_VOLUME;
  return isAtFullVolume && (direction === VolumeDirection.Louder || isBoosted);
}

// YouTube's own volume keys step by the same 5% as VLC and show YouTube's volume bezel; past 100% VLC's boost
// takes over, up to 200%
export function stepVolume({ player, direction }: {
  player: YoutubePlayer;
  direction: VolumeDirection;
}) {
  const isBoosted = isBoostStep({
    player,
    direction
  }) && stepBoostedVolume({
    player,
    direction
  });
  if (isBoosted) {
    return;
  }

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
