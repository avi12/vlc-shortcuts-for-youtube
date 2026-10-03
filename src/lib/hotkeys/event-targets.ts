const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const OVERLAY_SELECTOR = "dialog, [role='dialog'], [role='menu'], [role='listbox'], .ytp-popup, tp-yt-iron-dropdown";
const ACTIVATABLE_SELECTOR = "button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='tab'], [role='option']";

function getEventElement(e: Event) {
  const [target] = e.composedPath();
  return target instanceof Element ? target : null;
}

function isEditableElement(element: Element) {
  const isContentEditable = element instanceof HTMLElement && element.isContentEditable;
  return isContentEditable || element.closest(EDITABLE_SELECTOR) !== null;
}

// Space on a focused page control (Subscribe, a link) keeps activating it, as on YouTube
function isActivatableOutsidePlayer({ element, elPlayer }: {
  element: Element;
  elPlayer: HTMLElement;
}) {
  return element.closest(ACTIVATABLE_SELECTOR) !== null && !elPlayer.contains(element);
}

export function isKeyForPage({ e, elPlayer }: {
  e: KeyboardEvent;
  elPlayer: HTMLElement;
}) {
  const element = getEventElement(e);
  if (!element) {
    return false;
  }

  const isSpace = e.key === " ";
  return isEditableElement(element) ||
    element.closest(OVERLAY_SELECTOR) !== null ||
    isSpace && isActivatableOutsidePlayer({
      element,
      elPlayer
    });
}

export function isEventInside({ e, elContainer }: {
  e: Event;
  elContainer: HTMLElement;
}) {
  const element = getEventElement(e);
  return element !== null && elContainer.contains(element);
}
