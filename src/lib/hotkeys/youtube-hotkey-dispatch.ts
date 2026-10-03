import { getPlayerKind, type YoutubePlayer } from "@/lib/player";
import { isHotkeyHonored, type YoutubeHotkey } from "@/lib/youtube-keymap";

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

// Dispatched on the player, since YouTube only takes the arrow keys there; it bubbles to the
// document-level handler for the rest. A player that ignores the key (Shorts, the embed) gets the action's silent
// fallback instead - never the key, which can mean something else there. Tells whether the key was pressed
export function dispatchYoutubeHotkey({ player, hotkey, count = 1, fallback }: {
  player: YoutubePlayer;
  hotkey: YoutubeHotkey;
  count?: number;
  fallback?: () => void;
}) {
  if (!isHotkeyHonored({
    playerKind: getPlayerKind(player),
    hotkey
  })) {
    fallback?.();
    return false;
  }

  for (let i = 0; i < count; i++) {
    dispatchKey({
      player,
      hotkey,
      eventType: KeyEventType.Press
    });
  }
  return true;
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

  return () => {
    return dispatchKey({
      player,
      hotkey,
      eventType: KeyEventType.Release
    });
  };
}
