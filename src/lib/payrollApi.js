import { isValidUUID } from './supabaseClient';

/**
 * Validates that a madrasaId is a valid UUID string.
 * Throws a clear Urdu error if invalid.
 */
function assertValidMadrasaId(madrasaId) {
  if (!isValidUUID(madrasaId)) {
    throw new Error('نامعتبر ادارہ آئی ڈی');
  }
}

/**
 * Validates Supabase client presence.
 */
function assertSupabaseClient(supabase) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('ڈیٹا بیس کلائنٹ دستیاب نہیں ہے');
  }
}

/**
 * Fetches all staff salary records for a madrasa.
 * Sensitive data: never logs salary values to the console.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @returns {Promise<Array>} Array of staff_salary rows
 */
export async function fetchStaffSalaries(supabase, madrasaId) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  const { data, error } = await supabase
    .from('staff_salary')
    .select('staff_id, madrasa_id, base_salary, updated_at')
    .eq('madrasa_id', madrasaId);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Upserts staff salary records.
 * Sensitive data: never logs salary values to the console.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {Array<Object>} rows - Array of { staff_id, base_salary }
 * @returns {Promise<Array>} Array of upserted staff_salary rows
 */
export async function upsertStaffSalaries(supabase, madrasaId, rows) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const now = new Date().toISOString();
  const payload = rows.map((r) => {
    const staffId = r.staff_id || r.staffId;
    if (!isValidUUID(staffId)) {
      throw new Error('نامعتبر استاد آئی ڈی');
    }
    const baseSalary = Number(r.base_salary !== undefined ? r.base_salary : r.baseSalary);
    if (Number.isNaN(baseSalary) || baseSalary < 0) {
      throw new Error('بنیادی تنخواہ کی رقم درست نہیں ہے');
    }

    return {
      staff_id: staffId,
      madrasa_id: madrasaId,
      base_salary: baseSalary,
      updated_at: now
    };
  });

  const { data, error } = await supabase
    .from('staff_salary')
    .upsert(payload, { onConflict: 'staff_id' })
    .select('staff_id, madrasa_id, base_salary, updated_at');

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Fetches payroll settings for a madrasa.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @returns {Promise<Object|null>} Payroll settings row or null
 */
export async function fetchPayrollSettings(supabase, madrasaId) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  const { data, error } = await supabase
    .from('payroll_settings')
    .select('madrasa_id, weekly_off_days, late_grace_minutes, early_leave_grace_minutes, monthly_leave_accrual, fiscal_year_start_month, updated_at')
    .eq('madrasa_id', madrasaId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/**
 * Upserts payroll settings for a madrasa.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {Object} settings - Settings object
 * @returns {Promise<Object>} Upserted settings row
 */
export async function upsertPayrollSettings(supabase, madrasaId, settings) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  if (!settings || typeof settings !== 'object') {
    throw new Error('ترتیبات کی تفصیلات فراہم نہیں کی گئیں');
  }

  const weeklyOffDays = Array.isArray(settings.weekly_off_days)
    ? settings.weekly_off_days
    : (Array.isArray(settings.weeklyOffDays) ? settings.weeklyOffDays : [5]);

  const payload = {
    madrasa_id: madrasaId,
    weekly_off_days: weeklyOffDays,
    late_grace_minutes: Number(settings.late_grace_minutes !== undefined ? settings.late_grace_minutes : (settings.lateGraceMinutes ?? 0)),
    early_leave_grace_minutes: Number(settings.early_leave_grace_minutes !== undefined ? settings.early_leave_grace_minutes : (settings.earlyLeaveGraceMinutes ?? 0)),
    monthly_leave_accrual: Number(settings.monthly_leave_accrual !== undefined ? settings.monthly_leave_accrual : (settings.monthlyLeaveAccrual ?? 1.5)),
    fiscal_year_start_month: Number(settings.fiscal_year_start_month !== undefined ? settings.fiscal_year_start_month : (settings.fiscalYearStartMonth ?? 4)),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('payroll_settings')
    .upsert(payload, { onConflict: 'madrasa_id' })
    .select('madrasa_id, weekly_off_days, late_grace_minutes, early_leave_grace_minutes, monthly_leave_accrual, fiscal_year_start_month, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Fetches holidays for a madrasa, optionally filtered by year.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {number|string} [year] - Optional calendar year (e.g. 2026)
 * @returns {Promise<Array>} Array of holiday records sorted by date ascending
 */
export async function fetchHolidays(supabase, madrasaId, year) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  let query = supabase
    .from('holidays')
    .select('id, madrasa_id, holiday_date, title, created_at')
    .eq('madrasa_id', madrasaId);

  if (year) {
    const yr = String(year).trim();
    if (/^\d{4}$/.test(yr)) {
      query = query.gte('holiday_date', `${yr}-01-01`).lte('holiday_date', `${yr}-12-31`);
    }
  }

  query = query.order('holiday_date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Adds a single holiday for a madrasa.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {Object} holiday - { holiday_date, title }
 * @returns {Promise<Object>} Inserted holiday record
 */
export async function addHoliday(supabase, madrasaId, holiday) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  if (!holiday || typeof holiday !== 'object') {
    throw new Error('تعطیل کی تفصیلات فراہم نہیں کی گئیں');
  }

  const holidayDate = String(holiday.holiday_date || holiday.holidayDate || '').trim();
  const title = String(holiday.title || '').trim();

  if (!holidayDate) {
    throw new Error('تعطیل کی تاریخ درج کرنا لازمی ہے');
  }
  if (!title) {
    throw new Error('تعطیل کا عنوان درج کرنا لازمی ہے');
  }

  const payload = {
    madrasa_id: madrasaId,
    holiday_date: holidayDate,
    title
  };

  const { data, error } = await supabase
    .from('holidays')
    .insert([payload])
    .select('id, madrasa_id, holiday_date, title, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Deletes a holiday by ID.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {string} holidayId - UUID of the holiday to delete
 * @returns {Promise<boolean>} True on success
 */
export async function deleteHoliday(supabase, madrasaId, holidayId) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  if (!isValidUUID(holidayId)) {
    throw new Error('نامعتبر تعطیل آئی ڈی');
  }

  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', holidayId)
    .eq('madrasa_id', madrasaId);

  if (error) {
    throw error;
  }

  return true;
}

/**
 * Fetches leave opening records for a madrasa, optionally filtered by fiscalYearStart.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {string} [fiscalYearStart] - 'YYYY-MM-01'
 * @returns {Promise<Array>} Array of staff_leave_opening rows
 */
export async function fetchLeaveOpening(supabase, madrasaId, fiscalYearStart) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  let query = supabase
    .from('staff_leave_opening')
    .select('staff_id, madrasa_id, fiscal_year_start, used_days')
    .eq('madrasa_id', madrasaId);

  if (fiscalYearStart) {
    query = query.eq('fiscal_year_start', fiscalYearStart);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Upserts leave opening balances for staff.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} madrasaId - UUID of the active madrasa
 * @param {Array<Object>} rows - Array of { staff_id, fiscal_year_start, used_days }
 * @returns {Promise<Array>} Array of upserted rows
 */
export async function upsertLeaveOpening(supabase, madrasaId, rows) {
  assertSupabaseClient(supabase);
  assertValidMadrasaId(madrasaId);

  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const payload = rows.map((r) => {
    const staffId = r.staff_id || r.staffId;
    if (!isValidUUID(staffId)) {
      throw new Error('نامعتبر استاد آئی ڈی');
    }
    const fiscalYearStart = String(r.fiscal_year_start || r.fiscalYearStart || '').trim();
    if (!/^\d{4}-\d{2}-01$/.test(fiscalYearStart)) {
      throw new Error('مالی سال کی تاریخ درست نہیں ہے');
    }

    const usedDays = Number(r.used_days !== undefined ? r.used_days : (r.usedDays ?? 0));
    if (Number.isNaN(usedDays) || usedDays < 0) {
      throw new Error('استعمال شدہ چھٹیوں کی تعداد درست نہیں ہے');
    }

    return {
      staff_id: staffId,
      madrasa_id: madrasaId,
      fiscal_year_start: fiscalYearStart,
      used_days: usedDays
    };
  });

  const { data, error } = await supabase
    .from('staff_leave_opening')
    .upsert(payload, { onConflict: 'staff_id,fiscal_year_start' })
    .select('staff_id, madrasa_id, fiscal_year_start, used_days');

  if (error) {
    throw error;
  }

  return data || [];
}
