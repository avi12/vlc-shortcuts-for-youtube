import {
  formatCombos,
  isComboMatch,
  type KeyCombo,
  KeymapSection,
  type ShortcutStyle
} from "@/lib/shortcut";
import { YOUTUBE_HOTKEYS, type YoutubeHotkey } from "@/lib/youtube-keymap";

export enum VlcAction {
  PlayPause = "play-pause",
  Stop = "stop",
  ToggleFullscreen = "toggle-fullscreen",
  Next = "next",
  Previous = "previous",
  JumpBackwardExtraShort = "jump-backward-extra-short",
  JumpForwardExtraShort = "jump-forward-extra-short",
  JumpBackwardArrow = "jump-backward-arrow",
  JumpForwardArrow = "jump-forward-arrow",
  JumpBackwardShort = "jump-backward-short",
  JumpForwardShort = "jump-forward-short",
  JumpBackwardMedium = "jump-backward-medium",
  JumpForwardMedium = "jump-forward-medium",
  JumpBackwardLong = "jump-backward-long",
  JumpForwardLong = "jump-forward-long",
  NextFrame = "next-frame",
  VolumeUp = "volume-up",
  VolumeDown = "volume-down",
  ToggleMute = "toggle-mute",
  Slower = "slower",
  Faster = "faster",
  SlowerFine = "slower-fine",
  FasterFine = "faster-fine",
  NormalSpeed = "normal-speed",
  CycleSubtitles = "cycle-subtitles",
  CycleSubtitlesReverse = "cycle-subtitles-reverse",
  CycleAudioTrack = "cycle-audio-track",
  CycleAspectRatio = "cycle-aspect-ratio",
  ToggleLoop = "toggle-loop",
  Snapshot = "snapshot",
  ToggleControls = "toggle-controls"
}

export interface VlcBinding {
  action: VlcAction;
  section: KeymapSection;
  label: string;
  combos: KeyCombo[];
  isRepeatable?: boolean;
  // A YouTube key that does exactly the same, so YouTube's own (localized) label describes this binding too
  youtubeEquivalent?: YoutubeHotkey;
}

enum JumpDirection {
  Backward = -1,
  Forward = 1
}

interface JumpSize {
  seconds: number;
  modifiers: Omit<KeyCombo, "key">;
  backwardAction: VlcAction;
  forwardAction: VlcAction;
  youtubeEquivalents?: Record<JumpDirection, YoutubeHotkey>;
}

const SECONDS_PER_MINUTE = 60;

// VLC 3.x jump lengths (key-jump-*)
const JUMP_SECONDS = {
  extraShort: 3,
  arrow: 5,
  short: 10,
  medium: SECONDS_PER_MINUTE,
  long: 5 * SECONDS_PER_MINUTE
} as const;

// Each jump length sits on the arrow keys under its own modifier. Ctrl alone stays YouTube's chapter
// navigation, so VLC's 1-minute jump moved to Ctrl+Shift
const JUMP_SIZES: JumpSize[] = [
  {
    seconds: JUMP_SECONDS.extraShort,
    modifiers: {
      isShift: true
    },
    backwardAction: VlcAction.JumpBackwardExtraShort,
    forwardAction: VlcAction.JumpForwardExtraShort
  },
  {
    seconds: JUMP_SECONDS.arrow,
    modifiers: {},
    backwardAction: VlcAction.JumpBackwardArrow,
    forwardAction: VlcAction.JumpForwardArrow,
    youtubeEquivalents: {
      [JumpDirection.Backward]: YOUTUBE_HOTKEYS.seekBackwardShort,
      [JumpDirection.Forward]: YOUTUBE_HOTKEYS.seekForwardShort
    }
  },
  {
    seconds: JUMP_SECONDS.short,
    modifiers: {
      isAlt: true
    },
    backwardAction: VlcAction.JumpBackwardShort,
    forwardAction: VlcAction.JumpForwardShort,
    youtubeEquivalents: {
      [JumpDirection.Backward]: YOUTUBE_HOTKEYS.seekBackwardLong,
      [JumpDirection.Forward]: YOUTUBE_HOTKEYS.seekForwardLong
    }
  },
  {
    seconds: JUMP_SECONDS.medium,
    modifiers: {
      isCtrl: true,
      isShift: true
    },
    backwardAction: VlcAction.JumpBackwardMedium,
    forwardAction: VlcAction.JumpForwardMedium
  },
  {
    seconds: JUMP_SECONDS.long,
    modifiers: {
      isCtrl: true,
      isAlt: true
    },
    backwardAction: VlcAction.JumpBackwardLong,
    forwardAction: VlcAction.JumpForwardLong
  }
];

const JUMP_DIRECTION_KEYS: Record<JumpDirection, string> = {
  [JumpDirection.Backward]: "ArrowLeft",
  [JumpDirection.Forward]: "ArrowRight"
};

const JUMP_DIRECTION_WORDS: Record<JumpDirection, string> = {
  [JumpDirection.Backward]: "back",
  [JumpDirection.Forward]: "forward"
};

export const FINE_SPEED_STEP = 0.1;
export const NORMAL_SPEED = 1;

function formatDuration(seconds: number) {
  const isWholeMinutes = seconds >= SECONDS_PER_MINUTE && seconds % SECONDS_PER_MINUTE === 0;
  const [amount, unit] = isWholeMinutes ? [seconds / SECONDS_PER_MINUTE, "minute"] : [seconds, "second"];
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

function createJumpBinding({ jumpSize, direction }: {
  jumpSize: JumpSize;
  direction: JumpDirection;
}): VlcBinding {
  return {
    action: direction === JumpDirection.Forward ? jumpSize.forwardAction : jumpSize.backwardAction,
    section: KeymapSection.Playback,
    label: `Jump ${JUMP_DIRECTION_WORDS[direction]} ${formatDuration(jumpSize.seconds)}`,
    combos: [{
      key: JUMP_DIRECTION_KEYS[direction],
      ...jumpSize.modifiers
    }],
    isRepeatable: true,
    youtubeEquivalent: jumpSize.youtubeEquivalents?.[direction]
  };
}

const JUMP_DIRECTIONS = [JumpDirection.Backward, JumpDirection.Forward];

const JUMP_BINDINGS = JUMP_SIZES.flatMap(jumpSize => JUMP_DIRECTIONS.map(direction => createJumpBinding({
  jumpSize,
  direction
})));

export const JUMP_SECONDS_BY_ACTION = new Map<VlcAction, number>();
for (const { seconds, backwardAction, forwardAction } of JUMP_SIZES) {
  JUMP_SECONDS_BY_ACTION.set(backwardAction, JumpDirection.Backward * seconds);
  JUMP_SECONDS_BY_ACTION.set(forwardAction, JumpDirection.Forward * seconds);
}

export const VLC_BINDINGS: VlcBinding[] = [
  {
    action: VlcAction.PlayPause,
    section: KeymapSection.Playback,
    label: "Play/pause",
    combos: [{ key: " " }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.playPause
  },
  ...JUMP_BINDINGS,
  {
    action: VlcAction.Previous,
    section: KeymapSection.Playback,
    label: "Previous video",
    combos: [{ key: "p" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.previous
  },
  {
    action: VlcAction.Next,
    section: KeymapSection.Playback,
    label: "Next video",
    combos: [{ key: "n" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.next
  },
  {
    action: VlcAction.NextFrame,
    section: KeymapSection.Playback,
    label: "Next frame",
    combos: [{ key: "e" }],
    isRepeatable: true
  },
  {
    action: VlcAction.Slower,
    section: KeymapSection.Playback,
    label: "Slower",
    combos: [{ key: "[" }],
    isRepeatable: true,
    youtubeEquivalent: YOUTUBE_HOTKEYS.slower
  },
  {
    action: VlcAction.Faster,
    section: KeymapSection.Playback,
    label: "Faster",
    combos: [{ key: "]" }],
    isRepeatable: true,
    youtubeEquivalent: YOUTUBE_HOTKEYS.faster
  },
  {
    action: VlcAction.SlowerFine,
    section: KeymapSection.Playback,
    label: "Slower (fine)",
    combos: [{ key: "-" }],
    isRepeatable: true
  },
  {
    action: VlcAction.FasterFine,
    section: KeymapSection.Playback,
    label: "Faster (fine)",
    combos: [{ key: "+" }],
    isRepeatable: true
  },
  {
    action: VlcAction.NormalSpeed,
    section: KeymapSection.Playback,
    label: "Normal speed",
    combos: [{ key: "=" }]
  },
  {
    action: VlcAction.Stop,
    section: KeymapSection.Playback,
    label: "Stop",
    combos: [{ key: "s" }]
  },
  {
    action: VlcAction.ToggleLoop,
    section: KeymapSection.Playback,
    label: "Toggle loop",
    combos: [{ key: "l" }]
  },
  {
    action: VlcAction.ToggleFullscreen,
    section: KeymapSection.General,
    label: "Toggle fullscreen",
    combos: [{ key: "f" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.fullscreen
  },
  {
    action: VlcAction.ToggleMute,
    section: KeymapSection.General,
    label: "Mute/unmute",
    combos: [{ key: "m" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.mute
  },
  {
    action: VlcAction.VolumeUp,
    section: KeymapSection.General,
    label: "Volume up",
    combos: [{ key: "ArrowUp" }, {
      key: "ArrowUp",
      isCtrl: true
    }],
    isRepeatable: true
  },
  {
    action: VlcAction.VolumeDown,
    section: KeymapSection.General,
    label: "Volume down",
    combos: [{ key: "ArrowDown" }, {
      key: "ArrowDown",
      isCtrl: true
    }],
    isRepeatable: true
  },
  {
    action: VlcAction.CycleAudioTrack,
    section: KeymapSection.General,
    label: "Cycle audio track",
    combos: [{ key: "b" }]
  },
  {
    action: VlcAction.CycleAspectRatio,
    section: KeymapSection.General,
    label: "Cycle aspect ratio",
    combos: [{ key: "a" }]
  },
  {
    action: VlcAction.Snapshot,
    section: KeymapSection.General,
    label: "Take snapshot",
    combos: [{
      key: "s",
      isShift: true
    }]
  },
  {
    action: VlcAction.ToggleControls,
    section: KeymapSection.General,
    label: "Hide/show controls",
    combos: [{
      key: "h",
      isCtrl: true
    }]
  },
  {
    action: VlcAction.CycleSubtitles,
    section: KeymapSection.Subtitles,
    label: "Cycle subtitle track",
    combos: [{ key: "v" }]
  },
  {
    action: VlcAction.CycleSubtitlesReverse,
    section: KeymapSection.Subtitles,
    label: "Cycle subtitle track in reverse",
    combos: [{
      key: "v",
      isAlt: true
    }]
  }
];

// Wheel gestures have no key combo, so they carry their own display text
export const VLC_WHEEL_SHORTCUTS = [
  {
    section: KeymapSection.General,
    label: "Volume up/down",
    hotkey: "wheel"
  }
] as const;

export function findBinding(e: KeyboardEvent) {
  return VLC_BINDINGS.find(binding => binding.combos.some(combo => isComboMatch({
    combo,
    e
  })));
}

export function formatActionShortcut({ action, style }: {
  action: VlcAction;
  style: ShortcutStyle;
}) {
  const binding = VLC_BINDINGS.find(candidate => candidate.action === action);
  if (!binding) {
    return null;
  }

  return formatCombos({
    combos: binding.combos,
    style
  });
}
