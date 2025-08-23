/**
 * Mock SvelteKit stores for testing
 */

import { vi } from 'vitest';
import { writable } from 'svelte/store';

export const page = writable({
  data: {},
  params: {},
  url: new URL('http://localhost/')
});

export const navigating = writable(null);

export const updated = writable(false);