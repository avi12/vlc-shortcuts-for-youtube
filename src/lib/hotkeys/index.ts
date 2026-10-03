import { isVlcControlsEnabled, onEnabledChange } from "@/lib/enabled-flag";
import { installAspectRatioReset, resetAspectRatio } from "@/lib/hotkeys/actions/aspect-ratio";
import { showAllControls } from "@/lib/hotkeys/actions/controls-visibility";
import { isKeyForPage } from "@/lib/hotkeys/event-targets";
import { runAction } from "@/lib/hotkeys/run-action";
import { installWheelVolume } from "@/lib/hotkeys/wheel-volume";
import { isDispatchedYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { getPlayer } from "@/lib/player";
import { findBinding } from "@/lib/vlc-keymap";
import { isReplacedYoutubeKey } from "@/lib/youtube-keymap";

// Swallowed on keydown, so the matching keypress/keyup never reach YouTube either
const swallowedKeyCodes = new Set<string>();

function swallow(e: KeyboardEvent) {
  e.stopImmediatePropagation();
  swallowedKeyCodes.add(e.code);
}

function getTargetPlayer(e: KeyboardEvent) {
  const player = isVlcControlsEnabled() && !e.isComposing ? getPlayer() : null;
  if (!player || isKeyForPage({
    e,
    elPlayer: player
  })) {
    return null;
  }

  return player;
}

function onKeyDown(e: KeyboardEvent) {
  if (isDispatchedYoutubeHotkey(e)) {
    return;
  }

  const player = getTargetPlayer(e);
  if (!player) {
    return;
  }

  const binding = findBinding(e);
  if (binding) {
    e.preventDefault();
    swallow(e);
    runAction({
      binding,
      player,
      isRepeat: e.repeat
    });
    return;
  }

  if (isReplacedYoutubeKey(e)) {
    swallow(e);
  }
}

function onKeyPress(e: KeyboardEvent) {
  if (swallowedKeyCodes.has(e.code)) {
    e.stopImmediatePropagation();
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (swallowedKeyCodes.delete(e.code)) {
    e.stopImmediatePropagation();
  }
}

function undoSideEffects(isEnabled: boolean) {
  if (isEnabled) {
    return;
  }

  resetAspectRatio();
  showAllControls();
}

export function installHotkeys() {
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keypress", onKeyPress, true);
  window.addEventListener("keyup", onKeyUp, true);
  installWheelVolume();
  installAspectRatioReset();
  onEnabledChange(undoSideEffects);
}
