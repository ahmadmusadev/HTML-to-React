import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchRuns,
  fetchRunByMonth,
  createDraftRun,
  fetchRunItems,
  saveRunItems,
  deleteRunItemsForStaff,
  fetchMonthAttendance,
  fetchPriorPaidLeave,
  finalizeRun,
  reopenRun,
  deleteDraftRun,
  setItemPayment,
  updateItemNotes
} from './payrollRunsApi';

const VALID_MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const VALID_RUN_ID = '22222222-2222-2222-2222-222222222222';
const VALID_ITEM_ID = '33333333-3333-3333-3333-333333333333';
const VALID_STAFF_ID = '44444444-4444-4444-4444-444444444444';

describe('payrollRunsApi - Data Access & PostgREST Operations', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn()
    };
  });

  describe('madrasaId Validation & UUID Guard', () => {
    it('rejects invalid madrasaId across all API functions', async () => {
      const invalid = 'not-a-uuid';
      await expect(fetchRuns(mockSupabase, invalid)).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(fetchRunByMonth(mockSupabase, invalid, '2026-11-01')).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(createDraftRun(mockSupabase, invalid, '2026-11-01')).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(fetchRunItems(mockSupabase, invalid, VALID_RUN_ID)).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(saveRunItems(mockSupabase, invalid, VALID_RUN_ID, [])).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(deleteRunItemsForStaff(mockSupabase, invalid, VALID_RUN_ID, [VALID_STAFF_ID])).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(fetchMonthAttendance(mockSupabase, invalid, '2026-11')).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(fetchPriorPaidLeave(mockSupabase, invalid, '2026-04-01', '2026-11-01')).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(finalizeRun(mockSupabase, invalid, VALID_RUN_ID)).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(reopenRun(mockSupabase, invalid, VALID_RUN_ID)).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(deleteDraftRun(mockSupabase, invalid, VALID_RUN_ID)).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(setItemPayment(mockSupabase, invalid, VALID_ITEM_ID, { paid: true })).rejects.toThrow('غلط مدرسہ شناختی نمبر');
      await expect(updateItemNotes(mockSupabase, invalid, VALID_ITEM_ID, 'test')).rejects.toThrow('غلط مدرسہ شناختی نمبر');
    });
  });

  describe('createDraftRun', () => {
    it('payload contains ONLY madrasa_id, month, and status="draft"', async () => {
      let insertedPayload = null;
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: VALID_RUN_ID, madrasa_id: VALID_MADRASA_ID, month: '2026-11-01', status: 'draft' },
        error: null
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn((payload) => {
        insertedPayload = payload;
        return { select: mockSelect };
      });

      mockSupabase.from.mockReturnValue({ insert: mockInsert });

      const res = await createDraftRun(mockSupabase, VALID_MADRASA_ID, '2026-11-01');

      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_runs');
      expect(insertedPayload).toEqual({
        madrasa_id: VALID_MADRASA_ID,
        month: '2026-11-01',
        status: 'draft'
      });
      expect(insertedPayload.created_by).toBeUndefined();
      expect(insertedPayload.created_at).toBeUndefined();
      expect(insertedPayload.finalized_at).toBeUndefined();
      expect(res.id).toBe(VALID_RUN_ID);
    });

    it('throws when supabase returns an error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'unique violation', code: '23505' }
            })
          })
        })
      });

      await expect(createDraftRun(mockSupabase, VALID_MADRASA_ID, '2026-11-01')).rejects.toMatchObject({
        code: '23505'
      });
    });
  });

  describe('saveRunItems', () => {
    it('uses onConflict="run_id,staff_id" and whitelists payload', async () => {
      let upsertArgs = null;
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: VALID_ITEM_ID, run_id: VALID_RUN_ID, staff_id: VALID_STAFF_ID }],
        error: null
      });
      const mockUpsert = vi.fn((rows, opts) => {
        upsertArgs = { rows, opts };
        return { select: mockSelect };
      });

      mockSupabase.from.mockReturnValue({ upsert: mockUpsert });

      const rawItems = [
        {
          staff_id: VALID_STAFF_ID,
          base_salary: 30000,
          net_salary: 29000,
          bonus: 1000,
          calculable: true, // Should be stripped
          missing_dates: [] // Should be stripped
        }
      ];

      const res = await saveRunItems(mockSupabase, VALID_MADRASA_ID, VALID_RUN_ID, rawItems);

      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_items');
      expect(upsertArgs.opts).toEqual({ onConflict: 'run_id,staff_id' });
      expect(upsertArgs.rows).toHaveLength(1);
      expect(upsertArgs.rows[0].run_id).toBe(VALID_RUN_ID);
      expect(upsertArgs.rows[0].madrasa_id).toBe(VALID_MADRASA_ID);
      expect(upsertArgs.rows[0].staff_id).toBe(VALID_STAFF_ID);
      expect(upsertArgs.rows[0].calculable).toBeUndefined();
      expect(upsertArgs.rows[0].missing_dates).toBeUndefined();
      expect(res).toHaveLength(1);
    });
  });

  describe('fetchPriorPaidLeave', () => {
    it('filters finalized runs in month range and sums paid_leave_days per staff', async () => {
      // 1. Mock payroll_runs query
      const mockLt = vi.fn().mockResolvedValue({
        data: [
          { id: 'run-101', month: '2026-04-01', status: 'finalized' },
          { id: 'run-102', month: '2026-05-01', status: 'finalized' }
        ],
        error: null
      });
      const mockGte = vi.fn().mockReturnValue({ lt: mockLt });
      const mockEqStatus = vi.fn().mockReturnValue({ gte: mockGte });
      const mockEqMadrasaRuns = vi.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelectRuns = vi.fn().mockReturnValue({ eq: mockEqMadrasaRuns });

      // 2. Mock payroll_items query
      const mockIn = vi.fn().mockResolvedValue({
        data: [
          { staff_id: 't-1', paid_leave_days: 1 },
          { staff_id: 't-2', paid_leave_days: 1.5 },
          { staff_id: 't-1', paid_leave_days: 2 }
        ],
        error: null
      });
      const mockEqMadrasaItems = vi.fn().mockReturnValue({ in: mockIn });
      const mockSelectItems = vi.fn().mockReturnValue({ eq: mockEqMadrasaItems });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'payroll_runs') {
          return { select: mockSelectRuns };
        }
        if (table === 'payroll_items') {
          return { select: mockSelectItems };
        }
        return {};
      });

      const res = await fetchPriorPaidLeave(mockSupabase, VALID_MADRASA_ID, '2026-04-01', '2026-06-01');

      expect(mockEqStatus).toHaveBeenCalledWith('status', 'finalized');
      expect(mockGte).toHaveBeenCalledWith('month', '2026-04-01');
      expect(mockLt).toHaveBeenCalledWith('month', '2026-06-01');
      expect(mockIn).toHaveBeenCalledWith('run_id', ['run-101', 'run-102']);

      expect(res).toEqual({
        't-1': 3,
        't-2': 1.5
      });
    });

    it('returns empty object when no finalized runs match', async () => {
      const mockLt = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockGte = vi.fn().mockReturnValue({ lt: mockLt });
      const mockEqStatus = vi.fn().mockReturnValue({ gte: mockGte });
      const mockEqMadrasaRuns = vi.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelectRuns = vi.fn().mockReturnValue({ eq: mockEqMadrasaRuns });

      mockSupabase.from.mockReturnValue({ select: mockSelectRuns });

      const res = await fetchPriorPaidLeave(mockSupabase, VALID_MADRASA_ID, '2026-04-01', '2026-05-01');
      expect(res).toEqual({});
    });
  });

  describe('finalizeRun & reopenRun', () => {
    it('finalizeRun updates status to "finalized" for draft run and returns single row', async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: VALID_RUN_ID, status: 'finalized' }],
        error: null
      });
      const mockEqDraft = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqMadrasa = vi.fn().mockReturnValue({ eq: mockEqDraft });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqMadrasa });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await finalizeRun(mockSupabase, VALID_MADRASA_ID, VALID_RUN_ID);

      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_runs');
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'finalized' });
      expect(mockEqId).toHaveBeenCalledWith('id', VALID_RUN_ID);
      expect(mockEqMadrasa).toHaveBeenCalledWith('madrasa_id', VALID_MADRASA_ID);
      expect(mockEqDraft).toHaveBeenCalledWith('status', 'draft');
      expect(res.status).toBe('finalized');
    });

    it('finalizeRun throws when no row was updated', async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: mockSelect
              })
            })
          })
        })
      });

      await expect(finalizeRun(mockSupabase, VALID_MADRASA_ID, VALID_RUN_ID)).rejects.toThrow('فائنل کرنے کے دوران کوئی ریکارڈ تبدیل نہیں ہوا');
    });

    it('reopenRun updates status to "draft" for finalized run', async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: VALID_RUN_ID, status: 'draft' }],
        error: null
      });
      const mockEqFinalized = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqMadrasa = vi.fn().mockReturnValue({ eq: mockEqFinalized });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqMadrasa });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqId });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await reopenRun(mockSupabase, VALID_MADRASA_ID, VALID_RUN_ID);

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'draft' });
      expect(mockEqFinalized).toHaveBeenCalledWith('status', 'finalized');
      expect(res.status).toBe('draft');
    });
  });

  describe('setItemPayment', () => {
    it('updates only payment_status and paid_on date when marking paid', async () => {
      let updatePayload = null;
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: VALID_ITEM_ID, payment_status: 'paid', paid_on: '2026-11-05' }],
        error: null
      });
      const mockEqMadrasa = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqMadrasa });
      const mockUpdate = vi.fn((payload) => {
        updatePayload = payload;
        return { eq: mockEqId };
      });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await setItemPayment(mockSupabase, VALID_MADRASA_ID, VALID_ITEM_ID, {
        paid: true,
        paid_on: '2026-11-05'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_items');
      expect(updatePayload).toEqual({
        payment_status: 'paid',
        paid_on: '2026-11-05'
      });
      expect(res.payment_status).toBe('paid');
    });

    it('clears paid_on to null when marking unpaid', async () => {
      let updatePayload = null;
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: VALID_ITEM_ID, payment_status: 'unpaid', paid_on: null }],
        error: null
      });
      const mockEqMadrasa = vi.fn().mockReturnValue({ select: mockSelect });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqMadrasa });
      const mockUpdate = vi.fn((payload) => {
        updatePayload = payload;
        return { eq: mockEqId };
      });

      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      const res = await setItemPayment(mockSupabase, VALID_MADRASA_ID, VALID_ITEM_ID, {
        paid: false
      });

      expect(updatePayload).toEqual({
        payment_status: 'unpaid',
        paid_on: null
      });
      expect(res.payment_status).toBe('unpaid');
    });
  });

  describe('deleteDraftRun', () => {
    it('deletes draft run with status="draft" constraint', async () => {
      const mockEqStatus = vi.fn().mockResolvedValue({ error: null });
      const mockEqMadrasa = vi.fn().mockReturnValue({ eq: mockEqStatus });
      const mockEqId = vi.fn().mockReturnValue({ eq: mockEqMadrasa });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqId });

      mockSupabase.from.mockReturnValue({ delete: mockDelete });

      const res = await deleteDraftRun(mockSupabase, VALID_MADRASA_ID, VALID_RUN_ID);

      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_runs');
      expect(mockEqId).toHaveBeenCalledWith('id', VALID_RUN_ID);
      expect(mockEqStatus).toHaveBeenCalledWith('status', 'draft');
      expect(res).toBe(true);
    });
  });
});

