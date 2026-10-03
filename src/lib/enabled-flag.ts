// The isolated-world bridge mirrors the stored toggle onto <html> so the MAIN-world script
// (no extension APIs there) can read it synchronously and observe changes
export const ENABLED_ATTRIBUTE = "data-vlc-controls";

export enum EnabledState {
  On = "on",
  Off = "off"
}

export function isVlcControlsEnabled() {
  return document.documentElement.getAttribute(ENABLED_ATTRIBUTE) !== EnabledState.Off;
}

export function onEnabledChange(callback: (isEnabled: boolean) => void) {
  const observer = new MutationObserver(() => callback(isVlcControlsEnabled()));
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ENABLED_ATTRIBUTE]
  });
}
