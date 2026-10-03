import {
  buildGroups,
  createEmptyDialogText,
  findSectionByHotkeys,
  type HotkeyGroup
} from "@/lib/help-dialog/hotkey-groups";
import { toHotkeySignature } from "@/lib/help-dialog/hotkey-signature";

const SECTION_SELECTOR = "ytd-hotkey-dialog-section-renderer";
const SECTION_TITLE_SELECTOR = "#sub-title";
const OPTION_SELECTOR = "ytd-hotkey-dialog-section-option-renderer";
const OPTION_LABEL_SELECTOR = "#label";
const OPTION_HOTKEY_SELECTOR = "#hotkey";
const FALLBACK_ATTRIBUTE = "data-vlc-hotkeys";
const HIDDEN_BY_FALLBACK_ATTRIBUTE = "data-vlc-hidden";
const FALLBACK_CSS = `[${FALLBACK_ATTRIBUTE}] dl > div { display: flex; justify-content: space-between; gap: 24px; }`;

function readDomText(elDialog: Element) {
  const dialogText = createEmptyDialogText();
  for (const elSection of elDialog.querySelectorAll(SECTION_SELECTOR)) {
    const hotkeys: string[] = [];
    for (const elOption of elSection.querySelectorAll(OPTION_SELECTOR)) {
      const label = elOption.querySelector(OPTION_LABEL_SELECTOR)?.textContent.trim();
      const hotkey = elOption.querySelector(OPTION_HOTKEY_SELECTOR)?.textContent.trim();
      if (!label || !hotkey) {
        continue;
      }

      hotkeys.push(hotkey);
      dialogText.labelByHotkeySignature.set(toHotkeySignature(hotkey), label);
    }
    const section = findSectionByHotkeys(hotkeys);
    const title = elSection.querySelector(SECTION_TITLE_SELECTOR)?.textContent.trim();
    if (!section || !title) {
      continue;
    }

    dialogText.titleBySection.set(section, title);
  }
  return dialogText;
}

function createGroupElement({ title, rows }: HotkeyGroup) {
  const elSection = document.createElement("section");
  const elTitle = document.createElement("h2");
  elTitle.textContent = title;
  const elList = document.createElement("dl");
  for (const row of rows) {
    const elRow = document.createElement("div");
    const elLabel = document.createElement("dt");
    elLabel.textContent = row.label;
    const elHotkey = document.createElement("dd");
    elHotkey.textContent = row.hotkey;
    elRow.append(elLabel, elHotkey);
    elList.append(elRow);
  }
  elSection.append(elTitle, elList);
  return elSection;
}

// When the dialog's data can't be rewritten, YouTube's sections are hidden and ours are placed beside them
export function applyDomFallback(elDialog: Element) {
  const elSections = elDialog.querySelector(SECTION_SELECTOR)?.parentElement;
  const isApplied = elDialog.querySelector(`[${FALLBACK_ATTRIBUTE}]`) !== null;
  if (!(elSections instanceof HTMLElement) || isApplied) {
    return;
  }

  const elFallback = document.createElement("div");
  elFallback.setAttribute(FALLBACK_ATTRIBUTE, "");
  const elStyle = document.createElement("style");
  elStyle.textContent = FALLBACK_CSS;
  const groups = buildGroups(readDomText(elDialog));
  elFallback.append(elStyle, ...groups.map(createGroupElement));
  elSections.after(elFallback);
  elSections.setAttribute(HIDDEN_BY_FALLBACK_ATTRIBUTE, "");
  elSections.style.setProperty("display", "none");
}

export function removeDomFallback(elDialog: Element) {
  elDialog.querySelector(`[${FALLBACK_ATTRIBUTE}]`)?.remove();
  const elSections = elDialog.querySelector(`[${HIDDEN_BY_FALLBACK_ATTRIBUTE}]`);
  if (!(elSections instanceof HTMLElement)) {
    return;
  }

  elSections.removeAttribute(HIDDEN_BY_FALLBACK_ATTRIBUTE);
  elSections.style.removeProperty("display");
}
