import {
  formatCombos,
  isComboMatch,
  type KeyCombo,
  KeymapSection,
  ShortcutStyle
} from "@/lib/shortcut";
import { toHotkeyCombo, YOUTUBE_HOTKEYS, type YoutubeHotkey, type YoutubeShortcut } from "@/lib/youtube-keymap";

// YouTube Music's own keys for the controls VLC also has. Music's player ignores YouTube's player keys, so on Music
// VLC's keys ride these instead, and Music's player bar follows along
export const YOUTUBE_MUSIC_HOTKEYS = {
  playPause: {
    key: ";",
    code: "Semicolon",
    keyCode: 186
  },
  next: {
    key: "N",
    code: "KeyN",
    keyCode: 78,
    shiftKey: true
  },
  previous: {
    key: "P",
    code: "KeyP",
    keyCode: 80,
    shiftKey: true
  },
  seekForward: {
    key: "l",
    code: "KeyL",
    keyCode: 76
  },
  seekBackward: {
    key: "h",
    code: "KeyH",
    keyCode: 72
  },
  volumeUp: {
    key: "=",
    code: "Equal",
    keyCode: 187
  },
  volumeDown: {
    key: "-",
    code: "Minus",
    keyCode: 189
  },
  mute: {
    key: "m",
    code: "KeyM",
    keyCode: 77
  },
  fullscreen: {
    key: "f",
    code: "KeyF",
    keyCode: 70
  },
  shuffle: {
    key: "s",
    code: "KeyS",
    keyCode: 83
  },
  repeat: {
    key: "r",
    code: "KeyR",
    keyCode: 82
  }
} as const satisfies Record<string, YoutubeHotkey>;

// Music's key for each YouTube key whose control it also has. Its seek keys step 10 seconds, as YouTube's J and L do
const MUSIC_HOTKEY_BY_YOUTUBE_HOTKEY = new Map<YoutubeHotkey, YoutubeHotkey>([
  [YOUTUBE_HOTKEYS.playPause, YOUTUBE_MUSIC_HOTKEYS.playPause],
  [YOUTUBE_HOTKEYS.next, YOUTUBE_MUSIC_HOTKEYS.next],
  [YOUTUBE_HOTKEYS.previous, YOUTUBE_MUSIC_HOTKEYS.previous],
  [YOUTUBE_HOTKEYS.seekForwardLong, YOUTUBE_MUSIC_HOTKEYS.seekForward],
  [YOUTUBE_HOTKEYS.seekBackwardLong, YOUTUBE_MUSIC_HOTKEYS.seekBackward],
  [YOUTUBE_HOTKEYS.volumeUp, YOUTUBE_MUSIC_HOTKEYS.volumeUp],
  [YOUTUBE_HOTKEYS.volumeDown, YOUTUBE_MUSIC_HOTKEYS.volumeDown],
  [YOUTUBE_HOTKEYS.mute, YOUTUBE_MUSIC_HOTKEYS.mute],
  [YOUTUBE_HOTKEYS.fullscreen, YOUTUBE_MUSIC_HOTKEYS.fullscreen]
]);

export function findMusicHotkey(hotkey: YoutubeHotkey) {
  return MUSIC_HOTKEY_BY_YOUTUBE_HOTKEY.get(hotkey);
}

// Controls only Music has - VLC has no equivalent, so Music keeps handling its own keys. The help dialog keeps
// Music's own rows for these, in Music's (localized) wording
export const YOUTUBE_MUSIC_NATIVE_SHORTCUTS = {
  toggleQueue: {
    section: KeymapSection.General,
    combos: [{ key: "q" }]
  },
  like: {
    section: KeymapSection.General,
    combos: [{ key: "+" }]
  },
  dislike: {
    section: KeymapSection.General,
    combos: [{ key: "_" }]
  }
} as const satisfies Record<string, YoutubeShortcut>;

// A key Music always lists in each of its dialog sections that VLC's sections match. Music has no captions section
export const MUSIC_SECTION_ANCHOR_KEYS: Partial<Record<KeymapSection, string>> = {
  [KeymapSection.Playback]: YOUTUBE_MUSIC_HOTKEYS.playPause.key,
  [KeymapSection.General]: YOUTUBE_MUSIC_HOTKEYS.fullscreen.key
};

// Music's dialog writes a key the way YouTube's tooltips do ("SHIFT + n"), never "N (SHIFT+n)"
export function formatMusicHotkey(hotkey: YoutubeHotkey) {
  return formatCombos({
    combos: [toHotkeyCombo(hotkey)],
    style: ShortcutStyle.Tooltip
  });
}

// Music's navigation keys are two-key sequences ("g" then "l" goes to the library), so the key after its "g" is
// Music's, even where VLC binds it
const MUSIC_NAVIGATION_PREFIX_COMBO: KeyCombo = { key: "g" };

export function isMusicNavigationPrefix(e: KeyboardEvent) {
  return isComboMatch({
    combo: MUSIC_NAVIGATION_PREFIX_COMBO,
    e
  });
}
