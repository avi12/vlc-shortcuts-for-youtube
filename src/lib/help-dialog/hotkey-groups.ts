import { formatDialogCombos, learnNotation } from "@/lib/help-dialog/hotkey-notation";
import { toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";
import { getDialogRowRank } from "@/lib/help-dialog/row-order";
import { KeymapSection } from "@/lib/shortcut";
import { VLC_BINDINGS, VLC_WHEEL_SHORTCUTS, type VlcBinding } from "@/lib/vlc-keymap";
import {
  formatYoutubeHotkey,
  formatYoutubeShortcut,
  YOUTUBE_NATIVE_SHORTCUTS,
  YOUTUBE_SECTION_ANCHOR_KEYS
} from "@/lib/youtube-keymap";

// A row YouTube's own dialog lists carries YouTube's original entry, handed back untouched (badges included)
interface HotkeyRow<TYoutubeOption> {
  label: string;
  hotkey: string;
  youtubeOption?: TYoutubeOption;
}

export interface HotkeyGroup<TYoutubeOption> {
  title: string;
  rows: HotkeyRow<TYoutubeOption>[];
}

// The rows and titles YouTube's own dialog shows, already in the viewer's language. One key can have several
// rows, such as Ctrl+Right's chapter seek and Premium's "Jump ahead"
interface YoutubeDialogText<TYoutubeOption> {
  youtubeRowsBySignature: Map<string, HotkeyRow<TYoutubeOption>[]>;
  titleBySection: Map<KeymapSection, string>;
}

export function createEmptyDialogText<TYoutubeOption>(): YoutubeDialogText<TYoutubeOption> {
  return {
    youtubeRowsBySignature: new Map(),
    titleBySection: new Map()
  };
}

export function addYoutubeRow<TYoutubeOption>({ dialogText, row }: {
  dialogText: YoutubeDialogText<TYoutubeOption>;
  row: HotkeyRow<TYoutubeOption>;
}) {
  const signature = toHotkeySignature(row.hotkey);
  const rows = dialogText.youtubeRowsBySignature.get(signature) ?? [];
  dialogText.youtubeRowsBySignature.set(signature, [...rows, row]);
}

export function findSectionByHotkeys(hotkeys: string[]) {
  const signatures = hotkeys.map(toHotkeySignature);
  return Object.values(KeymapSection).find(section => {
    const anchorSignature = toHotkeySignature(YOUTUBE_SECTION_ANCHOR_KEYS[section]);
    return signatures.includes(anchorSignature);
  });
}

// A VLC row that does exactly what a YouTube key does takes YouTube's own (localized) label for that key
function findYoutubeLabel({ binding, youtubeRowsBySignature }: {
  binding: VlcBinding;
  youtubeRowsBySignature: Map<string, HotkeyRow<unknown>[]>;
}) {
  if (!binding.youtubeEquivalent) {
    return;
  }

  return youtubeRowsBySignature.get(toHotkeySignature(formatYoutubeHotkey(binding.youtubeEquivalent)))?.[0]?.label;
}

function buildRows<TYoutubeOption>({ section, youtubeRowsBySignature }: {
  section: KeymapSection;
  youtubeRowsBySignature: Map<string, HotkeyRow<TYoutubeOption>[]>;
}): HotkeyRow<TYoutubeOption>[] {
  const notation = learnNotation(youtubeRowsBySignature);
  const vlcRows = VLC_BINDINGS.filter(binding => binding.section === section).map(binding => ({
    rank: getDialogRowRank(binding.action),
    label: findYoutubeLabel({
      binding,
      youtubeRowsBySignature
    }) ?? binding.label,
    hotkey: formatDialogCombos({
      combos: binding.combos,
      notation
    })
  }));
  const wheelRows = VLC_WHEEL_SHORTCUTS.filter(shortcut => shortcut.section === section).map(shortcut => ({
    rank: getDialogRowRank(shortcut),
    label: shortcut.label,
    hotkey: formatDialogCombos({
      combos: shortcut.combos,
      notation
    })
  }));
  const youtubeRows = Object.values(YOUTUBE_NATIVE_SHORTCUTS)
    .filter(shortcut => shortcut.section === section)
    .flatMap(shortcut => {
      const rows = youtubeRowsBySignature.get(toHotkeySignature(formatYoutubeShortcut(shortcut))) ?? [];
      return rows.map(row => ({
        ...row,
        rank: getDialogRowRank(shortcut)
      }));
    });
  return [...vlcRows, ...wheelRows, ...youtubeRows]
    .toSorted((first, second) => first.rank - second.rank)
    .map(({ rank: _rank, ...row }) => row);
}

// Section titles, YouTube-only rows and the way keys are written all follow YouTube's own (localized) dialog
export function buildGroups<TYoutubeOption>(dialogText: YoutubeDialogText<TYoutubeOption>) {
  const { youtubeRowsBySignature, titleBySection } = dialogText;
  return Object.values(KeymapSection).map(section => ({
    title: titleBySection.get(section) ?? section,
    rows: buildRows({
      section,
      youtubeRowsBySignature
    })
  }));
}
