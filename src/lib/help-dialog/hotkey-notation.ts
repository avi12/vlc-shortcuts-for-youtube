import { splitAlternatives, stripBidiMarks, toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";
import {
  formatCombos,
  formatKeyName,
  getShiftedSymbolBaseKey,
  isLetter,
  type KeyCombo,
  MODIFIER_JOINER,
  MODIFIER_NAMES,
  ShortcutStyle
} from "@/lib/shortcut";
import { isMusicSite } from "@/lib/site";
import { formatYoutubeHotkey, YOUTUBE_CHAPTER_COMBOS, YOUTUBE_HOTKEYS } from "@/lib/youtube-keymap";
import { formatMusicHotkey, YOUTUBE_MUSIC_HOTKEYS } from "@/lib/youtube-music-keymap";

// How YouTube's dialog writes keys in the viewer's language: its words for the modifiers, the joiner between
// them, how a shifted key reads ("P (SHIFT+p)", "P（Shift+p）", "+ (SHIFT+=)"), and in right-to-left languages
// the invisible direction marks that keep a combo reading left to right
interface HotkeyNotation {
  formatShiftedKey: (key: string) => string;
  controlName: string;
  altName: string;
  shiftName: string;
  joiner: string;
  directionMark: string;
}

const COMBO_SEPARATOR = " / ";
const SHIFTED_LETTER_SAMPLE = YOUTUBE_HOTKEYS.previous;
const CONTROL_SAMPLE = YOUTUBE_CHAPTER_COMBOS.previous;
const SHIFTED_LETTER_SIGNATURE = toHotkeySignature(formatYoutubeHotkey(SHIFTED_LETTER_SAMPLE));
const CONTROL_SIGNATURE = toHotkeySignature(
  formatCombos({
    combos: [CONTROL_SAMPLE],
    style: ShortcutStyle.Dialog
  })
);
const SHIFT_NAME_PATTERN = /[(（]\s*([^+＋]+?)\s*[+＋]/;
const MUSIC_SHIFTED_LETTER_SAMPLE = YOUTUBE_MUSIC_HOTKEYS.next;
const MUSIC_SHIFTED_LETTER_SIGNATURE = toHotkeySignature(formatMusicHotkey(MUSIC_SHIFTED_LETTER_SAMPLE));
const MUSIC_TRAILING_JOINER_PATTERN = /\s*[+＋]$/;
const TWO_MODIFIERS_PREFIX = "2+";
const JOINER_KEY = "+";

function formatEnglishShiftedKey(key: string) {
  return formatCombos({
    combos: [{
      key,
      isShift: true
    }],
    style: ShortcutStyle.Dialog
  });
}

const ENGLISH_NOTATION: HotkeyNotation = {
  formatShiftedKey: formatEnglishShiftedKey,
  controlName: MODIFIER_NAMES.control,
  altName: MODIFIER_NAMES.alt,
  shiftName: MODIFIER_NAMES.shift,
  joiner: MODIFIER_JOINER,
  directionMark: ""
};

// The character a shifted key types and the key it is typed on: "P" on "p", "+" on "="
function splitShiftedKey(key: string) {
  if (isLetter(key)) {
    return {
      typedCharacter: key.toUpperCase(),
      typedOnKey: key.toLowerCase()
    };
  }

  return {
    typedCharacter: key,
    typedOnKey: getShiftedSymbolBaseKey(key) ?? key
  };
}

// YouTube's "P (SHIFT+p)" row becomes a template: its P and p are swapped for any other shifted key
function createShiftedKeyFormatter(sample: string) {
  const sampleLetter = SHIFTED_LETTER_SAMPLE.key;
  const iUppercase = sample.indexOf(sampleLetter.toUpperCase());
  const iLowercase = sample.lastIndexOf(sampleLetter.toLowerCase());
  const isTemplate = iUppercase !== -1 && iUppercase < iLowercase;
  if (!isTemplate) {
    return formatEnglishShiftedKey;
  }

  return (key: string) => {
    const { typedCharacter, typedOnKey } = splitShiftedKey(key);
    return [
      sample.slice(0, iUppercase),
      typedCharacter,
      sample.slice(iUppercase + 1, iLowercase),
      typedOnKey,
      sample.slice(iLowercase + 1)
    ].join("");
  };
}

// YouTube's "CONTROL + ←" row tells its word for Ctrl, the joiner, and the direction mark after the key
function readControlNotation(sample: string) {
  const key = formatKeyName(CONTROL_SAMPLE.key);
  const iKey = sample.lastIndexOf(key);
  const prefix = stripBidiMarks(sample.slice(0, iKey));
  const iJoinerKey = prefix.lastIndexOf(JOINER_KEY);
  if (iKey === -1 || iJoinerKey === -1) {
    return null;
  }

  const controlName = prefix.slice(0, iJoinerKey).trim();
  const afterKey = sample.slice(iKey + key.length);
  return {
    controlName,
    joiner: prefix.slice(prefix.indexOf(controlName) + controlName.length),
    directionMark: stripBidiMarks(afterKey) === "" ? afterKey : ""
  };
}

// YouTube never writes Alt, so it follows the casing YouTube uses for Shift ("SHIFT" or "Shift")
function matchCasing({ name, sample }: {
  name: string;
  sample: string;
}) {
  const isUppercase = sample === sample.toUpperCase();
  return isUppercase ? name.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// The key in a row that lists several keys ("j or SHIFT + n") with this signature
function findAlternative({ youtubeRowsBySignature, signature }: {
  youtubeRowsBySignature: Map<string, { hotkey: string }[]>;
  signature: string;
}) {
  const hotkey = youtubeRowsBySignature.get(signature)?.[0]?.hotkey;
  return hotkey && splitAlternatives(hotkey).find(alternative => toHotkeySignature(alternative) === signature);
}

// YouTube Music writes shifted letters as a plain combo ("SHIFT + n") and Ctrl as "CTRL": its next-song key tells its
// word for Shift and the joiner, and its 1-second seek ("CTRL + SHIFT + right arrow", its only key with two
// modifiers) its word for Ctrl
function learnMusicNotation(youtubeRowsBySignature: Map<string, { hotkey: string }[]>): HotkeyNotation {
  const shiftedLetterSample = findAlternative({
    youtubeRowsBySignature,
    signature: MUSIC_SHIFTED_LETTER_SIGNATURE
  });
  const twoModifierSignature = youtubeRowsBySignature.keys()
    .find(signature => signature.startsWith(TWO_MODIFIERS_PREFIX));
  const controlSample = twoModifierSignature && findAlternative({
    youtubeRowsBySignature,
    signature: twoModifierSignature
  });
  const iShiftedKey = shiftedLetterSample?.lastIndexOf(MUSIC_SHIFTED_LETTER_SAMPLE.key.toLowerCase()) ?? -1;
  const shiftAndJoiner = shiftedLetterSample && iShiftedKey > 0 ? shiftedLetterSample.slice(0, iShiftedKey) : "";
  const shiftName = shiftAndJoiner.trim().replace(MUSIC_TRAILING_JOINER_PATTERN, "") || ENGLISH_NOTATION.shiftName;
  const joiner = shiftAndJoiner.slice(shiftAndJoiner.indexOf(shiftName) + shiftName.length) || ENGLISH_NOTATION.joiner;
  const controlName = controlSample?.split(joiner)[0]?.trim() || ENGLISH_NOTATION.controlName;
  return {
    formatShiftedKey: key => `${shiftName}${joiner}${splitShiftedKey(key).typedOnKey}`,
    controlName,
    altName: matchCasing({
      name: ENGLISH_NOTATION.altName,
      sample: shiftName
    }),
    shiftName,
    joiner,
    directionMark: ""
  };
}

export function learnNotation(youtubeRowsBySignature: Map<string, { hotkey: string }[]>): HotkeyNotation {
  if (isMusicSite()) {
    return learnMusicNotation(youtubeRowsBySignature);
  }

  const shiftedLetterSample = youtubeRowsBySignature.get(SHIFTED_LETTER_SIGNATURE)?.[0]?.hotkey;
  const controlSample = youtubeRowsBySignature.get(CONTROL_SIGNATURE)?.[0]?.hotkey;
  const shiftName = shiftedLetterSample?.normalize("NFKC").match(SHIFT_NAME_PATTERN)?.[1] ?? ENGLISH_NOTATION.shiftName;
  return {
    ...ENGLISH_NOTATION,
    ...controlSample && readControlNotation(controlSample),
    ...shiftedLetterSample && {
      formatShiftedKey: createShiftedKeyFormatter(shiftedLetterSample)
    },
    shiftName,
    altName: matchCasing({
      name: ENGLISH_NOTATION.altName,
      sample: shiftName
    })
  };
}

function formatCombo({ combo, notation }: {
  combo: KeyCombo;
  notation: HotkeyNotation;
}) {
  const isShiftedCharacter = Boolean(combo.isShift) && isLetter(combo.key) ||
    getShiftedSymbolBaseKey(combo.key) !== undefined;
  const isShiftedKey = isShiftedCharacter && !combo.isCtrl && !combo.isAlt;
  if (isShiftedKey) {
    return notation.formatShiftedKey(combo.key);
  }

  const parts = [
    combo.isCtrl && notation.controlName,
    combo.isAlt && notation.altName,
    combo.isShift && notation.shiftName,
    formatKeyName(combo.key)
  ];
  const { directionMark } = notation;
  return `${directionMark}${parts.filter(Boolean).join(notation.joiner)}${directionMark}`;
}

export function formatDialogCombos({ combos, notation }: {
  combos: KeyCombo[];
  notation: HotkeyNotation;
}) {
  return combos.map(combo => formatCombo({
    combo,
    notation
  })).join(COMBO_SEPARATOR);
}
