import { describe, it, expect } from 'vitest';
import {
  formatDays,
  getNumericStaffCode,
  buildSlipData,
  buildReportData,
  rowsForAllSlips
} from './PayrollSlipLogic';

describe('PayrollSlipLogic Pure Utility', () => {
  describe('formatDays', () => {
    it('formats whole and decimal days without trailing zeros', () => {
      expect(formatDays(25)).toBe('25');
      expect(formatDays(25.5)).toBe('25.5');
      expect(formatDays(0)).toBe('0');
      expect(formatDays('26.0')).toBe('26');
      expect(formatDays(25.25)).toBe('25.25');
      expect(formatDays(null)).toBe('0');
      expect(formatDays(undefined)).toBe('0');
      expect(formatDays('')).toBe('0');
    });
  });

  describe('getNumericStaffCode', () => {
    it('extracts number from numeric and alphanumeric staff codes', () => {
      expect(getNumericStaffCode('2')).toBe(2);
      expect(getNumericStaffCode(9)).toBe(9);
      expect(getNumericStaffCode('10')).toBe(10);
      expect(getNumericStaffCode('T-04')).toBe(4);
    });
  });

  describe('buildSlipData fixtures', () => {
    const runFixture = { id: 'run-1', month_date: '2026-07-01', status: 'finalized' };
    const madrasaName = 'جامعہ دارالعلوم';

    // (a) Teacher with no deductions
    it('(a) builds slip data for teacher with no deductions', () => {
      const row = {
        id: 'item-1',
        staff_id: 'staff-1',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        day_rate: 1000,
        shift_minutes: 360,
        minute_rate: 2.78,
        present_days: 30,
        absent_days: 0,
        leave_days_taken: 0,
        paid_leave_days: 0,
        unpaid_leave_days: 0,
        leave_balance_after: 5,
        late_minutes_charged: 0,
        early_minutes_charged: 0,
        absence_deduction: 0,
        unpaid_leave_deduction: 0,
        time_deduction: 0,
        leave_encashment_days: 0,
        leave_encashment_amount: 0,
        bonus: 0,
        advance_deduction: 0,
        other_deduction: 0,
        net_salary: 30000,
        payment_status: 'unpaid',
        paid_on: null,
        notes: ''
      };
      const staff = { id: 'staff-1', name: 'محمد احمد', staff_code: '1' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);

      expect(slip.staff_name).toBe('محمد احمد');
      expect(slip.staff_code).toBe('1');
      expect(slip.base_salary).toBe(30000);
      expect(slip.base_pay_display).toBe(30000);
      expect(slip.total_deductions).toBe(0);
      expect(slip.net_salary).toBe(30000);
      expect(slip.rounding_display).toBe(0);
      expect(slip.show_rounding).toBe(false);
      expect(slip.was_clamped).toBe(false);
      expect(slip.consistent).toBe(true);
      expect(slip.has_encashment).toBe(false);
      expect(slip.has_bonus).toBe(false);
      expect(slip.has_advance).toBe(false);
      expect(slip.has_other).toBe(false);
      expect(slip.has_notes).toBe(false);
      expect(slip.is_paid).toBe(false);
    });

    // (b) Absence only
    it('(b) builds slip data for teacher with absence only', () => {
      const row = {
        id: 'item-2',
        staff_id: 'staff-2',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        day_rate: 1000,
        present_days: 28,
        absent_days: 2,
        absence_deduction: 2000,
        net_salary: 28000,
        payment_status: 'unpaid'
      };
      const staff = { id: 'staff-2', name: 'عبد اللہ', staff_code: '2' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);
      expect(slip.base_pay_display).toBe(30000);
      expect(slip.absence_deduction).toBe(2000);
      expect(slip.net_salary).toBe(28000);
      expect(slip.rounding_display).toBe(0);
      expect(slip.was_clamped).toBe(false);
      expect(slip.consistent).toBe(true);
    });

    // (c) Late/early with one-day cap (time_deduction less than minutes x rate is shown as stored)
    it('(c) preserves stored capped time_deduction without multiplying minutes by rate', () => {
      // 500 minutes at 2.78 would be 1390, but single day cap held it to 1000
      const row = {
        id: 'item-3',
        staff_id: 'staff-3',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        day_rate: 1000,
        shift_minutes: 360,
        minute_rate: 2.78,
        present_days: 30,
        late_minutes_charged: 300,
        early_minutes_charged: 200,
        time_deduction: 1000, // Capped to 1 day's wage
        net_salary: 29000,
        payment_status: 'unpaid'
      };
      const staff = { id: 'staff-3', name: 'قاری بلال', staff_code: '3' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);
      expect(slip.late_minutes_charged).toBe(300);
      expect(slip.early_minutes_charged).toBe(200);
      expect(slip.time_deduction).toBe(1000);
      expect(slip.total_deductions).toBe(1000);
      expect(slip.net_salary).toBe(29000);
      expect(slip.consistent).toBe(true);
    });

    // (d) Half-leave month (present 25.5, leave 0.5)
    it('(d) formats half-days properly (25.5 present, 0.5 leave)', () => {
      const row = {
        id: 'item-4',
        staff_id: 'staff-4',
        base_salary: 26000,
        working_days_in_month: 26,
        payable_working_days: 26,
        present_days: 25.5,
        leave_days_taken: 0.5,
        paid_leave_days: 0.5,
        unpaid_leave_days: 0,
        net_salary: 26000
      };
      const staff = { id: 'staff-4', name: 'مفتی زید', staff_code: '4' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);
      expect(slip.present_days).toBe('25.5');
      expect(slip.leave_days_taken).toBe('0.5');
      expect(slip.paid_leave_days).toBe('0.5');
      expect(slip.unpaid_leave_days).toBe('0');
      expect(slip.consistent).toBe(true);
    });

    // (e) Last fiscal month with leave encashment
    it('(e) includes encashment when leave_encashment_days > 0 and amount > 0', () => {
      const row = {
        id: 'item-5',
        staff_id: 'staff-5',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        leave_encashment_days: 4,
        leave_encashment_amount: 4000,
        net_salary: 34000
      };
      const staff = { id: 'staff-5', name: 'قاری حمزہ', staff_code: '5' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);
      expect(slip.has_encashment).toBe(true);
      expect(slip.leave_encashment_days).toBe(4);
      expect(slip.leave_encashment_amount).toBe(4000);
      expect(slip.net_salary).toBe(34000);
      expect(slip.consistent).toBe(true);
    });

    // (f) Bonus / advance / other present
    it('(f) activates conditional flags when bonus, advance or other deduction exist', () => {
      const row = {
        id: 'item-6',
        staff_id: 'staff-6',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        bonus: 1500,
        advance_deduction: 3000,
        other_deduction: 500,
        net_salary: 28000
      };
      const staff = { id: 'staff-6', name: 'مولانا سعید', staff_code: '6' };

      const slip = buildSlipData(row, staff, runFixture, madrasaName);
      expect(slip.has_bonus).toBe(true);
      expect(slip.bonus).toBe(1500);
      expect(slip.has_advance).toBe(true);
      expect(slip.advance_deduction).toBe(3000);
      expect(slip.has_other).toBe(true);
      expect(slip.other_deduction).toBe(500);
      expect(slip.total_deductions).toBe(3500);
      expect(slip.consistent).toBe(true);
    });

    // (g) Paid and unpaid status
    it('(g) handles paid and unpaid statuses and paid_on date', () => {
      const paidRow = {
        id: 'item-7',
        staff_id: 'staff-7',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        net_salary: 30000,
        payment_status: 'paid',
        paid_on: '2026-08-05'
      };
      const unpaidRow = {
        ...paidRow,
        id: 'item-8',
        payment_status: 'unpaid',
        paid_on: null
      };

      const paidSlip = buildSlipData(paidRow, { name: 'عمران' }, runFixture, madrasaName);
      expect(paidSlip.is_paid).toBe(true);
      expect(paidSlip.paid_on).toBe('2026-08-05');
      expect(paidSlip.payment_status_urdu).toBe('ادا شدہ');

      const unpaidSlip = buildSlipData(unpaidRow, { name: 'عمران' }, runFixture, madrasaName);
      expect(unpaidSlip.is_paid).toBe(false);
      expect(unpaidSlip.paid_on).toBeNull();
      expect(unpaidSlip.payment_status_urdu).toBe('غیر ادا شدہ');
    });

    // (h) Notes present and empty
    it('(h) exposes notes only when non-empty', () => {
      const withNotes = {
        id: 'item-9',
        staff_id: 'staff-9',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        net_salary: 30000,
        notes: 'خاص بونس برائے عید'
      };
      const withoutNotes = {
        ...withNotes,
        notes: '   '
      };

      const slip1 = buildSlipData(withNotes, { name: 'زبیر' }, runFixture, madrasaName);
      expect(slip1.has_notes).toBe(true);
      expect(slip1.notes).toBe('خاص بونس برائے عید');

      const slip2 = buildSlipData(withoutNotes, { name: 'زبیر' }, runFixture, madrasaName);
      expect(slip2.has_notes).toBe(false);
      expect(slip2.notes).toBe('');
    });

    // Rounding display and corruption check
    it('keeps rounding_display within +-1 for valid fixtures and flags corruption as consistent=false', () => {
      // 30000 / 26 * 26 = 30000
      // 1 day absence = 1153.85
      // net_before_rounding = 30000 - 1153.85 = 28846.15 -> rounded = 28846
      // rounding_display = 28846 - (30000 - 1153.85) = -0.15
      const validRow = {
        id: 'item-10',
        staff_id: 'staff-10',
        base_salary: 30000,
        working_days_in_month: 26,
        payable_working_days: 26,
        absence_deduction: 1153.85,
        net_salary: 28846
      };
      const validSlip = buildSlipData(validRow, {}, runFixture, madrasaName);
      expect(validSlip.rounding_display).toBe(-0.15);
      expect(Math.abs(validSlip.rounding_display)).toBeLessThanOrEqual(1);
      expect(validSlip.show_rounding).toBe(true);
      expect(validSlip.consistent).toBe(true);

      // Corrupted row (tampered net_salary)
      const corruptedRow = {
        ...validRow,
        net_salary: 35000 // Inconsistent with base 30000 and 1 day absence
      };
      const corruptedSlip = buildSlipData(corruptedRow, {}, runFixture, madrasaName);
      expect(corruptedSlip.consistent).toBe(false);
    });

    // Fix 1: Clamped Teacher Tests
    describe('Clamped Teacher (Fix 1)', () => {
      it('all-absent + advance 5000 fixture prints with was_clamped=true and consistent=true', () => {
        const clampedRow = {
          id: 'item-clamped',
          staff_id: 'staff-clamped',
          base_salary: 30000,
          working_days_in_month: 30,
          payable_working_days: 30,
          absent_days: 30,
          absence_deduction: 30000,
          advance_deduction: 5000,
          net_salary: 0
        };
        const staff = { id: 'staff-clamped', name: 'استاذ معذور', staff_code: '15' };

        const slip = buildSlipData(clampedRow, staff, runFixture, madrasaName);
        expect(slip.computed_net).toBe(-5000);
        expect(slip.was_clamped).toBe(true);
        expect(slip.consistent).toBe(true);
        expect(slip.show_rounding).toBe(false);
        expect(slip.clamped_message_urdu).toBe('کٹوتیاں قابل ادائیگی رقم سے زیادہ تھیں، خالص تنخواہ صفر کی گئی');
      });

      it('tampered non-zero net still blocks when computed_net is negative', () => {
        const tamperedRow = {
          id: 'item-tampered-nonzero',
          staff_id: 'staff-bad',
          base_salary: 30000,
          working_days_in_month: 30,
          payable_working_days: 30,
          absent_days: 30,
          absence_deduction: 30000,
          advance_deduction: 5000,
          net_salary: 2000 // Tampered: should be 0 (clamped), but non-zero given
        };
        const slip = buildSlipData(tamperedRow, {}, runFixture, madrasaName);
        expect(slip.computed_net).toBe(-5000);
        expect(slip.was_clamped).toBe(false);
        expect(slip.consistent).toBe(false);
      });

      it('net 0 with positive computed_net still blocks as inconsistent', () => {
        const tamperedZeroRow = {
          id: 'item-tampered-zero',
          staff_id: 'staff-zero',
          base_salary: 30000,
          working_days_in_month: 30,
          payable_working_days: 30,
          net_salary: 0 // Tampered: computed net is 30000, but net_salary entered as 0
        };
        const slip = buildSlipData(tamperedZeroRow, {}, runFixture, madrasaName);
        expect(slip.computed_net).toBe(30000);
        expect(slip.was_clamped).toBe(false);
        expect(slip.consistent).toBe(false);
      });
    });

    // Fix 5: Labels (Urdu only)
    it('contains updated Urdu labels without Latin letters', () => {
      const row = {
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        net_salary: 30000,
        payment_status: 'paid',
        paid_on: '2026-08-01'
      };
      const slip = buildSlipData(row, { name: 'استاذ', staff_code: '1' }, runFixture, 'مدرسہ');

      expect(slip.base_pay_title_urdu).toBe('قابل ادائیگی ایام کی تنخواہ');
      expect(slip.late_minutes_label_urdu).toBe('تاخیر کے قابل کٹوتی منٹ');
      expect(slip.early_minutes_label_urdu).toBe('جلدی روانگی کے قابل کٹوتی منٹ');
      expect(slip.rounding_label_urdu).toBe('روپے کی گول بندی');

      const allLabels = [
        slip.title_urdu,
        slip.attendance_section_title,
        slip.time_section_title,
        slip.earnings_section_title,
        slip.deductions_section_title,
        slip.base_pay_title_urdu,
        slip.late_minutes_label_urdu,
        slip.early_minutes_label_urdu,
        slip.rounding_label_urdu,
        slip.payment_status_urdu
      ];

      for (const label of allLabels) {
        expect(label).toBeTruthy();
        expect(/[a-zA-Z]/.test(label)).toBe(false);
      }
    });
  });

  describe('buildReportData & rowsForAllSlips', () => {
    const runFixture = { id: 'run-1', month_date: '2026-07-01', status: 'finalized' };
    const staffListFixture = [
      { id: 's-10', staff_code: '10', name: 'استاذ دس' },
      { id: 's-2', staff_code: '2', name: 'استاذ دو' },
      { id: 's-9', staff_code: '9', name: 'استاذ نو' }
    ];

    const rowsFixture = [
      {
        id: 'r-10',
        staff_id: 's-10',
        base_salary: 30000,
        working_days_in_month: 30,
        payable_working_days: 30,
        absence_deduction: 0,
        unpaid_leave_deduction: 0,
        time_deduction: 0,
        bonus: 500,
        advance_deduction: 0,
        other_deduction: 0,
        net_salary: 30500,
        payment_status: 'paid'
      },
      {
        id: 'r-2',
        staff_id: 's-2',
        base_salary: 25000,
        working_days_in_month: 30,
        payable_working_days: 30,
        absence_deduction: 1000,
        unpaid_leave_deduction: 0,
        time_deduction: 200,
        bonus: 0,
        advance_deduction: 500,
        other_deduction: 0,
        net_salary: 23300,
        payment_status: 'unpaid'
      },
      {
        id: 'r-9',
        staff_id: 's-9',
        base_salary: 28000,
        working_days_in_month: 30,
        payable_working_days: 30,
        absence_deduction: 0,
        unpaid_leave_deduction: 500,
        time_deduction: 0,
        bonus: 0,
        advance_deduction: 0,
        other_deduction: 300,
        net_salary: 27200,
        payment_status: 'paid'
      }
    ];

    it('sorts staff codes 2, 9, 10 numerically in ascending order', () => {
      const report = buildReportData(rowsFixture, staffListFixture, runFixture);
      const sortedCodes = report.rows.map((r) => r.staff_code);
      expect(sortedCodes).toEqual(['2', '9', '10']);

      const slipsSorted = rowsForAllSlips(rowsFixture, staffListFixture);
      expect(slipsSorted.map((r) => r.staff_code)).toEqual(['2', '9', '10']);
    });

    it('calculates totals equal to row sums and individual slips net_salary', () => {
      const report = buildReportData(rowsFixture, staffListFixture, runFixture);
      expect(report.totals.teachers_count).toBe(3);
      expect(report.totals.base_salary_total).toBe(83000);
      expect(report.totals.absence_total).toBe(1000);
      expect(report.totals.unpaid_leave_total).toBe(500);
      expect(report.totals.time_total).toBe(200);
      expect(report.totals.bonus_total).toBe(500);
      expect(report.totals.advance_total).toBe(500);
      expect(report.totals.other_total).toBe(300);
      expect(report.totals.deductions_total).toBe(2500);
      expect(report.totals.net_total).toBe(81000);
      expect(report.totals.paid_total).toBe(57700);
      expect(report.totals.unpaid_total).toBe(23300);
      expect(report.totals.paid_count).toBe(2);

      // Grand total equals sum of individual slips net_salary
      const sumIndividualNets = rowsFixture.reduce((acc, r) => acc + r.net_salary, 0);
      expect(report.totals.net_total).toBe(sumIndividualNets);
      expect(report.consistent).toBe(true);
      expect(report.inconsistent_staff_names).toEqual([]);
    });

    // Fix 2: Report consistency test
    it('flips report.consistent to false and lists affected staff name when a row is tampered', () => {
      const validReport = buildReportData(rowsFixture, staffListFixture, runFixture);
      expect(validReport.consistent).toBe(true);
      expect(validReport.inconsistent_staff_names).toEqual([]);

      // Tamper row for استاذ دو (s-2)
      const tamperedRows = rowsFixture.map((r) => {
        if (r.staff_id === 's-2') {
          return {
            ...r,
            net_salary: 99999 // Corrupted figure
          };
        }
        return r;
      });

      const corruptedReport = buildReportData(tamperedRows, staffListFixture, runFixture);
      expect(corruptedReport.consistent).toBe(false);
      expect(corruptedReport.inconsistent_staff_names).toContain('استاذ دو');
    });

    it('counts clamped rows as consistent in buildReportData', () => {
      const staffListWithClamped = [
        ...staffListFixture,
        { id: 's-clamped', staff_code: '12', name: 'استاذ معذور' }
      ];
      const rowsWithClamped = [
        ...rowsFixture,
        {
          id: 'r-clamped',
          staff_id: 's-clamped',
          base_salary: 20000,
          working_days_in_month: 30,
          payable_working_days: 30,
          absent_days: 30,
          absence_deduction: 20000,
          advance_deduction: 3000,
          net_salary: 0,
          payment_status: 'unpaid'
        }
      ];

      const report = buildReportData(rowsWithClamped, staffListWithClamped, runFixture);
      expect(report.consistent).toBe(true);
      expect(report.inconsistent_staff_names).toEqual([]);
    });
  });
});
