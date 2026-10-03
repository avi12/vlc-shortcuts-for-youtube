import { installHotkeys } from "@/lib/hotkeys";
import { defineContentScript } from "#imports";

export default defineContentScript({
  matches: ["https://www.youtube.com/*", "https://www.youtube-nocookie.com/embed/*"],
  world: "MAIN",
  runAt: "document_start",
  allFrames: true,
  main() {
    installHotkeys();
  }
});
