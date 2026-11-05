import { describe, it, expect } from 'vitest';
import {
  isoMonthToRunDate,
  runDateToIsoMonth,
  monthLabelUrdu,
  dateLabelUrdu,
  localTodayIso,
  formatRupees,
  canCreateRunForMonth,
  buildAdjustments,
  PAYROLL_ITEM_COLUMNS,
  itemToRow,
  rowToDisplayItem,
  findDrift,
  getFinalizeBlockers,
  totalsFromRows,
  toUrduRunError
} from './PayrollRunLogic';

describe('PayrollRunLogic - Pure Helpers & Business Logic', () => {
  describe('Month and Date Helpers', () => {
    it('converts iso month to run date', () => {
      expect(isoMonthToRunDate('2026-11')).toBe('2026-11-01');
      expect(isoMonthToRunDate('2025-04')).toBe('2025-04-01');
      expect(() => isoMonthToRunDate('invalid')).toThrow(TypeError);
      expect(() => isoMonthToRunDate('2026-13')).toThrow(TypeError);
    });

    it('converts run date to iso month', () => {
      expect(runDateToIsoMonth('2026-11-01')).toBe('2026-11');
      expect(runDateToIsoMonth('2026-11-25')).toBe('2026-11');
      expect(() => runDateToIsoMonth('invalid')).toThrow(TypeError);
    });

    it('generates Urdu month label correctly', () => {
      expect(monthLabelUrdu('2026-11')).toBe('نومبر 2026');
      expect(monthLabelUrdu('2026-04')).toBe('اپریل 2026');
      expect(monthLabelUrdu('2027-01')).toBe('جنوری 2027');
      expect(monthLabelUrdu('invalid')).toBe('');
    });

    it('generates Urdu date label correctly', () => {
      expect(dateLabelUrdu('2026-11-05')).toBe('5 نومبر 2026');
      expect(dateLabelUrdu('2026-01-15')).toBe('15 جنوری 2026');
      expect(dateLabelUrdu('invalid')).toBe('');
    });

    it('formats local Date to YYYY-MM-DD via local getters', () => {
      const d = new Date(2026, 10, 5); // Month 10 is November in 0-indexed Date
      expect(localTodayIso(d)).toBe('2026-11-05');
      expect(() => localTodayIso(null)).toThrow(TypeError);
    });

    it('formats rupees with thousands separators and Urdu suffix', () => {
      expect(formatRupees(10000)).toBe('10,000 روپے');
      expect(formatRupees(2500000)).toBe('2,500,000 روپے');
      expect(formatRupees(0)).toBe('0 روپے');
    });
  });

  describe('canCreateRunForMonth', () => {
    const todayMonth = '2026-12';

    it('rejects future months', () => {
      const res = canCreateRunForMonth({
        month: '2027-01',
        fiscalStartMonth: 4,
        runs: [],
        todayMonth: '2026-12'
      });
      expect(res.allowed).toBe(false);
      expect(res.reasonUrdu).toBe('مستقبل کے مہینے کا پے رول نہیں بنایا جا سکتا۔');
    });

    it('allows opening an already existing run for that month', () => {
      const runs = [
        { id: 'run-1', month: '2026-11-01', status: 'draft' }
      ];
      const res = canCreateRunForMonth({
        month: '2026-11',
        fiscalStartMonth: 4,
        runs,
        todayMonth
      });
      expect(res.allowed).toBe(true);
      expect(res.reasonUrdu).toBe('');
    });

    it('allows any month if NO finalized runs exist in the fiscal year', () => {
      const runs = [
        { id: 'run-0', month: '2025-05-01', status: 'finalized' } // Previous fiscal year
      ];
      const res = canCreateRunForMonth({
        month: '2026-08',
        fiscalStartMonth: 4,
        runs,
        todayMonth
      });
      expect(res.allowed).toBe(true);
      expect(res.reasonUrdu).toBe('');
    });

    it('allows strictly the month after the latest finalized month in the same fiscal year', () => {
      const runs = [
        { id: 'run-1', month: '2026-11-01', status: 'finalized' }
      ];

      // Next month (2026-12) is allowed
      const resNext = canCreateRunForMonth({
        month: '2026-12',
        fiscalStartMonth: 4,
        runs,
        todayMonth: '2026-12'
      });
      expect(resNext.allowed).toBe(true);

      // Earlier month (2026-10) is rejected
      const resEarlier = canCreateRunForMonth({
        month: '2026-10',
        fiscalStartMonth: 4,
        runs,
        todayMonth: '2026-12'
      });
      expect(resEarlier.allowed).toBe(false);
      expect(resEarlier.reasonUrdu).toBe('اس مہینے یا اس کے بعد کا پے رول پہلے ہی فائنل ہو چکا ہے۔');

      // Gap month (2027-01) is rejected
      const resGap = canCreateRunForMonth({
        month: '2027-01',
        fiscalStartMonth: 4,
        runs,
        todayMonth: '2027-02'
      });
      expect(resGap.allowed).toBe(false);
      expect(resGap.reasonUrdu).toContain('درمیانی مہینوں کو چھوڑ کر پے رول نہیں بنایا جا سکتا');
    });

    it('starts fresh for a new fiscal year (e.g. 2027-04 for fiscal start 4)', () => {
      const runs = [
        { id: 'run-1', month: '2026-11-01', status: 'finalized' }
      ];
      // Month in the next fiscal year
      const res = canCreateRunForMonth({
        month: '2027-04',
        fiscalStartMonth: 4,
        runs,
        todayMonth: '2027-05'
      });
      expect(res.allowed).toBe(true);
      expect(res.reasonUrdu).toBe('');
    });
  });

  describe('itemToRow & Column Whitelist', () => {
    it('strictly outputs only allowed columns with numeric values and no engine extra keys', () => {
      const engineItem = {
        staff_id: 'teacher-1',
        staff_code: '101',
        staff_name: 'استاد احمد',
        base_salary: 35000,
        working_days_in_month: 26,
        payable_working_days: 26,
        day_rate: 1346.1538,
        shift_minutes: 360,
        minute_rate: 3.739316,
        present_days: 24,
        absent_days: 1,
        leave_days_taken: 1,
        paid_leave_days: 1,
        unpaid_leave_days: 0,
        leave_balance_after: 5.5,
        late_minutes_charged: 30,
        early_minutes_charged: 15,
        absence_deduction: 1346.15,
        unpaid_leave_deduction: 0,
        time_deduction: 168.27,
        leave_encashment_days: 0,
        leave_encashment_amount: 0,
        bonus: 1000,
        advance_deduction: 500,
        other_deduction: 200,
        net_salary: 33785.58,
        // Engine-only keys that MUST NOT be in row payload:
        calculable: true,
        is_complete: true,
        missing_dates: [],
        was_clamped: false,
        rounding_adjustment: 0.01,
        invalid_rows: [],
        warnings: []
      };

      const row = itemToRow(engineItem, 'run-123', 'madrasa-456', {}, 'نوٹ');

      // Verify every key in row is in PAYROLL_ITEM_COLUMNS
      for (const k of Object.keys(row)) {
        expect(PAYROLL_ITEM_COLUMNS).toContain(k);
      }

      // Verify engine keys are NOT present
      expect(row.calculable).toBeUndefined();
      expect(row.is_complete).toBeUndefined();
      expect(row.missing_dates).toBeUndefined();
      expect(row.was_clamped).toBeUndefined();
      expect(row.warnings).toBeUndefined();

      // Verify values
      expect(row.run_id).toBe('run-123');
      expect(row.madrasa_id).toBe('madrasa-456');
      expect(row.staff_id).toBe('teacher-1');
      expect(row.base_salary).toBe(35000);
      expect(row.notes).toBe('نوٹ');
      expect(row.payment_status).toBe('unpaid');
    });
  });

  describe('findDrift', () => {
    const stored = [
      {
        staff_id: 't-1',
        net_salary: 30000,
        absence_deduction: 0,
        unpaid_leave_deduction: 0,
        time_deduction: 0,
        paid_leave_days: 0,
        unpaid_leave_days: 0,
        present_days: 26,
        absent_days: 0,
        leave_encashment_amount: 0
      }
    ];

    it('returns no drift when stored and fresh items are identical', () => {
      const fresh = [
        {
          staff_id: 't-1',
          net_salary: 30000,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          present_days: 26,
          absent_days: 0,
          leave_encashment_amount: 0
        }
      ];
      const res = findDrift(stored, fresh);
      expect(res.hasDrift).toBe(false);
      expect(res.changedStaffIds).toHaveLength(0);
    });

    it('detects drift when attendance or salary numbers change beyond tolerance', () => {
      const fresh = [
        {
          staff_id: 't-1',
          net_salary: 28500, // Changed
          absence_deduction: 1500, // Changed
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          paid_leave_days: 0,
          unpaid_leave_days: 0,
          present_days: 25,
          absent_days: 1,
          leave_encashment_amount: 0
        }
      ];
      const res = findDrift(stored, fresh);
      expect(res.hasDrift).toBe(true);
      expect(res.changedStaffIds).toContain('t-1');
    });

    it('detects drift when teacher is added or removed', () => {
      const fresh = [
        ...stored,
        {
          staff_id: 't-2',
          net_salary: 25000
        }
      ];
      const res = findDrift(stored, fresh);
      expect(res.hasDrift).toBe(true);
      expect(res.changedStaffIds).toContain('t-2');
    });
  });

  describe('getFinalizeBlockers', () => {
    it('blocks when zero items exist', () => {
      const blockers = getFinalizeBlockers({
        engineResult: { items: [], not_calculable: [] }
      });
      expect(blockers).toHaveLength(1);
      expect(blockers[0].code).toBe('NO_ITEMS');
      expect(blockers[0].message).toBe('پے رول میں کوئی استاد شامل نہیں ہے۔');
    });

    it('blocks when an item has incomplete attendance', () => {
      const engineResult = {
        items: [
          {
            staff_id: 't-1',
            staff_name: 'محمد عثمان',
            is_complete: false,
            missing_dates: ['2026-11-04', '2026-11-05']
          }
        ],
        not_calculable: []
      };
      const blockers = getFinalizeBlockers({ engineResult });
      expect(blockers).toHaveLength(1);
      expect(blockers[0].code).toBe('INCOMPLETE_ATTENDANCE');
      expect(blockers[0].message).toContain('محمد عثمان');
      expect(blockers[0].message).toContain('4 نومبر 2026');
      expect(blockers[0].message).toContain('5 نومبر 2026');
    });

    it('blocks for not_calculable teachers with no_salary or other critical errors', () => {
      const engineResult = {
        items: [{ staff_id: 't-1', is_complete: true }],
        not_calculable: [
          {
            staff_id: 't-2',
            staff_name: 'استاد بلال',
            reasons: ['no_salary']
          }
        ]
      };
      const blockers = getFinalizeBlockers({ engineResult });
      expect(blockers).toHaveLength(1);
      expect(blockers[0].code).toBe('NO_SALARY');
      expect(blockers[0].message).toContain('استاد بلال');
    });

    it('silently ignores teachers whose only reason is not_started', () => {
      const engineResult = {
        items: [{ staff_id: 't-1', is_complete: true }],
        not_calculable: [
          {
            staff_id: 't-3',
            staff_name: 'مستقبل کا استاد',
            reasons: ['not_started']
          }
        ]
      };
      const blockers = getFinalizeBlockers({ engineResult });
      expect(blockers).toHaveLength(0);
    });
  });

  describe('totalsFromRows', () => {
    it('aggregates totals accurately', () => {
      const rows = [
        {
          net_salary: 30000,
          absence_deduction: 1000,
          unpaid_leave_deduction: 500,
          time_deduction: 200,
          advance_deduction: 300,
          other_deduction: 100,
          payment_status: 'paid'
        },
        {
          net_salary: 20000,
          absence_deduction: 0,
          unpaid_leave_deduction: 0,
          time_deduction: 0,
          advance_deduction: 0,
          other_deduction: 0,
          payment_status: 'unpaid'
        }
      ];

      const totals = totalsFromRows(rows);
      expect(totals.teachers_count).toBe(2);
      expect(totals.net_total).toBe(50000);
      expect(totals.deductions_total).toBe(2100);
      expect(totals.paid_total).toBe(30000);
      expect(totals.unpaid_total).toBe(20000);
      expect(totals.paid_count).toBe(1);
    });
  });

  describe('toUrduRunError', () => {
    const assertNoLatin = (text) => {
      expect(/[a-zA-Z]/.test(text)).toBe(false);
    };

    it('maps trigger and database errors to Urdu with zero Latin letters', () => {
      const testCases = [
        { err: { message: 'Finalized payroll runs cannot be deleted' }, expectedPart: 'فائنل شدہ' },
        { err: { message: 'Payroll items of a finalized run are locked' }, expectedPart: 'مقفل' },
        { err: { message: 'earlier month is still in draft' }, expectedPart: 'پچھلے مہینوں' },
        { err: { message: 'Cannot reopen finalized run with paid items' }, expectedPart: 'ادائیگی' },
        { err: { message: 'Only the latest finalized month can be reopened' }, expectedPart: 'سب سے آخری' },
        { err: { message: 'Payment can only be recorded for finalized payroll runs' }, expectedPart: 'ادائیگی' },
        { err: { code: '23505', message: 'duplicate key value violates unique constraint' }, expectedPart: 'پہلے سے موجود' },
        { err: new Error('Some random unknown internal db failure xyz'), expectedPart: 'مسئلہ' },
        { err: { message: 'Raw English exception with Latin letters' }, expectedPart: 'براہ کرم' }
      ];

      for (const tc of testCases) {
        const urdu = toUrduRunError(tc.err);
        expect(urdu).toContain(tc.expectedPart);
        assertNoLatin(urdu);
      }
    });
  });
});
