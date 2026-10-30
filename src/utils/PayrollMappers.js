/**
 * Pure functions and validators for Payroll features (Stage 3).
 * All validation error messages and visible labels are strictly in Urdu.
 * No English words, abbreviations or parentheticals.
 */

export const WEEKDAY_NAMES_URDU = [
  'اتوار',   // 0 = Sunday
  'پیر',     // 1 = Monday
  'منگل',    // 2 = Tuesday
  'بدھ',     // 3 = Wednesday
  'جمعرات',  // 4 = Thursday
  'جمعہ',    // 5 = Friday
  'ہفتہ'     // 6 = Saturday
];

export const MONTH_NAMES_URDU = [
  '',
  'جنوری',
  'فروری',
  'مارچ',
  'اپریل',
  'مئی',
  'جون',
  'جولائی',
  'اگست',
  'ستمبر',
  'اکتوبر',
  'نومبر',
  'دسمبر'
];

/**
 * Maps raw database / network / runtime errors to user-friendly Urdu messages.
 * Prevents raw English database errors or stack traces from reaching the UI.
 *
 * @param {any} err - Error object or string
 * @param {'general'|'holiday'} [context='general'] - Error context
 * @returns {string} Urdu error message
 */
export function toUrduPayrollError(err, context = 'general') {
  if (!err) {
    return 'ایک غیر متوقع مسئلہ پیش آیا ہے۔';
  }

  const code = String(err?.code || '');
  const rawMsg = String(err?.message || (typeof err === 'string' ? err : '')).trim();

  // 1. Postgres code 23505 (Unique violation)
  if (code === '23505' || /duplicate key|unique constraint/i.test(rawMsg)) {
    if (context === 'holiday' || /holiday/i.test(rawMsg)) {
      return 'اس تاریخ کے لیے پہلے سے تعطیل درج ہے۔';
    }
    return 'یہ اندراج پہلے سے موجود ہے۔';
  }

  // 2. Postgres code 42501 (Permission denied) or RLS policy violation
  if (code === '42501' || /row-level security|permission denied/i.test(rawMsg)) {
    return 'آپ کو اس ادارے کے تنخواہ کے ریکارڈ تک رسائی کی اجازت نہیں ہے۔';
  }

  // 3. Network or connection failure
  if (/failed to fetch|network\s*error|networkrequestfailed|connection refused/i.test(rawMsg)) {
    return 'سرور سے رابطہ نہ ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔';
  }

  // 4. Our own Urdu validation / application errors:
  // Must contain Urdu characters and not be raw English database errors.
  const hasUrdu = /[\u0600-\u06FF]/.test(rawMsg);
  const hasEnglishDbKeywords = /violates|constraint|syntax error|relation|column|null value|invalid input/i.test(rawMsg);

  if (hasUrdu && !hasEnglishDbKeywords) {
    return rawMsg;
  }

  // 5. Default generic Urdu fallback
  return 'کارروائی کے دوران غیر متوقع مسئلہ پیش آیا ہے۔ براہ کرم دوبارہ کوشش کریں۔';
}

/**
 * Validates a base salary value.
 * Constraints: number, >= 0, at most 2 decimals, <= 9,999,999.99.
 *
 * @param {number|string} val
 * @returns {{ isValid: boolean, error?: string, value?: number }}
 */
export function validateBaseSalary(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isValid: false, error: 'تنخواہ درج کرنا لازمی ہے' };
  }

  const cleanStr = String(val).trim().replace(/,/g, '');

  if (!/^\d+(\.\d+)?$/.test(cleanStr)) {
    return { isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' };
  }

  const num = Number(cleanStr);
  if (Number.isNaN(num)) {
    return { isValid: false, error: 'تنخواہ ایک درست عدد ہونی چاہیے' };
  }

  if (num < 0) {
    return { isValid: false, error: 'تنخواہ صفر یا اس سے زیادہ ہونی چاہیے' };
  }

  if (num > 9999999.99) {
    return { isValid: false, error: 'تنخواہ 9,999,999.99 سے زیادہ نہیں ہو سکتی' };
  }

  const parts = cleanStr.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    return { isValid: false, error: 'تنخواہ میں اعشاریہ کے بعد زیادہ سے زیادہ 2 ہندسے ہو سکتے ہیں' };
  }

  return { isValid: true, value: Number(num.toFixed(2)) };
}

/**
 * Validates weekly off days array.
 * Constraints: array of unique ints 0..6, at most 6 days (at least one working day).
 *
 * @param {Array<number>} days
 * @returns {{ isValid: boolean, error?: string, value?: Array<number> }}
 */
export function validateWeeklyOffDays(days) {
  if (!Array.isArray(days)) {
    return { isValid: false, error: 'ہفتہ وار چھٹیوں کی فہرست درست نہیں ہے' };
  }

  // Check unique
  const set = new Set(days);
  if (set.size !== days.length) {
    return { isValid: false, error: 'ہفتہ وار چھٹیوں میں تکرار نہیں ہو سکتی' };
  }

  // Check range 0..6
  for (const d of days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return { isValid: false, error: 'تعطیل کا دن 0 (اتوار) سے 6 (ہفتہ) کے درمیان ہونا چاہیے' };
    }
  }

  // At most 6 days off (leaving at least one working day)
  if (days.length > 6) {
    return { isValid: false, error: 'ہفتہ وار تعطیلات زیادہ سے زیادہ 6 ہو سکتی ہیں (کم از کم ایک کام کا دن لازمی ہے)' };
  }

  // Sort ascending for consistency
  const sorted = [...days].sort((a, b) => a - b);
  return { isValid: true, value: sorted };
}

/**
 * Validates grace minutes (late or early leave).
 * Constraints: integer between 0 and 120.
 *
 * @param {number|string} val
 * @param {string} [labelUrdu='رعایتی وقت']
 * @returns {{ isValid: boolean, error?: string, value?: number }}
 */
export function validateGraceMinutes(val, labelUrdu = 'رعایتی وقت') {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isValid: false, error: `${labelUrdu} درج کرنا لازمی ہے` };
  }

  const cleanStr = String(val).trim();
  if (!/^\d+$/.test(cleanStr)) {
    return { isValid: false, error: `${labelUrdu} مکمل عدد ہونا چاہیے` };
  }

  const num = Number(cleanStr);
  if (num < 0 || num > 120) {
    return { isValid: false, error: `${labelUrdu} 0 سے 120 منٹ کے درمیان ہونا چاہیے` };
  }

  return { isValid: true, value: num };
}

/**
 * Validates monthly leave accrual.
 * Constraints: number 0..10, at most 2 decimals.
 *
 * @param {number|string} val
 * @returns {{ isValid: boolean, error?: string, value?: number }}
 */
export function validateMonthlyLeaveAccrual(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isValid: false, error: 'ماہانہ رخصت استحقاق درج کرنا لازمی ہے' };
  }

  const cleanStr = String(val).trim();
  if (!/^\d+(\.\d+)?$/.test(cleanStr)) {
    return { isValid: false, error: 'ماہانہ رخصت ایک درست عدد ہونی چاہیے' };
  }

  const num = Number(cleanStr);
  if (num < 0 || num > 10) {
    return { isValid: false, error: 'ماہانہ رخصت 0 سے 10 کے درمیان ہونی چاہیے' };
  }

  const parts = cleanStr.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    return { isValid: false, error: 'اعشاریہ کے بعد زیادہ سے زیادہ 2 ہندسے ہو سکتے ہیں' };
  }

  return { isValid: true, value: Number(num.toFixed(2)) };
}

/**
 * Validates fiscal year start month.
 * Constraints: integer 1..12.
 *
 * @param {number|string} val
 * @returns {{ isValid: boolean, error?: string, value?: number }}
 */
export function validateFiscalYearStartMonth(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isValid: false, error: 'مالی سال کا ابتدائی مہینہ منتخب کرنا لازمی ہے' };
  }

  const num = Number(String(val).trim());
  if (!Number.isInteger(num) || num < 1 || num > 12) {
    return { isValid: false, error: 'مالی سال کا ابتدائی مہینہ 1 سے 12 کے درمیان ہونا چاہیے' };
  }

  return { isValid: true, value: num };
}

/**
 * Validates holiday date and title.
 * Constraints: valid date string YYYY-MM-DD (no timezone conversion), trimmed title (1..100 chars).
 *
 * @param {{ holiday_date?: string, holidayDate?: string, title?: string }} holiday
 * @returns {{ isValid: boolean, error?: string, value?: { holiday_date: string, title: string } }}
 */
export function validateHoliday(holiday) {
  if (!holiday || typeof holiday !== 'object') {
    return { isValid: false, error: 'تعطیل کی تفصیلات فراہم نہیں کی گئیں' };
  }

  const dateStr = String(holiday.holiday_date || holiday.holidayDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { isValid: false, error: 'تعطیل کی درست تاریخ منتخب کریں' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12) {
    return { isValid: false, error: 'تعطیل کے مہینے کا انتخاب درست نہیں ہے' };
  }
  const maxDays = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDays) {
    return { isValid: false, error: 'تعطیل کے دن کا انتخاب درست نہیں ہے' };
  }

  const title = String(holiday.title || '').trim();
  if (!title) {
    return { isValid: false, error: 'تعطیل کا عنوان درج کرنا لازمی ہے' };
  }
  if (title.length > 100) {
    return { isValid: false, error: 'تعطیل کا عنوان 100 حروف سے زیادہ نہیں ہو سکتا' };
  }

  return {
    isValid: true,
    value: {
      holiday_date: dateStr,
      title
    }
  };
}

/**
 * Validates leave opening used days.
 * Constraints: number >= 0, multiple of 0.5, <= 99.5.
 *
 * @param {number|string} val
 * @returns {{ isValid: boolean, error?: string, value?: number }}
 */
export function validateLeaveOpeningUsedDays(val) {
  if (val === null || val === undefined || String(val).trim() === '') {
    return { isValid: false, error: 'استعمال شدہ چھٹیوں کی تعداد درج کرنا لازمی ہے' };
  }

  const cleanStr = String(val).trim();
  if (!/^\d+(\.\d+)?$/.test(cleanStr)) {
    return { isValid: false, error: 'چھٹیوں کی تعداد ایک درست عدد ہونی چاہیے' };
  }

  const num = Number(cleanStr);
  if (Number.isNaN(num) || num < 0) {
    return { isValid: false, error: 'استعمال شدہ چھٹیاں صفر یا اس سے زیادہ ہونی چاہیے' };
  }

  if (num > 99.5) {
    return { isValid: false, error: 'استعمال شدہ چھٹیاں 99.5 سے زیادہ نہیں ہو سکتیں' };
  }

  const roundedDoubled = Math.round(num * 2);
  if (Math.abs(num * 2 - roundedDoubled) > 0.0001) {
    return { isValid: false, error: 'چھٹیوں کی تعداد 0.5 کے حصوں میں ہونی چاہیے' };
  }

  return { isValid: true, value: num };
}

/**
 * Computes the fiscal year start date 'YYYY-MM-01' for a given date string and fiscal start month.
 * Pure string parsing; never uses toISOString or converts timezones.
 *
 * @param {string|Date} [dateInput] - 'YYYY-MM-DD' or 'YYYY-MM' or Date object
 * @param {number} [startMonth=4] - Fiscal year start month (1..12)
 * @returns {string} 'YYYY-MM-01'
 */
export function getFiscalYearStart(dateInput, startMonth = 4) {
  const mStart = Number(startMonth) || 4;

  let y;
  let m;

  if (!dateInput) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  } else if (dateInput instanceof Date) {
    y = dateInput.getFullYear();
    m = dateInput.getMonth() + 1;
  } else {
    const str = String(dateInput).trim();
    const parts = str.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
  }

  if (Number.isNaN(y) || Number.isNaN(m)) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  }

  const fiscalYear = m >= mStart ? y : y - 1;
  const monthStr = String(mStart).padStart(2, '0');
  return `${fiscalYear}-${monthStr}-01`;
}

/**
 * Returns Urdu representation of the fiscal year range.
 * E.g., for 2026-10-30 with startMonth 4 -> "1 اپریل 2026 تا 31 مارچ 2027"
 *
 * @param {string|Date} [dateInput]
 * @param {number} [startMonth=4]
 * @returns {string}
 */
export function getFiscalYearRangeUrdu(dateInput, startMonth = 4) {
  const startStr = getFiscalYearStart(dateInput, startMonth);
  const [startY, startM] = startStr.split('-').map(Number);

  const startMonthName = MONTH_NAMES_URDU[startM] || `${startM}`;

  let endY = startY;
  let endM = startM - 1;
  if (endM === 0) {
    endM = 12;
  } else {
    endY = startY + 1;
  }

  const endMonthName = MONTH_NAMES_URDU[endM] || `${endM}`;
  const endMonthDays = new Date(endY, endM, 0).getDate();

  return `1 ${startMonthName} ${startY} تا ${endMonthDays} ${endMonthName} ${endY}`;
}

/**
 * Calculates duty duration in minutes between shift_start and shift_end.
 * Handles 'HH:MM' and 'HH:MM:SS'. Pure calculation for display only.
 *
 * @param {string} shiftStart - e.g. '06:50' or '06:50:00'
 * @param {string} shiftEnd - e.g. '14:45' or '14:45:00'
 * @returns {number} Duration in minutes
 */
export function calculateShiftDurationMinutes(shiftStart, shiftEnd) {
  if (!shiftStart || !shiftEnd) return 0;

  const sParts = String(shiftStart).trim().split(':');
  const eParts = String(shiftEnd).trim().split(':');

  if (sParts.length < 2 || eParts.length < 2) return 0;

  const sH = parseInt(sParts[0], 10);
  const sM = parseInt(sParts[1], 10);
  const eH = parseInt(eParts[0], 10);
  const eM = parseInt(eParts[1], 10);

  if ([sH, sM, eH, eM].some(n => Number.isNaN(n))) return 0;

  let diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff < 0) {
    diff += 24 * 60; // shift crossing midnight
  }

  return diff;
}

/**
 * Formats shift duration in Urdu.
 *
 * @param {number} minutes
 * @returns {string} e.g. "7 گھنٹے 55 منٹ (475 منٹ)" or "475 منٹ"
 */
export function formatShiftDurationUrdu(minutes) {
  const mins = Number(minutes) || 0;
  if (mins <= 0) return 'مقرر نہیں';

  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hours > 0 && remMins > 0) {
    return `${hours} گھنٹے ${remMins} منٹ (${mins} منٹ)`;
  }
  if (hours > 0) {
    return `${hours} گھنٹے (${mins} منٹ)`;
  }
  return `${mins} منٹ`;
}
