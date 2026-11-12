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
function toPixels(event: WheelEvent) {
  const delta = event.deltaY || event.deltaX;
  return event.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * PIXELS_PER_LINE : delta;
}

// Shift+wheel anywhere over the player changes the volume; the plain wheel keeps scrolling the page. On Shorts
// the wheel moves between shorts, so it stays YouTube's there
function getWheelVolumePlayer(event: WheelEvent) {
  const isVolumeWheel = VLC_WHEEL_VOLUME.combos.some(combo => isWheelComboMatch({
    combo,
    e: event
  }));
  const player = isVolumeWheel ? getPlayer() : null;
  if (!player || isShortsPlayer(player) || !isEventInside({
    e: event,
    elContainer: player
  })) {
    return null;
  }

  return player;
}

function onWheel(event: WheelEvent) {
  const player = isVlcControlsEnabled() ? getWheelVolumePlayer(event) : null;
  if (!player) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  pendingDeltaPixels += toPixels(event);
  const notches = Math.trunc(pendingDeltaPixels / PIXELS_PER_WHEEL_NOTCH);
  if (notches === 0) {
    return;
  }

  pendingDeltaPixels -= notches * PIXELS_PER_WHEEL_NOTCH;
  const direction = notches < 0 ? VolumeDirection.LOUDER : VolumeDirection.QUIETER;
  for (let i = 0; i < Math.abs(notches); i++) {
    stepVolume({
      player,
      direction
    });
  }
}

export function installWheelVolume() {
  addEventListener("wheel", onWheel, {
    capture: true,
    passive: false
  });
}
