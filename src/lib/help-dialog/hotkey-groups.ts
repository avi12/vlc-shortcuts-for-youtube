import { formatDialogCombos, learnNotation } from "@/lib/help-dialog/hotkey-notation";
import { toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";
import { KeymapSection } from "@/lib/shortcut";
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

// The rows and titles YouTube's own dialog shows, already in the viewer's language
interface YoutubeDialogText {
  youtubeRowBySignature: Map<string, HotkeyRow>;
  titleBySection: Map<KeymapSection, string>;
}

export function createEmptyDialogText(): YoutubeDialogText {
  return {
    youtubeRowBySignature: new Map(),
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
function findYoutubeLabel({ binding, youtubeRowBySignature }: {
  binding: VlcBinding;
  youtubeRowBySignature: Map<string, HotkeyRow>;
}) {
  if (!binding.youtubeEquivalent) {
    return;
  }

  return youtubeRowBySignature.get(toHotkeySignature(formatYoutubeHotkey(binding.youtubeEquivalent)))?.label;
}

function buildRows({ section, youtubeRowBySignature }: {
  section: KeymapSection;
  youtubeRowBySignature: Map<string, HotkeyRow>;
}) {
  const notation = learnNotation(youtubeRowBySignature);
  const vlcRows = VLC_BINDINGS.filter(binding => binding.section === section).map(binding => ({
    label: findYoutubeLabel({
      binding,
      youtubeRowBySignature
    }) ?? binding.label,
    hotkey: formatDialogCombos({
      combos: binding.combos,
      notation
    })
  }));
  const wheelRows = VLC_WHEEL_SHORTCUTS.filter(shortcut => shortcut.section === section).map(shortcut => ({
    label: shortcut.label,
    hotkey: shortcut.hotkey
  }));
  const youtubeRows = YOUTUBE_NATIVE_SHORTCUTS.filter(shortcut => shortcut.section === section).map(shortcut => {
    const englishHotkey = formatYoutubeShortcut(shortcut);
    return youtubeRowBySignature.get(toHotkeySignature(englishHotkey)) ?? {
      label: shortcut.label,
      hotkey: englishHotkey
    };
  });
  return [...vlcRows, ...wheelRows, ...youtubeRows];
}

// Section titles, YouTube-only rows and the way keys are written all follow YouTube's own (localized) dialog
export function buildGroups({ youtubeRowBySignature, titleBySection }: YoutubeDialogText): HotkeyGroup[] {
  return Object.values(KeymapSection).map(section => ({
    title: titleBySection.get(section) ?? section,
    rows: buildRows({
      section,
      youtubeRowBySignature
    })
  }));
}
