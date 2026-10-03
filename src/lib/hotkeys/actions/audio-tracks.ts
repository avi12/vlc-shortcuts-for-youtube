import type { YoutubePlayer } from "@/lib/player";
import { z } from "@/lib/zod";

const AUDIO_TRACK_SCHEMA = z.looseObject({ id: z.string() });

const MULTIPLE_TRACKS_MIN = 2;

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

export function cycleAudioTrack(player: YoutubePlayer) {
  const parsedTracks = z.array(z.unknown()).safeParse(player.getAvailableAudioTracks?.());
  const tracks = parsedTracks.success ? parsedTracks.data : [];
  if (!player.setAudioTrack || tracks.length < MULTIPLE_TRACKS_MIN) {
    return;
  }

  const activeTrack = player.getAudioTrack?.();
  const iActive = tracks.findIndex(track => isSameTrack({
    track,
    activeTrack
  }));
  const nextTrack = tracks[(iActive + 1) % tracks.length];
  player.setAudioTrack(nextTrack);
}
