type ExpiryClock = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
};

const browserClock: ExpiryClock = {
  now: Date.now,
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

// A single browser timeout cannot cover the backend's default 30-day JWT.
const MAX_DELAY_MS = 2_147_483_647;

export function watchSessionExpiry(
  expiresAt: number,
  onExpire: () => void,
  clock: ExpiryClock = browserClock,
): () => void {
  let cancelled = false;
  let cancelTimer = () => {};
  const check = () => {
    if (cancelled) return;
    const remaining = expiresAt - clock.now();
    if (remaining <= 0) {
      onExpire();
      return;
    }
    cancelTimer = clock.schedule(check, Math.min(remaining, MAX_DELAY_MS));
  };
  check();
  return () => {
    cancelled = true;
    cancelTimer();
  };
}
