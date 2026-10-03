import { isVlcControlsEnabled } from "@/lib/enabled-flag";
import { stepVolume, VolumeDirection } from "@/lib/hotkeys/actions/volume";
import { isEventInside } from "@/lib/hotkeys/event-targets";
import { getPlayer, isShortsPlayer } from "@/lib/player";
import { isWheelComboMatch } from "@/lib/shortcut";
import { VLC_WHEEL_VOLUME } from "@/lib/vlc-keymap";

const PIXELS_PER_WHEEL_NOTCH = 100;
const PIXELS_PER_LINE = 40;

let pendingDeltaPixels = 0;

// Browsers turn Shift+wheel into horizontal scrolling, so the notch can arrive on either axis
function toPixels(e: WheelEvent) {
  const delta = e.deltaY || e.deltaX;
  return e.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * PIXELS_PER_LINE : delta;
}

// Shift+wheel anywhere over the player changes the volume; the plain wheel keeps scrolling the page. On Shorts
// the wheel moves between shorts, so it stays YouTube's there
function getWheelVolumePlayer(e: WheelEvent) {
  const isVolumeWheel = VLC_WHEEL_VOLUME.combos.some(combo => isWheelComboMatch({
    combo,
    e
  }));
  const player = isVolumeWheel ? getPlayer() : null;
  if (!player || isShortsPlayer(player) || !isEventInside({
    e,
    elContainer: player
  })) {
    return null;
  }

  return player;
}

function onWheel(e: WheelEvent) {
  const player = isVlcControlsEnabled() ? getWheelVolumePlayer(e) : null;
  if (!player) {
    return;
  }

  e.preventDefault();
  e.stopImmediatePropagation();
  pendingDeltaPixels += toPixels(e);
  const notches = Math.trunc(pendingDeltaPixels / PIXELS_PER_WHEEL_NOTCH);
  if (notches === 0) {
    return;
  }

  pendingDeltaPixels -= notches * PIXELS_PER_WHEEL_NOTCH;
  const direction = notches < 0 ? VolumeDirection.Louder : VolumeDirection.Quieter;
  for (let i = 0; i < Math.abs(notches); i++) {
    stepVolume({
      player,
      direction
    });
  }
}

export function installWheelVolume() {
  window.addEventListener("wheel", onWheel, {
    capture: true,
    passive: false
  });
}
