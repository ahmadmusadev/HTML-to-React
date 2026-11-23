import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Fix Node.js 26+ experimental localStorage shadowing jsdom
if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}
if (!globalThis.sessionStorage || typeof globalThis.sessionStorage.clear !== 'function') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}

// Automatically cleanup after each test
if (typeof afterEach === 'function') {
  try {
    afterEach(() => {
      cleanup();
    });
  } catch (_) {
    // Already handled by testing-library
  }
}

