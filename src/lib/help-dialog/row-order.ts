import { VLC_WHEEL_VOLUME, VlcAction } from "@/lib/vlc-keymap";
import { YOUTUBE_NATIVE_SHORTCUTS } from "@/lib/youtube-keymap";
import { YOUTUBE_MUSIC_NATIVE_SHORTCUTS } from "@/lib/youtube-music-keymap";

type YoutubeNativeShortcut = typeof YOUTUBE_NATIVE_SHORTCUTS[keyof typeof YOUTUBE_NATIVE_SHORTCUTS];
type MusicNativeShortcut = typeof YOUTUBE_MUSIC_NATIVE_SHORTCUTS[keyof typeof YOUTUBE_MUSIC_NATIVE_SHORTCUTS];
type DialogRowSource = VlcAction | typeof VLC_WHEEL_VOLUME | YoutubeNativeShortcut | MusicNativeShortcut;

// The help dialog lists related shortcuts side by side - VLC's and YouTube's own alike - in this order
const DIALOG_ROW_ORDER: DialogRowSource[] = [
  VlcAction.PLAY_PAUSE,
  VlcAction.STOP,
  VlcAction.JUMP_BACKWARD_EXTRA_SHORT,
  VlcAction.JUMP_FORWARD_EXTRA_SHORT,
  VlcAction.JUMP_BACKWARD_ARROW,
  VlcAction.JUMP_FORWARD_ARROW,
  VlcAction.JUMP_BACKWARD_SHORT,
  VlcAction.JUMP_FORWARD_SHORT,
  VlcAction.JUMP_BACKWARD_MEDIUM,
  VlcAction.JUMP_FORWARD_MEDIUM,
  VlcAction.JUMP_BACKWARD_LONG,
  VlcAction.JUMP_FORWARD_LONG,
  YOUTUBE_NATIVE_SHORTCUTS.seekToPercentage,
  YOUTUBE_NATIVE_SHORTCUTS.previousChapter,
  YOUTUBE_NATIVE_SHORTCUTS.nextChapter,
  VlcAction.PREVIOUS,
  VlcAction.NEXT,
  VlcAction.PREVIOUS_FRAME,
  VlcAction.NEXT_FRAME,
  VlcAction.SLOWER,
  VlcAction.FASTER,
  VlcAction.SLOWER_FINE,
  VlcAction.FASTER_FINE,
  VlcAction.NORMAL_SPEED,
  VlcAction.TOGGLE_LOOP,
  VlcAction.SHUFFLE,
  VlcAction.TOGGLE_FULLSCREEN,
  YOUTUBE_NATIVE_SHORTCUTS.theaterMode,
  VlcAction.TOGGLE_MINIPLAYER,
  YOUTUBE_NATIVE_SHORTCUTS.closeMiniplayerOrDialog,
  VlcAction.SHOW_MORE_VIDEOS,
  YOUTUBE_MUSIC_NATIVE_SHORTCUTS.toggleQueue,
  VlcAction.TOGGLE_MUTE,
  VlcAction.VOLUME_UP,
  VlcAction.VOLUME_DOWN,
  VLC_WHEEL_VOLUME,
  YOUTUBE_MUSIC_NATIVE_SHORTCUTS.like,
  YOUTUBE_MUSIC_NATIVE_SHORTCUTS.dislike,
  VlcAction.CYCLE_AUDIO_TRACK,
  VlcAction.CYCLE_ASPECT_RATIO,
  VlcAction.ZOOM_IN_360,
  VlcAction.ZOOM_OUT_360,
  VlcAction.PAN_UP_360,
  VlcAction.PAN_LEFT_360,
  VlcAction.PAN_DOWN_360,
  VlcAction.PAN_RIGHT_360,
  VlcAction.SNAPSHOT,
  VlcAction.TOGGLE_CONTROLS,
  VlcAction.CYCLE_SUBTITLES,
  VlcAction.CYCLE_SUBTITLES_REVERSE
];

// A row left out of the order still shows, after the ordered ones
export function getDialogRowRank(source: DialogRowSource) {
  const rank = DIALOG_ROW_ORDER.indexOf(source);
  return rank === -1 ? DIALOG_ROW_ORDER.length : rank;
}
