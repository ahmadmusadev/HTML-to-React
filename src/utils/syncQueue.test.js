import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enqueueWrite,
  getQueue,
  removeFromQueue,
  clearQueue,
  isNetworkError,
  flushQueue,
  SYNC_QUEUE_STORAGE_KEY
} from './syncQueue';

describe('syncQueue Utility Infrastructure', () => {
  beforeEach(() => {
    localStorage.clear();
    clearQueue();
    // Default navigator.onLine to true for predictable test setup
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Queue Operations (enqueueWrite, getQueue, removeFromQueue)', () => {
    it('starts with an empty queue', () => {
      expect(getQueue()).toEqual([]);
    });

    it('enqueues write items with proper shape and persists to localStorage', () => {
      const payload = {
        student_id: 'std_123',
        amount: 1500,
        month_year: '2026-09'
      };

      const item = enqueueWrite({
        table: 'fees',
        operation: 'insert',
        payload,
        matchId: 'match_1',
        onConflict: 'student_id',
        madrasaId: 'madrasa_abc'
      });

      expect(item).toBeDefined();
      expect(item.id).toBeTruthy();
      expect(item.createdAt).toBeTruthy();
      expect(item.table).toBe('fees');
      expect(item.operation).toBe('insert');
      expect(item.payload).toEqual(payload);
      expect(item.matchId).toBe('match_1');
      expect(item.onConflict).toBe('student_id');
      expect(item.madrasaId).toBe('madrasa_abc');
      expect(item.retryCount).toBe(0);
      expect(item.lastError).toBeNull();

      const queue = getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(item.id);

      const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw)).toEqual(queue);
    });

    it('enqueues multiple items in sequential order', () => {
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { id: 1 } });
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { id: 2 } });
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { id: 3 } });

      const queue = getQueue();
      expect(queue.length).toBe(3);
      expect(queue[0].payload.id).toBe(1);
      expect(queue[1].payload.id).toBe(2);
      expect(queue[2].payload.id).toBe(3);
    });

    it('removes an item by id from the queue and localStorage', () => {
      const item1 = enqueueWrite({ table: 'fees', operation: 'insert', payload: { id: 101 } });
      const item2 = enqueueWrite({ table: 'fees', operation: 'insert', payload: { id: 102 } });

      expect(getQueue().length).toBe(2);

      const remaining = removeFromQueue(item1.id);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(item2.id);
      expect(getQueue().length).toBe(1);
      expect(getQueue()[0].id).toBe(item2.id);
    });

    it('handles corrupted localStorage JSON gracefully', () => {
      localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, '{invalid json');
      expect(getQueue()).toEqual([]);
    });
  });

  describe('isNetworkError Classification', () => {
    describe('Genuine Network Failures (MUST return true -> queued for retry)', () => {
      it('returns true when navigator.onLine is false', () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        expect(isNetworkError(new Error('Any error while offline'))).toBe(true);
        expect(isNetworkError(null)).toBe(true);
      });

      it('returns true for TypeError with "Failed to fetch" (Chrome / Safari standard fetch failure)', () => {
        const error = new TypeError('Failed to fetch');
        expect(isNetworkError(error)).toBe(true);
      });

      it('returns true for Error with "NetworkError when attempting to fetch resource" (Firefox standard)', () => {
        const error = new Error('NetworkError when attempting to fetch resource');
        expect(isNetworkError(error)).toBe(true);
      });

      it('returns true for "Load failed" (iOS / Safari WebKit fetch failure)', () => {
        const error = new TypeError('Load failed');
        expect(isNetworkError(error)).toBe(true);
      });

      it('returns true for DOMException AbortError (timeout/abort)', () => {
        const abortErr = new DOMException('The user aborted a request.', 'AbortError');
        expect(isNetworkError(abortErr)).toBe(true);
      });

      it('returns true for TimeoutError', () => {
        const timeoutErr = new Error('The operation timed out');
        timeoutErr.name = 'TimeoutError';
        expect(isNetworkError(timeoutErr)).toBe(true);
      });

      it('returns true for network connection reset or refused codes', () => {
        expect(isNetworkError({ code: 'ECONNREFUSED', message: 'connection refused' })).toBe(true);
        expect(isNetworkError({ code: 'ETIMEDOUT', message: 'connection timed out' })).toBe(true);
        expect(isNetworkError({ code: 'ENOTFOUND', message: 'dns lookup failed' })).toBe(true);
      });

      it('returns true for plain strings mentioning network failures', () => {
        expect(isNetworkError('network error: unable to reach host')).toBe(true);
        expect(isNetworkError('Fetch failed due to socket disconnect')).toBe(true);
      });
    });

    describe('Genuine Application / Database Errors (MUST return false -> NOT queued, immediate error)', () => {
      it('returns false for Postgres unique violation (23505)', () => {
        const pgError = {
          code: '23505',
          message: 'duplicate key value violates unique constraint "fees_invoice_id_key"',
          details: 'Key (invoice_id)=(INV-001) already exists.'
        };
        expect(isNetworkError(pgError)).toBe(false);
      });

      it('returns false for Postgres RLS permission denial (42501)', () => {
        const rlsError = {
          code: '42501',
          message: 'new row violates row-level security policy for table "fees"'
        };
        expect(isNetworkError(rlsError)).toBe(false);
      });

      it('returns false for Postgres foreign key violation (23503)', () => {
        const fkError = {
          code: '23503',
          message: 'insert or update on table "fees" violates foreign key constraint "fees_student_id_fkey"'
        };
        expect(isNetworkError(fkError)).toBe(false);
      });

      it('returns false for Postgres NOT NULL violation (23502)', () => {
        const notNullError = {
          code: '23502',
          message: 'null value in column "amount" violates not-null constraint'
        };
        expect(isNetworkError(notNullError)).toBe(false);
      });

      it('returns false for PostgREST structured error (PGRST116)', () => {
        const pgrstError = {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned'
        };
        expect(isNetworkError(pgrstError)).toBe(false);
      });

      it('returns false when error is wrapped inside a Supabase { error: { code, message } } object', () => {
        const wrappedError = {
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint'
          }
        };
        expect(isNetworkError(wrappedError)).toBe(false);
      });

      it('returns false for client-side application / validation errors', () => {
        const valError = new Error('Student fee amount must be a positive number');
        expect(isNetworkError(valError)).toBe(false);
      });

      it('returns false for null / undefined error when online', () => {
        expect(isNetworkError(null)).toBe(false);
        expect(isNetworkError(undefined)).toBe(false);
      });
    });
  });

  describe('flushQueue Behavior', () => {
    it('successfully replays all queued items and removes them from the queue', async () => {
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-1' } });
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-2' } });

      const inserted = [];
      const mockSupabase = {
        from: vi.fn((table) => ({
          insert: vi.fn((data) => {
            inserted.push({ table, data });
            return Promise.resolve({ data, error: null });
          })
        }))
      };

      const result = await flushQueue(mockSupabase);
      expect(result.processed).toBe(2);
      expect(result.remaining).toBe(0);
      expect(getQueue().length).toBe(0);
      expect(inserted.length).toBe(2);
      expect(inserted[0].data).toEqual([{ invoice_id: 'INV-1' }]);
      expect(inserted[1].data).toEqual([{ invoice_id: 'INV-2' }]);
    });

    it('supports update, upsert, and delete operations during replay', async () => {
      enqueueWrite({ table: 'fees', operation: 'update', payload: { status: 'paid' }, matchId: 'fee-123' });
      enqueueWrite({ table: 'fees', operation: 'upsert', payload: { id: 'fee-456', amount: 500 }, onConflict: 'id' });
      enqueueWrite({ table: 'fees', operation: 'delete', matchId: 'fee-789' });

      const operations = [];
      const mockSupabase = {
        from: vi.fn((table) => ({
          update: vi.fn((payload) => ({
            eq: vi.fn((col, val) => {
              operations.push({ op: 'update', table, payload, col, val });
              return Promise.resolve({ error: null });
            })
          })),
          upsert: vi.fn((payload, opts) => {
            operations.push({ op: 'upsert', table, payload, opts });
            return Promise.resolve({ error: null });
          }),
          delete: vi.fn(() => ({
            eq: vi.fn((col, val) => {
              operations.push({ op: 'delete', table, col, val });
              return Promise.resolve({ error: null });
            })
          }))
        }))
      };

      const result = await flushQueue(mockSupabase);
      expect(result.processed).toBe(3);
      expect(result.remaining).toBe(0);
      expect(getQueue().length).toBe(0);
      expect(operations.length).toBe(3);
      expect(operations[0]).toEqual({ op: 'update', table: 'fees', payload: { status: 'paid' }, col: 'id', val: 'fee-123' });
      expect(operations[1]).toEqual({ op: 'upsert', table: 'fees', payload: [{ id: 'fee-456', amount: 500 }], opts: { onConflict: 'id' } });
      expect(operations[2]).toEqual({ op: 'delete', table: 'fees', col: 'id', val: 'fee-789' });
    });

    it('stops attempting further items when network is still down, increments retryCount, and leaves queue intact', async () => {
      const item1 = enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-1' } });
      const item2 = enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-2' } });

      let attempts = 0;
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => {
            attempts++;
            // Replay throws a network error
            return Promise.reject(new TypeError('Failed to fetch'));
          })
        }))
      };

      const result = await flushQueue(mockSupabase);
      expect(attempts).toBe(1); // Stopped immediately at item 1, did NOT attempt item 2
      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(2);

      const queue = getQueue();
      expect(queue.length).toBe(2);
      expect(queue[0].id).toBe(item1.id);
      expect(queue[0].retryCount).toBe(1);
      expect(queue[0].lastError).toContain('Failed to fetch');
      expect(queue[1].id).toBe(item2.id);
      expect(queue[1].retryCount).toBe(0);
    });

    it('removes non-network errored item (stale/invalid) and continues processing remaining items in queue', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Item 1: will fail with a Postgres unique constraint violation (code: '23505')
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-DUPLICATE' } });
      // Item 2: valid, should succeed
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-VALID' } });

      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn((data) => {
            if (data[0].invoice_id === 'INV-DUPLICATE') {
              return Promise.resolve({
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint'
                }
              });
            }
            return Promise.resolve({ data, error: null });
          })
        }))
      };

      const result = await flushQueue(mockSupabase);
      expect(result.processed).toBe(2); // 1 discarded, 1 succeeded
      expect(result.remaining).toBe(0);
      expect(getQueue().length).toBe(0);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Non-network error on queued write to fees (insert), discarding item:'),
        expect.objectContaining({ code: '23505' })
      );
    });

    it('does not flush if navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      enqueueWrite({ table: 'fees', operation: 'insert', payload: { invoice_id: 'INV-1' } });

      const mockSupabase = {
        from: vi.fn()
      };

      const result = await flushQueue(mockSupabase);
      expect(result.processed).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(getQueue().length).toBe(1);
    });
  });
});
