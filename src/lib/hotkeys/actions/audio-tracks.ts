import { showStatusInNativeBezel } from "@/lib/hotkeys/native/status-bezel";
import type { YoutubePlayer } from "@/lib/player";
import { z } from "@/lib/zod";

const AUDIO_TRACK_SCHEMA = z.looseObject({ id: z.string() });
// getLanguageInfo() carries YouTube's own localized track name ("English (US) original")
const NAMED_AUDIO_TRACK_SCHEMA = z.looseObject({
  getLanguageInfo: z.custom<() => unknown>(value => typeof value === "function")
});
const LANGUAGE_INFO_SCHEMA = z.looseObject({ name: z.string() });

const MULTIPLE_TRACKS_MIN = 2;
const AUDIO_TRACK_STATUS_PREFIX = "Audio track: ";

function readTrackId(track: unknown) {
  const parsed = AUDIO_TRACK_SCHEMA.safeParse(track);
  return parsed.success ? parsed.data.id : undefined;
}

function isSameTrack({ track, activeTrack }: {
  track: unknown;
  activeTrack: unknown;
}) {
  if (track === activeTrack) {
    return true;
  }

  const trackId = readTrackId(track);
  return trackId !== undefined && trackId === readTrackId(activeTrack);
}

function readTrackName(track: unknown) {
  const parsedTrack = NAMED_AUDIO_TRACK_SCHEMA.safeParse(track);
  if (!parsedTrack.success) {
    return;
  }

  const parsedInfo = LANGUAGE_INFO_SCHEMA.safeParse(parsedTrack.data.getLanguageInfo.call(track));
  return parsedInfo.success ? parsedInfo.data.name : undefined;
}

function showTrack({ player, track }: {
  player: YoutubePlayer;
  track: unknown;
}) {
  const name = readTrackName(track);
  if (!name) {
    return;
  }

  showStatusInNativeBezel({
    player,
    text: `${AUDIO_TRACK_STATUS_PREFIX}${name}`
  });
}

export function cycleAudioTrack(player: YoutubePlayer) {
  const parsedTracks = z.array(z.unknown()).safeParse(player.getAvailableAudioTracks?.());
  const tracks = parsedTracks.success ? parsedTracks.data : [];
  const activeTrack = player.getAudioTrack?.();
  if (!player.setAudioTrack || tracks.length < MULTIPLE_TRACKS_MIN) {
    showTrack({
      player,
      track: activeTrack
    });
    return;
  }

  const iActive = tracks.findIndex(track => isSameTrack({
    track,
    activeTrack
  }));
  const nextTrack = tracks[(iActive + 1) % tracks.length];
  player.setAudioTrack(nextTrack);
  showTrack({
    player,
    track: nextTrack
  });
}
