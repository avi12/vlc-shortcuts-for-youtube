import { formatDialogCombos, learnNotation } from "@/lib/help-dialog/hotkey-notation";
import { splitAlternatives, toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";
import { getDialogRowRank } from "@/lib/help-dialog/row-order";
import { KeymapSection } from "@/lib/shortcut";
import { getSite, isMusicSite } from "@/lib/site";
import { VLC_BINDINGS, VLC_WHEEL_SHORTCUTS, type VlcBinding } from "@/lib/vlc-keymap";
import {
  formatYoutubeHotkey,
  formatYoutubeShortcut,
  YOUTUBE_NATIVE_SHORTCUTS,
  YOUTUBE_SECTION_ANCHOR_KEYS,
  type YoutubeHotkey
} from "@/lib/youtube-keymap";
import {
  findMusicHotkey,
  formatMusicHotkey,
  MUSIC_SECTION_ANCHOR_KEYS,
  YOUTUBE_MUSIC_NATIVE_SHORTCUTS
} from "@/lib/youtube-music-keymap";

const SPHERICAL_VIDEOS_NOTE = "360° videos";

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

function toAlternativeSignatures(hotkey: string) {
  return splitAlternatives(hotkey).map(toHotkeySignature);
}

// A YouTube Music row is found by any of the keys it lists
export function addYoutubeRow<TYoutubeOption>({ dialogText, row }: {
  dialogText: YoutubeDialogText<TYoutubeOption>;
  row: HotkeyRow<TYoutubeOption>;
}) {
  for (const signature of toAlternativeSignatures(row.hotkey)) {
    const rows = dialogText.youtubeRowsBySignature.get(signature) ?? [];
    dialogText.youtubeRowsBySignature.set(signature, [...rows, row]);
  }
}

function getSectionAnchorKeys(): Partial<Record<KeymapSection, string>> {
  return isMusicSite() ? MUSIC_SECTION_ANCHOR_KEYS : YOUTUBE_SECTION_ANCHOR_KEYS;
}

export function findSectionByHotkeys(hotkeys: string[]) {
  const signatures = hotkeys.flatMap(toAlternativeSignatures);
  const anchorKeys = getSectionAnchorKeys();
  return Object.values(KeymapSection).find(section => {
    const anchorKey = anchorKeys[section];
    return anchorKey !== undefined && signatures.includes(toHotkeySignature(anchorKey));
  });
}

// Each site's dialog writes its own keys its own way
function toDialogSignature(hotkey: YoutubeHotkey) {
  return toHotkeySignature(isMusicSite() ? formatMusicHotkey(hotkey) : formatYoutubeHotkey(hotkey));
}

function findYoutubeRowLabel({ hotkey, youtubeRowsBySignature }: {
  hotkey: YoutubeHotkey;
  youtubeRowsBySignature: Map<string, HotkeyRow<unknown>[]>;
}) {
  return youtubeRowsBySignature.get(toDialogSignature(hotkey))?.[0]?.label;
}

// On YouTube Music, Music's own key for the same control: its repeat for VLC's loop, its key for a YouTube one
function findMusicEquivalent(binding: VlcBinding) {
  return binding.musicEquivalent ?? (binding.youtubeEquivalent && findMusicHotkey(binding.youtubeEquivalent));
}

// A VLC row matching a YouTube key takes YouTube's own (localized) label for that key - with its step when finer.
// Music has no speed keys, so there only exact matches count
function findYoutubeLabel({ binding, youtubeRowsBySignature }: {
  binding: VlcBinding;
  youtubeRowsBySignature: Map<string, HotkeyRow<unknown>[]>;
}) {
  const exactHotkey = isMusicSite() ? findMusicEquivalent(binding) : binding.youtubeEquivalent;
  if (exactHotkey) {
    return findYoutubeRowLabel({
      hotkey: exactHotkey,
      youtubeRowsBySignature
    });
  }

  if (!binding.youtubeCoarserEquivalent || isMusicSite()) {
    return;
  }

  const { hotkey, step } = binding.youtubeCoarserEquivalent;
  const label = findYoutubeRowLabel({
    hotkey,
    youtubeRowsBySignature
  });
  return label && `${label} (${step})`;
}

// 360° keys reuse keys other videos bind (l loops them), so their rows say where they apply
function labelBinding({ binding, youtubeRowsBySignature }: {
  binding: VlcBinding;
  youtubeRowsBySignature: Map<string, HotkeyRow<unknown>[]>;
}) {
  const label = findYoutubeLabel({
    binding,
    youtubeRowsBySignature
  }) ?? binding.label;
  return binding.isSphericalOnly ? `${label} (${SPHERICAL_VIDEOS_NOTE})` : label;
}

function isBindingOnSite(binding: VlcBinding) {
  return !binding.site || binding.site === getSite();
}

function getNativeShortcuts() {
  return Object.values(isMusicSite() ? YOUTUBE_MUSIC_NATIVE_SHORTCUTS : YOUTUBE_NATIVE_SHORTCUTS);
}

function buildRows<TYoutubeOption>({ section, youtubeRowsBySignature }: {
  section: KeymapSection;
  youtubeRowsBySignature: Map<string, HotkeyRow<TYoutubeOption>[]>;
}): HotkeyRow<TYoutubeOption>[] {
  const notation = learnNotation(youtubeRowsBySignature);
  const vlcRows = VLC_BINDINGS
    .filter(binding => binding.section === section && isBindingOnSite(binding))
    .map(binding => ({
      rank: getDialogRowRank(binding.action),
      label: labelBinding({
        binding,
        youtubeRowsBySignature
      }),
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
  const youtubeRows = getNativeShortcuts()
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
