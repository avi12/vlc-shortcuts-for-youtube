import { ENABLED_ATTRIBUTE, EnabledState } from "@/lib/enabled-flag";
import "@/lib/hotkeys/player-effects.css";
import { isEnabledItem } from "@/lib/storage";
import { defineContentScript } from "#imports";

function mirrorEnabledState(isEnabled: boolean) {
  document.documentElement.setAttribute(ENABLED_ATTRIBUTE, isEnabled ? EnabledState.On : EnabledState.Off);
}

// Isolated world: the MAIN-world script has no extension APIs, so the stored toggle reaches it
// through an attribute on <html> (see enabled-flag.ts). The player-effect stylesheet rides along here because
// only manifest-declared content scripts can inject CSS
export default defineContentScript({
  matches: ["https://www.youtube.com/*", "https://www.youtube-nocookie.com/embed/*"],
  allFrames: true,
  runAt: "document_start",
  cssInjectionMode: "manifest",
  async main() {
    isEnabledItem.watch(mirrorEnabledState);
    mirrorEnabledState(await isEnabledItem.getValue());
  }
});
