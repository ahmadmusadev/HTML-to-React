// Storage key for the offline sync queue
export const SYNC_QUEUE_STORAGE_KEY = 'hf_sync_queue_v1';

// In-memory subscribers for queue updates
const listeners = new Set();

/**
 * Notifies all active subscribers and dispatches a window event.
 */
function notifyQueueListeners() {
  const currentQueue = getQueue();
  listeners.forEach(callback => {
    try {
      callback(currentQueue.length, currentQueue);
    } catch (err) {
      console.error('[syncQueue] Error in subscriber callback:', err);
    }
  });

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('hf_sync_queue_change', {
        detail: { count: currentQueue.length }
      }));
    } catch (err) {
      // Ignore in non-browser environments
    }
  }
}

/**
 * Subscribes to queue changes.
 * @param {Function} callback Function called with (count, queue)
 * @returns {Function} Unsubscribe function
 */
export function subscribeSyncQueue(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Retrieves the current queue array from localStorage.
 * @returns {Array} Array of queued write items
 */
export function getQueue() {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[syncQueue] Failed to parse sync queue from localStorage:', err);
    return [];
  }
}

/**
 * Saves queue to localStorage and notifies listeners.
 * @param {Array} queue Array of items to save
 */
function saveQueue(queue) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifyQueueListeners();
  } catch (err) {
    console.error('[syncQueue] Failed to save sync queue to localStorage:', err);
  }
}

/**
 * Clears all items in the sync queue (useful for testing and resets).
 */
export function clearQueue() {
  saveQueue([]);
}

/**
 * Appends a write operation to the queue.
 * @param {Object} params Write parameters
 * @param {string} params.table Supabase table name
 * @param {'insert' | 'update' | 'upsert' | 'delete'} params.operation Supabase operation
 * @param {Object|Array} [params.payload] Data payload
 * @param {string|number} [params.matchId] Row ID to match for update/delete
 * @param {string} [params.onConflict] Conflict target column(s) for upsert
 * @param {string} [params.madrasaId] Associated madrasa ID
 * @returns {Object} The queued item
 */
export function enqueueWrite({ table, operation, payload, matchId, onConflict, madrasaId }) {
  const currentQueue = getQueue();

  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const item = {
    id,
    createdAt: new Date().toISOString(),
    table,
    operation,
    payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    matchId: matchId || null,
    onConflict: onConflict || null,
    madrasaId: madrasaId || null,
    retryCount: 0,
    lastError: null
  };

  currentQueue.push(item);
  saveQueue(currentQueue);
  return item;
}

/**
 * Removes one item by ID from the queue.
 * @param {string} id Unique item ID
 * @returns {Array} Updated queue array
 */
export function removeFromQueue(id) {
  const currentQueue = getQueue();
  const updatedQueue = currentQueue.filter(item => item.id !== id);
  saveQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Updates a queue item by ID (e.g. updating retryCount or lastError).
 * @param {string} id Unique item ID
 * @param {Object} updates Properties to update
 * @returns {Array} Updated queue array
 */
export function updateQueueItem(id, updates) {
  const currentQueue = getQueue();
  const updatedQueue = currentQueue.map(item => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Classifies whether an error is a genuine NETWORK failure (should queue and retry)
 * vs a genuine application/database error (e.g. Postgres constraint violation, RLS denial, PostgREST error).
 *
 * @param {any} error The caught error or Supabase error object
 * @returns {boolean} True if network failure, false if server/database/application error
 */
export function isNetworkError(error) {
  // If the browser is explicitly offline, it is definitely a network failure
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  if (!error) {
    return false;
  }

  // Unwrap potential Supabase response shape: { error: { code, message, ... } }
  const target = error?.error || error;

  // Check Error type and name first (e.g. AbortError, TimeoutError, DOMException)
  const errName = target?.name || '';
  if (errName === 'AbortError' || errName === 'TimeoutError') {
    return true;
  }
  if (typeof DOMException !== 'undefined' && target instanceof DOMException) {
    if (target.name === 'AbortError' || target.name === 'TimeoutError' || target.code === 20) {
      return true;
    }
  }

  // If the server returned an error object with a Postgres/PostgREST error code,
  // the request reached the server and the server/database rejected it.
  if (target?.code !== undefined && target?.code !== null) {
    const codeStr = String(target.code).trim().toUpperCase();

    // Specific low-level network error codes from Node/fetch/network stacks
    const knownNetworkCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
      'FETCH_ERROR'
    ];

    if (knownNetworkCodes.includes(codeStr)) {
      return true;
    }

    // Postgres SQLSTATE codes (e.g., 23505 unique violation, 42501 RLS denial) or
    // PostgREST codes (e.g., PGRST116) mean the server responded.
    return false;
  }

  // Check error message for standard network failure phrases
  const message = (target?.message || (typeof target === 'string' ? target : '')).toLowerCase();
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('networkrequestfailed') ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('net::err') ||
    message.includes('the user aborted a request') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('offline')
  ) {
    return true;
  }

  return false;
}

// Guard to prevent concurrent queue flushes
let isFlushing = false;

/**
 * Iterates through the offline queue in order, replays each item against Supabase.
 * - On success: removes item from queue.
 * - On failure with network error: increments retryCount, updates lastError, and stops processing.
 * - On failure with non-network error: logs warning and removes stale/invalid item from queue.
 *
 * @param {Object} supabaseClient Initialized Supabase client
 * @returns {Promise<{ processed: number, remaining: number }>}
 */
export async function flushQueue(supabaseClient) {
  if (isFlushing || !supabaseClient) {
    return { processed: 0, remaining: getQueue().length };
  }

  // If navigator is offline, do not attempt to flush
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { processed: 0, remaining: getQueue().length };
  }

  isFlushing = true;
  let processed = 0;

  try {
    const queue = getQueue();

    for (const item of queue) {
      let replayError = null;

      try {
        let query;

        if (item.operation === 'insert') {
          const insertData = Array.isArray(item.payload) ? item.payload : [item.payload];
          query = supabaseClient.from(item.table).insert(insertData);
        } else if (item.operation === 'upsert') {
          const upsertData = Array.isArray(item.payload) ? item.payload : [item.payload];
          const options = item.onConflict ? { onConflict: item.onConflict } : undefined;
          query = supabaseClient.from(item.table).upsert(upsertData, options);
        } else if (item.operation === 'update') {
          query = supabaseClient.from(item.table).update(item.payload);
          if (item.matchId) {
            query = query.eq('id', item.matchId);
          }
        } else if (item.operation === 'delete') {
          query = supabaseClient.from(item.table).delete();
          if (item.matchId) {
            query = query.eq('id', item.matchId);
          }
        } else {
          console.warn(`[syncQueue] Unknown operation '${item.operation}', discarding queued item:`, item);
          removeFromQueue(item.id);
          continue;
        }

        const res = await query;
        if (res && res.error) {
          replayError = res.error;
        }
      } catch (err) {
        replayError = err;
      }

      if (!replayError) {
        // Success: remove item from queue
        removeFromQueue(item.id);
        processed++;
      } else if (isNetworkError(replayError)) {
        // Network is still down: update retry metadata and STOP attempting further items
        updateQueueItem(item.id, {
          retryCount: (item.retryCount || 0) + 1,
          lastError: replayError?.message || String(replayError)
        });
        break;
      } else {
        // Non-network failure: item is invalid/stale, discard and log warning
        console.warn(
          `[syncQueue] Non-network error on queued write to ${item.table} (${item.operation}), discarding item:`,
          replayError
        );
        removeFromQueue(item.id);
        processed++;
      }
    }

    return { processed, remaining: getQueue().length };
  } finally {
    isFlushing = false;
  }
}
