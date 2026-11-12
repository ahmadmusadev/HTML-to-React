import { roundHalfUp } from './PayrollCalc';
import { monthLabelUrdu, totalsFromRows } from './PayrollRunLogic';

/**
 * Formats day quantities without unnecessary trailing zeros.
 * 25 -> '25', 25.5 -> '25.5'
 *
 * @param {number|string} n
 * @returns {string}
 */
export function formatDays(n) {
  if (n === null || n === undefined || n === '') return '0';
  const num = Number(n);
  if (Number.isNaN(num)) return '0';
  if (num % 1 === 0) return String(num);
  return parseFloat(num.toFixed(2)).toString();
}

/**
 * Extracts a numeric value from staff_code for natural ascending sort.
 * e.g. '2' -> 2, '10' -> 10, 'T-09' -> 9
 *
 * @param {string|number} code
 * @returns {number}
 */
export function getNumericStaffCode(code) {
  if (typeof code === 'number') return code;
  const match = String(code || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * Builds printable salary slip data from a single stored payroll_items row.
 * PURE: no React, no DB, no new Date() without arguments.
 *
 * @param {object} row Stored payroll_items row
 * @param {object} staff Staff profile from staffList
 * @param {object} run Payroll run object
 * @param {string} madrasaName Name of the madrasa
 * @returns {object} Plain slip data object
 */
export function buildSlipData(row = {}, staff = {}, run = {}, madrasaName = '') {
  const staffName = staff?.name || staff?.staff_name || row?.staff_name || '';
  const staffCode = staff?.staff_code || staff?.code || row?.staff_code || '';
  const runMonth = run?.month_date || run?.month || '';

  const baseSalary = Number(row?.base_salary || 0);
  const workingDays = Number(row?.working_days_in_month || 0);
  const payableDays = Number(row?.payable_working_days || 0);

  const basePayDisplay = workingDays > 0
    ? roundHalfUp((baseSalary / workingDays) * payableDays, 2)
    : 0;

  const encashmentDays = Number(row?.leave_encashment_days || 0);
  const encashmentAmount = Number(row?.leave_encashment_amount || 0);
  const bonus = Number(row?.bonus || 0);

  const absenceDeduction = Number(row?.absence_deduction || 0);
  const unpaidLeaveDeduction = Number(row?.unpaid_leave_deduction || 0);
  const timeDeduction = Number(row?.time_deduction || 0);
  const advanceDeduction = Number(row?.advance_deduction || 0);
  const otherDeduction = Number(row?.other_deduction || 0);

  const totalDeductions = roundHalfUp(
    absenceDeduction + unpaidLeaveDeduction + timeDeduction + advanceDeduction + otherDeduction,
    2
  );

  const netSalary = Number(row?.net_salary || 0);

  // Computed net before zero clamp
  const computedNet = roundHalfUp(
    basePayDisplay +
    encashmentAmount +
    bonus -
    absenceDeduction -
    unpaidLeaveDeduction -
    timeDeduction -
    advanceDeduction -
    otherDeduction,
    2
  );

  const roundingDisplay = roundHalfUp(netSalary - computedNet, 2);

  let wasClamped = false;
  let consistent = false;
  let clampedMessage = '';

  if (netSalary === 0 && computedNet < 0) {
    wasClamped = true;
    consistent = true;
    clampedMessage = 'کٹوتیاں قابل ادائیگی رقم سے زیادہ تھیں، خالص تنخواہ صفر کی گئی';
  } else {
    consistent = Math.abs(roundingDisplay) <= 1;
  }

  const showRounding = !wasClamped && roundingDisplay !== 0;
  const notesStr = row?.notes ? String(row.notes).trim() : '';
  const paymentStatus = row?.payment_status || 'unpaid';
  const isPaid = paymentStatus === 'paid';

  return {
    madrasa_name: madrasaName || '',
    title_urdu: 'تنخواہ کی سلپ',
    month_label: runMonth ? monthLabelUrdu(runMonth) : '',
    staff_name: staffName,
    staff_code: String(staffCode),

    // Attendance
    attendance_section_title: 'حاضری کی تفصیل',
    working_days: formatDays(workingDays),
    payable_days: formatDays(payableDays),
    present_days: formatDays(row?.present_days),
    absent_days: formatDays(row?.absent_days),
    leave_days_taken: formatDays(row?.leave_days_taken),
    paid_leave_days: formatDays(row?.paid_leave_days),
    unpaid_leave_days: formatDays(row?.unpaid_leave_days),
    leave_balance_after: formatDays(row?.leave_balance_after),

    // Time
    time_section_title: 'اوقات کی تفصیل',
    shift_minutes: Number(row?.shift_minutes || 0),
    late_minutes_charged: Number(row?.late_minutes_charged || 0),
    late_minutes_label_urdu: 'تاخیر کے قابل کٹوتی منٹ',
    early_minutes_charged: Number(row?.early_minutes_charged || 0),
    early_minutes_label_urdu: 'جلدی روانگی کے قابل کٹوتی منٹ',

    // Earnings
    earnings_section_title: 'آمدنی و واجبات',
    base_salary: baseSalary,
    base_pay_display: basePayDisplay,
    base_pay_title_urdu: 'قابل ادائیگی ایام کی تنخواہ',
    leave_encashment_days: encashmentDays,
    leave_encashment_amount: encashmentAmount,
    bonus: bonus,

    // Deductions
    deductions_section_title: 'کٹوتیاں',
    absence_deduction: absenceDeduction,
    unpaid_leave_deduction: unpaidLeaveDeduction,
    time_deduction: timeDeduction,
    advance_deduction: advanceDeduction,
    other_deduction: otherDeduction,
    total_deductions: totalDeductions,

    // Net, Rounding & Clamping
    net_salary: netSalary,
    computed_net: computedNet,
    rounding_display: roundingDisplay,
    show_rounding: showRounding,
    rounding_label_urdu: 'روپے کی گول بندی',
    was_clamped: wasClamped,
    clamped_message_urdu: clampedMessage,

    // Flags for conditional sections
    has_encashment: encashmentDays > 0 && encashmentAmount > 0,
    has_bonus: bonus > 0,
    has_advance: advanceDeduction > 0,
    has_other: otherDeduction > 0,
    has_notes: notesStr.length > 0,
    notes: notesStr,

    // Payment details
    payment_status: paymentStatus,
    payment_status_urdu: isPaid ? 'ادا شدہ' : 'غیر ادا شدہ',
    paid_on: row?.paid_on || null,
    is_paid: isPaid,

    // Consistency
    consistent: consistent
  };
}

/**
 * Builds printable monthly payroll report data across all staff in a run.
 * Sorts rows by numeric staff_code ascending.
 *
 * @param {Array} rows Stored payroll_items rows
 * @param {Array} staffList Staff list from madrasa
 * @param {object} run Payroll run object
 * @returns {{ rows: Array, totals: object, inconsistent_staff_names: Array, consistent: boolean }}
 */
export function buildReportData(rows = [], staffList = [], run = {}) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];
  const staffMap = new Map((Array.isArray(staffList) ? staffList : []).map((s) => [s.id, s]));

  // Attach staff details and sort by numeric staff_code ascending
  const enrichedRows = safeRows.map((r) => {
    const st = staffMap.get(r.staff_id) || {};
    const code = st.staff_code || st.code || r.staff_code || '';
    const name = st.name || st.staff_name || r.staff_name || '';
    return {
      ...r,
      staff_code: String(code),
      staff_name: name
    };
  });

  enrichedRows.sort((a, b) => {
    const numA = getNumericStaffCode(a.staff_code);
    const numB = getNumericStaffCode(b.staff_code);
    if (numA !== numB) return numA - numB;
    return a.staff_code.localeCompare(b.staff_code);
  });

  let baseSalaryTotal = 0;
  let absenceTotal = 0;
  let unpaidLeaveTotal = 0;
  let timeTotal = 0;
  let bonusTotal = 0;
  let advanceTotal = 0;
  let otherTotal = 0;
  let netTotal = 0;
  let paidTotal = 0;
  let unpaidTotal = 0;
  let paidCount = 0;

  const inconsistentStaffNames = [];

  for (const r of enrichedRows) {
    const base = Number(r.base_salary || 0);
    const absD = Number(r.absence_deduction || 0);
    const unpD = Number(r.unpaid_leave_deduction || 0);
    const timD = Number(r.time_deduction || 0);
    const bon = Number(r.bonus || 0);
    const advD = Number(r.advance_deduction || 0);
    const othD = Number(r.other_deduction || 0);
    const net = Number(r.net_salary || 0);

    baseSalaryTotal += base;
    absenceTotal += absD;
    unpaidLeaveTotal += unpD;
    timeTotal += timD;
    bonusTotal += bon;
    advanceTotal += advD;
    otherTotal += othD;
    netTotal += net;

    if (r.payment_status === 'paid') {
      paidTotal += net;
      paidCount += 1;
    } else {
      unpaidTotal += net;
    }

    // Individual slip consistency check
    const st = staffMap.get(r.staff_id) || {};
    const slip = buildSlipData(r, st, run, '');
    if (!slip.consistent) {
      const name = r.staff_name || r.staff_code || 'استاذ';
      if (!inconsistentStaffNames.includes(name)) {
        inconsistentStaffNames.push(name);
      }
    }
  }

  const deductionsTotal = roundHalfUp(
    absenceTotal + unpaidLeaveTotal + timeTotal + advanceTotal + otherTotal,
    2
  );

  const roundedTotals = {
    teachers_count: enrichedRows.length,
    base_salary_total: roundHalfUp(baseSalaryTotal, 2),
    absence_total: roundHalfUp(absenceTotal, 2),
    unpaid_leave_total: roundHalfUp(unpaidLeaveTotal, 2),
    time_total: roundHalfUp(timeTotal, 2),
    bonus_total: roundHalfUp(bonusTotal, 2),
    advance_total: roundHalfUp(advanceTotal, 2),
    other_total: roundHalfUp(otherTotal, 2),
    deductions_total: deductionsTotal,
    net_total: roundHalfUp(netTotal, 2),
    paid_total: roundHalfUp(paidTotal, 2),
    unpaid_total: roundHalfUp(unpaidTotal, 2),
    paid_count: paidCount
  };

  const expected = totalsFromRows(rows);
  const totalsMatch =
    Math.abs(roundedTotals.net_total - expected.net_total) <= 0.005 &&
    Math.abs(roundedTotals.deductions_total - expected.deductions_total) <= 0.005;

  const consistent = inconsistentStaffNames.length === 0 && totalsMatch;

  const runMonth = run?.month_date || run?.month || '';
  const monthLabel = runMonth ? monthLabelUrdu(runMonth) : '';

  return {
    month_label: monthLabel,
    rows: enrichedRows,
    totals: roundedTotals,
    inconsistent_staff_names: inconsistentStaffNames,
    consistent: consistent
  };
}

/**
 * Returns rows sorted by numeric staff_code for multi-slip printing.
 *
 * @param {Array} rows
 * @param {Array} staffList
 * @returns {Array}
 */
export function rowsForAllSlips(rows = [], staffList = []) {
  const safeRows = Array.isArray(rows) ? [...rows] : [];
  const staffMap = new Map((Array.isArray(staffList) ? staffList : []).map((s) => [s.id, s]));

  const enriched = safeRows.map((r) => {
    const st = staffMap.get(r.staff_id) || {};
    return {
      ...r,
      staff_code: String(st.staff_code || st.code || r.staff_code || ''),
      staff_name: st.name || st.staff_name || r.staff_name || ''
    };
  });

  enriched.sort((a, b) => {
    const numA = getNumericStaffCode(a.staff_code);
    const numB = getNumericStaffCode(b.staff_code);
    if (numA !== numB) return numA - numB;
    return a.staff_code.localeCompare(b.staff_code);
  });

  return enriched;
}
