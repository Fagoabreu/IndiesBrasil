// In-memory rate limiter — protects against brute-force attacks.
// Uses a Map with automatic expiration via periodic cleanup.
const attempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // clean expired entries every 5 min

// Periodic cleanup of expired entries to prevent memory leaks.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Allow the timer to not prevent Node.js from exiting.
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Checks if the given key has exceeded the rate limit.
 * @param {string} key — typically the client IP address.
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
function check(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetMs: WINDOW_MS };
  }

  entry.count += 1;

  if (entry.count > MAX_ATTEMPTS) {
    const resetMs = WINDOW_MS - (now - entry.firstAttempt);
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count, resetMs: WINDOW_MS - (now - entry.firstAttempt) };
}

/**
 * Returns the client IP from the request object.
 * Handles reverse proxy (nginx) via X-Forwarded-For.
 * @param {object} request — Next.js / next-connect request object.
 * @returns {string} IP address.
 */
function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket?.remoteAddress || request.connection?.remoteAddress || "unknown";
}

/**
 * Resets all rate-limit counters. Useful for tests.
 */
function reset() {
  attempts.clear();
}

const rateLimit = {
  check,
  getClientIp,
  reset,
  MAX_ATTEMPTS,
  WINDOW_MS,
};

export default rateLimit;
