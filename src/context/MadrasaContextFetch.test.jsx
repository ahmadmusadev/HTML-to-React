import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MadrasaProvider, useMadrasa } from './MadrasaContext';
import { supabase } from '../lib/supabaseClient';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const OFFLINE_TENANT = 'demo-madrasa-local';

// Mock AuthContext with empty profile so MadrasaProvider doesn't auto-fetch metadata on mount
vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(() => ({
    profile: null,
    user: null,
    role: null,
    loading: false
  }))
}));

// Mock syncQueue to prevent background syncing during tests
vi.mock('../utils/syncQueue', () => ({
  enqueueWrite: vi.fn(),
  getQueue: vi.fn(() => []),
  isNetworkError: vi.fn(() => false),
  flushQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0 }),
  subscribeSyncQueue: vi.fn(() => () => {}),
  SYNC_QUEUE_STORAGE_KEY: 'hf_offline_sync_queue_v1'
}));

// Helper to create thenable query builder
function createMockQuery(response = { data: [], error: null }, shouldThrow = false) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    not: vi.fn(() => builder),
    is: vi.fn(() => builder),
    single: vi.fn(() => (shouldThrow ? Promise.reject(response.error || new Error('Query error')) : Promise.resolve(response))),
    then: (onFulfilled, onRejected) => {
      if (shouldThrow) {
        return Promise.reject(response.error || new Error('Network error')).then(onFulfilled, onRejected);
      }
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
    catch: (onRejected) => {
      if (shouldThrow) {
        return Promise.reject(response.error || new Error('Network error')).catch(onRejected);
      }
      return Promise.resolve(response).catch(onRejected);
    }
  };
  return builder;
}

// Mock Supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => createMockQuery({ data: [], error: null }))
  },
  isValidUUID: (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}));

function TestConsumer({ onReady }) {
  const context = useMadrasa();
  React.useEffect(() => {
    if (onReady) onReady(context);
  }, [context, onReady]);
  return <div data-testid="ready">Ready</div>;
}

describe('MadrasaContext fetch*FromSupabase Honest Error Handling', () => {
  let madrasaCtx;

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();

    supabase.from.mockImplementation(() => createMockQuery({ data: [], error: null }));

    await act(async () => {
      render(
        <MadrasaProvider>
          <TestConsumer onReady={(ctx) => { madrasaCtx = ctx; }} />
        </MadrasaProvider>
      );
    });
  });

  it('fetchStudentsFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      records: [{ id: 'stale-1', name: 'طالب علم' }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch students') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchStudentsFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchHifzRecordsFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      monthlyExams: [{ id: 'exam-1', score: 95 }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch hifz records') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchHifzRecordsFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchFeesFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_fees_v1_${VALID_UUID}`, JSON.stringify({
      fees: [{ id: 'fee-1', amount: 5000 }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch fees') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchFeesFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchClassesFromSupabase throws on Supabase error and returns empty array on 0 rows (not DEFAULT_CLASSES)', async () => {
    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch classes') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchClassesFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();

    // When query succeeds with 0 rows, must return [] (not DEFAULT_CLASSES)
    supabase.from.mockImplementation(() => createMockQuery({ data: [], error: null }));
    const result = await madrasaCtx.fetchClassesFromSupabase(VALID_UUID);
    expect(result).toEqual([]);
  });

  it('fetchHifzHalfYearRecordsFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      records: [{ id: 'half-1', name: 'زید' }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch half year records') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchHifzHalfYearRecordsFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchStudentAttendanceFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_student_attendance_v1_${VALID_UUID}`, JSON.stringify([
      { id: 'att-1', status: 'present' }
    ]));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch student attendance') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchStudentAttendanceFromSupabase({}, VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchStaffFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      staffProfiles: [
        { id: 's1', name: 'استاد ۱' },
        { id: 's2', name: 'استاد ۲' },
        { id: 's3', name: 'استاد ۳' },
        { id: 's4', name: 'استاد ۴' },
        { id: 's5', name: 'استاد ۵' }
      ]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Network error connecting to staff table') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchStaffFromSupabase(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();

    // When query succeeds with 0 rows, must return []
    supabase.from.mockImplementation(() => createMockQuery({ data: [], error: null }));
    const emptyStaffResult = await madrasaCtx.fetchStaffFromSupabase(VALID_UUID);
    expect(emptyStaffResult).toEqual([]);
  });

  it('fetchStaffAttendanceFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_staff_attendance_v1_${VALID_UUID}`, JSON.stringify([
      { id: 'staff-att-1', status: 'present' }
    ]));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch staff attendance') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchStaffAttendanceFromSupabase(VALID_UUID, '2026-09-12')).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchStaffAttendancePendingDate throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_staff_attendance_v1_${VALID_UUID}`, JSON.stringify([
      { id: 'pending-1', status: 'present', check_in: '08:00', check_out: null, date: '2026-09-10' }
    ]));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch pending date') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchStaffAttendancePendingDate(VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchExamMiqdarFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      examMiqdar: [{ id: 'miq-1', term: 'first' }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch exam miqdar') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchExamMiqdarFromSupabase({}, VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fetchExamResultsFromSupabase throws on Supabase error and does NOT return stale local storage', async () => {
    localStorage.setItem(`hf_records_v1_${VALID_UUID}`, JSON.stringify({
      examResults: [{ id: 'res-1', term: 'first', pct: 90 }]
    }));

    supabase.from.mockImplementation(() => createMockQuery({ data: null, error: new Error('Failed to fetch exam results') }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(madrasaCtx.fetchExamResultsFromSupabase({}, VALID_UUID)).rejects.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('preserves intentional local fallback behavior when madrasaId is NOT a valid UUID (offline/mock mode)', async () => {
    localStorage.setItem(`hf_records_v1_${OFFLINE_TENANT}`, JSON.stringify({
      records: [{ id: 'offline-std', name: 'آف لائن طالب علم' }],
      staffProfiles: [{ id: 'offline-staff', name: 'آف لائن استاد' }]
    }));

    const students = await madrasaCtx.fetchStudentsFromSupabase(OFFLINE_TENANT);
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe('آف لائن طالب علم');

    const staff = await madrasaCtx.fetchStaffFromSupabase(OFFLINE_TENANT);
    expect(staff).toHaveLength(1);
    expect(staff[0].name).toBe('آف لائن استاد');

    const classes = await madrasaCtx.fetchClassesFromSupabase(OFFLINE_TENANT);
    expect(classes.length).toBeGreaterThan(0);
  });
});
