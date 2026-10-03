import type { YoutubePlayer } from "@/lib/player";
import { z } from "@/lib/zod";

const audioTrackLabelSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  audioTrack: z.object({ displayName: z.string().optional() }).optional()
});

const MULTIPLE_TRACKS_MIN = 2;

function parseTrackLabel(track: unknown) {
  const parsed = audioTrackLabelSchema.safeParse(track);
  return parsed.success ? parsed.data : {};
}

function isSameTrack({ track, activeTrack }: {
  track: unknown;
  activeTrack: unknown;
}) {
  if (track === activeTrack) {
    return true;
  }

  const trackId = parseTrackLabel(track).id;
  return trackId !== undefined && trackId === parseTrackLabel(activeTrack).id;
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
