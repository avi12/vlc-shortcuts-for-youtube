import { applyOverride, createOverrideRecords, type OverrideSlot, restoreOverride } from "@/lib/dom-overrides";
import {
  addYoutubeRow,
  buildGroups,
  createEmptyDialogText,
  findSectionByHotkeys,
  type HotkeyGroup
} from "@/lib/help-dialog/hotkey-groups";
import { isMusicSite } from "@/lib/site";
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
type HotkeyOption = z.infer<typeof OPTION_SCHEMA>;

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

// YouTube's own rows go back exactly as YouTube sent them; only VLC's rows are built
function toOption({ label, hotkey, youtubeOption }: HotkeyGroup<HotkeyOption>["rows"][number]): HotkeyOption {
  return youtubeOption ?? {
    hotkeyDialogSectionOptionRenderer: {
      label: createText(label),
      hotkey
    }
  };
}

function toSection({ title, rows }: HotkeyGroup<HotkeyOption>): HotkeySection {
  return {
    hotkeyDialogSectionRenderer: {
      title: createText(title),
      options: rows.map(toOption)
    }
  };
}

function readSectionHotkeys({ hotkeyDialogSectionRenderer }: HotkeySection) {
  return hotkeyDialogSectionRenderer.options.map(option => option.hotkeyDialogSectionOptionRenderer.hotkey);
}

// YouTube Music's sections VLC has no counterpart for (Navigation) stay exactly as Music sent them
function findMusicOnlySections(sections: HotkeySection[]) {
  if (!isMusicSite()) {
    return [];
  }

  return sections.filter(section => !findSectionByHotkeys(readSectionHotkeys(section)));
}

function readDataText(sections: HotkeySection[]) {
  const dialogText = createEmptyDialogText<HotkeyOption>();
  for (const { hotkeyDialogSectionRenderer: youtubeSection } of sections) {
    const hotkeys: string[] = [];
    for (const youtubeOption of youtubeSection.options) {
      const { label, hotkey } = youtubeOption.hotkeyDialogSectionOptionRenderer;
      const labelText = readText(label);
      if (!labelText) {
        continue;
      }

      hotkeys.push(hotkey);
      addYoutubeRow({
        dialogText,
        row: {
          label: labelText,
          hotkey,
          youtubeOption
        }
      });
    }
    const section = findSectionByHotkeys(hotkeys);
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
    sections: [
      ...buildGroups(readDataText(parsed.data.sections)).map(toSection),
      ...findMusicOnlySections(parsed.data.sections)
    ]
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
