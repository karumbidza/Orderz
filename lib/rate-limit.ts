// ORDERZ-SEC
// Simple rate limiting using an in-memory Map.
// Resets on cold start — good enough for serverless.

const requestCounts = new Map<string, {
  count: number;
  resetAt: number;
}>();

/**
 * Simple rate limiter — configurable requests per window per IP.
 * Returns true if rate limit exceeded.
 */
export function isRateLimited(
  ip: string,
  limit = 100,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return false;
  }

  entry.count++;
  if (entry.count > limit) return true;

  return false;
}
