import { getFiscalYearStart } from './PayrollMappers';

/**
 * Urdu explanations for all payroll reason and warning codes.
 * Contains purely Urdu sentences without Latin letters.
 */
export const PAYROLL_REASON_URDU = Object.freeze({
  no_salary: 'بنیادی تنخواہ مقرر نہیں کی گئی ہے۔',
  no_shift: 'اوقات کار (شفٹ کے اوقات) درست نہیں ہیں۔',
  no_working_days: 'اس مہینے میں کام کا کوئی دن نہیں ہے۔',
  not_started: 'شمولیت کی تاریخ اس مہینے کے بعد کی ہے۔',
  duplicate_rows: 'حاضری کے ریکارڈ میں ایک ہی تاریخ کے ایک سے زیادہ اندراجات موجود ہیں۔',
  bad_minutes: 'تاخیر یا قبل از وقت روانگی کے منٹ درست نہیں ہیں۔'
});

/**
 * Returns weekday index 0..6 (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * using Sakamoto's algorithm with pure integer date arithmetic.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {number} 0..6
 */
export function getWeekday(dateStr) {
  if (typeof dateStr !== 'string') return 0;
  const parts = dateStr.split('-');
  if (parts.length < 3) return 0;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 0;
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const year = m < 3 ? y - 1 : y;
  const res = (year + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400) + t[m - 1] + d) % 7;
  return (res + 7) % 7;
}

/**
 * Returns all dates of a given month as ['YYYY-MM-01', ..., last day].
 * Throws TypeError on invalid month format.
 *
 * @param {string} month - 'YYYY-MM'
 * @returns {string[]}
 */
export function getMonthDates(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError(`Invalid month format: ${month}. Expected YYYY-MM`);
  }
  const parts = month.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);

  let daysCount;
  if (m === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    daysCount = isLeap ? 29 : 28;
  } else if (m === 4 || m === 6 || m === 9 || m === 11) {
    daysCount = 30;
  } else {
    daysCount = 31;
  }

  const dates = [];
  for (let d = 1; d <= daysCount; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    dates.push(`${month}-${dayStr}`);
  }
  return dates;
}

/**
 * Returns working dates of the month minus weekly off days and holidays.
 * A holiday on a weekly off day removes nothing extra.
 *
 * @param {string} month - 'YYYY-MM'
 * @param {number[]} weeklyOffDays - array of weekday integers 0..6
 * @param {string[]} holidays - array of 'YYYY-MM-DD' strings
 * @returns {string[]}
 */
export function getWorkingDates(month, weeklyOffDays = [], holidays = []) {
  const dates = getMonthDates(month);
  const offSet = new Set(Array.isArray(weeklyOffDays) ? weeklyOffDays.map(Number) : []);
  const holidaySet = new Set(Array.isArray(holidays) ? holidays : []);

  return dates.filter(date => {
    const weekday = getWeekday(date);
    if (offSet.has(weekday)) return false;
    if (holidaySet.has(date)) return false;
    return true;
  });
}

/**
 * Computes fiscal year context for a given month and joining date.
 *
 * @param {string} month - 'YYYY-MM'
 * @param {number} [fiscalStartMonth=4] - 1..12
 * @param {string|null} [joiningDate=null] - 'YYYY-MM-DD' or null
 * @returns {object}
 */
export function getFiscalContext(month, fiscalStartMonth = 4, joiningDate = null) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError(`Invalid month format: ${month}. Expected YYYY-MM`);
  }
  const startM = Number(fiscalStartMonth);
  if (!Number.isInteger(startM) || startM < 1 || startM > 12) {
    throw new TypeError(`Invalid fiscal_year_start_month: ${fiscalStartMonth}. Expected 1..12`);
  }

  const fyStart = getFiscalYearStart(`${month}-01`, startM);
  const fyStartMonthStr = fyStart.slice(0, 7);

  let effectiveStartMonthStr = fyStartMonthStr;
  if (joiningDate && typeof joiningDate === 'string' && /^\d{4}-(0[1-9]|1[0-2])/.test(joiningDate)) {
    const jm = joiningDate.slice(0, 7);
    if (jm > fyStartMonthStr) {
      effectiveStartMonthStr = jm;
    }
  }

  const [y1, m1] = effectiveStartMonthStr.split('-').map(Number);
  const [y2, m2] = month.split('-').map(Number);
  const monthsElapsed = (y2 * 12 + m2) - (y1 * 12 + m1) + 1;

  const currMonthNum = parseInt(month.split('-')[1], 10);
  const lastFiscalMonthNum = startM === 1 ? 12 : startM - 1;
  const isLastMonth = currMonthNum === lastFiscalMonthNum;

  return {
    fiscal_year_start: fyStart,
    fiscal_year_start_month: startM,
    months_elapsed: Math.max(1, monthsElapsed),
    is_last_month_of_fiscal_year: isLastMonth,
    fiscalYearStart: fyStart,
    monthsElapsed: Math.max(1, monthsElapsed),
    isLastMonthOfFiscalYear: isLastMonth
  };
}

/**
 * Deterministic half-up rounding to specified decimal places.
 * Avoids floating-point noise via exponential representation.
 *
 * @param {number} x
 * @param {number} decimals
 * @returns {number}
 */
export function roundHalfUp(x, decimals = 2) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const d = Math.max(0, Math.floor(decimals || 0));
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const rounded = Math.round(Number(`${abs}e${d}`));
  const res = sign * Number(`${rounded}e-${d}`);
  return Object.is(res, -0) ? 0 : res;
}

/**
 * Parses time string 'HH:MM' or 'HH:MM:SS' into minutes from midnight.
 * Returns null if invalid.
 */
function parseTimeStrToMinutes(str) {
  if (typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Calculates shift duration in minutes. Adds 1440 for overnight shifts.
 * Returns null if <= 0 or unparsable.
 */
function calculateShiftMinutes(startStr, endStr) {
  const startM = parseTimeStrToMinutes(startStr);
  const endM = parseTimeStrToMinutes(endStr);
  if (startM === null || endM === null) return null;
  let diff = endM - startM;
  if (diff < 0) diff += 1440;
  if (diff <= 0) return null;
  return diff;
}

/**
 * Pure calculation engine for individual teacher monthly payroll.
 *
 * @param {object} input
 * @returns {object}
 */
export function calculateStaffPayroll(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Input must be an object');
  }

  const {
    month,
    staff,
    base_salary,
    settings,
    holidays = [],
    attendance = [],
    leave_opening_used_days = 0,
    prior_paid_leave_days = 0,
    adjustments = {}
  } = input;

  // Programmer error validations (THROW TypeError)
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError(`Invalid month format: ${month}. Expected YYYY-MM`);
  }
  if (!staff || typeof staff !== 'object' || staff.id === undefined || staff.id === null) {
    throw new TypeError('staff must be an object with an id property');
  }
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('settings must be an object');
  }
  if (!Array.isArray(settings.weekly_off_days)) {
    throw new TypeError('settings.weekly_off_days must be an array');
  }
  if (settings.late_grace_minutes !== undefined && (typeof settings.late_grace_minutes !== 'number' || settings.late_grace_minutes < 0 || Number.isNaN(settings.late_grace_minutes))) {
    throw new TypeError('settings.late_grace_minutes must be a non-negative number');
  }
  if (settings.early_leave_grace_minutes !== undefined && (typeof settings.early_leave_grace_minutes !== 'number' || settings.early_leave_grace_minutes < 0 || Number.isNaN(settings.early_leave_grace_minutes))) {
    throw new TypeError('settings.early_leave_grace_minutes must be a non-negative number');
  }
  if (settings.monthly_leave_accrual !== undefined && (typeof settings.monthly_leave_accrual !== 'number' || settings.monthly_leave_accrual < 0 || Number.isNaN(settings.monthly_leave_accrual))) {
    throw new TypeError('settings.monthly_leave_accrual must be a non-negative number');
  }
  if (settings.fiscal_year_start_month !== undefined) {
    const fysm = settings.fiscal_year_start_month;
    if (!Number.isInteger(fysm) || fysm < 1 || fysm > 12) {
      throw new TypeError('settings.fiscal_year_start_month must be an integer between 1 and 12');
    }
  }
  if (adjustments && typeof adjustments === 'object') {
    for (const key of ['bonus', 'advance_deduction', 'other_deduction']) {
      if (adjustments[key] !== undefined && adjustments[key] !== null) {
        if (typeof adjustments[key] !== 'number' || adjustments[key] < 0 || Number.isNaN(adjustments[key])) {
          throw new TypeError(`adjustments.${key} must be a non-negative number`);
        }
      }
    }
  }
  if (typeof leave_opening_used_days !== 'number' || leave_opening_used_days < 0 || Number.isNaN(leave_opening_used_days)) {
    throw new TypeError('leave_opening_used_days must be a non-negative number');
  }
  if (typeof prior_paid_leave_days !== 'number' || prior_paid_leave_days < 0 || Number.isNaN(prior_paid_leave_days)) {
    throw new TypeError('prior_paid_leave_days must be a non-negative number');
  }

  // Data conditions (return { calculable: false, staff_id, reasons })
  const reasons = [];

  if (base_salary === null || base_salary === undefined) {
    reasons.push('no_salary');
  }

  const shiftStart = staff.shift_start || staff.shiftStart;
  const shiftEnd = staff.shift_end || staff.shiftEnd;
  const shiftMinutes = calculateShiftMinutes(shiftStart, shiftEnd);
  if (!shiftMinutes || shiftMinutes <= 0) {
    reasons.push('no_shift');
  }

  const workingDates = getWorkingDates(month, settings.weekly_off_days, holidays);
  if (workingDates.length === 0) {
    reasons.push('no_working_days');
  }

  const allMonthDates = getMonthDates(month);
  const lastDateOfMonth = allMonthDates[allMonthDates.length - 1];
  const joiningDate = staff.joining_date || staff.joiningDate || null;
  if (joiningDate && typeof joiningDate === 'string' && joiningDate > lastDateOfMonth) {
    reasons.push('not_started');
  }

  const staffCode = staff.staff_code ?? staff.staffCode ?? null;
  const staffName = staff.name ?? staff.staff_name ?? '';

  if (reasons.length > 0) {
    return {
      calculable: false,
      staff_id: staff.id,
      staff_code: staffCode,
      staff_name: staffName,
      reasons
    };
  }

  // 1. Calendar
  const working_days_in_month = workingDates.length;

  // 2. Window
  const firstDateOfMonth = allMonthDates[0];
  const windowStart = (joiningDate && joiningDate > firstDateOfMonth) ? joiningDate : firstDateOfMonth;
  const payableDates = workingDates.filter(d => d >= windowStart);
  const payable_working_days = payableDates.length;

  // 3. Rates (full month working days used for day rate)
  const day_rate = base_salary / working_days_in_month;
  const shift_minutes = shiftMinutes;
  const minute_rate = day_rate / shift_minutes;

  // 4. Attendance
  const payableDatesSet = new Set(payableDates);
  const warnings = [];
  const addWarning = (w) => {
    if (!warnings.includes(w)) warnings.push(w);
  };
  let ignored_rows_count = 0;
  const invalid_rows = [];
  const validRowsByDate = new Map();

  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  for (const row of safeAttendance) {
    if (!row || typeof row !== 'object' || !row.date || !payableDatesSet.has(row.date)) {
      ignored_rows_count += 1;
      continue;
    }
    const status = row.status;
    if (!['present', 'absent', 'leave', 'half_leave'].includes(status)) {
      invalid_rows.push(row);
      continue;
    }
    if (validRowsByDate.has(row.date)) {
      addWarning('duplicate_rows');
    }
    validRowsByDate.set(row.date, row);
  }

  let present_days = 0;
  let absent_days = 0;
  let leave_days_taken = 0;
  let late_minutes_charged = 0;
  let early_minutes_charged = 0;
  let total_charged_minutes = 0;
  let capped_days = 0;
  const missing_dates = [];

  const lateGrace = settings.late_grace_minutes || 0;
  const earlyGrace = settings.early_leave_grace_minutes || 0;

  for (const date of payableDates) {
    const row = validRowsByDate.get(date);
    if (!row) {
      missing_dates.push(date);
      continue;
    }

    const status = row.status;
    if (status === 'present') {
      present_days += 1;
    } else if (status === 'half_leave') {
      present_days += 0.5;
      leave_days_taken += 0.5;
    } else if (status === 'leave') {
      leave_days_taken += 1;
    } else if (status === 'absent') {
      absent_days += 1;
    }

    if (status === 'present' || status === 'half_leave') {
      const lateVal = row.late_minutes ?? row.lateMinutes;
      const earlyVal = row.early_leave_minutes ?? row.earlyLeaveMinutes;
      let lateM = 0;
      let earlyM = 0;

      if (lateVal !== undefined && lateVal !== null && lateVal !== '') {
        const parsed = Number(lateVal);
        if (!Number.isFinite(parsed) || parsed < 0) {
          addWarning('bad_minutes');
          lateM = 0;
        } else {
          lateM = parsed;
        }
      }
      if (earlyVal !== undefined && earlyVal !== null && earlyVal !== '') {
        const parsed = Number(earlyVal);
        if (!Number.isFinite(parsed) || parsed < 0) {
          addWarning('bad_minutes');
          earlyM = 0;
        } else {
          earlyM = parsed;
        }
      }

      const chargedLate = Math.max(0, lateM - lateGrace);
      const chargedEarly = Math.max(0, earlyM - earlyGrace);
      const uncappedDay = chargedLate + chargedEarly;
      const dayTotal = Math.min(uncappedDay, shift_minutes);
      if (uncappedDay > shift_minutes) {
        capped_days += 1;
      }
      late_minutes_charged += chargedLate;
      early_minutes_charged += chargedEarly;
      total_charged_minutes += dayTotal;
    }
  }

  const is_complete = missing_dates.length === 0;

  // 5. Leave
  const fiscalStartMonth = settings.fiscal_year_start_month || 4;
  const fiscalCtx = getFiscalContext(month, fiscalStartMonth, joiningDate);
  const months_elapsed = fiscalCtx.months_elapsed;
  const monthlyAccrual = settings.monthly_leave_accrual || 0;
  const accrued_to_date = monthlyAccrual * months_elapsed;
  const used_before = leave_opening_used_days + prior_paid_leave_days;
  const available_before = Math.max(0, accrued_to_date - used_before);
  const paid_leave_days = Math.min(leave_days_taken, available_before);
  const unpaid_leave_days = leave_days_taken - paid_leave_days;
  const leave_balance_after = Math.max(0, available_before - paid_leave_days);
  const is_last_month_of_fiscal_year = fiscalCtx.is_last_month_of_fiscal_year;

  let leave_encashment_days = 0;
  let leave_encashment_amount = 0;
  if (is_last_month_of_fiscal_year) {
    leave_encashment_days = leave_balance_after;
    leave_encashment_amount = leave_encashment_days * day_rate;
  }

  // 6. Money
  const base_pay = day_rate * payable_working_days;
  const absence_deduction = absent_days * day_rate;
  const unpaid_leave_deduction = unpaid_leave_days * day_rate;
  const time_deduction = total_charged_minutes * minute_rate;
  const bonus = adjustments.bonus || 0;
  const advance_deduction = adjustments.advance_deduction || 0;
  const other_deduction = adjustments.other_deduction || 0;

  const gross = base_pay + leave_encashment_amount + bonus;
  const deductions = absence_deduction + unpaid_leave_deduction + time_deduction + advance_deduction + other_deduction;

  const net_unrounded = roundHalfUp(gross - deductions, 6);
  const roundedNetCandidate = roundHalfUp(net_unrounded, 0);
  const was_clamped = roundedNetCandidate < 0;
  const net_salary = Math.max(0, roundedNetCandidate);

  const base_pay_2dec = roundHalfUp(base_pay, 2);
  const encashment_2dec = roundHalfUp(leave_encashment_amount, 2);
  const bonus_2dec = roundHalfUp(bonus, 2);
  const absence_2dec = roundHalfUp(absence_deduction, 2);
  const unpaid_leave_2dec = roundHalfUp(unpaid_leave_deduction, 2);
  const time_2dec = roundHalfUp(time_deduction, 2);
  const advance_2dec = roundHalfUp(advance_deduction, 2);
  const other_2dec = roundHalfUp(other_deduction, 2);

  const combined_2dec = (base_pay_2dec + encashment_2dec + bonus_2dec) -
    (absence_2dec + unpaid_leave_2dec + time_2dec + advance_2dec + other_2dec);
  const rounding_adjustment = roundHalfUp(net_salary - combined_2dec, 2);

  return {
    calculable: true,
    staff_id: staff.id,
    staff_code: staffCode,
    staff_name: staffName,
    month,
    base_salary: roundHalfUp(base_salary, 2),
    working_days_in_month,
    payable_working_days,
    day_rate: roundHalfUp(day_rate, 4),
    shift_minutes,
    minute_rate: roundHalfUp(minute_rate, 6),
    present_days: roundHalfUp(present_days, 2),
    absent_days: roundHalfUp(absent_days, 2),
    leave_days_taken: roundHalfUp(leave_days_taken, 2),
    paid_leave_days: roundHalfUp(paid_leave_days, 2),
    unpaid_leave_days: roundHalfUp(unpaid_leave_days, 2),
    leave_balance_after: roundHalfUp(leave_balance_after, 2),
    late_minutes_charged: roundHalfUp(late_minutes_charged, 2),
    early_minutes_charged: roundHalfUp(early_minutes_charged, 2),
    absence_deduction: absence_2dec,
    unpaid_leave_deduction: unpaid_leave_2dec,
    time_deduction: time_2dec,
    leave_encashment_days: roundHalfUp(leave_encashment_days, 2),
    leave_encashment_amount: encashment_2dec,
    bonus: bonus_2dec,
    advance_deduction: advance_2dec,
    other_deduction: other_2dec,
    net_salary,
    base_pay: base_pay_2dec,
    accrued_leave_to_date: roundHalfUp(accrued_to_date, 2),
    available_leave_before: roundHalfUp(available_before, 2),
    is_last_month_of_fiscal_year,
    capped_days,
    rounding_adjustment,
    was_clamped,
    is_complete,
    missing_dates,
    invalid_rows,
    ignored_rows_count,
    warnings
  };
}

/**
 * Calculates monthly payroll for all staff members.
 *
 * @param {object} input
 * @returns {object}
 */
export function calculateMonthlyPayroll(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('Input must be an object');
  }

  const {
    month,
    settings,
    holidays = [],
    staff_list = [],
    salaries_by_staff_id = {},
    attendance = [],
    opening_by_staff_id = {},
    prior_paid_by_staff_id = {},
    adjustments_by_staff_id = {}
  } = input;

  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError(`Invalid month format: ${month}. Expected YYYY-MM`);
  }
  if (!settings || typeof settings !== 'object') {
    throw new TypeError('settings must be an object');
  }

  const workingDates = getWorkingDates(month, settings.weekly_off_days, holidays);
  const working_days_in_month = workingDates.length;

  const attMap = new Map();
  if (Array.isArray(attendance)) {
    for (const r of attendance) {
      if (!r || typeof r !== 'object') continue;
      const sId = String(r.staff_id || r.staffId || (r.staff && r.staff.id) || '');
      if (!sId) continue;
      if (!attMap.has(sId)) attMap.set(sId, []);
      attMap.get(sId).push(r);
    }
  }

  const items = [];
  const not_calculable = [];
  const incomplete_staff_ids = [];

  const safeStaffList = Array.isArray(staff_list) ? staff_list : [];
  for (const staff of safeStaffList) {
    if (!staff || typeof staff !== 'object') continue;
    const sId = String(staff.id);

    let baseSalary = null;
    if (salaries_by_staff_id && typeof salaries_by_staff_id === 'object') {
      const sEntry = salaries_by_staff_id[sId] ?? salaries_by_staff_id[staff.id];
      if (sEntry !== undefined && sEntry !== null) {
        if (typeof sEntry === 'object' && sEntry.base_salary !== undefined) {
          baseSalary = sEntry.base_salary;
        } else if (typeof sEntry === 'number') {
          baseSalary = sEntry;
        }
      }
    }

    const teacherAtt = attMap.get(sId) || [];
    const openingDays = (opening_by_staff_id && (opening_by_staff_id[sId] ?? opening_by_staff_id[staff.id])) || 0;
    const priorPaid = (prior_paid_by_staff_id && (prior_paid_by_staff_id[sId] ?? prior_paid_by_staff_id[staff.id])) || 0;
    const adjs = (adjustments_by_staff_id && (adjustments_by_staff_id[sId] ?? adjustments_by_staff_id[staff.id])) || { bonus: 0, advance_deduction: 0, other_deduction: 0 };

    const res = calculateStaffPayroll({
      month,
      staff,
      base_salary: baseSalary,
      settings,
      holidays,
      attendance: teacherAtt,
      leave_opening_used_days: Number(openingDays) || 0,
      prior_paid_leave_days: Number(priorPaid) || 0,
      adjustments: {
        bonus: Number(adjs.bonus || 0),
        advance_deduction: Number(adjs.advance_deduction || 0),
        other_deduction: Number(adjs.other_deduction || 0)
      }
    });

    if (res.calculable) {
      items.push(res);
      if (!res.is_complete) {
        incomplete_staff_ids.push(res.staff_id);
      }
    } else {
      not_calculable.push({
        staff_id: res.staff_id,
        staff_code: res.staff_code,
        staff_name: res.staff_name,
        reasons: res.reasons
      });
    }
  }

  // Sort by numeric staff_code ascending
  items.sort((a, b) => Number(a.staff_code || 0) - Number(b.staff_code || 0));
  not_calculable.sort((a, b) => Number(a.staff_code || 0) - Number(b.staff_code || 0));

  const net_total = roundHalfUp(items.reduce((s, it) => s + (it.net_salary || 0), 0), 2);
  const deductions_total = roundHalfUp(items.reduce((s, it) => s + (
    (it.absence_deduction || 0) +
    (it.unpaid_leave_deduction || 0) +
    (it.time_deduction || 0) +
    (it.advance_deduction || 0) +
    (it.other_deduction || 0)
  ), 0), 2);

  const totals = {
    teachers_count: items.length,
    net_total,
    deductions_total,
    incomplete_count: incomplete_staff_ids.length
  };

  return {
    month,
    working_days_in_month,
    items,
    not_calculable,
    incomplete_staff_ids,
    totals
  };
}

