import { applyOverride, createOverrideRecords, type OverrideSlot, restoreOverride } from "@/lib/dom-overrides";
import {
  buildGroups,
  createEmptyDialogText,
  findSectionByHotkeys,
  type HotkeyGroup
} from "@/lib/help-dialog/hotkey-groups";
import { z } from "@/lib/zod";

const DATA_PROPERTY = "data";
const TITLE_SUFFIX = " (VLC)";

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

type RendererDialog = Element & Record<typeof DATA_PROPERTY, unknown>;

const dialogDataRecords = createOverrideRecords<unknown>();

function createText(text: string) {
  return { runs: [{ text }] };
}

function readText(text: unknown) {
  const parsed = TEXT_SCHEMA.safeParse(text);
  if (!parsed.success) {
    return;
  }

  return parsed.data.runs.map(run => run.text).join("");
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

function readDataText(sections: HotkeySection[]) {
  const dialogText = createEmptyDialogText();
  for (const { hotkeyDialogSectionRenderer: youtubeSection } of sections) {
    const options = youtubeSection.options.map(option => option.hotkeyDialogSectionOptionRenderer);
    for (const option of options) {
      const label = readText(option.label);
      if (!label) {
        continue;
      }

      dialogText.labelByHotkey.set(option.hotkey, label);
    }
    const section = findSectionByHotkeys(options.map(option => option.hotkey));
    const title = readText(youtubeSection.title);
    if (!section || !title) {
      continue;
    }

    dialogText.titleBySection.set(section, title);
  }
  return dialogText;
}

function buildDialogData(data: unknown) {
  const parsed = DIALOG_DATA_SCHEMA.safeParse(data);
  if (!parsed.success) {
    return data;
  }

  return {
    ...parsed.data,
    title: appendTitleSuffix(parsed.data.title),
    sections: buildGroups(readDataText(parsed.data.sections)).map(toSection)
  };
}

function createDataSlot(elDialog: RendererDialog): OverrideSlot<unknown> {
  return {
    records: dialogDataRecords,
    target: elDialog,
    read: () => elDialog.data,
    write(value) {
      elDialog.data = value;
    }
  };
}

// Polymer exposes renderer data as an element property; without it only the DOM can be rewritten
export function isRendererDialog(elDialog: Element): elDialog is RendererDialog {
  return DATA_PROPERTY in elDialog;
}

// Rewrites the dialog through the data YouTube renders it from, and tells whether that took
export function syncDialogData({ elDialog, isEnabled }: {
  elDialog: RendererDialog;
  isEnabled: boolean;
}) {
  const slot = createDataSlot(elDialog);
  if (!isEnabled) {
    restoreOverride(slot);
    return false;
  }

  applyOverride({
    slot,
    transform: buildDialogData
  });
  return DIALOG_DATA_SCHEMA.safeParse(slot.read()).success;
}
