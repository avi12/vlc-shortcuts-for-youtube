import { cycleAspectRatio } from "@/lib/hotkeys/actions/aspect-ratio";
import { cycleAudioTrack } from "@/lib/hotkeys/actions/audio-tracks";
import { toggleControls } from "@/lib/hotkeys/actions/controls-visibility";
import { FrameDirection, stepFrame } from "@/lib/hotkeys/actions/frame-step";
import { shuffle } from "@/lib/hotkeys/actions/music-queue";
import {
  playNext,
  playPrevious,
  showMoreVideos,
  stop,
  toggleFullscreen,
  toggleLoop,
  toggleMiniplayer,
  togglePlayPause
} from "@/lib/hotkeys/actions/playback";
import { takeSnapshot } from "@/lib/hotkeys/actions/snapshot";
import { resetSpeed, SpeedDirection, stepFineSpeed, stepPresetSpeed } from "@/lib/hotkeys/actions/speed";
import { CycleDirection, cycleSubtitles } from "@/lib/hotkeys/actions/subtitles";
import { stepVolume, toggleMute, VolumeDirection } from "@/lib/hotkeys/actions/volume";
import { seekNatively } from "@/lib/hotkeys/native/seek";
import { holdYoutubeHotkey } from "@/lib/hotkeys/youtube-hotkey-dispatch";
import type { YoutubePlayer } from "@/lib/player";
import { findBinding, JUMP_SECONDS_BY_ACTION, VlcAction, type VlcBinding } from "@/lib/vlc-keymap";

// An action YouTube performs for as long as its key is held hands back the release of that key
type ReleaseKey = () => void;
// An action that has to wait for YouTube (switching a subtitle track waits for YouTube's own caption key) runs on
type ActionHandler = (player: YoutubePlayer) => ReleaseKey | Promise<void> | void;

// Holds the binding's YouTube key down until the viewer lets go of the VLC key
function createHoldHandler(action: VlcAction) {
  const hotkey = findBinding(action)?.youtubeEquivalent;
  return (player: YoutubePlayer) => hotkey && holdYoutubeHotkey({
    player,
    hotkey
  });
}

function createJumpHandler(action: VlcAction) {
  return (player: YoutubePlayer) => seekNatively({
    player,
    seconds: JUMP_SECONDS_BY_ACTION.get(action) ?? 0
  });
}

function createFrameHandler(direction: FrameDirection) {
  return (player: YoutubePlayer) => stepFrame({
    player,
    direction
  });
}

function createVolumeHandler(direction: VolumeDirection) {
  return (player: YoutubePlayer) => stepVolume({
    player,
    direction
  });
}

function createSubtitlesHandler(direction: CycleDirection) {
  return (player: YoutubePlayer) => cycleSubtitles({
    player,
    direction
  });
}

function createSpeedHandler({ step, direction }: {
  step: typeof stepPresetSpeed;
  direction: SpeedDirection;
}) {
  return (player: YoutubePlayer) => step({
    player,
    direction
  });
}

const ACTION_HANDLERS: Record<VlcAction, ActionHandler> = {
  [VlcAction.PLAY_PAUSE]: togglePlayPause,
  [VlcAction.STOP]: stop,
  [VlcAction.TOGGLE_FULLSCREEN]: toggleFullscreen,
  [VlcAction.NEXT]: playNext,
  [VlcAction.PREVIOUS]: playPrevious,
  [VlcAction.JUMP_BACKWARD_EXTRA_SHORT]: createJumpHandler(VlcAction.JUMP_BACKWARD_EXTRA_SHORT),
  [VlcAction.JUMP_FORWARD_EXTRA_SHORT]: createJumpHandler(VlcAction.JUMP_FORWARD_EXTRA_SHORT),
  [VlcAction.JUMP_BACKWARD_ARROW]: createJumpHandler(VlcAction.JUMP_BACKWARD_ARROW),
  [VlcAction.JUMP_FORWARD_ARROW]: createJumpHandler(VlcAction.JUMP_FORWARD_ARROW),
  [VlcAction.JUMP_BACKWARD_SHORT]: createJumpHandler(VlcAction.JUMP_BACKWARD_SHORT),
  [VlcAction.JUMP_FORWARD_SHORT]: createJumpHandler(VlcAction.JUMP_FORWARD_SHORT),
  [VlcAction.JUMP_BACKWARD_MEDIUM]: createJumpHandler(VlcAction.JUMP_BACKWARD_MEDIUM),
  [VlcAction.JUMP_FORWARD_MEDIUM]: createJumpHandler(VlcAction.JUMP_FORWARD_MEDIUM),
  [VlcAction.JUMP_BACKWARD_LONG]: createJumpHandler(VlcAction.JUMP_BACKWARD_LONG),
  [VlcAction.JUMP_FORWARD_LONG]: createJumpHandler(VlcAction.JUMP_FORWARD_LONG),
  [VlcAction.PREVIOUS_FRAME]: createFrameHandler(FrameDirection.BACKWARD),
  [VlcAction.NEXT_FRAME]: createFrameHandler(FrameDirection.FORWARD),
  [VlcAction.VOLUME_UP]: createVolumeHandler(VolumeDirection.LOUDER),
  [VlcAction.VOLUME_DOWN]: createVolumeHandler(VolumeDirection.QUIETER),
  [VlcAction.TOGGLE_MUTE]: toggleMute,
  [VlcAction.FASTER]: createSpeedHandler({
    step: stepPresetSpeed,
    direction: SpeedDirection.FASTER
  }),
  [VlcAction.SLOWER]: createSpeedHandler({
    step: stepPresetSpeed,
    direction: SpeedDirection.SLOWER
  }),
  [VlcAction.FASTER_FINE]: createSpeedHandler({
    step: stepFineSpeed,
    direction: SpeedDirection.FASTER
  }),
  [VlcAction.SLOWER_FINE]: createSpeedHandler({
    step: stepFineSpeed,
    direction: SpeedDirection.SLOWER
  }),
  [VlcAction.NORMAL_SPEED]: resetSpeed,
  [VlcAction.CYCLE_SUBTITLES]: createSubtitlesHandler(CycleDirection.FORWARD),
  [VlcAction.CYCLE_SUBTITLES_REVERSE]: createSubtitlesHandler(CycleDirection.BACKWARD),
  [VlcAction.CYCLE_AUDIO_TRACK]: cycleAudioTrack,
  [VlcAction.CYCLE_ASPECT_RATIO]: cycleAspectRatio,
  [VlcAction.TOGGLE_LOOP]: toggleLoop,
  [VlcAction.SHUFFLE]: shuffle,
  [VlcAction.SNAPSHOT]: takeSnapshot,
  [VlcAction.TOGGLE_CONTROLS]: toggleControls,
  [VlcAction.TOGGLE_MINIPLAYER]: toggleMiniplayer,
  [VlcAction.SHOW_MORE_VIDEOS]: showMoreVideos,
  [VlcAction.ZOOM_IN_360]: createHoldHandler(VlcAction.ZOOM_IN_360),
  [VlcAction.ZOOM_OUT_360]: createHoldHandler(VlcAction.ZOOM_OUT_360),
  [VlcAction.PAN_UP_360]: createHoldHandler(VlcAction.PAN_UP_360),
  [VlcAction.PAN_LEFT_360]: createHoldHandler(VlcAction.PAN_LEFT_360),
  [VlcAction.PAN_DOWN_360]: createHoldHandler(VlcAction.PAN_DOWN_360),
  [VlcAction.PAN_RIGHT_360]: createHoldHandler(VlcAction.PAN_RIGHT_360)
};

// Held keys keep stepping like VLC; toggles fire once per press
export function runAction({ binding, player, isRepeat }: {
  binding: VlcBinding;
  player: YoutubePlayer;
  isRepeat: boolean;
}) {
  if (isRepeat && !binding.isRepeatable) {
    return;
  }

  return ACTION_HANDLERS[binding.action](player);
}
