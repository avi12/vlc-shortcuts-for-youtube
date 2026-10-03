import type { YoutubePlayer } from "@/lib/player";

const dispatchedEvents = new WeakSet<Event>();

// Our own synthetic presses must reach YouTube's handler instead of being swallowed as a replaced key
export function isDispatchedYoutubeHotkey(e: Event) {
  return dispatchedEvents.has(e);
}

// Dispatched on the player, since YouTube only takes the arrow keys there; it bubbles to the
// document-level handler for the rest
export function dispatchYoutubeHotkey({ player, hotkey, count = 1 }: {
  player: YoutubePlayer;
  hotkey: KeyboardEventInit;
  count?: number;
}) {
  for (let i = 0; i < count; i++) {
    const e = new KeyboardEvent("keydown", {
      ...hotkey,
      bubbles: true,
      cancelable: true
    });
    dispatchedEvents.add(e);
    player.dispatchEvent(e);
  }
}
