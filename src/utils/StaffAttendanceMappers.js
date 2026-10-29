import { isValidUUID } from '../lib/supabaseClient';

/**
 * Normalizes staff attendance status to one of: 'present', 'absent', 'leave', 'half_leave'
 * Matching the database CHECK constraint: CHECK (status IN ('present', 'absent', 'leave', 'half_leave'))
 */
export const normalizeStaffAttendanceStatus = (status) => {
  if (!status) return 'present';
  const s = String(status).trim().toLowerCase();
  if (s === 'present' || s === 'p' || s === 'حاضر') return 'present';
  if (s === 'absent' || s === 'a' || s === 'غیر حاضر') return 'absent';
  if (s === 'half_leave' || s === 'half-leave' || s === 'half' || s === 'hl' || s === 'آدھی چھٹی' || s === 'آدھی رخصت' || s === 'نصف رخصت') return 'half_leave';
  if (s === 'leave' || s === 'l' || s === 'e' || s === 'رخصت' || s === 'معذور') return 'leave';
  return 'present';
};

/**
 * Returns Urdu label for staff attendance status (Urdu-only, no emojis/icons)
 */
export const getStaffAttendanceStatusLabelUrdu = (status) => {
  const norm = normalizeStaffAttendanceStatus(status);
  switch (norm) {
    case 'present': return 'حاضر';
    case 'absent': return 'غیر حاضر';
    case 'leave': return 'رخصت';
    case 'half_leave': return 'آدھی چھٹی';
    default: return 'حاضر';
  }
};

/**
 * Returns color tokens for staff status badges across light and dark themes
 */
export const getStaffStatusBadgeStyle = (status) => {
  const norm = normalizeStaffAttendanceStatus(status);
  switch (norm) {
    case 'present': return { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' };
    case 'absent': return { bg: '#fff5f5', border: '#fecaca', color: '#dc2626' };
    case 'leave': return { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7' };
    case 'half_leave': return { bg: '#f5f3ff', border: '#ddd6fe', color: '#7c3aed' };
    default: return { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' };
  }
};

/**
 * Computes attendance counts for staff:
 * present-equivalent = count(present) + 0.5 * count(half_leave)
 * leave-equivalent = count(leave) + 0.5 * count(half_leave)
 * absent = count(absent)
 * half_leave = count(half_leave)
 */
export const calculateStaffAttendanceCounts = (records = []) => {
  const safeRecords = Array.isArray(records) ? records : [];
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let halfLeaveCount = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;

  safeRecords.forEach(r => {
    if (!r) return;
    const st = normalizeStaffAttendanceStatus(r.status);
    if (st === 'present') {
      presentDays += 1;
    } else if (st === 'absent') {
      absentDays += 1;
    } else if (st === 'leave') {
      leaveDays += 1;
    } else if (st === 'half_leave') {
      halfLeaveCount += 1;
      presentDays += 0.5;
      leaveDays += 0.5;
    }
    totalLateMinutes += Number(r.lateMinutes || r.late_minutes || 0);
    totalEarlyLeaveMinutes += Number(r.earlyLeaveMinutes || r.early_leave_minutes || 0);
  });

  return {
    present: presentDays,
    absent: absentDays,
    leave: leaveDays,
    halfLeave: halfLeaveCount,
    totalLateMinutes,
    totalEarlyLeaveMinutes
  };
};

/**
 * Normalizes time string from 'HH:MM:SS' or 'HH:MM' to 'HH:MM'
 */
export const formatTimeForUi = (timeStr, defaultTime = '') => {
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
 * Calculates the difference in minutes between two 'HH:MM' or 'HH:MM:SS' times:
 * returns (actualTime in minutes) - (expectedTime in minutes)
 */
export const getMinutesDifference = (actualTime, expectedTime) => {
  if (!actualTime || !expectedTime) return 0;
  const [aH, aM] = String(actualTime).trim().split(':').map(Number);
  const [eH, eM] = String(expectedTime).trim().split(':').map(Number);
  if ([aH, aM, eH, eM].some(n => Number.isNaN(n))) return 0;
  return (aH * 60 + aM) - (eH * 60 + eM);
};

/**
 * Calculates late minutes based on arrival checkIn vs shiftStart.
 * Supports both present and half_leave statuses.
 */
export const calculateLateMinutes = (checkIn, shiftStart, status = 'present') => {
  const norm = normalizeStaffAttendanceStatus(status);
  if ((norm !== 'present' && norm !== 'half_leave') || !checkIn || !shiftStart) return 0;
  return Math.max(getMinutesDifference(checkIn, shiftStart), 0);
};

/**
 * Calculates early departure minutes based on checkOut vs shiftEnd.
 * Supports both present and half_leave statuses.
 */
export const calculateEarlyLeaveMinutes = (checkOut, shiftEnd, status = 'present') => {
  const norm = normalizeStaffAttendanceStatus(status);
  if ((norm !== 'present' && norm !== 'half_leave') || !checkOut || !shiftEnd) return 0;
  return Math.max(getMinutesDifference(shiftEnd, checkOut), 0);
};

/**
 * Transforms a Supabase `staff_attendance` row into a UI staff attendance record.
 * Supports joined staff object: row.staff = { id, name, staff_code, shift_start, shift_end }
 * or lookup object/array.
 */
export const mapStaffAttendanceRowToUi = (row, staffLookup = {}) => {
  if (!row) return null;

  let staffObj = row.staff || null;
  if (!staffObj && row.staff_id) {
    if (Array.isArray(staffLookup)) {
      staffObj = staffLookup.find(s => String(s.id) === String(row.staff_id));
    } else if (typeof staffLookup === 'object' && staffLookup[row.staff_id]) {
      staffObj = staffLookup[row.staff_id];
    }
  }

  const staffCode = staffObj
    ? (staffObj.staff_code || staffObj.staffCode || staffObj.teacherId)
    : (row.staff_code || row.teacherId);
  const teacherId = staffCode ? String(staffCode) : String(row.staff_id || '');
  const teacherName = staffObj ? (staffObj.name || '-') : (row.teacherName || row.staff_name || '-');

  const status = normalizeStaffAttendanceStatus(row.status);
  const checkIn = formatTimeForUi(row.check_in, '');
  const checkOut = formatTimeForUi(row.check_out, '');

  return {
    id: row.id,
    madrasaId: row.madrasa_id,
    staffId: row.staff_id,
    teacherId,
    teacherName,
    date: row.date,
    status,
    checkIn,
    checkOut,
    lateMinutes: Number(row.late_minutes || 0),
    earlyLeaveMinutes: Number(row.early_leave_minutes || 0),
    remarks: row.remarks || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
};

/**
 * Converts an array of Supabase staff_attendance rows into the dictionary structure
 * expected by Attendance.jsx: { [date]: { [teacherId]: record } }
 */
export const mapStaffAttendanceRowsToDict = (rows = [], staffList = []) => {
  const dict = {};
  if (!Array.isArray(rows)) return dict;

  const staffLookup = {};
  if (Array.isArray(staffList)) {
    staffList.forEach(s => {
      if (s.id) staffLookup[s.id] = s;
      if (s.staff_code || s.staffCode) {
        staffLookup[String(s.staff_code || s.staffCode)] = s;
      }
    });
  } else if (staffList && typeof staffList === 'object') {
    Object.assign(staffLookup, staffList);
  }

  rows.forEach(row => {
    if (!row || !row.date) return;
    const date = row.date;
    if (!dict[date]) {
      dict[date] = {};
    }
    const ui = mapStaffAttendanceRowToUi(row, staffLookup);
    if (ui && ui.teacherId) {
      dict[date][ui.teacherId] = {
        id: ui.id,
        staffId: ui.staffId,
        teacherId: ui.teacherId,
        teacherName: ui.teacherName,
        status: ui.status,
        checkIn: ui.checkIn,
        checkOut: ui.checkOut,
        lateMinutes: ui.lateMinutes,
        earlyLeaveMinutes: ui.earlyLeaveMinutes,
        remarks: ui.remarks
      };
    }
  });

  return dict;
};

/**
 * Transforms UI staff attendance entry into Supabase payload for `staff_attendance` table.
 */
export const mapUiToStaffAttendancePayload = (record, madrasaId, date) => {
  if (!record) return null;

  const status = normalizeStaffAttendanceStatus(record.status);
  const isPresentOrHalf = status === 'present' || status === 'half_leave';
  const checkIn = (isPresentOrHalf && (record.checkIn || record.check_in))
    ? formatTimeForUi(record.checkIn || record.check_in)
    : null;
  const checkOut = (isPresentOrHalf && (record.checkOut || record.check_out))
    ? formatTimeForUi(record.checkOut || record.check_out)
    : null;

  const lateMinutes = isPresentOrHalf
    ? Number(record.lateMinutes ?? record.late_minutes ?? 0)
    : 0;
  const earlyLeaveMinutes = isPresentOrHalf
    ? Number(record.earlyLeaveMinutes ?? record.early_leave_minutes ?? 0)
    : 0;

  const payload = {
    madrasa_id: madrasaId,
    staff_id: record.staff_id || record.staffId || record.id,
    date: record.date || date,
    status,
    check_in: checkIn || null,
    check_out: checkOut || null,
    late_minutes: lateMinutes,
    early_leave_minutes: earlyLeaveMinutes,
    remarks: record.remarks ? String(record.remarks).trim() : null,
    updated_at: new Date().toISOString()
  };

  if (record.id && isValidUUID(record.id)) {
    payload.id = record.id;
  }

  return payload;
};

/**
 * Derives the locked pending checkout date from attendance records.
 * Finds the most recent date where at least one 'present'-status row has
 * check_in IS NOT NULL/empty, but check_out IS NULL/empty.
 * If found, returns that date string (YYYY-MM-DD); otherwise returns null.
 */
export const derivePendingDate = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const pendingRows = rows.filter(r => {
    if (!r) return false;
    const status = normalizeStaffAttendanceStatus(r.status);
    const hasCheckIn = Boolean(r.check_in || r.checkIn);
    const hasCheckOut = Boolean(r.check_out || r.checkOut);
    return status === 'present' && hasCheckIn && !hasCheckOut;
  });

  if (pendingRows.length === 0) return null;

  // Sort descending by date to find the most recent date
  pendingRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return pendingRows[0].date || null;
};
