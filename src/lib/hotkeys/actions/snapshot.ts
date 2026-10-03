import { formatFileTimestamp } from "@/lib/hotkeys/time-format";
import { getVideo, getVideoTitle, type YoutubePlayer } from "@/lib/player";

const FORBIDDEN_FILENAME_CHARACTERS = /[/\\:*?"<>|]/g;
const SNAPSHOT_MIME_TYPE = "image/png";

function captureFrame(elVideo: HTMLVideoElement) {
  const elCanvas = document.createElement("canvas");
  elCanvas.width = elVideo.videoWidth;
  elCanvas.height = elVideo.videoHeight;
  elCanvas.getContext("2d")?.drawImage(elVideo, 0, 0);
  try {
    return elCanvas.toDataURL(SNAPSHOT_MIME_TYPE);
  } catch {
    return null;
  }
}

function downloadFile({ url, filename }: {
  url: string;
  filename: string;
}) {
  const elLink = document.createElement("a");
  elLink.href = url;
  elLink.download = filename;
  elLink.click();
}

export function takeSnapshot(player: YoutubePlayer) {
  const elVideo = getVideo();
  const isFrameAvailable = elVideo !== null && elVideo.videoWidth > 0;
  if (!isFrameAvailable) {
    return;
  }

  const frameUrl = captureFrame(elVideo);
  if (!frameUrl) {
    return;
  }

  const title = getVideoTitle(player).replaceAll(FORBIDDEN_FILENAME_CHARACTERS, "_");
  downloadFile({
    url: frameUrl,
    filename: `${title} - ${formatFileTimestamp(player.getCurrentTime())}.png`
  });
}
