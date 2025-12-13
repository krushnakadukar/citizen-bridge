/**
 * Production-safe logger utility
 * 
 * In development mode, logs are output to the console with full details.
 * In production mode, sensitive error details are suppressed to prevent
 * information leakage through browser DevTools.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log general information (development only)
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log debug information (development only)
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log warnings (development only for detailed messages)
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(message, ...args);
    }
  },

  /**
   * Log errors - safe message in production, detailed in development
   * @param message - User-safe error message
   * @param error - Optional error object (only logged in development)
   */
  error: (message: string, error?: unknown) => {
    if (isDev) {
      console.error(message, error);
    } else {
      // In production, only log the safe message without sensitive details
      console.error(message);
    }
  },

  /**
   * Log info messages (development only)
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
