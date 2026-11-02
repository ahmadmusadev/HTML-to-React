import { describe, it, expect } from 'vitest';
import {
  calculateStaffPayroll,
  calculateMonthlyPayroll,
  getMonthDates,
  getWeekday,
  getWorkingDates,
  getFiscalContext,
  roundHalfUp,
  PAYROLL_REASON_URDU
} from './PayrollCalc';

/**
 * Helper to deep-freeze objects for immutability testing.
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

/**
 * Standard test defaults as specified in the prompt:
 * Settings: weekly_off_days: [5] (Friday), late_grace: 0, early_grace: 0,
 *           monthly_accrual: 1.5, fiscal_year_start: 4 (April)
 * Shift: 06:50 - 14:45 (475 min)
 * Base: 30000
 * Month: '2026-11' (Nov 1 is Sunday; Fridays 6, 13, 20, 27; 26 working days)
 */
const DEFAULT_SETTINGS = {
  weekly_off_days: [5],
  late_grace_minutes: 0,
  early_leave_grace_minutes: 0,
  monthly_leave_accrual: 1.5,
  fiscal_year_start_month: 4
};

const DEFAULT_STAFF = {
  id: 'staff-uuid-1',
  staff_code: 101,
  name: 'مولانا عبد اللہ',
  joining_date: '2025-01-01',
  shift_start: '06:50',
  shift_end: '14:45'
};

function makeCompleteAttendance(month = '2026-11', weeklyOff = [5], holidays = []) {
  const dates = getWorkingDates(month, weeklyOff, holidays);
  return dates.map(date => ({
    date,
    status: 'present',
    late_minutes: 0,
    early_leave_minutes: 0
  }));
}

describe('PayrollCalc Engine', () => {
  // Unit tests for individual exported pure helpers
  it('Helper getMonthDates and getWeekday work deterministically with integer arithmetic', () => {
    const novDates = getMonthDates('2026-11');
    expect(novDates.length).toBe(30);
    expect(novDates[0]).toBe('2026-11-01');
    expect(novDates[29]).toBe('2026-11-30');

    // Leap year check
    const leapDates = getMonthDates('2024-02');
    expect(leapDates.length).toBe(29);
    const nonLeapDates = getMonthDates('2025-02');
    expect(nonLeapDates.length).toBe(28);

    // Weekdays
    expect(getWeekday('2026-11-01')).toBe(0); // Sunday
    expect(getWeekday('2026-11-02')).toBe(1); // Monday
    expect(getWeekday('2026-11-06')).toBe(5); // Friday
    expect(getWeekday('2026-11-07')).toBe(6); // Saturday
  });

  it('Helper roundHalfUp behaves half-up and eliminates floating point noise', () => {
    expect(roundHalfUp(2.5, 0)).toBe(3);
    expect(roundHalfUp(2.4, 0)).toBe(2);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(1.004, 2)).toBe(1.00);
    expect(roundHalfUp(-2.5, 0)).toBe(-3);
  });

  // Case 1: Complete attendance
  it('Case 1: Complete attendance yields net_salary 30000, is_complete true, present_days 26', () => {
    const attendance = makeCompleteAttendance('2026-11');
    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      holidays: [],
      attendance,
      leave_opening_used_days: 0,
      prior_paid_leave_days: 0,
      adjustments: { bonus: 0, advance_deduction: 0, other_deduction: 0 }
    });

    expect(res.calculable).toBe(true);
    expect(res.net_salary).toBe(30000);
    expect(res.is_complete).toBe(true);
    expect(res.present_days).toBe(26);
    expect(res.absent_days).toBe(0);
    expect(res.working_days_in_month).toBe(26);
    expect(res.payable_working_days).toBe(26);
    expect(res.day_rate).toBe(1153.8462);
    expect(res.minute_rate).toBe(2.42915);
  });

  // Case 2: One absent day
  it('Case 2: One absent day (Nov 2) -> absent_days 1, present_days 25, absence_deduction 1153.85, net_salary 28846', () => {
    const attendance = makeCompleteAttendance('2026-11').map(row => {
      if (row.date === '2026-11-02') {
        return { ...row, status: 'absent' };
      }
      return row;
    });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.calculable).toBe(true);
    expect(res.absent_days).toBe(1);
    expect(res.present_days).toBe(25);
    expect(res.absence_deduction).toBe(1153.85);
    expect(res.net_salary).toBe(28846);
  });

  // Case 3: Late minutes and grace
  it('Case 3: One present day with 25 late minutes with grace 0 and grace 10', () => {
    // Grace 0
    const attGrace0 = makeCompleteAttendance('2026-11').map(row => {
      if (row.date === '2026-11-02') {
        return { ...row, late_minutes: 25 };
      }
      return row;
    });

    const res0 = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: { ...DEFAULT_SETTINGS, late_grace_minutes: 0 },
      attendance: attGrace0
    });

    expect(res0.late_minutes_charged).toBe(25);
    expect(res0.time_deduction).toBe(60.73);
    expect(res0.net_salary).toBe(29939);

    // Grace 10
    const res10 = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: { ...DEFAULT_SETTINGS, late_grace_minutes: 10 },
      attendance: attGrace0
    });

    expect(res10.late_minutes_charged).toBe(15);
    expect(res10.time_deduction).toBe(36.44);
    expect(res10.net_salary).toBe(29964);
  });

  // Case 4: Leave allocation
  it('Case 4: 3 full leave days, opening used 10, prior paid 0 -> accrued 12, available 2, paid 2, unpaid 1, net 28846, balance 0', () => {
    const leaveDates = new Set(['2026-11-02', '2026-11-03', '2026-11-04']);
    const attendance = makeCompleteAttendance('2026-11').map(row => {
      if (leaveDates.has(row.date)) {
        return { ...row, status: 'leave' };
      }
      return row;
    });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance,
      leave_opening_used_days: 10,
      prior_paid_leave_days: 0
    });

    expect(res.accrued_leave_to_date).toBe(12);
    expect(res.available_leave_before).toBe(2);
    expect(res.paid_leave_days).toBe(2);
    expect(res.unpaid_leave_days).toBe(1);
    expect(res.unpaid_leave_deduction).toBe(1153.85);
    expect(res.net_salary).toBe(28846);
    expect(res.leave_balance_after).toBe(0);
  });

  // Case 5: Half leave with early leave
  it('Case 5: 25 present + 1 half_leave with early_leave_minutes 30 -> present 25.5, taken 0.5, paid 0.5, time_deduction 72.87, net 29927', () => {
    const attendance = makeCompleteAttendance('2026-11').map(row => {
      if (row.date === '2026-11-02') {
        return { ...row, status: 'half_leave', early_leave_minutes: 30 };
      }
      return row;
    });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.present_days).toBe(25.5);
    expect(res.leave_days_taken).toBe(0.5);
    expect(res.paid_leave_days).toBe(0.5);
    expect(res.time_deduction).toBe(72.87);
    expect(res.net_salary).toBe(29927);
  });

  // Case 6: Fiscal year end and leave encashment
  it('Case 6: Fiscal year end month 2027-03 -> 27 working days, base 27000 (day_rate 1000), 26 present + 1 leave, encashment 3 days = 3000, net 30000', () => {
    const dates = getWorkingDates('2027-03', [5], []);
    expect(dates.length).toBe(27);

    // 26 present + 1 leave (Mar 2)
    const attendance = dates.map(d => ({
      date: d,
      status: d === '2027-03-02' ? 'leave' : 'present',
      late_minutes: 0,
      early_leave_minutes: 0
    }));

    const res = calculateStaffPayroll({
      month: '2027-03',
      staff: DEFAULT_STAFF,
      base_salary: 27000,
      settings: DEFAULT_SETTINGS,
      attendance,
      leave_opening_used_days: 10,
      prior_paid_leave_days: 4
    });

    expect(res.accrued_leave_to_date).toBe(18);
    expect(res.available_leave_before).toBe(4);
    expect(res.paid_leave_days).toBe(1);
    expect(res.leave_balance_after).toBe(3);
    expect(res.is_last_month_of_fiscal_year).toBe(true);
    expect(res.leave_encashment_days).toBe(3);
    expect(res.leave_encashment_amount).toBe(3000);
    expect(res.net_salary).toBe(30000);
  });

  // Case 7: Holidays
  it('Case 7: Holiday on Monday Nov 9 reduces working days to 25 (day_rate 1200); Holiday on Friday Nov 6 leaves it at 26', () => {
    const datesMonHoliday = getWorkingDates('2026-11', [5], ['2026-11-09']);
    expect(datesMonHoliday.length).toBe(25);

    const att25 = datesMonHoliday.map(d => ({
      date: d,
      status: 'present',
      late_minutes: 0,
      early_leave_minutes: 0
    }));

    const resMon = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      holidays: ['2026-11-09'],
      attendance: att25
    });

    expect(resMon.working_days_in_month).toBe(25);
    expect(resMon.day_rate).toBe(1200);
    expect(resMon.net_salary).toBe(30000);

    // Holiday on Friday Nov 6 (already weekly off)
    const datesFriHoliday = getWorkingDates('2026-11', [5], ['2026-11-06']);
    expect(datesFriHoliday.length).toBe(26);

    const resFri = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      holidays: ['2026-11-06'],
      attendance: makeCompleteAttendance('2026-11')
    });
    expect(resFri.working_days_in_month).toBe(26);
  });

  // Case 8: Mid-month Joiner
  it('Case 8: Joiner with joining_date 2026-11-16 -> payable_working_days 13, base_pay 15000, net 15000, accrued 1.5, ignored_rows 1', () => {
    const dates = getWorkingDates('2026-11', [5], []);
    // Include 13 payable days plus an extra row on Nov 10 before joining
    const attendance = dates
      .filter(d => d >= '2026-11-16')
      .map(d => ({ date: d, status: 'present', late_minutes: 0, early_leave_minutes: 0 }));
    attendance.push({ date: '2026-11-10', status: 'present', late_minutes: 0, early_leave_minutes: 0 });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: { ...DEFAULT_STAFF, joining_date: '2026-11-16' },
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.payable_working_days).toBe(13);
    expect(res.base_pay).toBe(15000);
    expect(res.net_salary).toBe(15000);
    expect(res.accrued_leave_to_date).toBe(1.5);
    expect(res.ignored_rows_count).toBe(1);
  });

  // Case 9: Missing attendance rows
  it('Case 9: One working day without a row -> is_complete false, missing_dates has that date, no deduction', () => {
    const attendance = makeCompleteAttendance('2026-11').filter(r => r.date !== '2026-11-02');

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.is_complete).toBe(false);
    expect(res.missing_dates).toEqual(['2026-11-02']);
    expect(res.absence_deduction).toBe(0);
    expect(res.net_salary).toBe(30000);
  });

  // Case 10: Invalid status rows
  it('Case 10: Rows with status late and empty status -> invalid_rows lists them, counted as missing, never present', () => {
    const attendance = makeCompleteAttendance('2026-11').map(row => {
      if (row.date === '2026-11-02') {
        return { ...row, status: 'late' };
      }
      if (row.date === '2026-11-03') {
        return { ...row, status: '' };
      }
      return row;
    });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.invalid_rows.length).toBe(2);
    expect(res.missing_dates).toContain('2026-11-02');
    expect(res.missing_dates).toContain('2026-11-03');
    expect(res.present_days).toBe(24);
  });

  // Case 11: All days absent + advance deduction clamped
  it('Case 11: All 26 days absent plus advance_deduction 5000 -> net_salary 0, was_clamped true', () => {
    const attendance = makeCompleteAttendance('2026-11').map(r => ({ ...r, status: 'absent' }));

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance,
      adjustments: { bonus: 0, advance_deduction: 5000, other_deduction: 0 }
    });

    expect(res.net_salary).toBe(0);
    expect(res.was_clamped).toBe(true);
    expect(res.absent_days).toBe(26);
  });

  // Case 12: Capped minutes
  it('Case 12: One present day with late_minutes 600 (shift 475) -> capped_days 1, charged 600, time_deduction 1153.85, net 28846', () => {
    const attendance = makeCompleteAttendance('2026-11').map(row => {
      if (row.date === '2026-11-02') {
        return { ...row, late_minutes: 600 };
      }
      return row;
    });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.capped_days).toBe(1);
    expect(res.late_minutes_charged).toBe(600);
    expect(res.time_deduction).toBe(1153.85);
    expect(res.net_salary).toBe(28846);
  });

  // Case 13: Absent row on weekly off day ignored
  it('Case 13: An absent row dated Friday Nov 6 is ignored (absent_days stays 0)', () => {
    const attendance = makeCompleteAttendance('2026-11');
    attendance.push({ date: '2026-11-06', status: 'absent', late_minutes: 0, early_leave_minutes: 0 });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.absent_days).toBe(0);
    expect(res.ignored_rows_count).toBe(1);
  });

  // Case 14: Two rows for the same date
  it('Case 14: Two rows for the same date -> last wins and warnings contains duplicate_rows', () => {
    const attendance = makeCompleteAttendance('2026-11');
    // Prepend an absent row for Nov 2, so the present one comes second
    attendance.unshift({ date: '2026-11-02', status: 'absent', late_minutes: 0, early_leave_minutes: 0 });

    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.present_days).toBe(26);
    expect(res.absent_days).toBe(0);
    expect(res.warnings).toContain('duplicate_rows');
  });

  // Case 15: Not calculable vs programmer error
  it('Case 15: Data conditions return calculable false with proper reason codes; malformed input throws TypeError', () => {
    const baseInput = {
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 30000,
      settings: DEFAULT_SETTINGS,
      attendance: []
    };

    // base_salary null
    const noSalaryRes = calculateStaffPayroll({ ...baseInput, base_salary: null });
    expect(noSalaryRes.calculable).toBe(false);
    expect(noSalaryRes.reasons).toEqual(['no_salary']);

    // shift_end equal to shift_start
    const noShiftRes = calculateStaffPayroll({
      ...baseInput,
      staff: { ...DEFAULT_STAFF, shift_start: '08:00', shift_end: '08:00' }
    });
    expect(noShiftRes.calculable).toBe(false);
    expect(noShiftRes.reasons).toEqual(['no_shift']);

    // joining_date after month
    const notStartedRes = calculateStaffPayroll({
      ...baseInput,
      staff: { ...DEFAULT_STAFF, joining_date: '2026-12-01' }
    });
    expect(notStartedRes.calculable).toBe(false);
    expect(notStartedRes.reasons).toEqual(['not_started']);

    // zero working days
    const noWorkingDaysRes = calculateStaffPayroll({
      ...baseInput,
      settings: { ...DEFAULT_SETTINGS, weekly_off_days: [0, 1, 2, 3, 4, 5] },
      holidays: ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']
    });
    expect(noWorkingDaysRes.calculable).toBe(false);
    expect(noWorkingDaysRes.reasons).toEqual(['no_working_days']);

    // TypeError on malformed month
    expect(() => calculateStaffPayroll({ ...baseInput, month: '2026-13' })).toThrow(TypeError);
    expect(() => calculateStaffPayroll({ ...baseInput, month: '2026/11' })).toThrow(TypeError);

    // TypeError on negative bonus
    expect(() => calculateStaffPayroll({ ...baseInput, adjustments: { bonus: -10 } })).toThrow(TypeError);
  });

  // Case 16: Fiscal helpers
  it('Case 16: Fiscal context helpers for start month 4 and start month 1', () => {
    // Start month 4
    const ctxApr = getFiscalContext('2026-04', 4);
    expect(ctxApr.months_elapsed).toBe(1);
    expect(ctxApr.is_last_month_of_fiscal_year).toBe(false);
    expect(ctxApr.fiscal_year_start).toBe('2026-04-01');

    const ctxMar27 = getFiscalContext('2027-03', 4);
    expect(ctxMar27.months_elapsed).toBe(12);
    expect(ctxMar27.is_last_month_of_fiscal_year).toBe(true);
    expect(ctxMar27.fiscal_year_start).toBe('2026-04-01');

    const ctxMar26 = getFiscalContext('2026-03', 4);
    expect(ctxMar26.fiscal_year_start).toBe('2025-04-01');

    // Start month 1
    const ctxDec = getFiscalContext('2026-12', 1);
    expect(ctxDec.months_elapsed).toBe(12);
    expect(ctxDec.is_last_month_of_fiscal_year).toBe(true);
    expect(ctxDec.fiscal_year_start).toBe('2026-01-01');
  });

  // Case 17: Rounding
  it('Case 17: Rounding base_salary 26000.50 with complete attendance yields net_salary 26001', () => {
    const attendance = makeCompleteAttendance('2026-11');
    const res = calculateStaffPayroll({
      month: '2026-11',
      staff: DEFAULT_STAFF,
      base_salary: 26000.50,
      settings: DEFAULT_SETTINGS,
      attendance
    });

    expect(res.net_salary).toBe(26001);
  });

  // Case 18: Purity & Immutability
  it('Case 18: Pure engine: deep-freezing inputs causes no exceptions and produces identical deep-equal results', () => {
    const input = deepFreeze({
      month: '2026-11',
      staff: { ...DEFAULT_STAFF },
      base_salary: 30000,
      settings: { ...DEFAULT_SETTINGS },
      holidays: ['2026-11-09'],
      attendance: makeCompleteAttendance('2026-11'),
      leave_opening_used_days: 2,
      prior_paid_leave_days: 1,
      adjustments: { bonus: 500, advance_deduction: 200, other_deduction: 100 }
    });

    const res1 = calculateStaffPayroll(input);
    const res2 = calculateStaffPayroll(input);
    expect(res1).toEqual(res2);

    const monthlyInput = deepFreeze({
      month: '2026-11',
      settings: { ...DEFAULT_SETTINGS },
      holidays: ['2026-11-09'],
      staff_list: [{ ...DEFAULT_STAFF }],
      salaries_by_staff_id: { [DEFAULT_STAFF.id]: 30000 },
      attendance: makeCompleteAttendance('2026-11'),
      opening_by_staff_id: { [DEFAULT_STAFF.id]: 2 },
      prior_paid_by_staff_id: { [DEFAULT_STAFF.id]: 1 },
      adjustments_by_staff_id: { [DEFAULT_STAFF.id]: { bonus: 500, advance_deduction: 200, other_deduction: 100 } }
    });

    const mRes1 = calculateMonthlyPayroll(monthlyInput);
    const mRes2 = calculateMonthlyPayroll(monthlyInput);
    expect(mRes1).toEqual(mRes2);
  });

  // Case 19: Month level aggregation & sorting
  it('Case 19: Monthly payroll sorts items by numeric staff_code, categorizes not_calculable and incomplete_staff_ids', () => {
    const staff1 = { id: 's1', staff_code: '10', name: 'استاد 10', shift_start: '06:50', shift_end: '14:45' };
    const staff2 = { id: 's2', staff_code: '9', name: 'استاد 9', shift_start: '06:50', shift_end: '14:45' };
    const staff3 = { id: 's3', staff_code: '2', name: 'استاد 2', shift_start: '06:50', shift_end: '14:45' };
    const staff4 = { id: 's4', staff_code: '5', name: 'استاد بغیر تنخواہ', shift_start: '06:50', shift_end: '14:45' };

    const attStaff1 = makeCompleteAttendance('2026-11').map(r => ({ ...r, staff_id: 's1' }));
    const attStaff2 = makeCompleteAttendance('2026-11').map(r => ({ ...r, staff_id: 's2' }));
    // staff3 is incomplete (only 1 day attendance)
    const attStaff3 = [{ date: '2026-11-01', status: 'present', staff_id: 's3' }];

    const allAttendance = [...attStaff1, ...attStaff2, ...attStaff3];

    const monthlyRes = calculateMonthlyPayroll({
      month: '2026-11',
      settings: DEFAULT_SETTINGS,
      holidays: [],
      staff_list: [staff1, staff2, staff3, staff4],
      salaries_by_staff_id: {
        s1: 30000,
        s2: 30000,
        s3: 30000,
        s4: null // not calculable
      },
      attendance: allAttendance
    });

    // Sorted ascending by numeric staff_code: 2, 9, 10
    expect(monthlyRes.items.map(it => String(it.staff_code))).toEqual(['2', '9', '10']);

    // Staff 4 without salary lands in not_calculable
    expect(monthlyRes.not_calculable.length).toBe(1);
    expect(monthlyRes.not_calculable[0].staff_id).toBe('s4');
    expect(monthlyRes.not_calculable[0].reasons).toEqual(['no_salary']);

    // Staff 3 is incomplete
    expect(monthlyRes.incomplete_staff_ids).toContain('s3');

    // Totals net_total equals sum of items' net_salary
    const sumNet = monthlyRes.items.reduce((s, it) => s + it.net_salary, 0);
    expect(monthlyRes.totals.net_total).toBe(sumNet);
  });

  // Case 20: 200 Differential Tests with Seeded PRNG against Independent Reference
  it('Case 20: 200 differential tests match an independent straight-line reference calculator', () => {
    // Seeded PRNG: mulberry32
    function mulberry32(a) {
      return function () {
        let t = (a += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const rng = mulberry32(123456789);

    // Independent roundHalfUp
    function refRoundHalfUp(num, dec = 2) {
      if (typeof num !== 'number' || !Number.isFinite(num)) return 0;
      const d = Math.max(0, Math.floor(dec || 0));
      const sign = num < 0 ? -1 : 1;
      const abs = Math.abs(num);
      const rounded = Math.round(Number(`${abs}e${d}`));
      const res = sign * Number(`${rounded}e-${d}`);
      return Object.is(res, -0) ? 0 : res;
    }

    // Straight-line independent reference calculator without importing helpers
    function referenceCalculator(input) {
      const { month, staff, base_salary, settings, holidays, attendance, leave_opening_used_days, prior_paid_leave_days, adjustments } = input;
      const [y, m] = month.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();

      const allDates = [];
      for (let d = 1; d <= daysInMonth; d++) {
        allDates.push(`${month}-${d < 10 ? '0' + d : d}`);
      }

      const offSet = new Set(settings.weekly_off_days);
      const holSet = new Set(holidays);

      // Uses new Date(y, m - 1, d).getDay() as strictly required
      const working_dates = allDates.filter(d => {
        const [yy, mm, dd] = d.split('-').map(Number);
        const dayOfWeek = new Date(yy, mm - 1, dd).getDay();
        return !offSet.has(dayOfWeek) && !holSet.has(d);
      });

      const working_days_in_month = working_dates.length;
      const windowStart = staff.joining_date && staff.joining_date > allDates[0] ? staff.joining_date : allDates[0];
      const payable_dates = working_dates.filter(d => d >= windowStart);
      const payable_working_days = payable_dates.length;

      const [sh1, sm1] = staff.shift_start.split(':').map(Number);
      const [sh2, sm2] = staff.shift_end.split(':').map(Number);
      let shift_minutes = (sh2 * 60 + sm2) - (sh1 * 60 + sm1);
      if (shift_minutes < 0) shift_minutes += 1440;

      const day_rate = base_salary / working_days_in_month;
      const minute_rate = day_rate / shift_minutes;

      const payableSet = new Set(payable_dates);
      const rowsByDate = new Map();
      for (const row of attendance) {
        if (payableSet.has(row.date)) {
          rowsByDate.set(row.date, row);
        }
      }

      let present_days = 0;
      let absent_days = 0;
      let leave_days_taken = 0;
      let total_charged_minutes = 0;

      for (const d of payable_dates) {
        const row = rowsByDate.get(d);
        if (!row) continue;
        if (row.status === 'present') {
          present_days += 1;
        } else if (row.status === 'half_leave') {
          present_days += 0.5;
          leave_days_taken += 0.5;
        } else if (row.status === 'leave') {
          leave_days_taken += 1;
        } else if (row.status === 'absent') {
          absent_days += 1;
        }

        if (row.status === 'present' || row.status === 'half_leave') {
          const lateM = Math.max(0, (Number(row.late_minutes) || 0) - settings.late_grace_minutes);
          const earlyM = Math.max(0, (Number(row.early_leave_minutes) || 0) - settings.early_leave_grace_minutes);
          const dayTot = Math.min(lateM + earlyM, shift_minutes);
          total_charged_minutes += dayTot;
        }
      }

      const fStartMonth = settings.fiscal_year_start_month;
      const fiscalYear = m >= fStartMonth ? y : y - 1;
      const fyStartMonthStr = `${fiscalYear}-${fStartMonth < 10 ? '0' + fStartMonth : fStartMonth}`;
      let effStart = fyStartMonthStr;
      if (staff.joining_date && staff.joining_date.slice(0, 7) > fyStartMonthStr) {
        effStart = staff.joining_date.slice(0, 7);
      }
      const [ey, em] = effStart.split('-').map(Number);
      const monthsElapsed = (y * 12 + m) - (ey * 12 + em) + 1;
      const accrued = settings.monthly_leave_accrual * Math.max(1, monthsElapsed);
      const usedBefore = leave_opening_used_days + prior_paid_leave_days;
      const availBefore = Math.max(0, accrued - usedBefore);
      const paid_leave_days = Math.min(leave_days_taken, availBefore);
      const unpaid_leave_days = leave_days_taken - paid_leave_days;
      const leave_balance_after = Math.max(0, availBefore - paid_leave_days);

      const lastFiscalMonth = fStartMonth === 1 ? 12 : fStartMonth - 1;
      const isLastMonth = m === lastFiscalMonth;
      const leave_encashment_amount = isLastMonth ? leave_balance_after * day_rate : 0;

      const base_pay = day_rate * payable_working_days;
      const absence_deduction = absent_days * day_rate;
      const unpaid_leave_deduction = unpaid_leave_days * day_rate;
      const time_deduction = refRoundHalfUp(total_charged_minutes * minute_rate, 2);
      const bonus = adjustments.bonus || 0;
      const advance_deduction = adjustments.advance_deduction || 0;
      const other_deduction = adjustments.other_deduction || 0;

      const gross = base_pay + leave_encashment_amount + bonus;
      const deductions = absence_deduction + unpaid_leave_deduction + (total_charged_minutes * minute_rate) + advance_deduction + other_deduction;
      const netUnrounded = refRoundHalfUp(gross - deductions, 6);
      const net_salary = Math.max(0, refRoundHalfUp(netUnrounded, 0));

      return {
        working_days_in_month,
        absent_days: refRoundHalfUp(absent_days, 2),
        paid_leave_days: refRoundHalfUp(paid_leave_days, 2),
        time_deduction,
        net_salary
      };
    }

    const testMonths = [
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
      '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'
    ];

    for (let i = 0; i < 200; i++) {
      const month = testMonths[Math.floor(rng() * testMonths.length)];
      const numOffDays = 1 + Math.floor(rng() * 2);
      const offDays = [];
      while (offDays.length < numOffDays) {
        const day = Math.floor(rng() * 7);
        if (!offDays.includes(day)) offDays.push(day);
      }

      const numHolidays = Math.floor(rng() * 4);
      const holidays = [];
      const [y, m] = month.split('-').map(Number);
      const daysCount = new Date(y, m, 0).getDate();
      for (let h = 0; h < numHolidays; h++) {
        const d = 1 + Math.floor(rng() * daysCount);
        const holDate = `${month}-${d < 10 ? '0' + d : d}`;
        if (!holidays.includes(holDate)) holidays.push(holDate);
      }

      const lateGrace = Math.floor(rng() * 3) * 5;
      const earlyGrace = Math.floor(rng() * 3) * 5;
      const monthlyAccrual = 1.0 + Math.floor(rng() * 3) * 0.5;
      const fStartMonth = 1 + Math.floor(rng() * 12);

      const settings = {
        weekly_off_days: offDays,
        late_grace_minutes: lateGrace,
        early_leave_grace_minutes: earlyGrace,
        monthly_leave_accrual: monthlyAccrual,
        fiscal_year_start_month: fStartMonth
      };

      const baseSalary = 20000 + Math.floor(rng() * 30) * 1000;
      const staff = {
        id: `staff-${i}`,
        staff_code: i + 1,
        name: `Teacher ${i}`,
        shift_start: '07:30',
        shift_end: '13:30',
        joining_date: '2025-06-01'
      };

      const workingDates = [];
      const offSet = new Set(offDays);
      const holSet = new Set(holidays);
      for (let d = 1; d <= daysCount; d++) {
        const ds = `${month}-${d < 10 ? '0' + d : d}`;
        const dow = new Date(y, m - 1, d).getDay();
        if (!offSet.has(dow) && !holSet.has(ds)) {
          workingDates.push(ds);
        }
      }

      // If no working days generated, add one working day to test calculation
      if (workingDates.length === 0) {
        holidays.length = 0;
      }

      const attendance = [];
      const statuses = ['present', 'present', 'present', 'half_leave', 'absent', 'leave'];
      for (const date of workingDates) {
        // Occasionally skip date to test missing dates
        if (rng() < 0.05) continue;
        const status = statuses[Math.floor(rng() * statuses.length)];
        const lateMinutes = (status === 'present' || status === 'half_leave') ? Math.floor(rng() * 4) * 15 : 0;
        const earlyMinutes = (status === 'present' || status === 'half_leave') ? Math.floor(rng() * 3) * 10 : 0;
        attendance.push({
          date,
          status,
          late_minutes: lateMinutes,
          early_leave_minutes: earlyMinutes
        });
      }

      const leaveOpening = Math.floor(rng() * 6);
      const priorPaid = Math.floor(rng() * 4);
      const bonus = Math.floor(rng() * 3) * 500;
      const advance = Math.floor(rng() * 3) * 200;

      const input = {
        month,
        staff,
        base_salary: baseSalary,
        settings,
        holidays,
        attendance,
        leave_opening_used_days: leaveOpening,
        prior_paid_leave_days: priorPaid,
        adjustments: { bonus, advance_deduction: advance, other_deduction: 0 }
      };

      const engineResult = calculateStaffPayroll(input);
      if (engineResult.calculable) {
        const ref = referenceCalculator(input);
        expect(engineResult.working_days_in_month).toBe(ref.working_days_in_month);
        expect(engineResult.absent_days).toBe(ref.absent_days);
        expect(engineResult.paid_leave_days).toBe(ref.paid_leave_days);
        expect(engineResult.time_deduction).toBe(ref.time_deduction);
        expect(engineResult.net_salary).toBe(ref.net_salary);
      }
    }
  });

  // Case 21: Urdu reason codes purity
  it('Case 21: Every reason/warning code exists in PAYROLL_REASON_URDU and contains zero Latin letters', () => {
    const requiredCodes = [
      'no_salary',
      'no_shift',
      'no_working_days',
      'not_started',
      'duplicate_rows',
      'bad_minutes'
    ];

    for (const code of requiredCodes) {
      expect(PAYROLL_REASON_URDU).toHaveProperty(code);
      const text = PAYROLL_REASON_URDU[code];
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
      // Assert zero Latin letters
      expect(/[A-Za-z]/.test(text)).toBe(false);
    }
  });
});
