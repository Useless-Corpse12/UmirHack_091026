export const MAX_SHELF_LIFE_SECONDS = 3650 * 86400;
export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}
export function splitDuration(total: number): DurationParts {
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
export function durationSeconds(parts: DurationParts): number {
  for (const [value, max] of [
    [parts.days, 3650],
    [parts.hours, 23],
    [parts.minutes, 59],
    [parts.seconds, 59],
  ]) {
    if (!Number.isInteger(value) || value < 0 || value > max)
      throw new Error(
        "Укажите целые дни (0–3650), часы (0–23), минуты и секунды (0–59)",
      );
  }
  const total =
    parts.days * 86400 +
    parts.hours * 3600 +
    parts.minutes * 60 +
    parts.seconds;
  if (total < 1 || total > MAX_SHELF_LIFE_SECONDS)
    throw new Error("Срок хранения — от 1 секунды до 3650 дней");
  return total;
}
export function durationLabel(total: number): string {
  const parts = splitDuration(total);
  return (
    [
      parts.days ? parts.days + " дн." : "",
      parts.hours ? parts.hours + " ч." : "",
      parts.minutes ? parts.minutes + " мин." : "",
      parts.seconds ? parts.seconds + " сек." : "",
    ]
      .filter(Boolean)
      .join(" ") || "0 сек."
  );
}
