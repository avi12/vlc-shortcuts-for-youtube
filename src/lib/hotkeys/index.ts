import { isVlcControlsEnabled, onEnabledChange } from "@/lib/enabled-flag";
import { installAspectRatioReset, resetAspectRatio } from "@/lib/hotkeys/actions/aspect-ratio";
import { showAllControls } from "@/lib/hotkeys/actions/controls-visibility";
import { isBrowserShortcutOutsideTextBox, isEventInside, isKeyForPage } from "@/lib/hotkeys/event-targets";
import { installBezelRegistry } from "@/lib/hotkeys/native/bezel-component";
import { runAction } from "@/lib/hotkeys/run-action";
import { resetVolumeBoost } from "@/lib/hotkeys/volume-boost";
import { installWheelVolume } from "@/lib/hotkeys/wheel-volume";
import { isDispatchedYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import { getPlayer, isShortsPlayer, isSphericalVideo, type YoutubePlayer } from "@/lib/player";
import { getSite, isMusicSite } from "@/lib/site";
import { findBindings, type VlcBinding } from "@/lib/vlc-keymap";
import { isReplacedYoutubeKey, isShortsNavigationKey } from "@/lib/youtube-keymap";
import { isMusicNavigationPrefix } from "@/lib/youtube-music-keymap";

// Swallowed on keydown, so the matching keypress/keyup never reach YouTube either. Each keydown decides afresh,
// since a keyup can be lost (Ctrl+H opening the history tab) and the key may next be typed into a text box
const swallowedKeyCodes = new Set<string>();
// YouTube keys held down for as long as the viewer holds the VLC key that pressed them
const releaseByKeyCode = new Map<string, () => void>();
// The key after YouTube Music's "g" completes one of Music's navigation keys
let isAfterMusicNavigationPrefix = false;

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

function swallow(event: KeyboardEvent) {
  event.stopImmediatePropagation();
  swallowedKeyCodes.add(event.code);
}

function getTargetPlayer(event: KeyboardEvent) {
  const isPlayerControllable = isVlcControlsEnabled() && !event.isComposing;
  const player = isPlayerControllable ? getPlayer() : null;
  const isKeyIgnored = !player || isKeyForPage({
    e: event,
    elPlayer: player
  });
  if (isKeyIgnored) {
    return null;
  }

  return player;
}

// Kept from YouTube without cancelling the browser's own shortcut (Alt+Left still goes back)
function isVlcComboLeftToBrowser(event: KeyboardEvent) {
  const isOnPlayerPage = isVlcControlsEnabled() && getPlayer() !== null;
  return isOnPlayerPage && isBrowserShortcutOutsideTextBox(event) && findBindings(event).length > 0;
}

function isBindingActive({ binding, player, e }: {
  binding: VlcBinding;
  player: YoutubePlayer;
  e: KeyboardEvent;
}) {
  const isSiteSupported = !binding.site || binding.site === getSite();
  const isVideoSupported = !binding.isSphericalOnly || isSphericalVideo(player);
  const isFocusSupported = !binding.isPlayerFocusOnly || isEventInside({
    e,
    elContainer: player
  });
  return isSiteSupported && isVideoSupported && isFocusSupported;
}

function findActiveBinding({ e, player }: {
  e: KeyboardEvent;
  player: YoutubePlayer;
}) {
  const activeBindings = findBindings(e).filter(binding => isBindingActive({
    binding,
    player,
    e
  }));
  return activeBindings.find(binding => binding.isSphericalOnly) ?? activeBindings[0];
}

function onKeyDown(event: KeyboardEvent) {
  if (isDispatchedYoutubeHotkey(event)) {
    return;
  }

  swallowedKeyCodes.delete(event.code);
  const isMusicNavigation = isAfterMusicNavigationPrefix;
  isAfterMusicNavigationPrefix = isMusicSite() && isMusicNavigationPrefix(event);
  const player = getTargetPlayer(event);
  const isShortsNavigation = player !== null && isShortsPlayer(player) && isShortsNavigationKey(event);
  const isComboLeftToBrowser = !player && isVlcComboLeftToBrowser(event);
  if (isComboLeftToBrowser) {
    swallow(event);
    return;
  }

  const shouldIgnoreKey = !player || isShortsNavigation || isMusicNavigation;
  if (shouldIgnoreKey) {
    return;
  }

  const binding = findActiveBinding({
    e: event,
    player
  });
  if (binding) {
    event.preventDefault();
    swallow(event);
    const release = runAction({
      binding,
      player,
      isRepeat: event.repeat
    });
    const isReleaseHandler = typeof release === "function";
    if (isReleaseHandler) {
      releaseByKeyCode.set(event.code, release);
    }

    return;
  }

  // YouTube Music's own keys that VLC doesn't bind keep working there
  const isReplacedKey = !isMusicSite() && isReplacedYoutubeKey(event);
  if (isReplacedKey) {
    swallow(event);
  }
}

function onKeyPress(event: KeyboardEvent) {
  if (swallowedKeyCodes.has(event.code)) {
    event.stopImmediatePropagation();
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (!swallowedKeyCodes.delete(event.code)) {
    return;
  }

  event.stopImmediatePropagation();
  releaseHeldKey(event.code);
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
