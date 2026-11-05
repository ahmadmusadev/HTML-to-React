import { isValidUUID } from './supabaseClient';
import { itemToRow } from '../utils/PayrollRunLogic';

/**
 * Validates madrasaId is a valid UUID, throws on invalid.
 *
 * @param {string} madrasaId
 */
function assertValidMadrasaId(madrasaId) {
  if (!isValidUUID(madrasaId)) {
    throw new Error('غلط مدرسہ شناختی نمبر');
  }
}

/**
 * Fetches all payroll runs for a madrasa, ordered by month descending.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @returns {Promise<Array>}
 */
export async function fetchRuns(supabase, madrasaId) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('madrasa_id', madrasaId)
    .order('month', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Fetches a single run by month date ('YYYY-MM-01').
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} monthDate 'YYYY-MM-01'
 * @returns {Promise<object|null>}
 */
export async function fetchRunByMonth(supabase, madrasaId, monthDate) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('madrasa_id', madrasaId)
    .eq('month', monthDate)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Creates a new draft run for the given month.
 * Whitelists payload to ONLY { madrasa_id, month, status: 'draft' }.
 * Never sends created_by, created_at, or finalized_at.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} monthDate 'YYYY-MM-01'
 * @returns {Promise<object>}
 */
export async function createDraftRun(supabase, madrasaId, monthDate) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_runs')
    .insert({
      madrasa_id: madrasaId,
      month: monthDate,
      status: 'draft'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches all payroll items for a given run.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @returns {Promise<Array>}
 */
export async function fetchRunItems(supabase, madrasaId, runId) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('madrasa_id', madrasaId)
    .eq('run_id', runId);

  if (error) throw error;
  return data || [];
}

/**
 * Saves (upserts) payroll items for a run.
 * Strictly whitelists row columns and uses onConflict 'run_id,staff_id'.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @param {Array} rows
 * @returns {Promise<Array>}
 */
export async function saveRunItems(supabase, madrasaId, runId, rows) {
  assertValidMadrasaId(madrasaId);
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const cleanRows = rows.map((r) => itemToRow(r, runId, madrasaId));

  const { data, error } = await supabase
    .from('payroll_items')
    .upsert(cleanRows, { onConflict: 'run_id,staff_id' })
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Deletes items for staff IDs that are no longer calculable.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @param {Array<string>} staffIds
 * @returns {Promise<void>}
 */
export async function deleteRunItemsForStaff(supabase, madrasaId, runId, staffIds) {
  assertValidMadrasaId(madrasaId);
  if (!Array.isArray(staffIds) || staffIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from('payroll_items')
    .delete()
    .eq('madrasa_id', madrasaId)
    .eq('run_id', runId)
    .in('staff_id', staffIds);

  if (error) throw error;
}

/**
 * Fetches attendance rows for the whole month.
 * Computes last day of month via integer math.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} month 'YYYY-MM'
 * @returns {Promise<Array>}
 */
export async function fetchMonthAttendance(supabase, madrasaId, month) {
  assertValidMadrasaId(madrasaId);
  const [yearStr, monthStr] = month.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);

  const startDate = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDate = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('staff_attendance')
    .select('staff_id,date,status,late_minutes,early_leave_minutes')
    .eq('madrasa_id', madrasaId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw error;
  return data || [];
}

/**
 * Fetches prior paid leave days in the fiscal year prior to `beforeMonth`.
 * Only considers items belonging to FINALIZED runs.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} fiscalYearStart 'YYYY-MM-01'
 * @param {string} beforeMonth 'YYYY-MM-01'
 * @returns {Promise<object>} { [staff_id]: sum_paid_leave_days }
 */
export async function fetchPriorPaidLeave(supabase, madrasaId, fiscalYearStart, beforeMonth) {
  assertValidMadrasaId(madrasaId);
  const { data: runs, error: runsErr } = await supabase
    .from('payroll_runs')
    .select('id,month,status')
    .eq('madrasa_id', madrasaId)
    .eq('status', 'finalized')
    .gte('month', fiscalYearStart)
    .lt('month', beforeMonth);

  if (runsErr) throw runsErr;
  if (!runs || runs.length === 0) {
    return {};
  }

  const runIds = runs.map((r) => r.id);
  const { data: items, error: itemsErr } = await supabase
    .from('payroll_items')
    .select('staff_id,paid_leave_days')
    .eq('madrasa_id', madrasaId)
    .in('run_id', runIds);

  if (itemsErr) throw itemsErr;

  const result = {};
  for (const it of items || []) {
    const sId = String(it.staff_id);
    const days = Number(it.paid_leave_days || 0);
    result[sId] = (result[sId] || 0) + days;
  }
  return result;
}

/**
 * Finalizes a draft run.
 * Verifies exactly one row was updated, else throws.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @returns {Promise<object>}
 */
export async function finalizeRun(supabase, madrasaId, runId) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_runs')
    .update({ status: 'finalized' })
    .eq('id', runId)
    .eq('madrasa_id', madrasaId)
    .eq('status', 'draft')
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('فائنل کرنے کے دوران کوئی ریکارڈ تبدیل نہیں ہوا۔');
  }
  return data[0];
}

/**
 * Reopens a finalized run back to draft.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @returns {Promise<object>}
 */
export async function reopenRun(supabase, madrasaId, runId) {
  assertValidMadrasaId(madrasaId);
  const { data, error } = await supabase
    .from('payroll_runs')
    .update({ status: 'draft' })
    .eq('id', runId)
    .eq('madrasa_id', madrasaId)
    .eq('status', 'finalized')
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('دوبارہ کھولنے کے دوران کوئی ریکارڈ تبدیل نہیں ہوا۔');
  }
  return data[0];
}

/**
 * Deletes a draft run. Finalized runs cannot be deleted (guarded by DB trigger).
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} runId
 * @returns {Promise<boolean>}
 */
export async function deleteDraftRun(supabase, madrasaId, runId) {
  assertValidMadrasaId(madrasaId);
  const { error } = await supabase
    .from('payroll_runs')
    .delete()
    .eq('id', runId)
    .eq('madrasa_id', madrasaId)
    .eq('status', 'draft');

  if (error) throw error;
  return true;
}

/**
 * Sets item payment status and paid_on date.
 * Updates ONLY payment_status and paid_on.
 * Unpaid clears paid_on to null.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} itemId
 * @param {object} param
 * @param {boolean} param.paid
 * @param {string|null} [param.paid_on]
 * @returns {Promise<object>}
 */
export async function setItemPayment(supabase, madrasaId, itemId, { paid, paid_on }) {
  assertValidMadrasaId(madrasaId);
  const isPaid = Boolean(paid);
  const payload = {
    payment_status: isPaid ? 'paid' : 'unpaid',
    paid_on: isPaid ? (paid_on || null) : null
  };

  const { data, error } = await supabase
    .from('payroll_items')
    .update(payload)
    .eq('id', itemId)
    .eq('madrasa_id', madrasaId)
    .select();

  if (error) throw error;
  return data && data[0];
}

/**
 * Updates an item's notes.
 *
 * @param {object} supabase
 * @param {string} madrasaId
 * @param {string} itemId
 * @param {string} notes
 * @returns {Promise<object>}
 */
export async function updateItemNotes(supabase, madrasaId, itemId, notes) {
  assertValidMadrasaId(madrasaId);
  const cleanNotes = notes !== undefined && notes !== null ? String(notes).trim() : null;

  const { data, error } = await supabase
    .from('payroll_items')
    .update({ notes: cleanNotes })
    .eq('id', itemId)
    .eq('madrasa_id', madrasaId)
    .select();

  if (error) throw error;
  return data && data[0];
}

