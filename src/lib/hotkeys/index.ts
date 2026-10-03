import { isVlcControlsEnabled, onEnabledChange } from "@/lib/enabled-flag";
import { installAspectRatioReset, resetAspectRatio } from "@/lib/hotkeys/actions/aspect-ratio";
import { showAllControls } from "@/lib/hotkeys/actions/controls-visibility";
import { isEventInside, isKeyForPage } from "@/lib/hotkeys/event-targets";
import { installBezelRegistry } from "@/lib/hotkeys/native/bezel-component";
import { runAction } from "@/lib/hotkeys/run-action";
import { resetVolumeBoost } from "@/lib/hotkeys/volume-boost";
import { installWheelVolume } from "@/lib/hotkeys/wheel-volume";
import { isDispatchedYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { getPlayer, isShortsPlayer, isSphericalVideo, type YoutubePlayer } from "@/lib/player";
import { findBinding, type VlcBinding } from "@/lib/vlc-keymap";
import { isReplacedYoutubeKey, isShortsNavigationKey } from "@/lib/youtube-keymap";

// Swallowed on keydown, so the matching keypress/keyup never reach YouTube either. Each keydown decides afresh,
// since a keyup can be lost (Ctrl+H opening the history tab) and the key may next be typed into a text box
const swallowedKeyCodes = new Set<string>();
// YouTube keys held down for as long as the viewer holds the VLC key that pressed them
const releaseByKeyCode = new Map<string, () => void>();

function releaseHeldKey(code: string) {
  releaseByKeyCode.get(code)?.();
  releaseByKeyCode.delete(code);
}

// A keyup lost to another window or tab would leave YouTube's key held
function releaseAllHeldKeys() {
  for (const code of releaseByKeyCode.keys()) {
    releaseHeldKey(code);
  }
}

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

function isBindingActive({ binding, player, e }: {
  binding: VlcBinding;
  player: YoutubePlayer;
  e: KeyboardEvent;
}) {
  const isVideoSupported = !binding.isSphericalOnly || isSphericalVideo(player);
  const isFocusSupported = !binding.isPlayerFocusOnly || isEventInside({
    e,
    elContainer: player
  });
  return isVideoSupported && isFocusSupported;
}

function onKeyDown(e: KeyboardEvent) {
  if (isDispatchedYoutubeHotkey(e)) {
    return;
  }

  swallowedKeyCodes.delete(e.code);
  const player = getTargetPlayer(e);
  const isShortsNavigation = player !== null && isShortsPlayer(player) && isShortsNavigationKey(e);
  if (!player || isShortsNavigation) {
    return;
  }

  const binding = findBinding(e);
  if (binding && isBindingActive({
    binding,
    player,
    e
  })) {
    e.preventDefault();
    swallow(e);
    const release = runAction({
      binding,
      player,
      isRepeat: e.repeat
    });
    if (release) {
      releaseByKeyCode.set(e.code, release);
    }

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
  if (!swallowedKeyCodes.delete(e.code)) {
    return;
  }

  e.stopImmediatePropagation();
  releaseHeldKey(e.code);
}

function undoSideEffects(isEnabled: boolean) {
  if (isEnabled) {
    return;
  }

  resetAspectRatio();
  showAllControls();
  resetVolumeBoost();
}

export function installHotkeys() {
  installBezelRegistry();
  addEventListener("keydown", onKeyDown, {
    capture: true
  });
  addEventListener("keypress", onKeyPress, {
    capture: true
  });
  addEventListener("keyup", onKeyUp, {
    capture: true
  });
  addEventListener("blur", releaseAllHeldKeys);
  installWheelVolume();
  installAspectRatioReset();
  onEnabledChange(undoSideEffects);
}
