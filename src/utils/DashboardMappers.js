/**
 * DashboardMappers.js
 * Calculation and mapping helpers for Dashboard.jsx
 */

/**
 * Normalizes student status enum:
 * 'active' | 'graduated' | 'left' | 'inactive'
 */
export const normalizeStudentStatus = (status) => {
  if (!status) return 'inactive';
  const s = String(status).trim().toLowerCase();
  if (s === 'active' || s === 'graduated' || s === 'left' || s === 'inactive') {
    return s;
  }
  // Fallbacks for legacy/Urdu strings if any
  if (/(graduate|graduated|hafiz|فارغ|حافظ|مکمل)/i.test(s)) return 'graduated';
  if (/(withdrawn|left|خارج)/i.test(s)) return 'left';
  if (/(active|enrolled|داخل)/i.test(s)) return 'active';
  return 'inactive';
};

/**
 * Computes top-level counts and rates from students array.
 * Status Mapping:
 * - "فی الوقت طلباء" (active students) = status === 'active'
 * - "تکمیل شدہ" (completed/Hafiz) = status === 'graduated'
 * - "خارج شدہ" (withdrawn) = status === 'left'
 * - "کل داخلے" (total admitted) = count of all rows
 */
export const calculateStudentCounts = (students = []) => {
  const safeStudents = Array.isArray(students) ? students : [];
  let active = 0;
  let graduated = 0;
  let left = 0;
  const total = safeStudents.length;

  safeStudents.forEach(s => {
    const st = normalizeStudentStatus(s?.status);
    if (st === 'active') active++;
    else if (st === 'graduated') graduated++;
    else if (st === 'left') left++;
  });

  const activeRate = total > 0 ? ((active / total) * 100).toFixed(1) : '0.0';
  const completionRate = total > 0 ? ((graduated / total) * 100).toFixed(1) : '0.0';

  return {
    totalStudents: active,
    completedStudents: graduated,
    withdrawnStudents: left,
    totalAdmitted: total,
    activeRate,
    completionRate
  };
};

/**
 * Resolves class display name using the established fallback chain:
 * cls.class_name || cls.name || cls.className || 'بلا نام کلاس'
 */
export const resolveClassName = (cls) => {
  if (!cls) return 'بلا نام کلاس';
  return (cls.class_name || cls.name || cls.className || 'بلا نام کلاس').trim() || 'بلا نام کلاس';
};

/**
 * Calculates students by class distribution.
 * Matches student to class using:
 * (student.admClass === cls.id || student.class_id === cls.id || student.classId === cls.id)
 * Only counts active students.
 */
export const calculateStudentsByClass = (classesList = [], students = []) => {
  const safeClasses = Array.isArray(classesList) ? classesList : [];
  const safeStudents = Array.isArray(students) ? students : [];

  const activeStudents = safeStudents.filter(s => normalizeStudentStatus(s?.status) === 'active');

  return safeClasses.map(cls => {
    const count = activeStudents.filter(s =>
      s.admClass === cls.id || s.class_id === cls.id || s.classId === cls.id
    ).length;

    return {
      id: cls.id,
      name: resolveClassName(cls),
      teacher: (cls.teacher || cls.teacher_name || 'استاد درج نہیں').trim() || 'استاد درج نہیں',
      count
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ur'));
};

/**
 * Calculates recent admissions (top limit).
 * Sorts by admission_date / admDate DESC, then numeric roll_number / admRegNo DESC.
 */
export const calculateRecentAdmissions = (students = [], limit = 5) => {
  const safeStudents = Array.isArray(students) ? students : [];

  return [...safeStudents]
    .sort((a, b) => {
      const dateA = new Date(a.admission_date || a.admDate || 0).getTime();
      const dateB = new Date(b.admission_date || b.admDate || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;

      const rawA = String(a.roll_number || a.admRegNo || '');
      const rawB = String(b.roll_number || b.admRegNo || '');
      const numA = parseInt(rawA.replace(/\D/g, ''), 10);
      const numB = parseInt(rawB.replace(/\D/g, ''), 10);

      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      return rawB.localeCompare(rawA, undefined, { numeric: true });
    })
    .slice(0, limit);
};

/**
 * Computes unique staff count from staff rows and classes list.
 */
export const calculateStaffCount = (staffList = [], classesList = []) => {
  const teachers = new Set();
  (staffList || []).forEach(s => {
    if (s?.name && typeof s.name === 'string' && s.name.trim()) {
      teachers.add(s.name.trim());
    }
  });
  (classesList || []).forEach(c => {
    const t = c?.teacher || c?.teacher_name;
    if (t && typeof t === 'string' && t.trim()) {
      teachers.add(t.trim());
    }
  });
  return teachers.size;
};

/**
 * Computes today's attendance percentage.
 * (present count / total rows for today) * 100
 * Returns '—' if rows is empty or no valid records.
 */
export const calculateTodayAttendanceRate = (attendanceRows = []) => {
  if (!Array.isArray(attendanceRows) || attendanceRows.length === 0) {
    return '—';
  }
  const total = attendanceRows.length;
  const presentCount = attendanceRows.filter(r => {
    const s = String(r?.status || '').trim().toLowerCase();
    return s === 'present' || s === 'حاضر' || s === 'p';
  }).length;

  return `${((presentCount / total) * 100).toFixed(1)}%`;
};

/**
 * Computes current month fee collection percentage.
 * (count where status='paid' / total count) * 100
 * Optional monthYearFilter ('YYYY-MM') can be supplied if rows are not pre-filtered.
 * Returns '—' if no rows exist for the month.
 */
export const calculateMonthFeesRate = (feeRows = [], monthYearFilter = null) => {
  if (!Array.isArray(feeRows) || feeRows.length === 0) {
    return '—';
  }

  let relevantRows = feeRows;
  if (monthYearFilter) {
    relevantRows = feeRows.filter(f =>
      f.month_year === monthYearFilter || f.feeMonth === monthYearFilter
    );
  }

  if (relevantRows.length === 0) {
    return '—';
  }

  const paidCount = relevantRows.filter(f => String(f?.status || '').trim().toLowerCase() === 'paid').length;
  return `${((paidCount / relevantRows.length) * 100).toFixed(1)}%`;
};

/**
 * Computes average percentage from the most recent (year, term) pair in exam_results.
 * Returns '—' if examResultsRows is empty.
 */
export const calculateLatestExamAverage = (examResultsRows = []) => {
  if (!Array.isArray(examResultsRows) || examResultsRows.length === 0) {
    return '—';
  }

  // Find most recent (year, term) pair
  // Term precedence: annual (3) > second (2) > first (1)
  const getTermWeight = (t) => {
    const term = String(t || '').toLowerCase();
    if (term === 'annual' || term === 'سالانہ') return 3;
    if (term === 'second' || term === 'دوسری') return 2;
    if (term === 'first' || term === 'پہلی') return 1;
    return 0;
  };

  // Extract distinct pairs
  const pairs = [];
  examResultsRows.forEach(r => {
    const y = parseInt(r.year, 10);
    const t = String(r.term || '').trim();
    if (!isNaN(y) && t) {
      if (!pairs.some(p => p.year === y && p.term === t)) {
        pairs.push({ year: y, term: t });
      }
    }
  });

  if (pairs.length === 0) {
    // If year/term not structured, compute average of all rows with valid pct
    const validRows = examResultsRows.filter(r => r.pct !== null && r.pct !== undefined && !isNaN(Number(r.pct)));
    if (validRows.length === 0) return '—';
    const sum = validRows.reduce((s, r) => s + Number(r.pct), 0);
    return `${(sum / validRows.length).toFixed(1)}%`;
  }

  // Sort pairs: year DESC, then termWeight DESC
  pairs.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return getTermWeight(b.term) - getTermWeight(a.term);
  });

  const latest = pairs[0];
  const matchingRows = examResultsRows.filter(r =>
    parseInt(r.year, 10) === latest.year && String(r.term || '').trim() === latest.term
  );

  if (matchingRows.length === 0) return '—';

  const sum = matchingRows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const avg = sum / matchingRows.length;
  return `${avg.toFixed(1)}%`;
};

/**
 * Returns today's date in local YYYY-MM-DD
 */
export const getTodayDateIso = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Returns current month in local YYYY-MM
 */
export const getCurrentMonthIso = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};
