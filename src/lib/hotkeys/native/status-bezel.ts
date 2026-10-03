import { BezelValue, getBezel, getBezelTimers, TEXT_ONLY_BEZEL_CLASS } from "@/lib/hotkeys/native/bezel-component";
import type { YoutubePlayer } from "@/lib/player";

// YouTube's own flag for a bezel without text
const YOUTUBE_TEXT_HIDDEN_CLASS = "ytp-bezel-text-hide";

// Writes a status into YouTube's own bezel the way YouTube writes its volume and speed: a bezel still up is
// hidden at once, the text is set, and YouTube's show timer brings it back - restarting its fade - then its
// hide timer takes it down. The embedded player has no bezel, so there it stays silent
export function showStatusInNativeBezel({ player, text }: {
  player: YoutubePlayer;
  text: string;
}) {
  const bezel = getBezel(player);
  const timers = bezel ? getBezelTimers(bezel) : null;
  if (!bezel || !timers) {
    return;
  }

  if (timers.hideTimer.isActive()) {
    timers.hideTimer.stop();
    bezel.hide();
  }

  bezel.updateValue(BezelValue.Label, text);
  bezel.updateValue(BezelValue.Title, text);
  bezel.element.classList.remove(YOUTUBE_TEXT_HIDDEN_CLASS);
  bezel.element.classList.add(TEXT_ONLY_BEZEL_CLASS);
  timers.showTimer.start();
}

// Corrects the text of a bezel YouTube has just been asked to show
export function rewriteNativeBezelText({ player, title, label }: {
  player: YoutubePlayer;
  title: string;
  label: string;
}) {
  const bezel = getBezel(player);
  bezel?.updateValue(BezelValue.Title, title);
  bezel?.updateValue(BezelValue.Label, label);
}
