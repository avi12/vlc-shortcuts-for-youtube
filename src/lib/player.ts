import { isHtmlElement, isVideoElement } from "@/lib/dom-guards";
import { isMusicSite } from "@/lib/site";
import { z } from "@/lib/zod";
import { createGuard, VOID_METHOD_SCHEMA } from "@/lib/zod-guard";

// Every YouTube player shares this class: the watch page's, Shorts' and the embed's
export const PLAYER_SELECTOR = ".html5-video-player";
const MAIN_VIDEO_SELECTOR = "video.html5-main-video";
const SHORTS_PLAYER_ID = "shorts-player";
const EMBED_PATH_PREFIX = "/embed/";

// YouTube's player variants differ in which of YouTube's own keys they honor; YouTube Music's honors none
export enum PlayerKind {
  WATCH = "watch",
  SHORTS = "shorts",
  EMBED = "embed",
  MUSIC = "music"
}

const BUFFERING_STATE_CODE = 3;
const CUED_STATE_CODE = 5;

enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = BUFFERING_STATE_CODE,
  CUED = CUED_STATE_CODE
}

const NUMBER_GETTER_SCHEMA = z.function({
  input: [],
  output: z.number()
});
const NUMBER_SETTER_SCHEMA = z.function({
  input: [z.number()],
  output: z.void()
});
const STRING_GETTER_SCHEMA = z.function({
  input: [],
  output: z.string()
});
const STRING_SETTER_SCHEMA = z.function({
  input: [z.string()],
  output: z.void()
});
const UNKNOWN_GETTER_SCHEMA = z.function({
  input: [],
  output: z.unknown()
});

// The methods of YouTube's player element: the ones every player has, then the ones only some of them do
const playerApiSchema = z.looseObject({
  playVideo: VOID_METHOD_SCHEMA,
  pauseVideo: VOID_METHOD_SCHEMA,
  getPlayerState: z.function({
    input: [],
    output: z.enum(PlayerState)
  }),
  seekTo: z.function({
    input: [z.number(), z.boolean()],
    output: z.void()
  }),
  getCurrentTime: NUMBER_GETTER_SCHEMA,
  getDuration: NUMBER_GETTER_SCHEMA,
  getVolume: NUMBER_GETTER_SCHEMA,
  setVolume: NUMBER_SETTER_SCHEMA,
  isMuted: z.function({
    input: [],
    output: z.boolean()
  }),
  mute: VOID_METHOD_SCHEMA,
  unMute: VOID_METHOD_SCHEMA,
  getPlaybackRate: NUMBER_GETTER_SCHEMA,
  setPlaybackRate: NUMBER_SETTER_SCHEMA,
  getAvailablePlaybackRates: z.function({
    input: [],
    output: z.array(z.number())
  }),
  nextVideo: VOID_METHOD_SCHEMA.optional(),
  previousVideo: VOID_METHOD_SCHEMA.optional(),
  getOption: z.function({
    input: [z.string(), z.string(), z.record(z.string(), z.unknown()).optional()],
    output: z.unknown()
  }).optional(),
  setOption: z.function({
    input: [z.string(), z.string(), z.unknown()],
    output: z.void()
  }).optional(),
  loadModule: STRING_SETTER_SCHEMA.optional(),
  unloadModule: STRING_SETTER_SCHEMA.optional(),
  getAudioTrack: UNKNOWN_GETTER_SCHEMA.optional(),
  getAvailableAudioTracks: UNKNOWN_GETTER_SCHEMA.optional(),
  setAudioTrack: z.function({
    input: [z.unknown()],
    output: z.unknown()
  }).optional(),
  setLoopVideo: z.function({
    input: [z.boolean()],
    output: z.void()
  }).optional(),
  getVideoData: UNKNOWN_GETTER_SCHEMA.optional(),
  getPlayerResponse: UNKNOWN_GETTER_SCHEMA.optional(),
  hideControls: VOID_METHOD_SCHEMA.optional(),
  showControls: VOID_METHOD_SCHEMA.optional(),
  getSphericalProperties: UNKNOWN_GETTER_SCHEMA.optional(),
  getPlaybackQuality: STRING_GETTER_SCHEMA.optional(),
  getPreferredQuality: STRING_GETTER_SCHEMA.optional(),
  getAvailableQualityData: UNKNOWN_GETTER_SCHEMA.optional(),
  setPlaybackQualityRange: z.function({
    input: [z.string(), z.string()],
    output: z.void()
  }).optional()
});

export type YoutubePlayer = HTMLElement & z.infer<typeof playerApiSchema>;

const isPlayerApi = createGuard(playerApiSchema);

function isYoutubePlayer(element: Element | null): element is YoutubePlayer {
  return isHtmlElement(element) && isPlayerApi(element);
}

const videoDataSchema = z.looseObject({ title: z.string() });

// A 360° video reports its view; any other video reports an empty object
const sphericalPropertiesSchema = z.looseObject({ fov: z.number() });

// Re-queried on every call: YouTube's SPA swaps players and <video> sources without a reload, and keeps the
// watch page's player mounted but hidden while Shorts plays in its own
export function getPlayer() {
  for (const elPlayer of document.querySelectorAll(PLAYER_SELECTOR)) {
    const isVisibleYoutubePlayer = isYoutubePlayer(elPlayer) && elPlayer.checkVisibility();
    if (isVisibleYoutubePlayer) {
      return elPlayer;
    }
  }
  return null;
}

export function getVideo(player: YoutubePlayer) {
  const elVideo = player.querySelector(MAIN_VIDEO_SELECTOR);
  return isVideoElement(elVideo) ? elVideo : null;
}

export function getPlayerKind(player: YoutubePlayer) {
  if (isMusicSite()) {
    return PlayerKind.MUSIC;
  }

  const isShortsPlayerId = player.id === SHORTS_PLAYER_ID;
  if (isShortsPlayerId) {
    return PlayerKind.SHORTS;
  }

  return location.pathname.startsWith(EMBED_PATH_PREFIX) ? PlayerKind.EMBED : PlayerKind.WATCH;
}

export function isShortsPlayer(player: YoutubePlayer) {
  return getPlayerKind(player) === PlayerKind.SHORTS;
}

export function isMainVideo(target: EventTarget | null) {
  return isVideoElement(target) &&target.matches(`${PLAYER_SELECTOR} ${MAIN_VIDEO_SELECTOR}`);
}

export function getVideoTitle(player: YoutubePlayer) {
  const parsed = videoDataSchema.safeParse(player.getVideoData?.());
  const hasCustomTitle = parsed.success && parsed.data.title;
  return hasCustomTitle ? parsed.data.title : document.title;
}

export function isSphericalVideo(player: YoutubePlayer) {
  return sphericalPropertiesSchema.safeParse(player.getSphericalProperties?.()).success;
}

export function isPlaying(player: YoutubePlayer) {
  const state = player.getPlayerState();
  return state === PlayerState.PLAYING || state === PlayerState.BUFFERING;
}

// A song, episode or video is playing or paused, as opposed to nothing loaded or a finished queue
export function isMediaActive(player: YoutubePlayer) {
  return isPlaying(player) || player.getPlayerState() === PlayerState.PAUSED;
}
