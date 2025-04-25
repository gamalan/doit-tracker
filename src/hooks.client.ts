import { invalidate } from '$app/navigation';
import type { HandleClientError } from '@sveltejs/kit';

// Keep track of which URLs we've already loaded data for
const loadedUrls = new Set<string>();

// Override SvelteKit's default invalidation behavior by creating a custom invalidate function
const originalInvalidate = invalidate;

// Replace the global invalidate function with our custom version
// @ts-expect-error - Overriding the invalidate function
globalThis.__sveltekit_invalidate = async (url: string | ((url: string) => boolean)) => {
  // If it's a simple page navigation (not a data modification), don't invalidate
  // We consider it a data modification only when the URL includes specific paths
  // that we've defined in our data modification handlers
  if (typeof url === 'string') {
    const shouldInvalidate = url.includes('/dashboard') || 
                             url.includes('/habits/daily') || 
                             url.includes('/habits/weekly');
    
    // Only invalidate if explicitly requested by our data modification handlers
    if (shouldInvalidate) {
      return originalInvalidate(url);
    }
    
    // For normal navigation, just mark the URL as loaded but don't actually invalidate
    loadedUrls.add(url);
    return Promise.resolve();
  }
  
  // If it's a function-based invalidation, let it proceed (advanced case)
  return originalInvalidate(url);
};

// Handle client-side errors
export const handleError: HandleClientError = ({ error }) => {
  console.error('Client error:', error);
  return {
    message: 'An unexpected error occurred',
    code: 'UNEXPECTED'
  };
};