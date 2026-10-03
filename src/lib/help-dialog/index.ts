import { isVlcControlsEnabled, onEnabledChange } from "@/lib/enabled-flag";
import { isRendererDialog, syncDialogData } from "@/lib/help-dialog/data-override";
import { applyDomFallback, removeDomFallback } from "@/lib/help-dialog/dom-fallback";

const HOTKEY_DIALOG_SELECTOR = "ytd-hotkey-dialog-renderer";
const POPUP_CONTAINER_SELECTOR = "ytd-popup-container";

function syncDialog(elDialog: Element) {
  const isEnabled = isVlcControlsEnabled();
  const isDataOverridden = isRendererDialog(elDialog) && syncDialogData({
    elDialog,
    isEnabled
  });
  if (!isEnabled || isDataOverridden) {
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
