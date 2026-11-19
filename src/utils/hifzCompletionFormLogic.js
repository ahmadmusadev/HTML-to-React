/**
 * hifzCompletionFormLogic.js
 * Utility and calculation logic for Cumulative Hifz Performance Form
 * (مجموعی حفظ کارکردگی فارم)
 */

import { isValidUUID } from '../lib/supabaseClient';

/**
 * Calculates duration between two dates (startDate and endDate) in years, months, and days.
 * Pure function: accepts two ISO date strings ('YYYY-MM-DD').
 * 
 * @param {string} startDateStr - 'YYYY-MM-DD'
 * @param {string} endDateStr - 'YYYY-MM-DD'
 * @returns {{ text: string, years: number, months: number, days: number }}
 */
export function calculateDuration(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr || typeof startDateStr !== 'string' || typeof endDateStr !== 'string') {
    return { text: '', years: 0, months: 0, days: 0 };
  }

  const sParts = startDateStr.split(/[-/]/);
  const eParts = endDateStr.split(/[-/]/);
  if (sParts.length !== 3 || eParts.length !== 3) {
    return { text: '', years: 0, months: 0, days: 0 };
  }

  const sy = parseInt(sParts[0], 10);
  const sm = parseInt(sParts[1], 10);
  const sd = parseInt(sParts[2], 10);

  const ey = parseInt(eParts[0], 10);
  const em = parseInt(eParts[1], 10);
  const ed = parseInt(eParts[2], 10);

  if (isNaN(sy) || isNaN(sm) || isNaN(sd) || isNaN(ey) || isNaN(em) || isNaN(ed)) {
    return { text: '', years: 0, months: 0, days: 0 };
  }

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  if (end < start) {
    return { text: 'غلط تاریخ', years: 0, months: 0, days: 0 };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const parts = [];
  parts.push(`${years} سال`);
  parts.push(`${months} ماہ`);
  parts.push(`${days} دن`);

  return {
    text: parts.join('، '),
    years,
    months,
    days
  };
}

/**
 * Calculates age at benchmark date (e.g. 1st April of benchmark year or completion date).
 * 
 * @param {string} dobStr - Date of birth 'YYYY-MM-DD'
 * @param {string} benchmarkDateStr - 'YYYY-MM-DD'
 * @returns {string} Age text in Urdu e.g. '10 سال، 7 ماہ، 26 دن'
 */
export function calculateAgeAtBenchmark(dobStr, benchmarkDateStr) {
  const result = calculateDuration(dobStr, benchmarkDateStr);
  return result.text;
}

/**
 * Converts a Gregorian date string ('YYYY-MM-DD') into an Islamic Hijri date representation.
 * Uses Intl.DateTimeFormat with fallback.
 * 
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} Hijri date string e.g. '1447-11-20' or empty
 */
export function toHijriDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return '';

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

  try {
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const formatted = formatter.format(date);
    // formatted is usually "MM/DD/YYYY AH" or similar
    const clean = formatted.replace(/[^\d/]/g, '').trim();
    const fParts = clean.split('/');
    if (fParts.length === 3) {
      // Month, Day, Year
      const hMonth = fParts[0].padStart(2, '0');
      const hDay = fParts[1].padStart(2, '0');
      const hYear = fParts[2];
      return `${hYear}-${hMonth}-${hDay}`;
    }
  } catch {
    // Graceful fallback
  }

  return '';
}

/**
 * Maps numeric exam score to Urdu grade label based on score and total marks.
 * 
 * @param {number|string} score
 * @param {number|string} [totalMarks=100]
 * @param {string} [examType='general'] - 'general' | 'wifaq'
 * @returns {string} Grade in Urdu
 */
export function getGradeFromScore(score, totalMarks = 100, examType = 'general') {
  if (score === '' || score === null || score === undefined) return '—';
  const num = Number(score);
  if (isNaN(num) || num <= 0) return '—';
  const total = Number(totalMarks) > 0 ? Number(totalMarks) : 100;
  const percentage = (num / total) * 100;

  if (examType === 'wifaq') {
    if (percentage >= 80) return 'ممتاز';
    if (percentage >= 60) return 'جید جدا';
    if (percentage >= 50) return 'جید';
    if (percentage >= 40) return 'مقبول';
    return 'فیل';
  }

  // General / Shishmahi / Salana
  if (percentage >= 90) return 'ممتاز';
  if (percentage >= 80) return 'جید جدا';
  if (percentage >= 70) return 'جید';
  if (percentage >= 60) return 'مقبول';
  return 'فیل';
}

/**
 * Sets or updates department start date and initial department when enrolling or updating a student.
 * 
 * @param {string} admissionDate - 'YYYY-MM-DD'
 * @param {string} department - 'قاعدہ' | 'ناظرہ' | 'حفظ'
 * @param {object} existing - Existing dates object
 * @returns {object} Updated milestones object
 */
export function initializeDepartmentStartDates(admissionDate, department, existing = {}) {
  const result = {
    initial_department: existing.initial_department || department || '',
    qaida_start_date: existing.qaida_start_date || null,
    qaida_completion_date: existing.qaida_completion_date || null,
    nazira_start_date: existing.nazira_start_date || null,
    nazira_completion_date: existing.nazira_completion_date || null,
    hifz_start_date: existing.hifz_start_date || null,
    hifz_completion_date: existing.hifz_completion_date || null
  };

  const cleanDate = (admissionDate && typeof admissionDate === 'string' && admissionDate.trim())
    ? admissionDate.trim()
    : null;

  if (!cleanDate) return result;

  if (department === 'قاعدہ' && !result.qaida_start_date) {
    result.qaida_start_date = cleanDate;
    if (!result.initial_department) result.initial_department = 'قاعدہ';
  } else if (department === 'ناظرہ' && !result.nazira_start_date) {
    result.nazira_start_date = cleanDate;
    if (!result.initial_department) result.initial_department = 'ناظرہ';
  } else if (department === 'حفظ' && !result.hifz_start_date) {
    result.hifz_start_date = cleanDate;
    if (!result.initial_department) result.initial_department = 'حفظ';
  }

  return result;
}

/**
 * Maps Supabase `hifz_completion_forms` row to UI form data shape.
 */
export function mapCompletionFormSupabaseToUi(row) {
  if (!row) return null;
  return {
    id: row.id,
    madrasaId: row.madrasa_id,
    studentId: row.student_id,
    computerId: row.computer_id || '',
    initialDepartment: row.initial_department || '',
    admissionDate: row.admission_date || '',
    qaidaStartDate: row.qaida_start_date || '',
    qaidaCompletionDate: row.qaida_completion_date || '',
    naziraStartDate: row.nazira_start_date || '',
    naziraCompletionDate: row.nazira_completion_date || '',
    hifzStartDate: row.hifz_start_date || '',
    hifzCompletionDate: row.hifz_completion_date || '',
    hifzCompletionHijri: row.hifz_completion_hijri || '',
    hifzDurationText: row.hifz_duration_text || '',
    daurDurationText: row.daur_duration_text || '',
    branchName: row.branch_name || '',
    areaName: row.area_name || '',
    teacherName: row.teacher_name || '',
    overallQuality: row.overall_quality || '',
    shishmahiTotalMarks: row.shishmahi_total_marks ?? 100,
    shishmahiMarks: row.shishmahi_marks ?? '',
    shishmahiGrade: row.shishmahi_grade || '',
    salanaTotalMarks: row.salana_total_marks ?? 100,
    salanaMarks: row.salana_marks ?? '',
    salanaGrade: row.salana_grade || '',
    wifaqTotalMarks: row.wifaq_total_marks ?? 100,
    wifaqMarks: row.wifaq_marks ?? '',
    wifaqGrade: row.wifaq_grade || '',
    attendanceQuality: row.attendance_quality || '',
    parentsConduct: row.parents_conduct || '',
    monthlyFee: row.monthly_fee ?? '',
    feeConcession: row.fee_concession ?? '',
    concessionType: row.concession_type || '',
    specialNotes: row.special_notes || '',
    formDate: row.form_date || '',
    preparerName: row.preparer_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Maps UI form data shape to Supabase `hifz_completion_forms` payload shape.
 */
export function mapCompletionFormUiToSupabase(data, madrasaId, studentId) {
  if (!data) return null;
  const mId = madrasaId || data.madrasaId;
  const sId = studentId || data.studentId;

  return {
    id: data.id && isValidUUID(data.id) ? data.id : undefined,
    madrasa_id: mId,
    student_id: sId,
    computer_id: (data.computerId || '').trim(),
    initial_department: data.initialDepartment || '',
    admission_date: data.admissionDate || null,
    qaida_start_date: data.qaidaStartDate || null,
    qaida_completion_date: data.qaidaCompletionDate || null,
    nazira_start_date: data.naziraStartDate || null,
    nazira_completion_date: data.naziraCompletionDate || null,
    hifz_start_date: data.hifzStartDate || null,
    hifz_completion_date: data.hifzCompletionDate || null,
    hifz_completion_hijri: (data.hifzCompletionHijri || '').trim(),
    hifz_duration_text: (data.hifzDurationText || '').trim(),
    daur_duration_text: (data.daurDurationText || '').trim(),
    branch_name: (data.branchName || '').trim(),
    area_name: (data.areaName || '').trim(),
    teacher_name: (data.teacherName || '').trim(),
    overall_quality: (data.overallQuality || '').trim(),
    shishmahi_total_marks: data.shishmahiTotalMarks !== '' && data.shishmahiTotalMarks !== null && !isNaN(data.shishmahiTotalMarks) ? Number(data.shishmahiTotalMarks) : 100,
    shishmahi_marks: data.shishmahiMarks !== '' && data.shishmahiMarks !== null && !isNaN(data.shishmahiMarks) ? Number(data.shishmahiMarks) : 0,
    shishmahi_grade: (data.shishmahiGrade || '').trim(),
    salana_total_marks: data.salanaTotalMarks !== '' && data.salanaTotalMarks !== null && !isNaN(data.salanaTotalMarks) ? Number(data.salanaTotalMarks) : 100,
    salana_marks: data.salanaMarks !== '' && data.salanaMarks !== null && !isNaN(data.salanaMarks) ? Number(data.salanaMarks) : 0,
    salana_grade: (data.salanaGrade || '').trim(),
    wifaq_total_marks: data.wifaqTotalMarks !== '' && data.wifaqTotalMarks !== null && !isNaN(data.wifaqTotalMarks) ? Number(data.wifaqTotalMarks) : 100,
    wifaq_marks: data.wifaqMarks !== '' && data.wifaqMarks !== null && !isNaN(data.wifaqMarks) ? Number(data.wifaqMarks) : 0,
    wifaq_grade: (data.wifaqGrade || '').trim(),
    attendance_quality: (data.attendanceQuality || '').trim(),
    parents_conduct: (data.parentsConduct || '').trim(),
    monthly_fee: data.monthlyFee !== '' && data.monthlyFee !== null && !isNaN(data.monthlyFee) ? Number(data.monthlyFee) : 0,
    fee_concession: data.feeConcession !== '' && data.feeConcession !== null && !isNaN(data.feeConcession) ? Number(data.feeConcession) : 0,
    concession_type: (data.concessionType || '').trim(),
    special_notes: (data.specialNotes || '').trim(),
    form_date: data.formDate || null,
    preparer_name: (data.preparerName || '').trim(),
    updated_at: new Date().toISOString()
  };
}
