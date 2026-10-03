import { showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import { dispatchMusicHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { YOUTUBE_MUSIC_HOTKEYS } from "@/lib/youtube-music-keymap";

// YouTube Music's player-bar buttons. Music retitles a button as its state changes ("Repeat off" -> "Repeat all")
const MUSIC_CONTROL_BUTTON_SELECTOR = "ytmusic-wiz-player-controls button, ytmusic-player-bar [title]";
const SHUFFLED_STATUS = "Queue shuffled";

function readControlTitles() {
  return Array.from(document.querySelectorAll(MUSIC_CONTROL_BUTTON_SELECTOR), elButton => elButton.getAttribute("title"));
}

// VLC's loop cycles through Music's own repeat modes, and the bezel shows the mode in Music's own words
export function toggleRepeat(player: YoutubePlayer) {
  const titlesBefore = readControlTitles();
  dispatchMusicHotkey({
    player,
    hotkey: YOUTUBE_MUSIC_HOTKEYS.repeat
  });
  requestAnimationFrame(() => {
    const changedTitle = readControlTitles().find((title, i) => title !== titlesBefore[i]);
    if (!changedTitle) {
      return;
    }

    showStatusInNativeBezel({
      player,
      text: changedTitle
    });
  });
}

// VLC's random is Music's shuffle, which reorders the queue once
export function shuffle(player: YoutubePlayer) {
  dispatchMusicHotkey({
    player,
    hotkey: YOUTUBE_MUSIC_HOTKEYS.shuffle
  });
  showStatusInNativeBezel({
    player,
    text: SHUFFLED_STATUS
  });
}
