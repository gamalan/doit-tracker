/**
 * Production-optimized logging utility
 * Reduces console.log overhead in production environments
 */

const IS_PRODUCTION = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (!IS_PRODUCTION) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};