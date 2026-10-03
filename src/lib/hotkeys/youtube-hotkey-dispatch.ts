import { getPlayerKind, PlayerKind, type YoutubePlayer } from "@/lib/player";
import { isHotkeyHonored, type YoutubeHotkey } from "@/lib/youtube-keymap";
import { findMusicHotkey } from "@/lib/youtube-music-keymap";

enum KeyEventType {
  Press = "keydown",
  Release = "keyup"
}

const dispatchedEvents = new WeakSet<Event>();

// Our own synthetic presses must reach YouTube's handler instead of being swallowed as a replaced key
export function isDispatchedYoutubeHotkey(e: Event) {
  return dispatchedEvents.has(e);
}

function dispatchKey({ player, hotkey, eventType }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
  eventType: KeyEventType;
}) {
  const e = new KeyboardEvent(eventType, {
    ...hotkey,
    bubbles: true,
    cancelable: true
  });
  dispatchedEvents.add(e);
  player.dispatchEvent(e);
}

// The key the player presses for a YouTube key: the key itself, YouTube Music's own key for the same control, or
// none where the player has no such key
function findPlayerHotkey({ player, hotkey }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
}) {
  const playerKind = getPlayerKind(player);
  if (playerKind === PlayerKind.Music) {
    return findMusicHotkey(hotkey);
  }

  const isHonored = isHotkeyHonored({
    playerKind,
    hotkey
  });
  return isHonored ? hotkey : undefined;
}

// Dispatched on the player, since YouTube only takes the arrow keys there; it bubbles to the
// document-level handler for the rest. A player that ignores the key (Shorts, the embed) gets the action's silent
// fallback instead - never the key, which can mean something else there. Tells whether the key was pressed
export function dispatchYoutubeHotkey({ player, hotkey, count = 1, fallback }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
  count?: number;
  fallback?: () => void;
}) {
  const playerHotkey = findPlayerHotkey({
    player,
    hotkey
  });
  if (!playerHotkey) {
    fallback?.();
    return false;
  }

  for (let i = 0; i < count; i++) {
    dispatchKey({
      player,
      hotkey: playerHotkey,
      eventType: KeyEventType.Press
    });
  }
  return true;
}

// For a control only YouTube Music has (shuffle, repeat): pressed on Music's player only
export function dispatchMusicHotkey({ player, hotkey }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
}) {
  if (getPlayerKind(player) !== PlayerKind.Music) {
    return;
  }

  dispatchKey({
    player,
    hotkey,
    eventType: KeyEventType.Press
  });
}

// For a YouTube key that acts for as long as it is held (360° zoom): pressed now, and released by the returned
// function once the viewer lets go of the VLC key
export function holdYoutubeHotkey({ player, hotkey }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
}) {
  const isPressed = dispatchYoutubeHotkey({
    player,
    hotkey
  });
  if (!isPressed) {
    return;
  }

  return () => dispatchKey({
    player,
    hotkey,
    eventType: KeyEventType.Release
  });
}
