import { installHelpDialogOverride } from "@/lib/help-dialog";
import { installHotkeys } from "@/lib/hotkeys";
import { YOUTUBE_PAGE_MATCHES } from "@/lib/page-matches";
import { installTooltipOverrides } from "@/lib/tooltips";
import { defineContentScript } from "#imports";

export default defineContentScript({
  matches: YOUTUBE_PAGE_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  allFrames: true,
  main() {
    installHotkeys();
    installTooltipOverrides();
    installHelpDialogOverride();
  }
});
