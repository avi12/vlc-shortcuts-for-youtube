const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const CLOCK_PART_LENGTH = 2;

function splitClock(totalSeconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(wholeSeconds / SECONDS_PER_HOUR),
    minutes: Math.floor(wholeSeconds % SECONDS_PER_HOUR / SECONDS_PER_MINUTE),
    seconds: wholeSeconds % SECONDS_PER_MINUTE
  };
}

function padClockPart(part: number) {
  return String(part).padStart(CLOCK_PART_LENGTH, "0");
}

export function formatFileTimestamp(seconds: number) {
  const clock = splitClock(seconds);
  return [clock.hours, clock.minutes, clock.seconds].map(padClockPart).join("-");
}
