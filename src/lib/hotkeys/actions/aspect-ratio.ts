import { showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import { getVideo, isMainVideo, isSphericalVideo, type YoutubePlayer } from "@/lib/player";

const ASPECT_RATIO_CLASS = "vlc-controls-aspect-ratio";
const ASPECT_RATIO_STATUS_PREFIX = "Aspect ratio: ";
const SPHERICAL_UNAVAILABLE_LABEL = "not available on 360° videos";

enum VideoBoxProperty {
  TOP = "--vlc-controls-video-top",
  LEFT = "--vlc-controls-video-left",
  WIDTH = "--vlc-controls-video-width",
  HEIGHT = "--vlc-controls-video-height"
}

// VLC's aspect ratio menu, in its cycle order - the same list the right-click menu offers
const ASPECT_RATIO_LABELS = ["16:9", "4:3", "1:1", "16:10", "2.21:1", "2.35:1", "2.39:1", "5:4"] as const;

function parseAspectRatio(label: string) {
  const [width = 1, height = 1] = label.split(":").map(Number);
  return width / height;
}

const DEFAULT_ASPECT_RATIO: {
  label: string;
  ratio: number | null;
} = {
  label: "Default",
  ratio: null
};

export const ASPECT_RATIOS = [
  DEFAULT_ASPECT_RATIO,
  ...ASPECT_RATIO_LABELS.map(label => ({
    label,
    ratio: parseAspectRatio(label)
  }))
];

type AspectRatio = typeof DEFAULT_ASPECT_RATIO;

let currentAspectRatio: AspectRatio = DEFAULT_ASPECT_RATIO;
let resizeObserver: ResizeObserver | null = null;

function toPixels(value: number) {
  return `${value}px`;
}

function fitVideoBox({ player, ratio }: {
  player: YoutubePlayer;
  ratio: number;
}) {
  const elVideo = getVideo(player);
  const elVideoParent = elVideo?.offsetParent;
  if (!elVideoParent) {
    return;
  }

  const playerRect = player.getBoundingClientRect();
  const parentRect = elVideoParent.getBoundingClientRect();
  const isPlayerWider = playerRect.width / playerRect.height > ratio;
  const width = isPlayerWider ? playerRect.height * ratio : playerRect.width;
  const height = isPlayerWider ? playerRect.height : playerRect.width / ratio;
  const boxValues = {
    [VideoBoxProperty.TOP]: playerRect.top - parentRect.top + (playerRect.height - height) / 2,
    [VideoBoxProperty.LEFT]: playerRect.left - parentRect.left + (playerRect.width - width) / 2,
    [VideoBoxProperty.WIDTH]: width,
    [VideoBoxProperty.HEIGHT]: height
  };
  for (const [property, value] of Object.entries(boxValues)) {
    player.style.setProperty(property, toPixels(value));
  }
}

function clearAspectRatio(elPlayer: HTMLElement) {
  elPlayer.classList.remove(ASPECT_RATIO_CLASS);
  for (const property of Object.values(VideoBoxProperty)) {
    elPlayer.style.removeProperty(property);
  }
}

export function resetAspectRatio() {
  currentAspectRatio = DEFAULT_ASPECT_RATIO;
  resizeObserver?.disconnect();
  resizeObserver = null;
  for (const elPlayer of document.querySelectorAll(`.${ASPECT_RATIO_CLASS}`)) {
    const isPlayerElement = elPlayer instanceof HTMLElement;
    if (isPlayerElement) {
      clearAspectRatio(elPlayer);
    }
  }
}

export function getAspectRatioLabel() {
  return currentAspectRatio.label;
}

// YouTube draws a 360° video onto its own canvas with no setting for the view's shape, so there the aspect ratio
// is left alone rather than stretching the view
function applyAspectRatio({ player, aspectRatio }: {
  player: YoutubePlayer;
  aspectRatio: AspectRatio;
}) {
  if (isSphericalVideo(player)) {
    showStatusInNativeBezel({
      player,
      text: `${ASPECT_RATIO_STATUS_PREFIX}${SPHERICAL_UNAVAILABLE_LABEL}`
    });
    return;
  }

  const { label, ratio } = aspectRatio;
  resetAspectRatio();
  currentAspectRatio = aspectRatio;
  showStatusInNativeBezel({
    player,
    text: `${ASPECT_RATIO_STATUS_PREFIX}${label}`
  });

  const isDefaultRatio = ratio === null;
  if (isDefaultRatio) {
    return;
  }

  player.classList.add(ASPECT_RATIO_CLASS);
  resizeObserver = new ResizeObserver(() => fitVideoBox({
    player,
    ratio
  }));
  resizeObserver.observe(player);
}

export function cycleAspectRatio(player: YoutubePlayer) {
  const iNext = (ASPECT_RATIOS.indexOf(currentAspectRatio) + 1) % ASPECT_RATIOS.length;
  applyAspectRatio({
    player,
    aspectRatio: ASPECT_RATIOS[iNext] ?? DEFAULT_ASPECT_RATIO
  });
}

export function selectAspectRatio({ player, label }: {
  player: YoutubePlayer;
  label: string;
}) {
  const aspectRatio = ASPECT_RATIOS.find(option => option.label === label);
  if (!aspectRatio) {
    return;
  }

  applyAspectRatio({
    player,
    aspectRatio
  });
}

export function installAspectRatioReset() {
  document.addEventListener("loadstart", event => {
    if (isMainVideo(event.target)) {
      resetAspectRatio();
    }
  }, {
    capture: true
  });
  document.addEventListener("yt-navigate-finish", resetAspectRatio);
}
