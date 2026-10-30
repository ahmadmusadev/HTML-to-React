import { describe, it, expect } from 'vitest';
import {
  WEEKDAY_NAMES_URDU,
  MONTH_NAMES_URDU,
  toUrduPayrollError,
  validateBaseSalary,
  validateWeeklyOffDays,
  validateGraceMinutes,
  validateMonthlyLeaveAccrual,
  validateFiscalYearStartMonth,
  validateHoliday,
  validateLeaveOpeningUsedDays,
  getFiscalYearStart,
  getFiscalYearRangeUrdu,
  calculateShiftDurationMinutes,
  formatShiftDurationUrdu
} from './PayrollMappers';

describe('PayrollMappers - Validators & Pure Calculations', () => {
  describe('Constants', () => {
    it('has 7 Urdu weekday names starting from Sunday (0) to Saturday (6)', () => {
      expect(WEEKDAY_NAMES_URDU).toHaveLength(7);
      expect(WEEKDAY_NAMES_URDU[0]).toBe('اتوار');
      expect(WEEKDAY_NAMES_URDU[5]).toBe('جمعہ');
      expect(WEEKDAY_NAMES_URDU[6]).toBe('ہفتہ');
    });

    it('has 12 Urdu month names (1-indexed)', () => {
      expect(MONTH_NAMES_URDU).toHaveLength(13);
      expect(MONTH_NAMES_URDU[1]).toBe('جنوری');
      expect(MONTH_NAMES_URDU[4]).toBe('اپریل');
      expect(MONTH_NAMES_URDU[12]).toBe('دسمبر');
    });
  });

  describe('toUrduPayrollError', () => {
    it('maps code 42501 to Urdu authorization message', () => {
      expect(toUrduPayrollError({ code: '42501', message: 'permission denied' })).toBe(
        'آپ کو اس ادارے کے تنخواہ کے ریکارڈ تک رسائی کی اجازت نہیں ہے۔'
      );
    });

    it('maps row-level security error message to Urdu authorization message', () => {
      expect(toUrduPayrollError(new Error('new row violates row-level security policy for table "staff_salary"'))).toBe(
        'آپ کو اس ادارے کے تنخواہ کے ریکارڈ تک رسائی کی اجازت نہیں ہے۔'
      );
    });

    it('maps permission denied string to Urdu authorization message', () => {
      expect(toUrduPayrollError('permission denied for table payroll_settings')).toBe(
        'آپ کو اس ادارے کے تنخواہ کے ریکارڈ تک رسائی کی اجازت نہیں ہے۔'
      );
    });

    it('maps Failed to fetch / network errors to Urdu connectivity message', () => {
      expect(toUrduPayrollError(new TypeError('Failed to fetch'))).toBe(
        'سرور سے رابطہ نہ ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔'
      );
      expect(toUrduPayrollError(new Error('NetworkError when attempting to fetch resource'))).toBe(
        'سرور سے رابطہ نہ ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔'
      );
    });

    it('preserves user-facing Urdu validation errors unchanged', () => {
      const urduErr = 'تنخواہ درج کرنا لازمی ہے';
      expect(toUrduPayrollError(urduErr)).toBe('تنخواہ درج کرنا لازمی ہے');
      expect(toUrduPayrollError(new Error('چھٹیوں کی تعداد صفر یا اس سے زیادہ ہونی چاہیے'))).toBe(
        'چھٹیوں کی تعداد صفر یا اس سے زیادہ ہونی چاہیے'
      );
    });

    it('maps code 23505 with holiday context to clear Urdu holiday message', () => {
      expect(toUrduPayrollError({ code: '23505', message: 'duplicate key' }, 'holiday')).toBe(
        'اس تاریخ کے لیے پہلے سے تعطیل درج ہے۔'
      );
    });

    it('maps unknown English error to generic Urdu message (never leaking raw English)', () => {
      const res = toUrduPayrollError(new Error('syntax error at or near SELECT'));
      expect(res).toBe('کارروائی کے دوران غیر متوقع مسئلہ پیش آیا ہے۔ براہ کرم دوبارہ کوشش کریں۔');
      expect(res).not.toMatch(/[a-zA-Z]/);
    });
  });

  describe('validateBaseSalary', () => {
    it('accepts valid integers and decimals up to 2 decimal places', () => {
      expect(validateBaseSalary(25000)).toEqual({ isValid: true, value: 25000 });
      expect(validateBaseSalary('35000')).toEqual({ isValid: true, value: 35000 });
      expect(validateBaseSalary('42500.50')).toEqual({ isValid: true, value: 42500.5 });
      expect(validateBaseSalary(0)).toEqual({ isValid: true, value: 0 });
      expect(validateBaseSalary('9999999.99')).toEqual({ isValid: true, value: 9999999.99 });
      expect(validateBaseSalary('15,000.00')).toEqual({ isValid: true, value: 15000 });
    });

    it('rejects empty, null, or undefined', () => {
      expect(validateBaseSalary('')).toEqual({ isValid: false, error: 'تنخواہ درج کرنا لازمی ہے' });
      expect(validateBaseSalary('   ')).toEqual({ isValid: false, error: 'تنخواہ درج کرنا لازمی ہے' });
      expect(validateBaseSalary(null)).toEqual({ isValid: false, error: 'تنخواہ درج کرنا لازمی ہے' });
      expect(validateBaseSalary(undefined)).toEqual({ isValid: false, error: 'تنخواہ درج کرنا لازمی ہے' });
    });

    it('rejects non-numeric strings', () => {
      expect(validateBaseSalary('abc')).toEqual({ isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' });
      expect(validateBaseSalary('25000xyz')).toEqual({ isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' });
    });

    it('rejects negative numbers', () => {
      expect(validateBaseSalary(-500)).toEqual({ isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' });
      expect(validateBaseSalary('-1000')).toEqual({ isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' });
    });

    it('rejects numbers exceeding 9,999,999.99', () => {
      expect(validateBaseSalary('10000000')).toEqual({ isValid: false, error: 'تنخواہ 9,999,999.99 سے زیادہ نہیں ہو سکتی' });
    });

    it('rejects numbers with more than 2 decimal places', () => {
      expect(validateBaseSalary('1500.555')).toEqual({
        isValid: false,
        error: 'تنخواہ میں اعشاریہ کے بعد زیادہ سے زیادہ 2 ہندسے ہو سکتے ہیں'
      });
    });
  });

  describe('validateWeeklyOffDays', () => {
    it('accepts valid arrays of unique integers between 0 and 6 with up to 6 off days', () => {
      expect(validateWeeklyOffDays([5])).toEqual({ isValid: true, value: [5] });
      expect(validateWeeklyOffDays([0, 5])).toEqual({ isValid: true, value: [0, 5] });
      expect(validateWeeklyOffDays([5, 4, 3])).toEqual({ isValid: true, value: [3, 4, 5] });
      expect(validateWeeklyOffDays([0, 1, 2, 3, 4, 5])).toEqual({ isValid: true, value: [0, 1, 2, 3, 4, 5] });
    });

    it('rejects duplicate off days', () => {
      expect(validateWeeklyOffDays([5, 5])).toEqual({
        isValid: false,
        error: 'ہفتہ وار چھٹیوں میں تکرار نہیں ہو سکتی'
      });
    });

    it('rejects days out of 0..6 range or non-integers', () => {
      expect(validateWeeklyOffDays([7])).toEqual({
        isValid: false,
        error: 'تعطیل کا دن 0 (اتوار) سے 6 (ہفتہ) کے درمیان ہونا چاہیے'
      });
      expect(validateWeeklyOffDays([-1])).toEqual({
        isValid: false,
        error: 'تعطیل کا دن 0 (اتوار) سے 6 (ہفتہ) کے درمیان ہونا چاہیے'
      });
      expect(validateWeeklyOffDays([1.5])).toEqual({
        isValid: false,
        error: 'تعطیل کا دن 0 (اتوار) سے 6 (ہفتہ) کے درمیان ہونا چاہیے'
      });
    });

    it('rejects when all 7 days are set as off (leaving zero working days)', () => {
      expect(validateWeeklyOffDays([0, 1, 2, 3, 4, 5, 6])).toEqual({
        isValid: false,
        error: 'ہفتہ وار تعطیلات زیادہ سے زیادہ 6 ہو سکتی ہیں (کم از کم ایک کام کا دن لازمی ہے)'
      });
    });

    it('rejects non-array input', () => {
      expect(validateWeeklyOffDays(null)).toEqual({
        isValid: false,
        error: 'ہفتہ وار چھٹیوں کی فہرست درست نہیں ہے'
      });
    });
  });

  describe('validateGraceMinutes', () => {
    it('accepts integers between 0 and 120', () => {
      expect(validateGraceMinutes(0)).toEqual({ isValid: true, value: 0 });
      expect(validateGraceMinutes('15')).toEqual({ isValid: true, value: 15 });
      expect(validateGraceMinutes(120)).toEqual({ isValid: true, value: 120 });
    });

    it('rejects empty input', () => {
      expect(validateGraceMinutes('')).toEqual({
        isValid: false,
        error: 'رعایتی وقت درج کرنا لازمی ہے'
      });
    });

    it('rejects out of 0..120 range', () => {
      expect(validateGraceMinutes(-1)).toEqual({
        isValid: false,
        error: 'رعایتی وقت مکمل عدد ہونا چاہیے'
      });
      expect(validateGraceMinutes(121)).toEqual({
        isValid: false,
        error: 'رعایتی وقت 0 سے 120 منٹ کے درمیان ہونا چاہیے'
      });
    });

    it('rejects non-integer input', () => {
      expect(validateGraceMinutes('15.5')).toEqual({
        isValid: false,
        error: 'رعایتی وقت مکمل عدد ہونا چاہیے'
      });
    });
  });

  describe('validateMonthlyLeaveAccrual', () => {
    it('accepts numbers between 0 and 10 with at most 2 decimals', () => {
      expect(validateMonthlyLeaveAccrual(0)).toEqual({ isValid: true, value: 0 });
      expect(validateMonthlyLeaveAccrual('1.5')).toEqual({ isValid: true, value: 1.5 });
      expect(validateMonthlyLeaveAccrual('2.75')).toEqual({ isValid: true, value: 2.75 });
      expect(validateMonthlyLeaveAccrual(10)).toEqual({ isValid: true, value: 10 });
    });

    it('rejects empty or out-of-range values', () => {
      expect(validateMonthlyLeaveAccrual('')).toEqual({
        isValid: false,
        error: 'ماہانہ رخصت استحقاق درج کرنا لازمی ہے'
      });
      expect(validateMonthlyLeaveAccrual(10.5)).toEqual({
        isValid: false,
        error: 'ماہانہ رخصت 0 سے 10 کے درمیان ہونی چاہیے'
      });
    });

    it('rejects values with more than 2 decimal places', () => {
      expect(validateMonthlyLeaveAccrual('1.333')).toEqual({
        isValid: false,
        error: 'اعشاریہ کے بعد زیادہ سے زیادہ 2 ہندسے ہو سکتے ہیں'
      });
    });
  });

  describe('validateFiscalYearStartMonth', () => {
    it('accepts integers 1 to 12', () => {
      expect(validateFiscalYearStartMonth(1)).toEqual({ isValid: true, value: 1 });
      expect(validateFiscalYearStartMonth('4')).toEqual({ isValid: true, value: 4 });
      expect(validateFiscalYearStartMonth(12)).toEqual({ isValid: true, value: 12 });
    });

    it('rejects values outside 1..12 or non-integers', () => {
      expect(validateFiscalYearStartMonth(0)).toEqual({
        isValid: false,
        error: 'مالی سال کا ابتدائی مہینہ 1 سے 12 کے درمیان ہونا چاہیے'
      });
      expect(validateFiscalYearStartMonth(13)).toEqual({
        isValid: false,
        error: 'مالی سال کا ابتدائی مہینہ 1 سے 12 کے درمیان ہونا چاہیے'
      });
      expect(validateFiscalYearStartMonth('4.5')).toEqual({
        isValid: false,
        error: 'مالی سال کا ابتدائی مہینہ 1 سے 12 کے درمیان ہونا چاہیے'
      });
      expect(validateFiscalYearStartMonth('')).toEqual({
        isValid: false,
        error: 'مالی سال کا ابتدائی مہینہ منتخب کرنا لازمی ہے'
      });
    });
  });

  describe('validateHoliday', () => {
    it('accepts valid date format YYYY-MM-DD and non-empty title', () => {
      const valid = { holiday_date: '2026-08-14', title: 'یوم آزادی پاکستان' };
      expect(validateHoliday(valid)).toEqual({
        isValid: true,
        value: { holiday_date: '2026-08-14', title: 'یوم آزادی پاکستان' }
      });
    });

    it('rejects invalid date formats', () => {
      expect(validateHoliday({ holiday_date: '14-08-2026', title: 'یوم آزادی' })).toEqual({
        isValid: false,
        error: 'تعطیل کی درست تاریخ منتخب کریں'
      });
      expect(validateHoliday({ holiday_date: '2026-13-01', title: 'غلط مہینہ' })).toEqual({
        isValid: false,
        error: 'تعطیل کے مہینے کا انتخاب درست نہیں ہے'
      });
      expect(validateHoliday({ holiday_date: '2026-02-31', title: 'غلط دن' })).toEqual({
        isValid: false,
        error: 'تعطیل کے دن کا انتخاب درست نہیں ہے'
      });
    });

    it('rejects empty title or title exceeding 100 characters', () => {
      expect(validateHoliday({ holiday_date: '2026-08-14', title: '   ' })).toEqual({
        isValid: false,
        error: 'تعطیل کا عنوان درج کرنا لازمی ہے'
      });
      const longTitle = 'a'.repeat(101);
      expect(validateHoliday({ holiday_date: '2026-08-14', title: longTitle })).toEqual({
        isValid: false,
        error: 'تعطیل کا عنوان 100 حروف سے زیادہ نہیں ہو سکتا'
      });
    });
  });

  describe('validateLeaveOpeningUsedDays', () => {
    it('accepts multiples of 0.5 between 0 and 99.5', () => {
      expect(validateLeaveOpeningUsedDays(0)).toEqual({ isValid: true, value: 0 });
      expect(validateLeaveOpeningUsedDays('0.5')).toEqual({ isValid: true, value: 0.5 });
      expect(validateLeaveOpeningUsedDays('5.0')).toEqual({ isValid: true, value: 5 });
      expect(validateLeaveOpeningUsedDays(14.5)).toEqual({ isValid: true, value: 14.5 });
      expect(validateLeaveOpeningUsedDays('99.5')).toEqual({ isValid: true, value: 99.5 });
    });

    it('rejects non-multiples of 0.5', () => {
      expect(validateLeaveOpeningUsedDays('1.2')).toEqual({
        isValid: false,
        error: 'چھٹیوں کی تعداد 0.5 کے حصوں میں ہونی چاہیے'
      });
      expect(validateLeaveOpeningUsedDays('0.25')).toEqual({
        isValid: false,
        error: 'چھٹیوں کی تعداد 0.5 کے حصوں میں ہونی چاہیے'
      });
    });

    it('rejects negative numbers or numbers exceeding 99.5', () => {
      expect(validateLeaveOpeningUsedDays(-1)).toEqual({
        isValid: false,
        error: 'چھٹیوں کی تعداد ایک درست عدد ہونی چاہیے'
      });
      expect(validateLeaveOpeningUsedDays(100)).toEqual({
        isValid: false,
        error: 'استعمال شدہ چھٹیاں 99.5 سے زیادہ نہیں ہو سکتیں'
      });
    });

    it('rejects empty input', () => {
      expect(validateLeaveOpeningUsedDays('')).toEqual({
        isValid: false,
        error: 'استعمال شدہ چھٹیوں کی تعداد درج کرنا لازمی ہے'
      });
    });
  });

  describe('getFiscalYearStart', () => {
    it('computes 2026-10-30 with start 4 -> 2026-04-01', () => {
      expect(getFiscalYearStart('2026-10-30', 4)).toBe('2026-04-01');
    });

    it('computes 2027-02-15 with start 4 -> 2026-04-01', () => {
      expect(getFiscalYearStart('2027-02-15', 4)).toBe('2026-04-01');
    });

    it('computes 2026-04-01 with start 4 -> 2026-04-01', () => {
      expect(getFiscalYearStart('2026-04-01', 4)).toBe('2026-04-01');
    });

    it('computes 2026-03-31 with start 4 -> 2025-04-01', () => {
      expect(getFiscalYearStart('2026-03-31', 4)).toBe('2025-04-01');
    });

    it('computes start month 1 with 2026-10-30 -> 2026-01-01', () => {
      expect(getFiscalYearStart('2026-10-30', 1)).toBe('2026-01-01');
    });

    it('handles Date object inputs without timezone shifting', () => {
      const d = new Date(2026, 9, 30); // October 30, 2026
      expect(getFiscalYearStart(d, 4)).toBe('2026-04-01');
    });
  });

  describe('getFiscalYearRangeUrdu', () => {
    it('returns formatted Urdu range string for fiscal year', () => {
      const range = getFiscalYearRangeUrdu('2026-10-30', 4);
      expect(range).toContain('1 اپریل 2026');
      expect(range).toContain('31 مارچ 2027');
    });
  });

  describe('calculateShiftDurationMinutes', () => {
    it('calculates duration for 06:50 to 14:45 as 475 minutes', () => {
      expect(calculateShiftDurationMinutes('06:50', '14:45')).toBe(475);
    });

    it('handles time strings with seconds: 06:50:00 to 14:45:00', () => {
      expect(calculateShiftDurationMinutes('06:50:00', '14:45:00')).toBe(475);
    });

    it('handles shifts crossing midnight', () => {
      expect(calculateShiftDurationMinutes('22:00', '06:00')).toBe(480);
    });

    it('returns 0 for missing or invalid inputs', () => {
      expect(calculateShiftDurationMinutes(null, '14:45')).toBe(0);
      expect(calculateShiftDurationMinutes('06:50', null)).toBe(0);
      expect(calculateShiftDurationMinutes('invalid', '14:45')).toBe(0);
    });
  });

  describe('formatShiftDurationUrdu', () => {
    it('formats duration with hours and minutes in Urdu', () => {
      expect(formatShiftDurationUrdu(475)).toBe('7 گھنٹے 55 منٹ (475 منٹ)');
      expect(formatShiftDurationUrdu(120)).toBe('2 گھنٹے (120 منٹ)');
      expect(formatShiftDurationUrdu(45)).toBe('45 منٹ');
      expect(formatShiftDurationUrdu(0)).toBe('مقرر نہیں');
    });
  });
});
