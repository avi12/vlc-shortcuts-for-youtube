// YouTube's own Shift+/ dialog categories, so every key sits where YouTube users expect it
export enum KeymapSection {
  Playback = "Playback",
  General = "General",
  Subtitles = "Subtitles and closed captions"
}

export interface KeyCombo {
  key: string;
  isShift?: boolean;
  isCtrl?: boolean;
  isAlt?: boolean;
}

// YouTube's two notations: tooltips write "SHIFT+n", the Shift+/ dialog writes "N (SHIFT+n)"
export enum ShortcutStyle {
  Tooltip = "tooltip",
  Dialog = "dialog"
}

// Spelled the way YouTube's own dialog spells them
const KEY_DISPLAY_NAMES: Record<string, string> = {
  " ": "SPACE",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Escape: "ESCAPE",
  Home: "HOME",
  End: "END",
  PageUp: "PAGE UP",
  PageDown: "PAGE DOWN"
};

// YouTube writes a shifted symbol next to the key it is typed on (US layout): "< (SHIFT+,)". "+" is also matched
// as typed on the numpad, with no Shift
const SHIFTED_SYMBOL_BASE_KEYS: Record<string, string> = {
  "<": ",",
  ">": ".",
  "+": "="
};

export function getShiftedSymbolBaseKey(key: string) {
  return SHIFTED_SYMBOL_BASE_KEYS[key];
}

// The English notation of YouTube's dialog; the help dialog learns the viewer's own from YouTube's rows
export const MODIFIER_NAMES = {
  control: "CONTROL",
  alt: "ALT",
  shift: "SHIFT"
} as const;

export const MODIFIER_JOINER = " + ";

const COMBO_SEPARATOR = " or ";

// Shifted symbols ("+") need Shift to type, so Shift only counts for letters and named keys
function isShiftSignificant(key: string) {
  return key.length > 1 || key.toLowerCase() !== key.toUpperCase();
}

function isCtrlAltMatch({ combo, e }: {
  combo: KeyCombo;
  e: KeyboardEvent | WheelEvent;
}) {
  return e.ctrlKey === Boolean(combo.isCtrl) && e.altKey === Boolean(combo.isAlt) && !e.metaKey;
}

export function isComboMatch({ combo, e }: {
  combo: KeyCombo;
  e: KeyboardEvent;
}) {
  const isSameKey = e.key.toLowerCase() === combo.key.toLowerCase();
  const isShiftMatch = !isShiftSignificant(combo.key) || e.shiftKey === Boolean(combo.isShift);
  return isSameKey && isShiftMatch && isCtrlAltMatch({
    combo,
    e
  });
}

// A wheel combo's key is the wheel itself, so only its modifiers need matching
export function isWheelComboMatch({ combo, e }: {
  combo: KeyCombo;
  e: WheelEvent;
}) {
  return e.shiftKey === Boolean(combo.isShift) && isCtrlAltMatch({
    combo,
    e
  });
}

export function isLetter(key: string) {
  return key.length === 1 && key.toLowerCase() !== key.toUpperCase();
}

export function formatKeyName(key: string) {
  return KEY_DISPLAY_NAMES[key] ?? key.toLowerCase();
}

function formatCombo({ combo, style }: {
  combo: KeyCombo;
  style: ShortcutStyle;
}) {
  const key = formatKeyName(combo.key);
  const shiftedSymbolBaseKey = getShiftedSymbolBaseKey(combo.key);
  const typedOnKey = isLetter(combo.key) ? key : shiftedSymbolBaseKey;
  const isShifted = Boolean(combo.isShift) || shiftedSymbolBaseKey !== undefined;
  const isShiftOnly = isShifted && !combo.isCtrl && !combo.isAlt;
  if (isShiftOnly && typedOnKey) {
    const shiftedKey = `${MODIFIER_NAMES.shift}+${typedOnKey}`;
    return style === ShortcutStyle.Dialog ? `${combo.key.toUpperCase()} (${shiftedKey})` : shiftedKey;
  }

  const modifiers = [
    combo.isCtrl && MODIFIER_NAMES.control,
    combo.isAlt && MODIFIER_NAMES.alt,
    combo.isShift && MODIFIER_NAMES.shift
  ];
  return [...modifiers, key].filter(Boolean).join(MODIFIER_JOINER);
}

export function formatCombos({ combos, style }: {
  combos: readonly KeyCombo[];
  style: ShortcutStyle;
}) {
  return combos.map(combo => formatCombo({
    combo,
    style
  })).join(COMBO_SEPARATOR);
}
