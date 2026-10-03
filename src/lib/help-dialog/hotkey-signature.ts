// YouTube translates the hotkey text in its dialog ("CONTROL + ←", "STEUERUNG + ←", "Ctrl+←"), so rows are
// matched on what survives translation: how many modifiers are held and the key pressed last
const BIDI_MARKS_PATTERN = /[‎‏‪-‮⁦-⁩]/g;
const TYPING_HINT_PATTERN = /\(.*\)/;
const COMBO_JOINER = "+";

// Named keys YouTube abbreviates in some languages ("ESC", "Esc")
const NAMED_KEY_ALIASES: Record<string, string> = {
  escape: "esc"
};

function normalizeKeyName(key: string) {
  const isNamedKey = key.length > 1;
  if (!isNamedKey) {
    return key;
  }

  const lowercaseKey = key.toLowerCase();
  return NAMED_KEY_ALIASES[lowercaseKey] ?? lowercaseKey;
}

export function stripBidiMarks(text: string) {
  return text.replaceAll(BIDI_MARKS_PATTERN, "");
}

export function toHotkeySignature(hotkey: string) {
  const plainText = stripBidiMarks(hotkey.normalize("NFKC")).replace(TYPING_HINT_PATTERN, "").trim();
  const isJoinerKey = plainText === COMBO_JOINER;
  const parts = isJoinerKey ? [plainText] : plainText.split(COMBO_JOINER).map(part => part.trim());
  const modifierCount = parts.length - 1;
  return `${modifierCount}${COMBO_JOINER}${normalizeKeyName(parts.at(-1) ?? "")}`;
}
