import { cycleAspectRatio } from "@/lib/hotkeys/actions/aspect-ratio";
import { cycleAudioTrack } from "@/lib/hotkeys/actions/audio-tracks";
import { toggleControls } from "@/lib/hotkeys/actions/controls-visibility";
import { stepFrame } from "@/lib/hotkeys/actions/frame-step";
import {
  playNext,
  playPrevious,
  stop,
  toggleFullscreen,
  toggleLoop,
  togglePlayPause
} from "@/lib/hotkeys/actions/playback";
import { takeSnapshot } from "@/lib/hotkeys/actions/snapshot";
import { resetSpeed, SpeedDirection, stepFineSpeed, stepPresetSpeed } from "@/lib/hotkeys/actions/speed";
import { CycleDirection, cycleSubtitles } from "@/lib/hotkeys/actions/subtitles";
import { stepVolume, toggleMute, VolumeDirection } from "@/lib/hotkeys/actions/volume";
import { zoomIn360, zoomOut360 } from "@/lib/hotkeys/actions/zoom-360";
import { seekNatively } from "@/lib/hotkeys/native/seek";
import type { YoutubePlayer } from "@/lib/player";
import { JUMP_SECONDS_BY_ACTION, VlcAction, type VlcBinding } from "@/lib/vlc-keymap";

// An action YouTube performs for as long as its key is held hands back the release of that key
type ReleaseKey = () => void;
type ActionHandler = (player: YoutubePlayer) => ReleaseKey | void;

function createJumpHandler(action: VlcAction): ActionHandler {
  return player => seekNatively({
    player,
    seconds: JUMP_SECONDS_BY_ACTION.get(action) ?? 0
  });
}

function createVolumeHandler(direction: VolumeDirection): ActionHandler {
  return player => stepVolume({
    player,
    direction
  });
}

function createSubtitlesHandler(direction: CycleDirection): ActionHandler {
  return player => cycleSubtitles({
    player,
    direction
  });
}

function createSpeedHandler({ step, direction }: {
  step: typeof stepPresetSpeed;
  direction: SpeedDirection;
}): ActionHandler {
  return player => step({
    player,
    direction
  });
}

const ACTION_HANDLERS: Record<VlcAction, ActionHandler> = {
  [VlcAction.PlayPause]: togglePlayPause,
  [VlcAction.Stop]: stop,
  [VlcAction.ToggleFullscreen]: toggleFullscreen,
  [VlcAction.Next]: playNext,
  [VlcAction.Previous]: playPrevious,
  [VlcAction.JumpBackwardExtraShort]: createJumpHandler(VlcAction.JumpBackwardExtraShort),
  [VlcAction.JumpForwardExtraShort]: createJumpHandler(VlcAction.JumpForwardExtraShort),
  [VlcAction.JumpBackwardArrow]: createJumpHandler(VlcAction.JumpBackwardArrow),
  [VlcAction.JumpForwardArrow]: createJumpHandler(VlcAction.JumpForwardArrow),
  [VlcAction.JumpBackwardShort]: createJumpHandler(VlcAction.JumpBackwardShort),
  [VlcAction.JumpForwardShort]: createJumpHandler(VlcAction.JumpForwardShort),
  [VlcAction.JumpBackwardMedium]: createJumpHandler(VlcAction.JumpBackwardMedium),
  [VlcAction.JumpForwardMedium]: createJumpHandler(VlcAction.JumpForwardMedium),
  [VlcAction.JumpBackwardLong]: createJumpHandler(VlcAction.JumpBackwardLong),
  [VlcAction.JumpForwardLong]: createJumpHandler(VlcAction.JumpForwardLong),
  [VlcAction.NextFrame]: stepFrame,
  [VlcAction.VolumeUp]: createVolumeHandler(VolumeDirection.Louder),
  [VlcAction.VolumeDown]: createVolumeHandler(VolumeDirection.Quieter),
  [VlcAction.ToggleMute]: toggleMute,
  [VlcAction.Faster]: createSpeedHandler({
    step: stepPresetSpeed,
    direction: SpeedDirection.Faster
  }),
  [VlcAction.Slower]: createSpeedHandler({
    step: stepPresetSpeed,
    direction: SpeedDirection.Slower
  }),
  [VlcAction.FasterFine]: createSpeedHandler({
    step: stepFineSpeed,
    direction: SpeedDirection.Faster
  }),
  [VlcAction.SlowerFine]: createSpeedHandler({
    step: stepFineSpeed,
    direction: SpeedDirection.Slower
  }),
  [VlcAction.NormalSpeed]: resetSpeed,
  [VlcAction.CycleSubtitles]: createSubtitlesHandler(CycleDirection.Forward),
  [VlcAction.CycleSubtitlesReverse]: createSubtitlesHandler(CycleDirection.Backward),
  [VlcAction.CycleAudioTrack]: cycleAudioTrack,
  [VlcAction.CycleAspectRatio]: cycleAspectRatio,
  [VlcAction.ToggleLoop]: toggleLoop,
  [VlcAction.Snapshot]: takeSnapshot,
  [VlcAction.ToggleControls]: toggleControls,
  [VlcAction.ZoomIn360]: zoomIn360,
  [VlcAction.ZoomOut360]: zoomOut360
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
