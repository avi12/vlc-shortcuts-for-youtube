const MUSIC_HOSTNAME = "music.youtube.com";

// YouTube Music is its own app around YouTube's player, with its own keys and shortcuts dialog
export enum Site {
  Youtube = "youtube",
  Music = "music"
}

export function getSite() {
  return location.hostname === MUSIC_HOSTNAME ? Site.Music : Site.Youtube;
}

export function isMusicSite() {
  return getSite() === Site.Music;
}
