/**
 * Mizan Academic Result Analysis Logic
 * 
 * Implements the 4-category classification and Largest Remainder (Hare-Niemeyer)
 * percentage distribution method adapted from the reference Mizan application.
 * 
 * Rules:
 * - Manzil: Max 60 marks
 * - Tajweed: Max 10 marks
 * - Category 1: 90% or above (90٪ یا زائد)
 * - Category 2: 85% to below 90% (85٪ تا 89٪)
 * - Category 3: 75% to below 85% (75٪ تا 84٪)
 * - Category 4: Below 75% (74٪ یا کم)
 * - Genuine 0 is counted as valid score in Category 4.
 * - Blank, null, or genuinely absent scores are excluded from participating students
 *   and kept separate as absent / unmarked.
 * - Category percentages are calculated from participating students and always add
 *   up to exactly 100% when participating students exist.
 */

export const MIZAN_CATEGORIES = [
  {
    id: 'cat1',
    index: 0,
    label: '90٪ یا زائد',
    fullLabel: 'کیٹگری 1 (90٪ یا زائد)',
    minPct: 90,
    maxPct: Infinity,
    badgeClass: 'badge-cat1'
  },
  {
    id: 'cat2',
    index: 1,
    label: '85٪ تا 89٪',
    fullLabel: 'کیٹگری 2 (85٪ تا 89٪)',
    minPct: 85,
    maxPct: 90,
    badgeClass: 'badge-cat2'
  },
  {
    id: 'cat3',
    index: 2,
    label: '75٪ تا 84٪',
    fullLabel: 'کیٹگری 3 (75٪ تا 84٪)',
    minPct: 75,
    maxPct: 85,
    badgeClass: 'badge-cat3'
  },
  {
    id: 'cat4',
    index: 3,
    label: '74٪ یا کم',
    fullLabel: 'کیٹگری 4 (74٪ یا کم)',
    minPct: 0,
    maxPct: 75,
    badgeClass: 'badge-cat4'
  }
];

export const SUBJECT_CONFIGS = {
  manzil: {
    key: 'manzil',
    name: 'منزل',
    maxMarks: 60,
    fullName: 'منزل (کل نمبر: 60)'
  },
  tajweed: {
    key: 'tajweed',
    name: 'تجوید',
    maxMarks: 10,
    fullName: 'تجوید (کل نمبر: 10)'
  }
};

/**
 * Parses raw mark value according to application semantics.
 * - Returns { isPresent: true, mark: Number } for genuine 0 or positive numbers.
 * - Returns { isPresent: false, mark: null } for empty, null, undefined, or absent indicators ('-', '—', 'غ', 'A').
 */
export function parseSubjectMark(rawVal, maxMarks) {
  if (rawVal === null || rawVal === undefined) {
    return { isPresent: false, mark: null };
  }

  const s = String(rawVal).trim();
  if (s === '' || s === '-' || s === '—' || s === 'غ' || s === 'A' || s === 'a') {
    return { isPresent: false, mark: null };
  }

  const num = Number(s);
  if (isNaN(num) || num < 0) {
    return { isPresent: false, mark: null };
  }

  // Cap at maxMarks to protect against data entry typos
  const safeMarks = typeof maxMarks === 'number' && maxMarks > 0 ? Math.min(num, maxMarks) : num;
  return { isPresent: true, mark: safeMarks };
}

/**
 * Classifies an unrounded percentage into Mizan Category (0, 1, 2, or 3).
 * Uses strict thresholds:
 * - >= 90 => 0 (Category 1)
 * - >= 85 and < 90 => 1 (Category 2)
 * - >= 75 and < 85 => 2 (Category 3)
 * - < 75 => 3 (Category 4)
 */
export function classifyMizanCategory(percentage) {
  if (percentage >= 90) return 0;
  if (percentage >= 85) return 1;
  if (percentage >= 75) return 2;
  return 3;
}

/**
 * Distributes percentage shares among 4 categories using Mizan's exact
 * Largest Remainder (Hare-Niemeyer) method so that the sum is exactly 100%.
 */
export function allocateCategoryPercentages(counts, participatingCount) {
  if (!participatingCount || participatingCount <= 0) {
    return [0, 0, 0, 0];
  }

  // 1. Calculate each category's exact percentage
  const raw = counts.map(n => (n / participatingCount) * 100);

  // 2. Take the floor of each percentage
  const pct = raw.map(Math.floor);

  // 3. Calculate remaining percentage points
  let rem = 100 - pct.reduce((a, b) => a + b, 0);

  // 4. Distribute remainder points to categories with the largest fractional remainders
  raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f)
    .forEach((x, i) => {
      if (i < rem) {
        pct[x.i]++;
      }
    });

  return pct;
}

/**
 * Main analytical report calculation function.
 * Evaluates the students array for the given subject.
 * 
 * @param {Array} students List of student rows from meStudents.data or monthlyExams.students
 * @param {string} subjectKey 'manzil' or 'tajweed'
 * @param {number} [customMaxMarks] Optional override for max marks
 */
export function calculateSubjectAnalysis(students = [], subjectKey = 'manzil', customMaxMarks) {
  const config = SUBJECT_CONFIGS[subjectKey] || {
    key: subjectKey,
    name: subjectKey === 'tajweed' ? 'تجوید' : 'منزل',
    maxMarks: customMaxMarks || (subjectKey === 'tajweed' ? 10 : 60),
    fullName: `${subjectKey === 'tajweed' ? 'تجوید' : 'منزل'} (کل نمبر: ${customMaxMarks || (subjectKey === 'tajweed' ? 10 : 60)})`
  };

  const maxMarks = customMaxMarks || config.maxMarks;
  const totalEntries = students.length;

  const processedStudents = students.map((item, index) => {
    const rawVal = item[subjectKey] !== undefined ? item[subjectKey] : item?.marks?.[subjectKey];
    const { isPresent, mark } = parseSubjectMark(rawVal, maxMarks);

    const regNo = item.student?.admRegNo || item.student?.roll_number || item.regNo || item.roll_number || '-';
    const name = item.student?.name || item.name || '-';

    if (!isPresent) {
      return {
        srNo: index + 1,
        studentId: item.student?.id || item.student_id || null,
        regNo,
        name,
        rawMark: rawVal,
        mark: null,
        percentage: null,
        categoryIndex: null,
        categoryDef: null,
        categoryLabel: 'غیر حاضر / غیر درج',
        isAbsent: true
      };
    }

    const percentage = maxMarks > 0 ? (mark / maxMarks) * 100 : 0;
    const categoryIndex = classifyMizanCategory(percentage);
    const categoryDef = MIZAN_CATEGORIES[categoryIndex];

    return {
      srNo: index + 1,
      studentId: item.student?.id || item.student_id || null,
      regNo,
      name,
      rawMark: rawVal,
      mark,
      percentage,
      categoryIndex,
      categoryDef,
      categoryLabel: categoryDef.label,
      isAbsent: false
    };
  });

  const participatingStudents = processedStudents.filter(s => !s.isAbsent);
  const absentStudents = processedStudents.filter(s => s.isAbsent);
  const participatingCount = participatingStudents.length;
  const absentCount = absentStudents.length;

  // Tally counts in each of the 4 categories
  const counts = [0, 0, 0, 0];
  participatingStudents.forEach(s => {
    if (s.categoryIndex !== null && s.categoryIndex >= 0 && s.categoryIndex < 4) {
      counts[s.categoryIndex]++;
    }
  });

  // Calculate percentages using Mizan's exact allocation
  const pct = allocateCategoryPercentages(counts, participatingCount);
  const totalPct = participatingCount > 0 ? pct.reduce((a, b) => a + b, 0) : 0;

  return {
    subjectKey,
    subjectName: config.name,
    maxMarks,
    fullName: config.fullName,
    totalEntries,
    participating: participatingCount,
    absent: absentCount,
    counts,
    pct,
    totalPct,
    students: processedStudents,
    participatingStudents,
    absentStudents,
    categories: MIZAN_CATEGORIES.map((cat, idx) => ({
      ...cat,
      count: counts[idx],
      percentage: pct[idx]
    }))
  };
}

