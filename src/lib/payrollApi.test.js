import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchStaffSalaries,
  upsertStaffSalaries,
  fetchPayrollSettings,
  upsertPayrollSettings,
  fetchHolidays,
  addHoliday,
  deleteHoliday,
  fetchLeaveOpening,
  upsertLeaveOpening
} from './payrollApi';

const VALID_MADRASA_ID = '11111111-1111-1111-1111-111111111111';
const VALID_STAFF_ID = '22222222-2222-2222-2222-222222222222';
const VALID_HOLIDAY_ID = '33333333-3333-3333-3333-333333333333';

describe('payrollApi Library', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn()
    };
  });

  describe('Validation of madrasaId', () => {
    it('rejects invalid madrasaId across all functions', async () => {
      await expect(fetchStaffSalaries(mockSupabase, 'invalid-id')).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(upsertStaffSalaries(mockSupabase, 'invalid-id', [])).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(fetchPayrollSettings(mockSupabase, 'invalid-id')).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(upsertPayrollSettings(mockSupabase, 'invalid-id', {})).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(fetchHolidays(mockSupabase, 'invalid-id')).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(addHoliday(mockSupabase, 'invalid-id', {})).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(deleteHoliday(mockSupabase, 'invalid-id', VALID_HOLIDAY_ID)).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(fetchLeaveOpening(mockSupabase, 'invalid-id')).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
      await expect(upsertLeaveOpening(mockSupabase, 'invalid-id', [])).rejects.toThrow('نامعتبر ادارہ آئی ڈی');
    });

    it('rejects missing supabase client', async () => {
      await expect(fetchStaffSalaries(null, VALID_MADRASA_ID)).rejects.toThrow('ڈیٹا بیس کلائنٹ دستیاب نہیں ہے');
    });
  });

  describe('Staff Salaries API', () => {
    it('fetchStaffSalaries queries staff_salary with madrasa_id', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        data: [{ staff_id: VALID_STAFF_ID, base_salary: 30000 }],
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq
      });

      const result = await fetchStaffSalaries(mockSupabase, VALID_MADRASA_ID);
      expect(mockSupabase.from).toHaveBeenCalledWith('staff_salary');
      expect(mockEq).toHaveBeenCalledWith('madrasa_id', VALID_MADRASA_ID);
      expect(result).toHaveLength(1);
    });

    it('fetchStaffSalaries throws on database error', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('RLS policy violation')
        })
      });

      await expect(fetchStaffSalaries(mockSupabase, VALID_MADRASA_ID)).rejects.toThrow('RLS policy violation');
    });

    it('upsertStaffSalaries calls upsert with onConflict staff_id', async () => {
      let capturedPayload = null;
      let capturedOptions = null;

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ staff_id: VALID_STAFF_ID, base_salary: 35000 }],
        error: null
      });

      const mockUpsert = vi.fn().mockImplementation((payload, opts) => {
        capturedPayload = payload;
        capturedOptions = opts;
        return { select: mockSelect };
      });

      mockSupabase.from.mockReturnValue({
        upsert: mockUpsert
      });

      const rows = [{ staff_id: VALID_STAFF_ID, base_salary: 35000 }];
      const result = await upsertStaffSalaries(mockSupabase, VALID_MADRASA_ID, rows);

      expect(mockSupabase.from).toHaveBeenCalledWith('staff_salary');
      expect(capturedOptions).toEqual({ onConflict: 'staff_id' });
      expect(capturedPayload).toHaveLength(1);
      expect(capturedPayload[0].staff_id).toBe(VALID_STAFF_ID);
      expect(capturedPayload[0].madrasa_id).toBe(VALID_MADRASA_ID);
      expect(capturedPayload[0].base_salary).toBe(35000);
      expect(result).toHaveLength(1);
    });

    it('upsertStaffSalaries throws when database upsert fails', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Permission denied for relation staff_salary')
          })
        })
      });

      await expect(
        upsertStaffSalaries(mockSupabase, VALID_MADRASA_ID, [{ staff_id: VALID_STAFF_ID, base_salary: 20000 }])
      ).rejects.toThrow('Permission denied for relation staff_salary');
    });
  });

  describe('Payroll Settings API', () => {
    it('fetchPayrollSettings queries payroll_settings and returns data or null', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            madrasa_id: VALID_MADRASA_ID,
            weekly_off_days: [5],
            late_grace_minutes: 10,
            fiscal_year_start_month: 4
          },
          error: null
        })
      });

      const data = await fetchPayrollSettings(mockSupabase, VALID_MADRASA_ID);
      expect(mockSupabase.from).toHaveBeenCalledWith('payroll_settings');
      expect(data.weekly_off_days).toEqual([5]);
      expect(data.late_grace_minutes).toBe(10);
    });

    it('upsertPayrollSettings calls upsert with onConflict madrasa_id', async () => {
      let capturedOptions = null;
      let capturedPayload = null;

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockImplementation((payload, opts) => {
          capturedPayload = payload;
          capturedOptions = opts;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { madrasa_id: VALID_MADRASA_ID, ...payload },
                error: null
              })
            })
          };
        })
      });

      const result = await upsertPayrollSettings(mockSupabase, VALID_MADRASA_ID, {
        weekly_off_days: [0, 5],
        late_grace_minutes: 15,
        early_leave_grace_minutes: 10,
        monthly_leave_accrual: 1.5,
        fiscal_year_start_month: 4
      });

      expect(capturedOptions).toEqual({ onConflict: 'madrasa_id' });
      expect(capturedPayload.weekly_off_days).toEqual([0, 5]);
      expect(capturedPayload.late_grace_minutes).toBe(15);
      expect(result.madrasa_id).toBe(VALID_MADRASA_ID);
    });
  });

  describe('Holidays API', () => {
    it('fetchHolidays applies year filter when year is passed', async () => {
      const mockGte = vi.fn().mockReturnThis();
      const mockLte = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [{ id: VALID_HOLIDAY_ID, holiday_date: '2026-08-14', title: 'یوم آزادی' }],
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          gte: mockGte,
          lte: mockLte,
          order: mockOrder
        })
      });

      const result = await fetchHolidays(mockSupabase, VALID_MADRASA_ID, 2026);
      expect(mockSupabase.from).toHaveBeenCalledWith('holidays');
      expect(mockGte).toHaveBeenCalledWith('holiday_date', '2026-01-01');
      expect(mockLte).toHaveBeenCalledWith('holiday_date', '2026-12-31');
      expect(result).toHaveLength(1);
    });

    it('addHoliday inserts row into holidays table and throws on error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: VALID_HOLIDAY_ID, holiday_date: '2026-05-01', title: 'یوم مزدور' },
              error: null
            })
          })
        })
      });

      const holiday = await addHoliday(mockSupabase, VALID_MADRASA_ID, {
        holiday_date: '2026-05-01',
        title: 'یوم مزدور'
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('holidays');
      expect(holiday.title).toBe('یوم مزدور');
    });

    it('deleteHoliday calls delete with id and madrasa_id and rejects invalid id', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: mockEq1
        })
      });

      const ok = await deleteHoliday(mockSupabase, VALID_MADRASA_ID, VALID_HOLIDAY_ID);
      expect(ok).toBe(true);
      expect(mockEq1).toHaveBeenCalledWith('id', VALID_HOLIDAY_ID);
      expect(mockEq2).toHaveBeenCalledWith('madrasa_id', VALID_MADRASA_ID);

      await expect(deleteHoliday(mockSupabase, VALID_MADRASA_ID, 'invalid-uuid')).rejects.toThrow('نامعتبر تعطیل آئی ڈی');
    });
  });

  describe('Leave Opening API', () => {
    it('fetchLeaveOpening queries staff_leave_opening and filters by fiscal_year_start', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({
        data: [{ staff_id: VALID_STAFF_ID, fiscal_year_start: '2026-04-01', used_days: 2.5 }],
        error: null
      });
      const mockEq1 = vi.fn().mockReturnValue({
        eq: mockEq2
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: mockEq1
      });

      const result = await fetchLeaveOpening(mockSupabase, VALID_MADRASA_ID, '2026-04-01');
      expect(mockSupabase.from).toHaveBeenCalledWith('staff_leave_opening');
      expect(mockEq2).toHaveBeenCalledWith('fiscal_year_start', '2026-04-01');
      expect(result).toHaveLength(1);
    });

    it('upsertLeaveOpening upserts with onConflict staff_id,fiscal_year_start', async () => {
      let capturedOptions = null;
      let capturedPayload = null;

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockImplementation((payload, opts) => {
          capturedPayload = payload;
          capturedOptions = opts;
          return {
            select: vi.fn().mockResolvedValue({
              data: payload,
              error: null
            })
          };
        })
      });

      const rows = [{
        staff_id: VALID_STAFF_ID,
        fiscal_year_start: '2026-04-01',
        used_days: 3.5
      }];

      const res = await upsertLeaveOpening(mockSupabase, VALID_MADRASA_ID, rows);
      expect(capturedOptions).toEqual({ onConflict: 'staff_id,fiscal_year_start' });
      expect(capturedPayload[0].used_days).toBe(3.5);
      expect(res).toHaveLength(1);
    });
  });
});
