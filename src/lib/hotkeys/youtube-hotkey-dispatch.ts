import { getPlayerKind, type YoutubePlayer } from "@/lib/player";
import { isHotkeyHonored, type YoutubeHotkey } from "@/lib/youtube-keymap";

const dispatchedEvents = new WeakSet<Event>();

// Our own synthetic presses must reach YouTube's handler instead of being swallowed as a replaced key
export function isDispatchedYoutubeHotkey(e: Event) {
  return dispatchedEvents.has(e);
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
    const e = new KeyboardEvent("keydown", {
      ...hotkey,
      bubbles: true,
      cancelable: true
    });
    dispatchedEvents.add(e);
    player.dispatchEvent(e);
  }
  return true;
}
