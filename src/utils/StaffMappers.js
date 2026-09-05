import { isValidUUID } from '../lib/supabaseClient';

/**
 * Normalizes time string from 'HH:MM:SS' or 'HH:MM' to 'HH:MM'
 */
export const formatTimeForUi = (timeStr, defaultTime = '06:50') => {
  if (!timeStr) return defaultTime;
  const parts = String(timeStr).trim().split(':');
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return timeStr;
};

/**
 * Transforms a Supabase staff record into the UI formData / staffProfile object shape.
 *
 * @param {Object} row - Supabase row from `staff` table, optionally with joined `classes(id, class_name)`
 * @param {Object|Array} classesLookup - Map of classId -> classObj or Array of class objects
 * @returns {Object} UI staff profile object
 */
export const mapSupabaseToUi = (row, classesLookup = {}) => {
  if (!row) return null;

  // Resolve assigned class name from joined classes object or lookup
  let assignedClassName = '';
  if (row.classes && (row.classes.class_name || row.classes.name)) {
    assignedClassName = row.classes.class_name || row.classes.name;
  } else if (row.assigned_class_id) {
    if (Array.isArray(classesLookup)) {
      const found = classesLookup.find(c => String(c.id) === String(row.assigned_class_id));
      if (found) {
        assignedClassName = found.class_name || found.name || found.className || '';
      }
    } else if (typeof classesLookup === 'object' && classesLookup[row.assigned_class_id]) {
      const cls = classesLookup[row.assigned_class_id];
      assignedClassName = cls.class_name || cls.name || cls.className || '';
    }
  } else if (row.assigned_class_name || row.assignedClassName) {
    assignedClassName = row.assigned_class_name || row.assignedClassName;
  }

  const staffCode = (row.staff_code !== undefined && row.staff_code !== null)
    ? Number(row.staff_code)
    : (row.staffCode !== undefined && row.staffCode !== null ? Number(row.staffCode) : null);

  return {
    id: row.id,
    staffCode,
    name: row.name || '',
    fatherName: row.father_name || row.fatherName || '',
    cnic: row.cnic || '',
    assignedClass: row.assigned_class_id || row.assignedClass || '',
    assignedClassName,
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    residenceStatus: row.residence_status || row.residenceStatus || 'ذاتی مکان',
    address: row.address || '',
    qualification: row.qualification || '',
    joiningDate: row.joining_date || row.joiningDate || '',
    shiftStart: formatTimeForUi(row.shift_start || row.shiftStart, '06:50'),
    shiftEnd: formatTimeForUi(row.shift_end || row.shiftEnd, '14:45'),
    experience: row.experience || '',
    reference: row.reference || '',
    notes: row.notes || '',
    profileId: row.profile_id || row.profileId || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || null
  };
};

/**
 * Transforms UI staff form data into a Supabase payload for the `staff` table.
 *
 * @param {Object} uiData - Form data or UI staff profile object
 * @param {string} madrasaId - Active madrasa UUID
 * @returns {Object} Payload matching Supabase `staff` table columns
 */
export const mapUiToSupabase = (uiData, madrasaId) => {
  if (!uiData) return null;

  const payload = {
    madrasa_id: madrasaId,
    name: uiData.name ? String(uiData.name).trim() : '',
    father_name: (uiData.fatherName || uiData.father_name) ? String(uiData.fatherName || uiData.father_name).trim() : '',
    cnic: uiData.cnic ? String(uiData.cnic).trim() : null,
    assigned_class_id: (uiData.assignedClass && isValidUUID(uiData.assignedClass))
      ? uiData.assignedClass
      : ((uiData.assigned_class_id && isValidUUID(uiData.assigned_class_id)) ? uiData.assigned_class_id : null),
    phone: uiData.phone ? String(uiData.phone).trim() : '',
    whatsapp: uiData.whatsapp ? String(uiData.whatsapp).trim() : null,
    residence_status: uiData.residenceStatus || uiData.residence_status || 'ذاتی مکان',
    address: uiData.address ? String(uiData.address).trim() : null,
    qualification: uiData.qualification ? String(uiData.qualification).trim() : null,
    joining_date: uiData.joiningDate || uiData.joining_date || null,
    shift_start: formatTimeForUi(uiData.shiftStart || uiData.shift_start, '06:50'),
    shift_end: formatTimeForUi(uiData.shiftEnd || uiData.shift_end, '14:45'),
    experience: uiData.experience ? String(uiData.experience).trim() : null,
    reference: uiData.reference ? String(uiData.reference).trim() : null,
    notes: uiData.notes ? String(uiData.notes).trim() : null
  };

  if (uiData.id && isValidUUID(uiData.id)) {
    payload.id = uiData.id;
  }

  if (uiData.staffCode !== undefined && uiData.staffCode !== null && uiData.staffCode !== '') {
    payload.staff_code = Number(uiData.staffCode);
  } else if (uiData.staff_code !== undefined && uiData.staff_code !== null && uiData.staff_code !== '') {
    payload.staff_code = Number(uiData.staff_code);
  }

  if (uiData.profileId && isValidUUID(uiData.profileId)) {
    payload.profile_id = uiData.profileId;
  } else if (uiData.profile_id && isValidUUID(uiData.profile_id)) {
    payload.profile_id = uiData.profile_id;
  }

  return payload;
};
