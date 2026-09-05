/**
 * ExamsMappers.js
 * Utility and mapper functions for Exams.jsx
 * Translates between UI shape (regNo-keyed) and Supabase payload shape (student_id-keyed).
 */

export const isValidUUID = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

/**
 * Calculates target ruku count based on starting and ending para/ruku.
 * Formula: Math.max(0, (endPara - startPara) * 8 + (endRuku - startRuku))
 */
export const calculateTargetRuku = (startPara, startRuku, endPara, endRuku) => {
  const sp = parseInt(startPara) || 0;
  const sr = parseInt(startRuku) || 0;
  const ep = parseInt(endPara) || 0;
  const er = parseInt(endRuku) || 0;
  return Math.max(0, (ep - sp) * 8 + (er - sr));
};

/**
 * Calculates percentage of achieved ruku vs target ruku.
 * Formula: target > 0 ? Math.round((achieved / target) * 100) : 0
 */
export const calculatePct = (achievedRuku, targetRuku) => {
  const target = parseInt(targetRuku) || 0;
  const achieved = parseInt(achievedRuku) || 0;
  return target > 0 ? Math.round((achieved / target) * 100) : 0;
};

/**
 * Returns Urdu grade label based on percentage.
 * >= 80%: ممتاز, >= 60%: اچھا, >= 40%: اوسط, < 40%: ضعیف
 */
export const getExamGrade = (pct) => {
  const p = Number(pct) || 0;
  if (p >= 80) return 'ممتاز';
  if (p >= 60) return 'اچھا';
  if (p >= 40) return 'اوسط';
  return 'ضعیف';
};

/**
 * Returns color code corresponding to percentage tier.
 * >= 80%: #15803d (green), >= 60%: #b45309 (amber), < 60%: #dc2626 (red)
 */
export const getPctColor = (pct) => {
  const p = Number(pct) || 0;
  return p >= 80 ? '#15803d' : p >= 60 ? '#b45309' : '#dc2626';
};

/**
 * Maps a Supabase `exam_miqdar` row (optionally joined with `students` and `classes`)
 * to the UI representation.
 */
export const mapExamMiqdarToUi = (row) => {
  if (!row) return null;
  const student = row.students || {};
  const cls = row.classes || {};

  return {
    id: row.id,
    studentId: row.student_id,
    regNo: student.roll_number || row.regNo || '',
    studentName: student.name || row.studentName || '',
    fatherName: student.father_name || row.fatherName || '',
    classId: row.class_id || '',
    className: cls.class_name || cls.name || row.className || '',
    term: row.term || 'first',
    year: Number(row.year) || 2025,
    startPara: row.start_para !== null && row.start_para !== undefined ? row.start_para : (row.startPara ?? ''),
    startRuku: row.start_ruku !== null && row.start_ruku !== undefined ? row.start_ruku : (row.startRuku ?? ''),
    endPara: row.end_para !== null && row.end_para !== undefined ? row.end_para : (row.endPara ?? ''),
    endRuku: row.end_ruku !== null && row.end_ruku !== undefined ? row.end_ruku : (row.endRuku ?? ''),
    targetRuku: Number(row.target_ruku ?? row.targetRuku ?? 0)
  };
};

/**
 * Maps a UI miqdar item to the Supabase `exam_miqdar` payload shape.
 */
export const mapUiToExamMiqdarPayload = (item, madrasaId) => {
  if (!item) return null;
  const student = item.student || {};
  const studentId = student.id || item.studentId || item.student_id;
  const classId = item.classId || item.class_id || student.admClass || student.class_id || null;
  const sp = parseInt(item.startPara ?? item.start_para) || 0;
  const sr = parseInt(item.startRuku ?? item.start_ruku) || 0;
  const ep = parseInt(item.endPara ?? item.end_para) || 0;
  const er = parseInt(item.endRuku ?? item.end_ruku) || 0;
  const targetRuku = item.targetRuku !== undefined ? (parseInt(item.targetRuku) || 0) : calculateTargetRuku(sp, sr, ep, er);

  return {
    madrasa_id: madrasaId,
    student_id: studentId,
    class_id: isValidUUID(classId) ? classId : null,
    term: item.term || 'first',
    year: parseInt(item.year) || 2025,
    start_para: sp,
    start_ruku: sr,
    end_para: ep,
    end_ruku: er,
    target_ruku: targetRuku,
    updated_at: new Date().toISOString()
  };
};

/**
 * Maps a Supabase `exam_results` row (optionally joined with `students` and `classes`)
 * to the UI representation.
 */
export const mapExamResultToUi = (row) => {
  if (!row) return null;
  const student = row.students || {};
  const cls = row.classes || {};

  return {
    id: row.id,
    studentId: row.student_id,
    regNo: student.roll_number || row.regNo || '',
    studentName: student.name || row.studentName || '',
    fatherName: student.father_name || row.fatherName || '',
    classId: row.class_id || '',
    classNm: cls.class_name || cls.name || row.classNm || '',
    term: row.term || 'first',
    year: Number(row.year) || 2025,
    targetRuku: Number(row.target_ruku ?? row.targetRuku ?? 0),
    achievedRuku: row.achieved_ruku !== null && row.achieved_ruku !== undefined ? row.achieved_ruku : (row.achievedRuku ?? ''),
    pct: row.pct !== null && row.pct !== undefined ? Number(row.pct) : (row.pct !== undefined ? Number(row.pct) : null)
  };
};

/**
 * Maps a UI exam result item to the Supabase `exam_results` payload shape.
 */
export const mapUiToExamResultPayload = (item, madrasaId) => {
  if (!item) return null;
  const student = item.student || {};
  const studentId = student.id || item.studentId || item.student_id;
  const classId = item.classId || item.class_id || student.admClass || student.class_id || null;
  const target = parseInt(item.targetRuku ?? item.target_ruku) || 0;
  const achieved = parseInt(item.achievedRuku ?? item.achieved_ruku) || 0;
  const pct = item.pct !== null && item.pct !== undefined ? Number(item.pct) : calculatePct(achieved, target);

  return {
    madrasa_id: madrasaId,
    student_id: studentId,
    class_id: isValidUUID(classId) ? classId : null,
    term: item.term || 'first',
    year: parseInt(item.year) || 2025,
    target_ruku: target,
    achieved_ruku: achieved,
    pct: pct,
    updated_at: new Date().toISOString()
  };
};
