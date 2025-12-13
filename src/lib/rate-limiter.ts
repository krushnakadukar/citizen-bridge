/**
 * Client-side rate limiting utility
 * 
 * Provides basic rate limiting to prevent abuse of forms and actions.
 * This is a UX enhancement - actual security should be enforced server-side.
 */

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
}

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  report_submission: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  comment_posting: { maxAttempts: 20, windowMs: 10 * 60 * 1000 }, // 20 per 10 min
  password_reset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
};

/**
 * Check if an action is rate limited
 * @param action - The type of action being performed
 * @param identifier - Unique identifier (usually user ID or email)
 * @returns Object with allowed status and remaining attempts/wait time
 */
export function checkRateLimit(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): { allowed: boolean; remainingAttempts: number; retryAfterMs?: number } {
  const config = RATE_LIMITS[action];
  if (!config) {
    return { allowed: true, remainingAttempts: Infinity };
  }

  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No previous attempts or window expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    rateLimitStore.set(key, { attempts: 1, windowStart: now });
    return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
  }

  // Within window, check attempts
  if (entry.attempts >= config.maxAttempts) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      retryAfterMs 
    };
  }

  // Increment attempts
  entry.attempts += 1;
  rateLimitStore.set(key, entry);
  
  return { 
    allowed: true, 
    remainingAttempts: config.maxAttempts - entry.attempts 
  };
}

/**
 * Reset rate limit for an action (e.g., after successful login)
 */
export function resetRateLimit(action: string, identifier: string): void {
  const key = `${action}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Format remaining time for display
 */
export function formatRetryTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}
