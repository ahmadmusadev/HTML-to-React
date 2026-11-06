import { PAYROLL_REASON_URDU, roundHalfUp } from './PayrollCalc';
import { MONTH_NAMES_URDU, toUrduPayrollError } from './PayrollMappers';

/**
 * Converts 'YYYY-MM' to 'YYYY-MM-01'.
 *
 * @param {string} month
 * @returns {string}
 */
export function isoMonthToRunDate(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new TypeError(`Invalid month format: ${month}. Expected YYYY-MM`);
  }
  return `${month}-01`;
}

/**
 * Converts 'YYYY-MM-01' (or 'YYYY-MM-DD') to 'YYYY-MM'.
 *
 * @param {string} runDate
 * @returns {string}
 */
export function runDateToIsoMonth(runDate) {
  if (typeof runDate !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(runDate)) {
    throw new TypeError(`Invalid runDate format: ${runDate}. Expected YYYY-MM-DD`);
  }
  return runDate.slice(0, 7);
}

/**
 * Returns Urdu month and year label, e.g. 'نومبر 2026'.
 *
 * @param {string} month 'YYYY-MM'
 * @returns {string}
 */
export function monthLabelUrdu(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return '';
  }
  const [yearStr, monthStr] = month.split('-');
  const monthIdx = parseInt(monthStr, 10);
  const name = MONTH_NAMES_URDU[monthIdx] || '';
  return `${name} ${yearStr}`.trim();
}

/**
 * Returns Urdu date label, e.g. '5 نومبر 2026'.
 *
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {string}
 */
export function dateLabelUrdu(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(dateStr)) {
    return '';
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const monthIdx = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const monthName = MONTH_NAMES_URDU[monthIdx] || '';
  return `${day} ${monthName} ${yearStr}`;
}

/**
 * Formats a local Date object into 'YYYY-MM-DD' using local getters.
 * Parameterized, does NOT call new Date() without args internally.
 *
 * @param {Date} dateObj
 * @returns {string}
 */
export function localTodayIso(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    throw new TypeError('Valid Date object required');
  }
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a numeric amount with thousands separators and 'روپے'.
 *
 * @param {number} n
 * @returns {string}
 */
export function formatRupees(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString('en-US')} روپے`;
}

/**
 * Calculates fiscal year start month string 'YYYY-MM' for a given month 'YYYY-MM'
 * and fiscalStartMonth (integer 1-12).
 *
 * @param {string} month 'YYYY-MM'
 * @param {number} fiscalStartMonth
 * @returns {string} 'YYYY-MM'
 */
function getFiscalYearStartMonthIso(month, fiscalStartMonth = 4) {
  const [yStr, mStr] = month.split('-');
  let y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (m < fiscalStartMonth) {
    y -= 1;
  }
  return `${y}-${String(fiscalStartMonth).padStart(2, '0')}`;
}

/**
 * Validates whether a run can be created or opened for the requested month.
 *
 * Rules:
 * - Reject future months (if todayMonth is provided and month > todayMonth).
 * - If a run for the exact month already exists, it is allowed (open existing).
 * - Inside the fiscal year of `month`:
 *   - If NO finalized run exists, any month is allowed.
 *   - If finalized runs exist, the month must be exactly the month after the latest
 *     finalized one (no gaps, nothing earlier).
 * - A different fiscal year starts fresh.
 *
 * @param {object} params
 * @param {string} params.month 'YYYY-MM'
 * @param {number} [params.fiscalStartMonth=4]
 * @param {Array} [params.runs=[]] Array of runs: { id, month, status }
 * @param {string} [params.todayMonth] 'YYYY-MM'
 * @returns {{ allowed: boolean, reasonUrdu: string }}
 */
export function canCreateRunForMonth({
  month,
  fiscalStartMonth = 4,
  runs = [],
  todayMonth
}) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { allowed: false, reasonUrdu: 'غلط ماہانہ تاریخ۔' };
  }

  // Reject future months
  if (todayMonth && month > todayMonth) {
    return {
      allowed: false,
      reasonUrdu: 'مستقبل کے مہینے کا پے رول نہیں بنایا جا سکتا۔'
    };
  }

  const safeRuns = Array.isArray(runs) ? runs : [];

  // If a run already exists for this exact month, it is allowed (will be opened, not created)
  const exactRun = safeRuns.find((r) => {
    if (!r || !r.month) return false;
    const rMonth = String(r.month).slice(0, 7);
    return rMonth === month;
  });
  if (exactRun) {
    return { allowed: true, reasonUrdu: '' };
  }

  // Determine current fiscal year start for requested month
  const targetFiscalStart = getFiscalYearStartMonthIso(month, fiscalStartMonth);
  const [targetFiscalYear] = targetFiscalStart.split('-').map(Number);
  const nextFiscalStart = `${targetFiscalYear + 1}-${String(fiscalStartMonth).padStart(2, '0')}`;

  // Find finalized runs strictly within the same fiscal year
  const finalizedInSameFiscalYear = safeRuns.filter((r) => {
    if (!r || !r.month || r.status !== 'finalized') return false;
    const rMonth = String(r.month).slice(0, 7);
    return rMonth >= targetFiscalStart && rMonth < nextFiscalStart;
  });

  // If no finalized run exists in this fiscal year, any month in this fiscal year is allowed
  if (finalizedInSameFiscalYear.length === 0) {
    return { allowed: true, reasonUrdu: '' };
  }

  // Sort finalized runs descending to find the latest finalized month
  finalizedInSameFiscalYear.sort((a, b) => {
    const ma = String(a.month).slice(0, 7);
    const mb = String(b.month).slice(0, 7);
    return mb.localeCompare(ma);
  });

  const latestFinalizedMonth = String(finalizedInSameFiscalYear[0].month).slice(0, 7);

  // Compute the expected next month after latest finalized
  const [lYear, lMonth] = latestFinalizedMonth.split('-').map(Number);
  let expYear = lYear;
  let expMonth = lMonth + 1;
  if (expMonth > 12) {
    expMonth = 1;
    expYear += 1;
  }
  const expectedNextMonth = `${expYear}-${String(expMonth).padStart(2, '0')}`;

  if (month === expectedNextMonth) {
    return { allowed: true, reasonUrdu: '' };
  }

  if (month <= latestFinalizedMonth) {
    return {
      allowed: false,
      reasonUrdu: 'اس مہینے یا اس کے بعد کا پے رول پہلے ہی فائنل ہو چکا ہے۔'
    };
  }

  return {
    allowed: false,
    reasonUrdu: `درمیانی مہینوں کو چھوڑ کر پے رول نہیں بنایا جا سکتا۔ پہلے ${monthLabelUrdu(expectedNextMonth)} کا پے رول فائنل کریں۔`
  };
}

/**
 * Builds adjustments map from an array of engine items or stored rows.
 *
 * @param {Array} itemsOrRows
 * @returns {object} { [staff_id]: { bonus, advance_deduction, other_deduction } }
 */
export function buildAdjustments(itemsOrRows) {
  const result = {};
  if (!Array.isArray(itemsOrRows)) return result;

  for (const item of itemsOrRows) {
    if (!item || typeof item !== 'object') continue;
    const staffId = String(item.staff_id || (item.staff && item.staff.id) || '');
    if (!staffId) continue;

    result[staffId] = {
      bonus: Number(item.bonus || 0),
      advance_deduction: Number(item.advance_deduction || 0),
      other_deduction: Number(item.other_deduction || 0)
    };
  }
  return result;
}

/**
 * Exact PostgREST column whitelist for payroll_items.
 * Extra keys cause DB insert/update failures.
 */
export const PAYROLL_ITEM_COLUMNS = Object.freeze([
  'id',
  'run_id',
  'madrasa_id',
  'staff_id',
  'base_salary',
  'working_days_in_month',
  'payable_working_days',
  'day_rate',
  'shift_minutes',
  'minute_rate',
  'present_days',
  'absent_days',
  'leave_days_taken',
  'paid_leave_days',
  'unpaid_leave_days',
  'leave_balance_after',
  'late_minutes_charged',
  'early_minutes_charged',
  'absence_deduction',
  'unpaid_leave_deduction',
  'time_deduction',
  'leave_encashment_days',
  'leave_encashment_amount',
  'bonus',
  'advance_deduction',
  'other_deduction',
  'net_salary',
  'payment_status',
  'paid_on',
  'notes'
]);

/**
 * Whitelists and sanitizes an engine item or user data into a payroll_items row.
 *
 * @param {object} item
 * @param {string} runId
 * @param {string} madrasaId
 * @param {object} [adjustments={}]
 * @param {string} [notes]
 * @returns {object} Whitelisted database payload
 */
export function itemToRow(item, runId, madrasaId, adjustments = {}, notes) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('item must be an object');
  }

  const staffId = item.staff_id || (item.staff && item.staff.id);
  const bonus = Number(adjustments.bonus !== undefined ? adjustments.bonus : item.bonus) || 0;
  const advance = Number(adjustments.advance_deduction !== undefined ? adjustments.advance_deduction : item.advance_deduction) || 0;
  const other = Number(adjustments.other_deduction !== undefined ? adjustments.other_deduction : item.other_deduction) || 0;

  const row = {
    run_id: runId,
    madrasa_id: madrasaId,
    staff_id: staffId,
    base_salary: roundHalfUp(item.base_salary || 0, 2),
    working_days_in_month: Number(item.working_days_in_month || 0),
    payable_working_days: roundHalfUp(item.payable_working_days || 0, 2),
    day_rate: roundHalfUp(item.day_rate || 0, 4),
    shift_minutes: Number(item.shift_minutes || 0),
    minute_rate: roundHalfUp(item.minute_rate || 0, 6),
    present_days: roundHalfUp(item.present_days || 0, 2),
    absent_days: roundHalfUp(item.absent_days || 0, 2),
    leave_days_taken: roundHalfUp(item.leave_days_taken || 0, 2),
    paid_leave_days: roundHalfUp(item.paid_leave_days || 0, 2),
    unpaid_leave_days: roundHalfUp(item.unpaid_leave_days || 0, 2),
    leave_balance_after: roundHalfUp(item.leave_balance_after || 0, 2),
    late_minutes_charged: roundHalfUp(item.late_minutes_charged || 0, 2),
    early_minutes_charged: roundHalfUp(item.early_minutes_charged || 0, 2),
    absence_deduction: roundHalfUp(item.absence_deduction || 0, 2),
    unpaid_leave_deduction: roundHalfUp(item.unpaid_leave_deduction || 0, 2),
    time_deduction: roundHalfUp(item.time_deduction || 0, 2),
    leave_encashment_days: roundHalfUp(item.leave_encashment_days || 0, 2),
    leave_encashment_amount: roundHalfUp(item.leave_encashment_amount || 0, 2),
    bonus: roundHalfUp(bonus, 2),
    advance_deduction: roundHalfUp(advance, 2),
    other_deduction: roundHalfUp(other, 2),
    net_salary: roundHalfUp(item.net_salary || 0, 2),
    payment_status: item.payment_status === 'paid' ? 'paid' : 'unpaid',
    paid_on: item.paid_on || null,
    notes: notes !== undefined ? (notes ? String(notes).trim() : null) : (item.notes ? String(item.notes).trim() : null)
  };

  if (item.id) {
    row.id = item.id;
  }

  // Exact whitelist enforcement
  const cleanPayload = {};
  for (const col of PAYROLL_ITEM_COLUMNS) {
    if (row[col] !== undefined) {
      cleanPayload[col] = row[col];
    }
  }

  return cleanPayload;
}

/**
 * Transforms a stored DB row and staff metadata into a UI display item.
 *
 * @param {object} row
 * @param {object} [staff]
 * @returns {object}
 */
export function rowToDisplayItem(row, staff = {}) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    run_id: row.run_id,
    staff_id: row.staff_id,
    staff_code: staff.staff_code || staff.code || row.staff_code || '',
    staff_name: staff.name || row.staff_name || '',
    base_salary: Number(row.base_salary || 0),
    working_days_in_month: Number(row.working_days_in_month || 0),
    payable_working_days: Number(row.payable_working_days || 0),
    day_rate: Number(row.day_rate || 0),
    shift_minutes: Number(row.shift_minutes || 0),
    minute_rate: Number(row.minute_rate || 0),
    present_days: Number(row.present_days || 0),
    absent_days: Number(row.absent_days || 0),
    leave_days_taken: Number(row.leave_days_taken || 0),
    paid_leave_days: Number(row.paid_leave_days || 0),
    unpaid_leave_days: Number(row.unpaid_leave_days || 0),
    leave_balance_after: Number(row.leave_balance_after || 0),
    late_minutes_charged: Number(row.late_minutes_charged || 0),
    early_minutes_charged: Number(row.early_minutes_charged || 0),
    absence_deduction: Number(row.absence_deduction || 0),
    unpaid_leave_deduction: Number(row.unpaid_leave_deduction || 0),
    time_deduction: Number(row.time_deduction || 0),
    leave_encashment_days: Number(row.leave_encashment_days || 0),
    leave_encashment_amount: Number(row.leave_encashment_amount || 0),
    bonus: Number(row.bonus || 0),
    advance_deduction: Number(row.advance_deduction || 0),
    other_deduction: Number(row.other_deduction || 0),
    net_salary: Number(row.net_salary || 0),
    payment_status: row.payment_status || 'unpaid',
    paid_on: row.paid_on || null,
    notes: row.notes || '',
    is_complete: true
  };
}

/**
 * Compares stored rows against freshly calculated engine items.
 * Tolerance: 0.005.
 *
 * @param {Array} storedRows
 * @param {Array} freshItems
 * @returns {{ hasDrift: boolean, changedStaffIds: string[] }}
 */
export function findDrift(storedRows = [], freshItems = []) {
  const storedMap = new Map();
  for (const r of storedRows || []) {
    if (r && r.staff_id) storedMap.set(String(r.staff_id), r);
  }

  const freshMap = new Map();
  for (const item of freshItems || []) {
    if (item && item.staff_id) freshMap.set(String(item.staff_id), item);
  }

  const changedStaffIds = new Set();

  // Teachers added or removed
  for (const sId of storedMap.keys()) {
    if (!freshMap.has(sId)) {
      changedStaffIds.add(sId);
    }
  }
  for (const sId of freshMap.keys()) {
    if (!storedMap.has(sId)) {
      changedStaffIds.add(sId);
    }
  }

  const fields = [
    'net_salary',
    'absence_deduction',
    'unpaid_leave_deduction',
    'time_deduction',
    'paid_leave_days',
    'unpaid_leave_days',
    'present_days',
    'absent_days',
    'leave_encashment_amount'
  ];

  const TOLERANCE = 0.005;

  for (const [sId, stored] of storedMap.entries()) {
    const fresh = freshMap.get(sId);
    if (!fresh) continue;

    for (const field of fields) {
      const vStored = Number(stored[field] || 0);
      const vFresh = Number(fresh[field] || 0);
      if (Math.abs(vStored - vFresh) > TOLERANCE) {
        changedStaffIds.add(sId);
        break;
      }
    }
  }

  const list = Array.from(changedStaffIds);
  return {
    hasDrift: list.length > 0,
    changedStaffIds: list
  };
}

/**
 * Returns finalization blockers based on engine calculation results.
 * Excludes 'not_started' teachers silently.
 *
 * @param {object} params
 * @param {object} params.engineResult
 * @param {Array} [params.staffList=[]]
 * @returns {Array<{ code: string, message: string }>}
 */
export function getFinalizeBlockers({ engineResult, staffList = [] }) {
  const blockers = [];

  if (!engineResult || !Array.isArray(engineResult.items) || engineResult.items.length === 0) {
    blockers.push({
      code: 'NO_ITEMS',
      message: 'پے رول میں کوئی استاد شامل نہیں ہے۔'
    });
    return blockers;
  }

  const staffMap = new Map();
  if (Array.isArray(staffList)) {
    for (const s of staffList) {
      if (s && s.id !== undefined && s.id !== null) {
        staffMap.set(String(s.id), s);
      }
    }
  }

  const resolveStaffName = (id, existingName, existingCode) => {
    if (existingName && existingName !== 'نامعلوم استاد' && existingName !== 'نامعلوم') {
      return existingName;
    }
    const staff = staffMap.get(String(id));
    if (staff && staff.name && String(staff.name).trim() !== '') {
      return staff.name;
    }
    if (existingCode) {
      return existingCode;
    }
    if (staff && staff.staff_code && String(staff.staff_code).trim() !== '') {
      return staff.staff_code;
    }
    return 'نامعلوم استاد';
  };

  // Check incomplete attendance for any calculable item
  for (const item of engineResult.items) {
    if (!item.is_complete) {
      const missingDates = Array.isArray(item.missing_dates) ? item.missing_dates : [];
      const formattedDates = missingDates.map(dateLabelUrdu).filter(Boolean);
      const datesStr = formattedDates.length > 0 ? formattedDates.join('، ') : 'نامعلوم تاریخیں';
      const staffName = resolveStaffName(item.staff_id, item.staff_name, item.staff_code);

      blockers.push({
        code: 'INCOMPLETE_ATTENDANCE',
        staff_id: item.staff_id,
        message: `استاد ${staffName} کی حاضری نامکمل ہے (تاریخیں: ${datesStr})`
      });
    }
  }

  // Check not_calculable teachers
  const notCalculable = Array.isArray(engineResult.not_calculable) ? engineResult.not_calculable : [];
  for (const nc of notCalculable) {
    const reasons = Array.isArray(nc.reasons) ? nc.reasons : [];
    // Silently exclude teachers whose sole reason is 'not_started'
    const nonNotStartedReasons = reasons.filter((r) => r !== 'not_started');
    if (nonNotStartedReasons.length > 0) {
      const reasonsUrdu = nonNotStartedReasons
        .map((r) => PAYROLL_REASON_URDU[r] || r)
        .join('، ');
      const staffName = resolveStaffName(nc.staff_id, nc.staff_name, nc.staff_code);

      blockers.push({
        code: nonNotStartedReasons[0].toUpperCase(),
        staff_id: nc.staff_id,
        message: `استاد ${staffName} کا پے رول نامکمل ہے (${reasonsUrdu})`
      });
    }
  }

  return blockers;
}

/**
 * Computes summary totals from an array of stored payroll_items rows.
 *
 * @param {Array} rows
 * @returns {object}
 */
export function totalsFromRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const teachers_count = safeRows.length;

  let net_total = 0;
  let deductions_total = 0;
  let paid_total = 0;
  let unpaid_total = 0;
  let paid_count = 0;

  for (const r of safeRows) {
    if (!r || typeof r !== 'object') continue;
    const net = Number(r.net_salary || 0);
    const absD = Number(r.absence_deduction || 0);
    const unpD = Number(r.unpaid_leave_deduction || 0);
    const timD = Number(r.time_deduction || 0);
    const advD = Number(r.advance_deduction || 0);
    const othD = Number(r.other_deduction || 0);

    const deductions = absD + unpD + timD + advD + othD;

    net_total += net;
    deductions_total += deductions;

    if (r.payment_status === 'paid') {
      paid_total += net;
      paid_count += 1;
    } else {
      unpaid_total += net;
    }
  }

  return {
    teachers_count,
    net_total: roundHalfUp(net_total, 2),
    deductions_total: roundHalfUp(deductions_total, 2),
    paid_total: roundHalfUp(paid_total, 2),
    unpaid_total: roundHalfUp(unpaid_total, 2),
    paid_count
  };
}

/**
 * Converts trigger and database errors into clear, friendly Urdu text.
 * Strictly guarantees that the returned text contains NO Latin letters.
 *
 * @param {any} err
 * @returns {string} Pure Urdu error message
 */
export function toUrduRunError(err) {
  if (!err) return '';

  const msg = typeof err === 'string' ? err : String(err.message || err.details || err.hint || '');
  const code = String(err.code || '');

  if (code === '23505' || msg.includes('payroll_runs_madrasa_id_month_key') || msg.includes('unique constraint')) {
    return 'اس مہینے کا پے رول پہلے سے موجود ہے۔';
  }

  if (msg.includes('Finalized payroll') || msg.includes('finalized run cannot be deleted')) {
    return 'فائنل شدہ پے رول حذف نہیں کیا جا سکتا۔';
  }

  if (msg.includes('figures are locked') || msg.includes('locked')) {
    return 'فائنل شدہ پے رول کے اعداد و شمار مقفل ہیں اور تبدیل نہیں کیے جا سکتے۔';
  }

  if (msg.includes('earlier month is still in draft') || msg.includes('earlier month is still a draft')) {
    return 'پہلے پچھلے مہینوں کا پے رول فائنل کریں۔';
  }

  if (msg.includes('Cannot reopen') || msg.includes('paid items')) {
    return 'جن اساتذہ کو ادائیگی ہو چکی ہو ان کا پے رول دوبارہ نہیں کھولا جا سکتا۔ پہلے تمام ادائیگیاں منسوخ کریں۔';
  }

  if (msg.includes('Only the latest finalized month')) {
    return 'صرف سب سے آخری فائنل شدہ مہینے کا پے رول ہی دوبارہ مسودہ بنایا جا سکتا ہے۔';
  }

  if (msg.includes('Payment can only be recorded')) {
    return 'ادائیگی صرف فائنل شدہ پے رول میں ہی درج کی جا سکتی ہے۔';
  }

  if (msg.includes('cannot be deleted')) {
    return 'یہ ریکارڈ حذف نہیں کیا جا سکتا۔';
  }

  // Delegate to toUrduPayrollError
  const fallback = toUrduPayrollError(err, 'payroll_run');

  // Strip or replace any Latin characters if present
  if (/[a-zA-Z]/.test(fallback)) {
    return 'ڈیٹا بیس میں خرابی پیش آگئی ہے۔ براہ کرم دوبارہ کوشش کریں۔';
  }

  return fallback;
}

/**
 * Validates all typed adjustments before calling the engine or saving.
 *
 * @param {object} adjustments - Map of staff_id -> { bonus, advance_deduction, other_deduction }
 * @param {Map|Array|object} [staffMap] - Staff lookup map, list, or dictionary
 * @returns {{ valid: boolean, messageUrdu: string }}
 */
export function validateAllAdjustments(adjustments = {}, staffMap = null) {
  if (!adjustments || typeof adjustments !== 'object') {
    return { valid: true, messageUrdu: '' };
  }

  const getStaffLabel = (staffId) => {
    let staff = null;
    if (staffMap instanceof Map) {
      staff = staffMap.get(String(staffId)) || staffMap.get(staffId);
    } else if (Array.isArray(staffMap)) {
      staff = staffMap.find((s) => s && (String(s.id) === String(staffId) || s.id === staffId));
    } else if (staffMap && typeof staffMap === 'object') {
      staff = staffMap[staffId] || staffMap[String(staffId)];
    }
    return staff ? (staff.name || staff.staff_code || staffId) : staffId;
  };

  const fields = [
    { key: 'bonus', label: 'بونس' },
    { key: 'advance_deduction', label: 'پیشگی رقم' },
    { key: 'other_deduction', label: 'دیگر کٹوتی' }
  ];

  for (const [staffId, adj] of Object.entries(adjustments)) {
    if (!adj || typeof adj !== 'object') continue;

    for (const field of fields) {
      const raw = adj[field.key];
      if (raw === undefined || raw === null || String(raw).trim() === '') {
        continue;
      }
      const clean = String(raw).trim();
      // Must be non-negative digits, optional decimal with at most 2 digits
      if (!/^\d+(\.\d{1,2})?$/.test(clean)) {
        const staffName = getStaffLabel(staffId);
        return {
          valid: false,
          messageUrdu: `استاد ${staffName}: ${field.label}: رقم صرف مثبت اعداد یا دو اعشاریہ تک ہونی چاہیے۔`
        };
      }
      const num = Number(clean);
      if (Number.isNaN(num) || num < 0 || num > 9999999.99) {
        const staffName = getStaffLabel(staffId);
        return {
          valid: false,
          messageUrdu: `استاد ${staffName}: ${field.label}: رقم 0 سے 9,999,999.99 کے درمیان ہونی چاہیے۔`
        };
      }
    }
  }

  return { valid: true, messageUrdu: '' };
}

/**
 * Detects whether any typed adjustments or notes differ from the stored rows.
 *
 * @param {Array} storedRows - Array of stored payroll_items rows
 * @param {object} adjustments - Map of staff_id -> { bonus, advance_deduction, other_deduction }
 * @param {object} notesState - Map of staff_id -> note string
 * @returns {boolean}
 */
export function hasUnsavedChanges(storedRows = [], adjustments = {}, notesState = {}) {
  const safeRows = Array.isArray(storedRows) ? storedRows : [];
  const storedStaffIds = new Set();

  for (const row of safeRows) {
    if (!row || !row.staff_id) continue;
    const sId = String(row.staff_id);
    storedStaffIds.add(sId);

    const adj = adjustments[sId] || adjustments[row.staff_id] || {};
    const storedBonus = row.bonus !== null && row.bonus !== undefined ? Number(row.bonus) : 0;
    const storedAdv = row.advance_deduction !== null && row.advance_deduction !== undefined ? Number(row.advance_deduction) : 0;
    const storedOth = row.other_deduction !== null && row.other_deduction !== undefined ? Number(row.other_deduction) : 0;

    const typedBonus = adj.bonus !== undefined && adj.bonus !== null && String(adj.bonus).trim() !== '' ? Number(adj.bonus) : 0;
    const typedAdv = adj.advance_deduction !== undefined && adj.advance_deduction !== null && String(adj.advance_deduction).trim() !== '' ? Number(adj.advance_deduction) : 0;
    const typedOth = adj.other_deduction !== undefined && adj.other_deduction !== null && String(adj.other_deduction).trim() !== '' ? Number(adj.other_deduction) : 0;

    if (Math.abs(typedBonus - storedBonus) > 0.001) return true;
    if (Math.abs(typedAdv - storedAdv) > 0.001) return true;
    if (Math.abs(typedOth - storedOth) > 0.001) return true;

    const storedNote = row.notes || '';
    const typedNote = notesState[sId] !== undefined ? notesState[sId] : (notesState[row.staff_id] !== undefined ? notesState[row.staff_id] : '');
    if (String(typedNote) !== String(storedNote)) return true;
  }

  // Check adjustments for any staff not in stored rows
  if (adjustments && typeof adjustments === 'object') {
    for (const [staffId, adj] of Object.entries(adjustments)) {
      if (!storedStaffIds.has(String(staffId)) && adj && typeof adj === 'object') {
        const b = adj.bonus !== undefined && adj.bonus !== null && String(adj.bonus).trim() !== '' ? Number(adj.bonus) : 0;
        const a = adj.advance_deduction !== undefined && adj.advance_deduction !== null && String(adj.advance_deduction).trim() !== '' ? Number(adj.advance_deduction) : 0;
        const o = adj.other_deduction !== undefined && adj.other_deduction !== null && String(adj.other_deduction).trim() !== '' ? Number(adj.other_deduction) : 0;
        if (b !== 0 || a !== 0 || o !== 0) return true;
      }
    }
  }

  // Check notes for any staff not in stored rows
  if (notesState && typeof notesState === 'object') {
    for (const [staffId, note] of Object.entries(notesState)) {
      if (!storedStaffIds.has(String(staffId)) && note && String(note).trim() !== '') {
        return true;
      }
    }
  }

  return false;
}
