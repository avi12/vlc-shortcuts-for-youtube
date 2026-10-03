import { formatCombos, KeymapSection, ShortcutStyle } from "@/lib/shortcut";
import { VLC_BINDINGS, VLC_WHEEL_SHORTCUTS, type VlcBinding } from "@/lib/vlc-keymap";
import {
  formatYoutubeHotkey,
  formatYoutubeShortcut,
  YOUTUBE_NATIVE_SHORTCUTS,
  YOUTUBE_SECTION_ANCHOR_KEYS
} from "@/lib/youtube-keymap";

interface HotkeyRow {
  label: string;
  hotkey: string;
}

export interface HotkeyGroup {
  title: string;
  rows: HotkeyRow[];
}

// The text YouTube's own dialog shows, already in the viewer's language
interface YoutubeDialogText {
  labelByHotkey: Map<string, string>;
  titleBySection: Map<KeymapSection, string>;
}

export function createEmptyDialogText(): YoutubeDialogText {
  return {
    labelByHotkey: new Map(),
    titleBySection: new Map()
  };
}

export function findSectionByHotkeys(hotkeys: string[]) {
  return Object.values(KeymapSection).find(section => hotkeys.includes(YOUTUBE_SECTION_ANCHOR_KEYS[section]));
}

// A VLC row that does exactly what a YouTube key does takes YouTube's own (localized) label for that key
function findYoutubeLabel({ binding, labelByHotkey }: {
  binding: VlcBinding;
  labelByHotkey: Map<string, string>;
}) {
  if (!binding.youtubeEquivalent) {
    return;
  }

  return labelByHotkey.get(formatYoutubeHotkey(binding.youtubeEquivalent));
}

function buildRows({ section, labelByHotkey }: {
  section: KeymapSection;
  labelByHotkey: Map<string, string>;
}) {
  const vlcRows = VLC_BINDINGS.filter(binding => binding.section === section).map(binding => ({
    label: findYoutubeLabel({
      binding,
      labelByHotkey
    }) ?? binding.label,
    hotkey: formatCombos({
      combos: binding.combos,
      style: ShortcutStyle.Dialog
    })
  }));
  const wheelRows = VLC_WHEEL_SHORTCUTS.filter(shortcut => shortcut.section === section).map(shortcut => ({
    label: shortcut.label,
    hotkey: shortcut.hotkey
  }));
  const youtubeRows = YOUTUBE_NATIVE_SHORTCUTS.filter(shortcut => shortcut.section === section).map(shortcut => {
    const hotkey = formatYoutubeShortcut(shortcut);
    return {
      label: labelByHotkey.get(hotkey) ?? shortcut.label,
      hotkey
    };
  });
  return [...vlcRows, ...wheelRows, ...youtubeRows];
}

// Section titles and YouTube-only rows reuse YouTube's own (localized) text when its dialog has them
export function buildGroups({ labelByHotkey, titleBySection }: YoutubeDialogText): HotkeyGroup[] {
  return Object.values(KeymapSection).map(section => ({
    title: titleBySection.get(section) ?? section,
    rows: buildRows({
      section,
      labelByHotkey
    })
  }));
}
