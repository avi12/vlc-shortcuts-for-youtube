import { applyOverride, createOverrideRecords, type OverrideSlot, restoreOverride } from "@/lib/dom-overrides";
import { isVlcControlsEnabled, onEnabledChange } from "@/lib/enabled-flag";
import {
  formatActionShortcut,
  KeymapSection,
  ShortcutStyle,
  VLC_BINDINGS,
  VLC_WHEEL_SHORTCUTS
} from "@/lib/vlc-keymap";
import { formatYoutubeShortcut, YOUTUBE_NATIVE_SHORTCUTS } from "@/lib/youtube-keymap";
import { z } from "@/lib/zod";

interface HotkeyRow {
  label: string;
  hotkey: string;
}

interface HotkeyGroup {
  title: string;
  rows: HotkeyRow[];
}

const HOTKEY_DIALOG_SELECTOR = "ytd-hotkey-dialog-renderer";
const POPUP_CONTAINER_SELECTOR = "ytd-popup-container";
const SECTION_SELECTOR = "ytd-hotkey-dialog-section-renderer";
const OPTION_SELECTOR = "ytd-hotkey-dialog-section-option-renderer";
const OPTION_LABEL_SELECTOR = "#label";
const OPTION_HOTKEY_SELECTOR = "#hotkey";
const DATA_PROPERTY = "data";
const TITLE_SUFFIX = " (VLC)";
const FALLBACK_ATTRIBUTE = "data-vlc-hotkeys";
const HIDDEN_BY_FALLBACK_ATTRIBUTE = "data-vlc-hidden";
const FALLBACK_CSS = `[${FALLBACK_ATTRIBUTE}] dl > div { display: flex; justify-content: space-between; gap: 24px; }`;

const TEXT_SCHEMA = z.looseObject({
  runs: z.array(z.looseObject({ text: z.string() }))
});

const OPTION_SCHEMA = z.looseObject({
  hotkeyDialogSectionOptionRenderer: z.looseObject({
    label: z.unknown(),
    hotkey: z.string()
  })
});

const SECTION_SCHEMA = z.looseObject({
  hotkeyDialogSectionRenderer: z.looseObject({
    title: z.unknown(),
    options: z.array(OPTION_SCHEMA)
  })
});

const DIALOG_DATA_SCHEMA = z.looseObject({
  title: z.unknown(),
  sections: z.array(SECTION_SCHEMA)
});

type HotkeySection = z.infer<typeof SECTION_SCHEMA>;

const dialogDataRecords = createOverrideRecords<unknown>();

// YouTube-only rows reuse YouTube's own (localized) label when its dialog lists the same hotkey
function buildGroups(youtubeLabelByHotkey: Map<string, string>) {
  const groups: HotkeyGroup[] = [];
  for (const section of Object.values(KeymapSection)) {
    const rows: HotkeyRow[] = [];
    for (const binding of VLC_BINDINGS) {
      const hotkey = formatActionShortcut({
        action: binding.action,
        style: ShortcutStyle.Dialog
      });
      if (binding.section !== section || !hotkey) {
        continue;
      }

      rows.push({
        label: binding.label,
        hotkey
      });
    }
    for (const wheelShortcut of VLC_WHEEL_SHORTCUTS) {
      if (wheelShortcut.section !== section) {
        continue;
      }

      rows.push({
        label: wheelShortcut.label,
        hotkey: wheelShortcut.hotkey
      });
    }
    for (const shortcut of YOUTUBE_NATIVE_SHORTCUTS) {
      if (shortcut.section !== section) {
        continue;
      }

      const hotkey = formatYoutubeShortcut(shortcut);
      rows.push({
        label: youtubeLabelByHotkey.get(hotkey) ?? shortcut.label,
        hotkey
      });
    }
    groups.push({
      title: section,
      rows
    });
  }
  return groups;
}

function createText(text: string) {
  return { runs: [{ text }] };
}

function toSection({ title, rows }: HotkeyGroup): HotkeySection {
  return {
    hotkeyDialogSectionRenderer: {
      title: createText(title),
      options: rows.map(row => ({
        hotkeyDialogSectionOptionRenderer: {
          label: createText(row.label),
          hotkey: row.hotkey
        }
      }))
    }
  };
}

function appendTitleSuffix(title: unknown) {
  const parsedTitle = TEXT_SCHEMA.safeParse(title);
  if (!parsedTitle.success) {
    return title;
  }

  return {
    ...parsedTitle.data,
    runs: [...parsedTitle.data.runs, { text: TITLE_SUFFIX }]
  };
}

function readDataLabels(sections: HotkeySection[]) {
  const labelByHotkey = new Map<string, string>();
  for (const section of sections) {
    for (const { hotkeyDialogSectionOptionRenderer: option } of section.hotkeyDialogSectionRenderer.options) {
      const parsedLabel = TEXT_SCHEMA.safeParse(option.label);
      if (!parsedLabel.success) {
        continue;
      }

      labelByHotkey.set(option.hotkey, parsedLabel.data.runs.map(run => run.text).join(""));
    }
  }
  return labelByHotkey;
}

function buildDialogData(data: unknown) {
  const parsed = DIALOG_DATA_SCHEMA.safeParse(data);
  if (!parsed.success) {
    return data;
  }

  return {
    ...parsed.data,
    title: appendTitleSuffix(parsed.data.title),
    sections: buildGroups(readDataLabels(parsed.data.sections)).map(toSection)
  };
}

function createDataSlot(elDialog: Element & Record<typeof DATA_PROPERTY, unknown>): OverrideSlot<unknown> {
  return {
    records: dialogDataRecords,
    target: elDialog,
    read: () => elDialog.data,
    write(value) {
      elDialog.data = value;
    }
  };
}

function readDomLabels(elDialog: Element) {
  const labelByHotkey = new Map<string, string>();
  for (const elOption of elDialog.querySelectorAll(OPTION_SELECTOR)) {
    const label = elOption.querySelector(OPTION_LABEL_SELECTOR)?.textContent.trim();
    const hotkey = elOption.querySelector(OPTION_HOTKEY_SELECTOR)?.textContent.trim();
    if (!label || !hotkey) {
      continue;
    }

    labelByHotkey.set(hotkey, label);
  }
  return labelByHotkey;
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

function applyDomFallback(elDialog: Element) {
  const elSections = elDialog.querySelector(SECTION_SELECTOR)?.parentElement;
  const isApplied = elDialog.querySelector(`[${FALLBACK_ATTRIBUTE}]`) !== null;
  if (!(elSections instanceof HTMLElement) || isApplied) {
    return;
  }

  const elFallback = document.createElement("div");
  elFallback.setAttribute(FALLBACK_ATTRIBUTE, "");
  const elStyle = document.createElement("style");
  elStyle.textContent = FALLBACK_CSS;
  const groups = buildGroups(readDomLabels(elDialog));
  elFallback.append(elStyle, ...groups.map(createGroupElement));
  elSections.after(elFallback);
  elSections.setAttribute(HIDDEN_BY_FALLBACK_ATTRIBUTE, "");
  elSections.style.setProperty("display", "none");
}

function removeDomFallback(elDialog: Element) {
  elDialog.querySelector(`[${FALLBACK_ATTRIBUTE}]`)?.remove();
  const elSections = elDialog.querySelector(`[${HIDDEN_BY_FALLBACK_ATTRIBUTE}]`);
  if (!(elSections instanceof HTMLElement)) {
    return;
  }

  elSections.removeAttribute(HIDDEN_BY_FALLBACK_ATTRIBUTE);
  elSections.style.removeProperty("display");
}

function syncDomFallback(elDialog: Element) {
  if (!isVlcControlsEnabled()) {
    removeDomFallback(elDialog);
    return;
  }

  applyDomFallback(elDialog);
}

function syncDialog(elDialog: Element) {
  // Polymer exposes renderer data as an element property; without it only the DOM can be rewritten
  if (!(DATA_PROPERTY in elDialog)) {
    syncDomFallback(elDialog);
    return;
  }

  const slot = createDataSlot(elDialog);
  if (!isVlcControlsEnabled()) {
    restoreOverride(slot);
    removeDomFallback(elDialog);
    return;
  }

  applyOverride({
    slot,
    transform: buildDialogData
  });
  const isDataOverridden = DIALOG_DATA_SCHEMA.safeParse(slot.read()).success;
  if (isDataOverridden) {
    removeDomFallback(elDialog);
    return;
  }

  applyDomFallback(elDialog);
}

function syncAllDialogs() {
  for (const elDialog of document.querySelectorAll(HOTKEY_DIALOG_SELECTOR)) {
    syncDialog(elDialog);
  }
}

function waitForPopupContainer(onFound: (elContainer: Element) => void) {
  const elExisting = document.querySelector(POPUP_CONTAINER_SELECTOR);
  if (elExisting) {
    onFound(elExisting);
    return;
  }

  const observer = new MutationObserver(() => {
    const elContainer = document.querySelector(POPUP_CONTAINER_SELECTOR);
    if (!elContainer) {
      return;
    }

    observer.disconnect();
    onFound(elContainer);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

// YouTube mounts the dialog lazily in ytd-popup-container on the first Shift+/ and may reassign its data on reopen
export function installHelpDialogOverride() {
  waitForPopupContainer(elContainer => {
    new MutationObserver(syncAllDialogs).observe(elContainer, {
      childList: true,
      subtree: true
    });
    syncAllDialogs();
  });
  onEnabledChange(syncAllDialogs);
}
