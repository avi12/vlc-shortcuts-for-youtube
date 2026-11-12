import { formatRate } from "@/lib/hotkeys/native/speed-bezel";
import {
  formatCombos,
  isComboMatch,
  type KeyCombo,
  KeymapSection,
  type ShortcutStyle
} from "@/lib/shortcut";
import { Site } from "@/lib/site";
import { YOUTUBE_360_HOTKEYS, YOUTUBE_HOTKEYS, type YoutubeHotkey } from "@/lib/youtube-keymap";
import { YOUTUBE_MUSIC_HOTKEYS } from "@/lib/youtube-music-keymap";

export enum VlcAction {
  PLAY_PAUSE = "play-pause",
  STOP = "stop",
  TOGGLE_FULLSCREEN = "toggle-fullscreen",
  NEXT = "next",
  PREVIOUS = "previous",
  JUMP_BACKWARD_EXTRA_SHORT = "jump-backward-extra-short",
  JUMP_FORWARD_EXTRA_SHORT = "jump-forward-extra-short",
  JUMP_BACKWARD_ARROW = "jump-backward-arrow",
  JUMP_FORWARD_ARROW = "jump-forward-arrow",
  JUMP_BACKWARD_SHORT = "jump-backward-short",
  JUMP_FORWARD_SHORT = "jump-forward-short",
  JUMP_BACKWARD_MEDIUM = "jump-backward-medium",
  JUMP_FORWARD_MEDIUM = "jump-forward-medium",
  JUMP_BACKWARD_LONG = "jump-backward-long",
  JUMP_FORWARD_LONG = "jump-forward-long",
  PREVIOUS_FRAME = "previous-frame",
  NEXT_FRAME = "next-frame",
  VOLUME_UP = "volume-up",
  VOLUME_DOWN = "volume-down",
  TOGGLE_MUTE = "toggle-mute",
  SLOWER = "slower",
  FASTER = "faster",
  SLOWER_FINE = "slower-fine",
  FASTER_FINE = "faster-fine",
  NORMAL_SPEED = "normal-speed",
  CYCLE_SUBTITLES = "cycle-subtitles",
  CYCLE_SUBTITLES_REVERSE = "cycle-subtitles-reverse",
  CYCLE_AUDIO_TRACK = "cycle-audio-track",
  CYCLE_ASPECT_RATIO = "cycle-aspect-ratio",
  TOGGLE_LOOP = "toggle-loop",
  SHUFFLE = "shuffle",
  SNAPSHOT = "snapshot",
  TOGGLE_CONTROLS = "toggle-controls",
  TOGGLE_MINIPLAYER = "toggle-miniplayer",
  SHOW_MORE_VIDEOS = "show-more-videos",
  ZOOM_IN_360 = "zoom-in-360",
  ZOOM_OUT_360 = "zoom-out-360",
  PAN_UP_360 = "pan-up-360",
  PAN_LEFT_360 = "pan-left-360",
  PAN_DOWN_360 = "pan-down-360",
  PAN_RIGHT_360 = "pan-right-360"
}

export interface VlcBinding {
  action: VlcAction;
  section: KeymapSection;
  label: string;
  combos: KeyCombo[];
  isRepeatable?: boolean;
  // Acts only on 360° videos, as VLC's viewpoint keys do, and there takes over the key from any other binding (l
  // loops other videos). On any other video the key is left to its other binding, or to the page
  isSphericalOnly?: boolean;
  // Acts only on this site: YouTube Music has no miniplayer or 360° videos and keeps + for liking a song, and only
  // Music has a queue to shuffle
  site?: Site;
  // A page scroll key, so like YouTube's volume keys it acts only while focus is inside the player
  isPlayerFocusOnly?: boolean;
  // A YouTube key that does exactly the same, so YouTube's own (localized) label describes this binding too
  youtubeEquivalent?: YoutubeHotkey;
  // A YouTube key that does the same in bigger steps: YouTube's own (localized) label plus this binding's step
  youtubeCoarserEquivalent?: {
    hotkey: YoutubeHotkey;
    step: string;
  };
  // YouTube Music's key for the same control where it isn't YouTube's (VLC's loop is Music's repeat), so Music's
  // own (localized) label describes this binding there
  musicEquivalent?: YoutubeHotkey;
}

enum JumpDirection {
  BACKWARD = -1,
  FORWARD = 1
}

interface JumpSize {
  seconds: number;
  modifiers: Omit<KeyCombo, "key">;
  backwardAction: VlcAction;
  forwardAction: VlcAction;
  youtubeEquivalents?: Record<JumpDirection, YoutubeHotkey>;
}

const SECONDS_PER_MINUTE = 60;
const LONG_JUMP_MINUTES = 5;

// VLC 3.x jump lengths (key-jump-*)
const JUMP_SECONDS = {
  extraShort: 3,
  arrow: 5,
  short: 10,
  medium: SECONDS_PER_MINUTE,
  long: LONG_JUMP_MINUTES * SECONDS_PER_MINUTE
} as const;

// Each jump length sits on the arrow keys under its own modifier. Ctrl alone stays YouTube's chapter
// navigation, so VLC's 1-minute jump moved to Ctrl+Shift
const JUMP_SIZES: JumpSize[] = [
  {
    seconds: JUMP_SECONDS.extraShort,
    modifiers: {
      isShift: true
    },
    backwardAction: VlcAction.JUMP_BACKWARD_EXTRA_SHORT,
    forwardAction: VlcAction.JUMP_FORWARD_EXTRA_SHORT
  },
  {
    seconds: JUMP_SECONDS.arrow,
    modifiers: {},
    backwardAction: VlcAction.JUMP_BACKWARD_ARROW,
    forwardAction: VlcAction.JUMP_FORWARD_ARROW,
    youtubeEquivalents: {
      [JumpDirection.BACKWARD]: YOUTUBE_HOTKEYS.seekBackwardShort,
      [JumpDirection.FORWARD]: YOUTUBE_HOTKEYS.seekForwardShort
    }
  },
  {
    seconds: JUMP_SECONDS.short,
    modifiers: {
      isAlt: true
    },
    backwardAction: VlcAction.JUMP_BACKWARD_SHORT,
    forwardAction: VlcAction.JUMP_FORWARD_SHORT,
    youtubeEquivalents: {
      [JumpDirection.BACKWARD]: YOUTUBE_HOTKEYS.seekBackwardLong,
      [JumpDirection.FORWARD]: YOUTUBE_HOTKEYS.seekForwardLong
    }
  },
  {
    seconds: JUMP_SECONDS.medium,
    modifiers: {
      isCtrl: true,
      isShift: true
    },
    backwardAction: VlcAction.JUMP_BACKWARD_MEDIUM,
    forwardAction: VlcAction.JUMP_FORWARD_MEDIUM
  },
  {
    seconds: JUMP_SECONDS.long,
    modifiers: {
      isCtrl: true,
      isAlt: true
    },
    backwardAction: VlcAction.JUMP_BACKWARD_LONG,
    forwardAction: VlcAction.JUMP_FORWARD_LONG
  }
];

const JUMP_DIRECTION_KEYS: Record<JumpDirection, string> = {
  [JumpDirection.BACKWARD]: "ArrowLeft",
  [JumpDirection.FORWARD]: "ArrowRight"
};

const JUMP_DIRECTION_WORDS: Record<JumpDirection, string> = {
  [JumpDirection.BACKWARD]: "back",
  [JumpDirection.FORWARD]: "forward"
};

export const FINE_SPEED_STEP = 0.1;
export const NORMAL_SPEED = 1;
// YouTube's English labels for its speed keys, used until its own (localized) dialog is read
const SLOWER_LABEL = "Decrease playback rate";
const FASTER_LABEL = "Increase playback rate";
const FINE_SPEED_STEP_LABEL = formatRate(FINE_SPEED_STEP);

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
    action: direction === JumpDirection.FORWARD ? jumpSize.forwardAction : jumpSize.backwardAction,
    section: KeymapSection.PLAYBACK,
    label: `Jump ${JUMP_DIRECTION_WORDS[direction]} ${formatDuration(jumpSize.seconds)}`,
    combos: [{
      key: JUMP_DIRECTION_KEYS[direction],
      ...jumpSize.modifiers
    }],
    isRepeatable: true,
    youtubeEquivalent: jumpSize.youtubeEquivalents?.[direction]
  };
}

const JUMP_DIRECTIONS = [JumpDirection.BACKWARD, JumpDirection.FORWARD];

const JUMP_BINDINGS = JUMP_SIZES.flatMap(jumpSize => JUMP_DIRECTIONS.map(direction => createJumpBinding({
  jumpSize,
  direction
})));

export const JUMP_SECONDS_BY_ACTION = new Map<VlcAction, number>();
for (const { seconds, backwardAction, forwardAction } of JUMP_SIZES) {
  JUMP_SECONDS_BY_ACTION.set(backwardAction, JumpDirection.BACKWARD * seconds);
  JUMP_SECONDS_BY_ACTION.set(forwardAction, JumpDirection.FORWARD * seconds);
}

// YouTube moves a 360° view for as long as its key is held, so these keep moving while held too
const VIEW_360_BINDING_BASE = {
  section: KeymapSection.GENERAL,
  isRepeatable: true,
  isSphericalOnly: true,
  site: Site.YOUTUBE
} as const satisfies Partial<VlcBinding>;

export const VLC_BINDINGS: VlcBinding[] = [
  {
    action: VlcAction.PLAY_PAUSE,
    section: KeymapSection.PLAYBACK,
    label: "Play/pause",
    combos: [{ key: " " }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.playPause
  },
  ...JUMP_BINDINGS,
  {
    action: VlcAction.PREVIOUS,
    section: KeymapSection.PLAYBACK,
    label: "Previous video",
    combos: [{ key: "p" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.previous
  },
  {
    action: VlcAction.NEXT,
    section: KeymapSection.PLAYBACK,
    label: "Next video",
    combos: [{ key: "n" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.next
  },
  {
    action: VlcAction.PREVIOUS_FRAME,
    section: KeymapSection.PLAYBACK,
    label: "Previous frame",
    combos: [{
      key: "e",
      isShift: true
    }],
    isRepeatable: true,
    youtubeEquivalent: YOUTUBE_HOTKEYS.previousFrame
  },
  {
    action: VlcAction.NEXT_FRAME,
    section: KeymapSection.PLAYBACK,
    label: "Next frame",
    combos: [{ key: "e" }],
    isRepeatable: true,
    youtubeEquivalent: YOUTUBE_HOTKEYS.nextFrame
  },
  {
    action: VlcAction.SLOWER,
    section: KeymapSection.PLAYBACK,
    label: SLOWER_LABEL,
    combos: [{ key: "-" }],
    isRepeatable: true,
    youtubeEquivalent: YOUTUBE_HOTKEYS.slower
  },
  {
    action: VlcAction.FASTER,
    section: KeymapSection.PLAYBACK,
    label: FASTER_LABEL,
    combos: [{ key: "+" }],
    isRepeatable: true,
    // YouTube Music's + likes the song
    site: Site.YOUTUBE,
    youtubeEquivalent: YOUTUBE_HOTKEYS.faster
  },
  {
    action: VlcAction.SLOWER_FINE,
    section: KeymapSection.PLAYBACK,
    label: `${SLOWER_LABEL} (${FINE_SPEED_STEP_LABEL})`,
    combos: [{ key: "[" }],
    isRepeatable: true,
    youtubeCoarserEquivalent: {
      hotkey: YOUTUBE_HOTKEYS.slower,
      step: FINE_SPEED_STEP_LABEL
    }
  },
  {
    action: VlcAction.FASTER_FINE,
    section: KeymapSection.PLAYBACK,
    label: `${FASTER_LABEL} (${FINE_SPEED_STEP_LABEL})`,
    combos: [{ key: "]" }],
    isRepeatable: true,
    youtubeCoarserEquivalent: {
      hotkey: YOUTUBE_HOTKEYS.faster,
      step: FINE_SPEED_STEP_LABEL
    }
  },
  {
    action: VlcAction.NORMAL_SPEED,
    section: KeymapSection.PLAYBACK,
    label: "Normal speed",
    combos: [{ key: "=" }]
  },
  {
    action: VlcAction.STOP,
    section: KeymapSection.PLAYBACK,
    label: "Stop",
    combos: [{ key: "s" }]
  },
  {
    action: VlcAction.TOGGLE_LOOP,
    section: KeymapSection.PLAYBACK,
    label: "Toggle loop",
    combos: [{ key: "l" }],
    musicEquivalent: YOUTUBE_MUSIC_HOTKEYS.repeat
  },
  {
    action: VlcAction.SHUFFLE,
    section: KeymapSection.PLAYBACK,
    label: "Shuffle",
    combos: [{ key: "r" }],
    site: Site.MUSIC,
    musicEquivalent: YOUTUBE_MUSIC_HOTKEYS.shuffle
  },
  {
    action: VlcAction.TOGGLE_FULLSCREEN,
    section: KeymapSection.GENERAL,
    label: "Toggle fullscreen",
    combos: [{ key: "f" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.fullscreen
  },
  {
    action: VlcAction.TOGGLE_MINIPLAYER,
    section: KeymapSection.GENERAL,
    label: "Toggle miniplayer",
    combos: [{ key: "i" }, {
      key: "i",
      isShift: true
    }],
    site: Site.YOUTUBE,
    youtubeEquivalent: YOUTUBE_HOTKEYS.miniplayer
  },
  {
    action: VlcAction.SHOW_MORE_VIDEOS,
    section: KeymapSection.GENERAL,
    label: "Show more videos at the end",
    combos: [{
      key: "v",
      isShift: true
    }],
    site: Site.YOUTUBE,
    youtubeEquivalent: YOUTUBE_HOTKEYS.moreVideos
  },
  {
    action: VlcAction.TOGGLE_MUTE,
    section: KeymapSection.GENERAL,
    label: "Mute/unmute",
    combos: [{ key: "m" }],
    youtubeEquivalent: YOUTUBE_HOTKEYS.mute
  },
  {
    action: VlcAction.VOLUME_UP,
    section: KeymapSection.GENERAL,
    label: "Volume up",
    combos: [{ key: "ArrowUp" }, {
      key: "ArrowUp",
      isCtrl: true
    }],
    isRepeatable: true
  },
  {
    action: VlcAction.VOLUME_DOWN,
    section: KeymapSection.GENERAL,
    label: "Volume down",
    combos: [{ key: "ArrowDown" }, {
      key: "ArrowDown",
      isCtrl: true
    }],
    isRepeatable: true
  },
  {
    action: VlcAction.CYCLE_AUDIO_TRACK,
    section: KeymapSection.GENERAL,
    label: "Cycle audio track",
    combos: [{ key: "b" }]
  },
  {
    action: VlcAction.CYCLE_ASPECT_RATIO,
    section: KeymapSection.GENERAL,
    label: "Cycle aspect ratio",
    combos: [{ key: "a" }]
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.ZOOM_IN_360,
    label: "Zoom in",
    combos: [{ key: "PageUp" }],
    isPlayerFocusOnly: true,
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.zoomIn
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.ZOOM_OUT_360,
    label: "Zoom out",
    combos: [{ key: "PageDown" }],
    isPlayerFocusOnly: true,
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.zoomOut
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.PAN_UP_360,
    label: "Pan up",
    combos: [{ key: "i" }],
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.lookUp
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.PAN_LEFT_360,
    label: "Pan left",
    combos: [{ key: "j" }],
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.lookLeft
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.PAN_DOWN_360,
    label: "Pan down",
    combos: [{ key: "k" }],
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.lookDown
  },
  {
    ...VIEW_360_BINDING_BASE,
    action: VlcAction.PAN_RIGHT_360,
    label: "Pan right",
    combos: [{ key: "l" }],
    youtubeEquivalent: YOUTUBE_360_HOTKEYS.lookRight
  },
  {
    action: VlcAction.SNAPSHOT,
    section: KeymapSection.GENERAL,
    label: "Take snapshot",
    combos: [{
      key: "s",
      isShift: true
    }]
  },
  {
    action: VlcAction.TOGGLE_CONTROLS,
    section: KeymapSection.GENERAL,
    label: "Hide/show controls",
    combos: [{
      key: "h",
      isCtrl: true
    }]
  },
  {
    action: VlcAction.CYCLE_SUBTITLES,
    section: KeymapSection.SUBTITLES,
    label: "Cycle subtitle track",
    combos: [{ key: "v" }]
  },
  {
    action: VlcAction.CYCLE_SUBTITLES_REVERSE,
    section: KeymapSection.SUBTITLES,
    label: "Cycle subtitle track in reverse",
    combos: [{
      key: "v",
      isAlt: true
    }]
  }
];

const WHEEL_KEY = "wheel";

// Shift keeps the plain wheel scrolling the page
export const VLC_WHEEL_VOLUME = {
  section: KeymapSection.GENERAL,
  label: "Volume up/down",
  combos: [{
    key: WHEEL_KEY,
    isShift: true
  }]
} as const satisfies Pick<VlcBinding, "section" | "label" | "combos">;

export const VLC_WHEEL_SHORTCUTS = [VLC_WHEEL_VOLUME];

export function findBindings(event: KeyboardEvent) {
  return VLC_BINDINGS.filter(binding => binding.combos.some(combo => isComboMatch({
    combo,
    e: event
  })));
}

export function findBinding(action: VlcAction) {
  return VLC_BINDINGS.find(binding => binding.action === action) ?? null;
}

export function formatActionShortcut({ action, style }: {
  action: VlcAction;
  style: ShortcutStyle;
}) {
  const binding = findBinding(action);
  if (!binding) {
    return null;
  }

  return formatCombos({
    combos: binding.combos,
    style
  });
}
