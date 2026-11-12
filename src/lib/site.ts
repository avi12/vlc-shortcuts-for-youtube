const MUSIC_HOSTNAME = "music.youtube.com";

// YouTube Music is its own app around YouTube's player, with its own keys and shortcuts dialog
export enum Site {
  YOUTUBE = "youtube",
  MUSIC = "music"
}

export function getSite() {
  return location.hostname === MUSIC_HOSTNAME ? Site.MUSIC : Site.YOUTUBE;
}

export function isMusicSite() {
  return getSite() === Site.MUSIC;
}
