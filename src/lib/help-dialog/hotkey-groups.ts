import { toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";
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
  labelByHotkeySignature: Map<string, string>;
  titleBySection: Map<KeymapSection, string>;
}

export function createEmptyDialogText(): YoutubeDialogText {
  return {
    labelByHotkeySignature: new Map(),
    titleBySection: new Map()
  };
}

export function findSectionByHotkeys(hotkeys: string[]) {
  const signatures = hotkeys.map(toHotkeySignature);
  return Object.values(KeymapSection).find(section => {
    const anchorSignature = toHotkeySignature(YOUTUBE_SECTION_ANCHOR_KEYS[section]);
    return signatures.includes(anchorSignature);
  });
}

// A VLC row that does exactly what a YouTube key does takes YouTube's own (localized) label for that key
function findYoutubeLabel({ binding, labelByHotkeySignature }: {
  binding: VlcBinding;
  labelByHotkeySignature: Map<string, string>;
}) {
  if (!binding.youtubeEquivalent) {
    return;
  }

  return labelByHotkeySignature.get(toHotkeySignature(formatYoutubeHotkey(binding.youtubeEquivalent)));
}

function buildRows({ section, labelByHotkeySignature }: {
  section: KeymapSection;
  labelByHotkeySignature: Map<string, string>;
}) {
  const vlcRows = VLC_BINDINGS.filter(binding => binding.section === section).map(binding => ({
    label: findYoutubeLabel({
      binding,
      labelByHotkeySignature
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
      label: labelByHotkeySignature.get(toHotkeySignature(hotkey)) ?? shortcut.label,
      hotkey
    };
  });
  return [...vlcRows, ...wheelRows, ...youtubeRows];
}

// Section titles and YouTube-only rows reuse YouTube's own (localized) text when its dialog has them
export function buildGroups({ labelByHotkeySignature, titleBySection }: YoutubeDialogText): HotkeyGroup[] {
  return Object.values(KeymapSection).map(section => ({
    title: titleBySection.get(section) ?? section,
    rows: buildRows({
      section,
      labelByHotkeySignature
    })
  }));
}
