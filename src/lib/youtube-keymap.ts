import {
  formatCombos,
  isComboMatch,
  type KeyCombo,
  KeymapSection,
  ShortcutStyle
} from "@/lib/vlc-keymap";

interface YoutubeShortcut {
  section: KeymapSection;
  label: string;
  combos: KeyCombo[];
  hotkeyLabel?: string;
}

const DIGIT_COMBOS = Array.from({ length: 10 }, (_, digit) => ({ key: String(digit) }));

// Controls only YouTube's player has - VLC has no equivalent, so YouTube keeps handling its own keys.
// Labels are YouTube's English wording, used only when YouTube's own (localized) row is missing
export const YOUTUBE_NATIVE_SHORTCUTS: YoutubeShortcut[] = [
  {
    section: KeymapSection.General,
    label: "Toggle theater mode",
    combos: [{ key: "t" }]
  },
  {
    section: KeymapSection.General,
    label: "Toggle miniplayer",
    combos: [{ key: "i" }]
  },
  {
    section: KeymapSection.Playback,
    label: "Previous frame (while paused)",
    combos: [{ key: "," }]
  },
  {
    section: KeymapSection.Playback,
    label: "Seek to specific point in the video (7 advances to 70% of duration)",
    combos: DIGIT_COMBOS,
    hotkeyLabel: "0..9"
  },
  {
    section: KeymapSection.Playback,
    label: "Seek to previous chapter",
    combos: [{
      key: "ArrowLeft",
      isCtrl: true
    }]
  },
  {
    section: KeymapSection.Playback,
    label: "Seek to next chapter",
    combos: [{
      key: "ArrowRight",
      isCtrl: true
    }]
  },
  {
    section: KeymapSection.Playback,
    label: "Seek to the beginning",
    combos: [{ key: "Home" }]
  },
  {
    section: KeymapSection.Playback,
    label: "Seek to the end",
    combos: [{ key: "End" }]
  },
  {
    section: KeymapSection.General,
    label: "Close miniplayer or current dialog",
    combos: [{ key: "Escape" }]
  }
];

interface YoutubeHotkey {
  key: string;
  code: string;
  keyCode: number;
  shiftKey?: boolean;
}

// YouTube's own keys for the controls VLC also has. VLC's keys trigger these (dispatched to YouTube),
// so every action shows YouTube's native bezel, seek overlay or caption card - never an overlay of ours
export const YOUTUBE_HOTKEYS = {
  playPause: {
    key: "k",
    code: "KeyK",
    keyCode: 75
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
  seekBackwardShort: {
    key: "ArrowLeft",
    code: "ArrowLeft",
    keyCode: 37
  },
  seekForwardShort: {
    key: "ArrowRight",
    code: "ArrowRight",
    keyCode: 39
  },
  seekBackwardLong: {
    key: "j",
    code: "KeyJ",
    keyCode: 74
  },
  seekForwardLong: {
    key: "l",
    code: "KeyL",
    keyCode: 76
  },
  volumeUp: {
    key: "ArrowUp",
    code: "ArrowUp",
    keyCode: 38
  },
  volumeDown: {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40
  },
  faster: {
    key: ">",
    code: "Period",
    keyCode: 190,
    shiftKey: true
  },
  slower: {
    key: "<",
    code: "Comma",
    keyCode: 188,
    shiftKey: true
  },
  nextFrame: {
    key: ".",
    code: "Period",
    keyCode: 190
  },
  captions: {
    key: "c",
    code: "KeyC",
    keyCode: 67
  }
} as const satisfies Record<string, YoutubeHotkey>;

// YouTube's seek keys move by these many seconds
export const YOUTUBE_SEEK_SECONDS = {
  short: 5,
  long: 10
} as const;

function toCombo({ key, shiftKey }: YoutubeHotkey): KeyCombo {
  return {
    key,
    isShift: shiftKey
  };
}

// YouTube's shortcuts for controls VLC also has - VLC's keys replace them, so these are swallowed
const YOUTUBE_REPLACED_COMBOS: KeyCombo[] = [
  ...Object.values(YOUTUBE_HOTKEYS).map(toCombo),
  { key: " " },
  { key: "b" },
  { key: "+" },
  { key: "-" }
];

export function isReplacedYoutubeKey(e: KeyboardEvent) {
  return YOUTUBE_REPLACED_COMBOS.some(combo => isComboMatch({
    combo,
    e
  }));
}

export function formatYoutubeShortcut({ combos, hotkeyLabel }: YoutubeShortcut) {
  return hotkeyLabel ?? formatCombos({
    combos,
    style: ShortcutStyle.Dialog
  });
}

// A key YouTube always lists in each dialog section, so its localized section title can be found in any language
export const YOUTUBE_SECTION_ANCHOR_KEYS: Record<KeymapSection, string> = {
  [KeymapSection.Playback]: YOUTUBE_HOTKEYS.playPause.key,
  [KeymapSection.General]: YOUTUBE_HOTKEYS.fullscreen.key,
  [KeymapSection.Subtitles]: YOUTUBE_HOTKEYS.captions.key
};
