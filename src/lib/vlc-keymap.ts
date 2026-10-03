import {
  formatCombos,
  isComboMatch,
  type KeyCombo,
  KeymapSection,
  type ShortcutStyle
} from "@/lib/shortcut";

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

interface VlcBinding {
  action: VlcAction;
  section: KeymapSection;
  label: string;
  combos: KeyCombo[];
}

// VLC 3.x defaults (Windows/Linux key-jump-* and volume-step)
const JUMP_SECONDS = {
  extraShort: 3,
  arrow: 5,
  short: 10,
  medium: 60,
  long: 300
} as const;

export const FINE_SPEED_STEP = 0.1;
export const NORMAL_SPEED = 1;

export const JUMP_SECONDS_BY_ACTION: Partial<Record<VlcAction, number>> = {
  [VlcAction.JumpBackwardExtraShort]: -JUMP_SECONDS.extraShort,
  [VlcAction.JumpForwardExtraShort]: JUMP_SECONDS.extraShort,
  [VlcAction.JumpBackwardArrow]: -JUMP_SECONDS.arrow,
  [VlcAction.JumpForwardArrow]: JUMP_SECONDS.arrow,
  [VlcAction.JumpBackwardShort]: -JUMP_SECONDS.short,
  [VlcAction.JumpForwardShort]: JUMP_SECONDS.short,
  [VlcAction.JumpBackwardMedium]: -JUMP_SECONDS.medium,
  [VlcAction.JumpForwardMedium]: JUMP_SECONDS.medium,
  [VlcAction.JumpBackwardLong]: -JUMP_SECONDS.long,
  [VlcAction.JumpForwardLong]: JUMP_SECONDS.long
};

export const VLC_BINDINGS: VlcBinding[] = [
  {
    action: VlcAction.PlayPause,
    section: KeymapSection.Playback,
    label: "Play/pause",
    combos: [{ key: " " }]
  },
  {
    action: VlcAction.JumpBackwardExtraShort,
    section: KeymapSection.Playback,
    label: `Jump back ${JUMP_SECONDS.extraShort} seconds`,
    combos: [{
      key: "ArrowLeft",
      isShift: true
    }]
  },
  {
    action: VlcAction.JumpForwardExtraShort,
    section: KeymapSection.Playback,
    label: `Jump forward ${JUMP_SECONDS.extraShort} seconds`,
    combos: [{
      key: "ArrowRight",
      isShift: true
    }]
  },
  {
    action: VlcAction.JumpBackwardArrow,
    section: KeymapSection.Playback,
    label: `Jump back ${JUMP_SECONDS.arrow} seconds`,
    combos: [{ key: "ArrowLeft" }]
  },
  {
    action: VlcAction.JumpForwardArrow,
    section: KeymapSection.Playback,
    label: `Jump forward ${JUMP_SECONDS.arrow} seconds`,
    combos: [{ key: "ArrowRight" }]
  },
  {
    action: VlcAction.JumpBackwardShort,
    section: KeymapSection.Playback,
    label: `Jump back ${JUMP_SECONDS.short} seconds`,
    combos: [{
      key: "ArrowLeft",
      isAlt: true
    }]
  },
  {
    action: VlcAction.JumpForwardShort,
    section: KeymapSection.Playback,
    label: `Jump forward ${JUMP_SECONDS.short} seconds`,
    combos: [{
      key: "ArrowRight",
      isAlt: true
    }]
  },
  {
    action: VlcAction.JumpBackwardMedium,
    section: KeymapSection.Playback,
    label: "Jump back 1 minute",
    combos: [{
      key: "ArrowLeft",
      isCtrl: true,
      isShift: true
    }]
  },
  {
    action: VlcAction.JumpForwardMedium,
    section: KeymapSection.Playback,
    label: "Jump forward 1 minute",
    combos: [{
      key: "ArrowRight",
      isCtrl: true,
      isShift: true
    }]
  },
  {
    action: VlcAction.JumpBackwardLong,
    section: KeymapSection.Playback,
    label: "Jump back 5 minutes",
    combos: [{
      key: "ArrowLeft",
      isCtrl: true,
      isAlt: true
    }]
  },
  {
    action: VlcAction.JumpForwardLong,
    section: KeymapSection.Playback,
    label: "Jump forward 5 minutes",
    combos: [{
      key: "ArrowRight",
      isCtrl: true,
      isAlt: true
    }]
  },
  {
    action: VlcAction.Previous,
    section: KeymapSection.Playback,
    label: "Previous video",
    combos: [{ key: "p" }]
  },
  {
    action: VlcAction.Next,
    section: KeymapSection.Playback,
    label: "Next video",
    combos: [{ key: "n" }]
  },
  {
    action: VlcAction.NextFrame,
    section: KeymapSection.Playback,
    label: "Next frame",
    combos: [{ key: "e" }]
  },
  {
    action: VlcAction.Slower,
    section: KeymapSection.Playback,
    label: "Slower",
    combos: [{ key: "[" }]
  },
  {
    action: VlcAction.Faster,
    section: KeymapSection.Playback,
    label: "Faster",
    combos: [{ key: "]" }]
  },
  {
    action: VlcAction.SlowerFine,
    section: KeymapSection.Playback,
    label: "Slower (fine)",
    combos: [{ key: "-" }]
  },
  {
    action: VlcAction.FasterFine,
    section: KeymapSection.Playback,
    label: "Faster (fine)",
    combos: [{ key: "+" }]
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
    combos: [{ key: "f" }]
  },
  {
    action: VlcAction.ToggleMute,
    section: KeymapSection.General,
    label: "Mute/unmute",
    combos: [{ key: "m" }]
  },
  {
    action: VlcAction.VolumeUp,
    section: KeymapSection.General,
    label: "Volume up",
    combos: [{ key: "ArrowUp" }, {
      key: "ArrowUp",
      isCtrl: true
    }]
  },
  {
    action: VlcAction.VolumeDown,
    section: KeymapSection.General,
    label: "Volume down",
    combos: [{ key: "ArrowDown" }, {
      key: "ArrowDown",
      isCtrl: true
    }]
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
