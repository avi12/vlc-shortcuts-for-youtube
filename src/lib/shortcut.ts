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
  End: "END"
};

const COMBO_SEPARATOR = " or ";

// Shifted symbols ("+") need Shift to type, so Shift only counts for letters and named keys
function isShiftSignificant(key: string) {
  return key.length > 1 || key.toLowerCase() !== key.toUpperCase();
}

export function isComboMatch({ combo, e }: {
  combo: KeyCombo;
  e: KeyboardEvent;
}) {
  const isSameKey = e.key.toLowerCase() === combo.key.toLowerCase();
  const isShiftMatch = !isShiftSignificant(combo.key) || e.shiftKey === Boolean(combo.isShift);
  return isSameKey &&
    isShiftMatch &&
    e.ctrlKey === Boolean(combo.isCtrl) &&
    e.altKey === Boolean(combo.isAlt) &&
    !e.metaKey;
}

function isLetter(key: string) {
  return key.length === 1 && key.toLowerCase() !== key.toUpperCase();
}

function formatCombo({ combo, style }: {
  combo: KeyCombo;
  style: ShortcutStyle;
}) {
  const key = KEY_DISPLAY_NAMES[combo.key] ?? combo.key.toLowerCase();
  const isShiftedLetter = Boolean(combo.isShift) && !combo.isCtrl && !combo.isAlt && isLetter(combo.key);
  if (isShiftedLetter) {
    const shiftedKey = `SHIFT+${key}`;
    return style === ShortcutStyle.Dialog ? `${key.toUpperCase()} (${shiftedKey})` : shiftedKey;
  }

  const modifiers = [combo.isCtrl && "CONTROL", combo.isAlt && "ALT", combo.isShift && "SHIFT"];
  return [...modifiers, key].filter(Boolean).join(" + ");
}

export function formatCombos({ combos, style }: {
  combos: KeyCombo[];
  style: ShortcutStyle;
}) {
  return combos.map(combo => formatCombo({
    combo,
    style
  })).join(COMBO_SEPARATOR);
}
