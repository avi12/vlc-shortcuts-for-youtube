import { applyOverride, createOverrideRecords, type OverrideSlot, restoreOverride } from "@/lib/dom-overrides";
import { isVlcControlsEnabled, onEnabledChange, unlessRetired } from "@/lib/enabled-flag";
import { PLAYER_SELECTOR } from "@/lib/player";
import { ShortcutStyle } from "@/lib/shortcut";
import { formatActionShortcut, VlcAction } from "@/lib/vlc-keymap";

// aria-keyshortcuts goes first so the label attributes are rewritten against YouTube's own key
enum TooltipAttribute {
  ARIA_KEY_SHORTCUTS = "aria-keyshortcuts",
  TOOLTIP_TITLE = "data-tooltip-title",
  TITLE_NO_TOOLTIP = "data-title-no-tooltip",
  TITLE = "title",
  ARIA_LABEL = "aria-label"
}

enum ButtonEnterEvent {
  POINTER_OVER = "pointerover",
  FOCUS_IN = "focusin"
}

interface ShortcutButton {
  selector: string;
  action: VlcAction | null;
  // Only its title attribute names the key: it holds other controls, so hovering inside it isn't hovering it
  isContainer?: boolean;
}

const SHORTCUT_BUTTONS: ShortcutButton[] = [
  {
    selector: ".ytp-play-button",
    action: VlcAction.PLAY_PAUSE
  },
  {
    selector: ".ytp-miniplayer-play-button",
    action: VlcAction.PLAY_PAUSE
  },
  {
    selector: ".ytp-next-button",
    action: VlcAction.NEXT
  },
  {
    selector: ".ytp-prev-button",
    action: VlcAction.PREVIOUS
  },
  {
    selector: ".ytp-mute-button",
    action: VlcAction.TOGGLE_MUTE
  },
  {
    selector: ".ytp-subtitles-button",
    action: VlcAction.CYCLE_SUBTITLES
  },
  {
    selector: ".ytp-fullscreen-button",
    action: VlcAction.TOGGLE_FULLSCREEN
  },
  {
    selector: ".ytp-miniplayer-button",
    action: VlcAction.TOGGLE_MINIPLAYER
  },
  {
    selector: ".ytp-jump-button",
    action: null
  },
  {
    selector: ".ytp-fullscreen-grid",
    action: VlcAction.SHOW_MORE_VIDEOS,
    isContainer: true
  },
  {
    selector: ".ytp-fullscreen-grid-hover-overlay",
    action: VlcAction.SHOW_MORE_VIDEOS
  },
  {
    selector: ".ytp-fullscreen-grid-expand-button",
    action: VlcAction.SHOW_MORE_VIDEOS
  }
];

function joinSelectors(buttons: ShortcutButton[]) {
  return buttons.map(button => button.selector).join(",");
}

const SHORTCUT_BUTTON_SELECTOR = joinSelectors(SHORTCUT_BUTTONS);
const HOVERABLE_BUTTON_SELECTOR = joinSelectors(SHORTCUT_BUTTONS.filter(button => !button.isContainer));
const TOOLTIP_TEXT_SELECTOR = ".ytp-tooltip-text";
const SHORTCUT_SUFFIX_PATTERN = /\s*\([^()]*\)\s*$/;
const TOOLTIP_ATTRIBUTES = Object.values(TooltipAttribute);

const attributeRecords = new Map(TOOLTIP_ATTRIBUTES.map(attribute => [
  attribute,
  createOverrideRecords<string | null>()
]));
const tooltipTextRecords = createOverrideRecords<string | null>();
const observedTooltipTexts = new WeakSet<Element>();
let elHoveredButton: Element | null = null;

function findShortcutButton(elButton: Element) {
  return SHORTCUT_BUTTONS.find(button => elButton.matches(button.selector));
}

function replaceShortcutSuffix({ text, action }: {
  text: string;
  action: VlcAction | null;
}) {
  if (!SHORTCUT_SUFFIX_PATTERN.test(text)) {
    return text;
  }

  const label = text.replace(SHORTCUT_SUFFIX_PATTERN, "");
  const shortcut = action && formatActionShortcut({
    action,
    style: ShortcutStyle.TOOLTIP
  });
  return shortcut ? `${label} (${shortcut})` : label;
}

function rewriteAttribute({ attribute, value, action }: {
  attribute: TooltipAttribute;
  value: string | null;
  action: VlcAction | null;
}) {
  if (value === null) {
    return null;
  }

  if (attribute === TooltipAttribute.ARIA_KEY_SHORTCUTS) {
    return action && formatActionShortcut({
      action,
      style: ShortcutStyle.TOOLTIP
    });
  }

  return replaceShortcutSuffix({
    text: value,
    action
  });
}

function createAttributeSlot({ elButton, attribute }: {
  elButton: Element;
  attribute: TooltipAttribute;
}): OverrideSlot<string | null> {
  return {
    records: attributeRecords.get(attribute) ?? createOverrideRecords(),
    target: elButton,
    read: () => elButton.getAttribute(attribute),
    write(value) {
      if (value === null) {
        elButton.removeAttribute(attribute);
        return;
      }

      elButton.setAttribute(attribute, value);
    }
  };
}

function createTextSlot(elText: Element): OverrideSlot<string | null> {
  return {
    records: tooltipTextRecords,
    target: elText,
    read: () => elText.textContent,
    write(value) {
      elText.textContent = value;
    }
  };
}

function syncButton(elButton: Element) {
  const button = findShortcutButton(elButton);
  if (!button) {
    return;
  }

  const isEnabled = isVlcControlsEnabled();
  for (const attribute of TOOLTIP_ATTRIBUTES) {
    const slot = createAttributeSlot({
      elButton,
      attribute
    });
    if (!isEnabled) {
      restoreOverride(slot);
      continue;
    }

    // YouTube drops data-tooltip-title while its tooltip shows and writes it back on hide
    if (!elButton.hasAttribute(attribute)) {
      continue;
    }

    applyOverride({
      slot,
      transform: value => rewriteAttribute({
        attribute,
        value,
        action: button.action
      })
    });
  }
}

function syncAllButtons() {
  for (const elButton of document.querySelectorAll(SHORTCUT_BUTTON_SELECTOR)) {
    syncButton(elButton);
  }
}

// YouTube can re-read its own title into the open tooltip before our attribute rewrite lands
function syncTooltipText(elText: Element) {
  const slot = createTextSlot(elText);
  if (!isVlcControlsEnabled()) {
    restoreOverride(slot);
    return;
  }

  const button = elHoveredButton && findShortcutButton(elHoveredButton);
  if (!button) {
    return;
  }

  applyOverride({
    slot,
    transform: text => text && replaceShortcutSuffix({
      text,
      action: button.action
    })
  });
}

function observeTooltipText(elButton: Element) {
  const elText = elButton.closest(PLAYER_SELECTOR)?.querySelector(TOOLTIP_TEXT_SELECTOR);
  if (!elText || observedTooltipTexts.has(elText)) {
    return;
  }

  observedTooltipTexts.add(elText);
  new MutationObserver(unlessRetired(() => syncTooltipText(elText))).observe(elText, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function handleButtonEnter(e: Event) {
  const elTarget = e.target;
  const elButton = elTarget instanceof Element ? elTarget.closest(HOVERABLE_BUTTON_SELECTOR) : null;
  elHoveredButton = elButton;

  if (!elButton) {
    return;
  }

  syncButton(elButton);
  observeTooltipText(elButton);
}

function handleAttributeMutations(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    const elTarget = mutation.target;
    const isShortcutButton = elTarget instanceof Element && elTarget.matches(SHORTCUT_BUTTON_SELECTOR);
    if (!isShortcutButton) {
      continue;
    }

    syncButton(elTarget);
  }
}

// documentElement exists at document_start, so the subtree observer covers <body> before it is parsed
export function installTooltipOverrides() {
  new MutationObserver(unlessRetired(handleAttributeMutations)).observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: TOOLTIP_ATTRIBUTES
  });
  for (const eventName of Object.values(ButtonEnterEvent)) {
    document.addEventListener(eventName, unlessRetired(handleButtonEnter), {
      capture: true,
      passive: true
    });
  }
  syncAllButtons();
  onEnabledChange(syncAllButtons);
}
