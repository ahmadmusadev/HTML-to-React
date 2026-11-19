/**
 * classGrading.js
 * 
 * Rules for Individual Student Grading and Class Evaluation Grading:
 * 
 * 1. Individual Students (انفرادی طلباء):
 *    - 90 to 100: ممتاز (#15803d - green)
 *    - 80 to 89: جید جدا (#15803d - green)
 *    - 70 to 79: جید (#1d4ed8 - blue)
 *    - 60 to 69: مقبول (#d97706 - amber)
 *    - Below 60: فیل (#dc2626 - red)
 * 
 * 2. Wifaq-ul-Madaris at Hifz Completion (وفاق المدارس - تکمیلِ حفظ):
 *    - 80 to 100: ممتاز
 *    - 60 to 79: جید جدا
 *    - 50 to 59: جید
 *    - 40 to 49: مقبول
 *    - Below 40: فیل
 * 
 * 3. Class Evaluation Tiers (کلاس درجہ بندی برائے طلبہ):
 *    - اعلیٰ (Superior): 80% to 100% (ممتاز و جید جدا)
 *    - اوسط (Average): 60% to 79.9% (جید و مقبول)
 *    - کمزور (Weak): Below 60% (فیل)
 * 
 * 4. Overall Class Report Grade (کلاس کی درجہ بندی):
 *    - اعلیٰ A: اعلیٰ >= 65%, کمزور <= 10%
 *    - اعلیٰ B: اعلیٰ >= 65%, کمزور <= 20% (اور کمزور > 10%)
 *    - اوسط: اعلیٰ >= 50%, کمزور <= 25% (اور اعلیٰ A یا B نہ ہو)
 *    - کمزور: اگر اعلیٰ < 50% ہو یا کمزور > 25% ہو
 */

/**
 * Returns Urdu grade label and color for an individual student.
 * @param {number|string} percentage 
 */
export function getIndividualStudentGrade(percentage) {
  if (percentage === '' || percentage === null || percentage === undefined) {
    return { grade: '—', color: 'inherit', cls: 'me-total-empty' };
  }
  const pct = Number(percentage);
  if (isNaN(pct)) {
    return { grade: '—', color: 'inherit', cls: 'me-total-empty' };
  }
  if (pct > 100 || pct < 0) {
    return { grade: 'غلط', color: '#dc2626', cls: 'me-total-invalid' };
  }
  if (pct >= 90) {
    return { grade: 'ممتاز', color: '#15803d', cls: 'me-total-mumtaz' };
  }
  if (pct >= 80) {
    return { grade: 'جید جدا', color: '#15803d', cls: 'me-total-jayyid-jiddan' };
  }
  if (pct >= 70) {
    return { grade: 'جید', color: '#1d4ed8', cls: 'me-total-jayyid' };
  }
  if (pct >= 60) {
    return { grade: 'مقبول', color: '#d97706', cls: 'me-total-maqbool' };
  }
  return { grade: 'فیل', color: '#dc2626', cls: 'me-total-fail' };
}

/**
 * Returns Urdu grade label for Wifaq-ul-Madaris exam.
 * @param {number|string} percentage 
 */
export function getWifaqGrade(percentage) {
  if (percentage === '' || percentage === null || percentage === undefined) {
    return { grade: '—', color: 'inherit' };
  }
  const pct = Number(percentage);
  if (isNaN(pct)) {
    return { grade: '—', color: 'inherit' };
  }
  if (pct > 100 || pct < 0) {
    return { grade: 'غلط', color: '#dc2626' };
  }
  if (pct >= 80) {
    return { grade: 'ممتاز', color: '#15803d' };
  }
  if (pct >= 60) {
    return { grade: 'جید جدا', color: '#15803d' };
  }
  if (pct >= 50) {
    return { grade: 'جید', color: '#1d4ed8' };
  }
  if (pct >= 40) {
    return { grade: 'مقبول', color: '#d97706' };
  }
  return { grade: 'فیل', color: '#dc2626' };
}

/**
 * Returns student performance tier for class evaluation:
 * - 'اعلیٰ' (80% or above)
 * - 'اوسط' (60% to 79.9%)
 * - 'کمزور' (below 60%)
 * @param {number|string} percentage 
 */
export function getStudentTier(percentage) {
  const pct = Number(percentage);
  if (isNaN(pct) || pct < 0) return null;
  if (pct >= 80) return 'اعلیٰ';
  if (pct >= 60) return 'اوسط';
  return 'کمزور';
}

/**
 * Calculates overall class classification from an array of student results.
 * Each student object can have `pct`, or mark/ruku details.
 * 
 * Rules from syllabus:
 * (1) اعلیٰ >= 65%, کمزور <= 10% => اعلیٰ A
 * (2) اعلیٰ >= 65%, کمزور <= 20% (کمزور > 10%) => اعلیٰ B
 * (3) اعلیٰ >= 50%, کمزور <= 25% => اوسط
 * (4) اگر اعلیٰ < 50% ہو، یا کمزور > 25% ہو => کمزور
 * 
 * @param {Array} students Array of student objects with `pct` property.
 */
export function calculateClassGrading(students = []) {
  if (!Array.isArray(students) || students.length === 0) {
    return {
      classGrade: '—',
      classGradeColor: 'inherit',
      aCount: 0,
      mCount: 0,
      wCount: 0,
      aPct: 0,
      mPct: 0,
      wPct: 0,
      total: 0
    };
  }

  let aCount = 0; // اعلیٰ
  let mCount = 0; // اوسط
  let wCount = 0; // کمزور
  let validCount = 0;

  students.forEach((s) => {
    const rawPct = s.pct !== undefined && s.pct !== null ? s.pct : s.percentage;
    if (rawPct === '' || rawPct === null || rawPct === undefined) return;
    const numPct = Number(rawPct);
    if (isNaN(numPct) || numPct < 0) return;

    validCount++;
    const tier = getStudentTier(numPct);
    if (tier === 'اعلیٰ') aCount++;
    else if (tier === 'اوسط') mCount++;
    else if (tier === 'کمزور') wCount++;
  });

  if (validCount === 0) {
    return {
      classGrade: '—',
      classGradeColor: 'inherit',
      aCount: 0,
      mCount: 0,
      wCount: 0,
      aPct: 0,
      mPct: 0,
      wPct: 0,
      total: 0
    };
  }

  const aPct = (aCount / validCount) * 100;
  const mPct = (mCount / validCount) * 100;
  const wPct = (wCount / validCount) * 100;

  let classGrade = 'کمزور';
  let classGradeColor = '#dc2626';

  // Rule 4: If aPct < 50 or wPct > 25 => کمزور
  if (aPct < 50 || wPct > 25) {
    classGrade = 'کمزور';
    classGradeColor = '#dc2626';
  } else if (aPct >= 65 && wPct <= 10) {
    // Rule 1: اعلیٰ A
    classGrade = 'اعلیٰ A';
    classGradeColor = '#15803d';
  } else if (aPct >= 65 && wPct <= 20) {
    // Rule 2: اعلیٰ B
    classGrade = 'اعلیٰ B';
    classGradeColor = '#166534';
  } else if (aPct >= 50 && wPct <= 25) {
    // Rule 3: اوسط
    classGrade = 'اوسط';
    classGradeColor = '#b45309';
  }

  return {
    classGrade,
    classGradeColor,
    aCount,
    mCount,
    wCount,
    aPct: Number(aPct.toFixed(1)),
    mPct: Number(mPct.toFixed(1)),
    wPct: Number(wPct.toFixed(1)),
    total: validCount
  };
}

/**
 * Calculates overall institution classification from an array of class exams.
 * Same standard applied at the institution level based on class distribution:
 * (1) اعلیٰ کلاسیں >= 65%, کمزور کلاسیں <= 10% => اعلیٰ A
 * (2) اعلیٰ کلاسیں >= 65%, کمزور کلاسیں <= 20% => اعلیٰ B
 * (3) اعلیٰ کلاسیں >= 50%, کمزور کلاسیں <= 25% => اوسط
 * (4) اگر اعلیٰ کلاسیں < 50% ہوں یا کمزور کلاسیں > 25% ہوں => کمزور
 * 
 * @param {Array} exams Array of monthly exam objects, each with students or classGrading.
 */
export function calculateInstituteGrading(exams = []) {
  if (!Array.isArray(exams) || exams.length === 0) {
    return {
      instituteGrade: '—',
      instituteGradeColor: 'inherit',
      aClassCount: 0,
      mClassCount: 0,
      wClassCount: 0,
      aClassPct: 0,
      mClassPct: 0,
      wClassPct: 0,
      totalClasses: 0
    };
  }

  let aClassCount = 0; // اعلیٰ A اور اعلیٰ B
  let mClassCount = 0; // اوسط
  let wClassCount = 0; // کمزور

  exams.forEach((exam) => {
    const classGrading = exam.classGrading || calculateClassGrading(exam.students || []);
    const g = classGrading.classGrade;
    if (g === 'اعلیٰ A' || g === 'اعلیٰ B') {
      aClassCount++;
    } else if (g === 'اوسط') {
      mClassCount++;
    } else if (g === 'کمزور') {
      wClassCount++;
    }
  });

  const totalClasses = exams.length;
  if (totalClasses === 0) {
    return {
      instituteGrade: '—',
      instituteGradeColor: 'inherit',
      aClassCount: 0,
      mClassCount: 0,
      wClassCount: 0,
      aClassPct: 0,
      mClassPct: 0,
      wClassPct: 0,
      totalClasses: 0
    };
  }

  const aClassPct = (aClassCount / totalClasses) * 100;
  const mClassPct = (mClassCount / totalClasses) * 100;
  const wClassPct = (wClassCount / totalClasses) * 100;

  let instituteGrade = 'کمزور';
  let instituteGradeColor = '#dc2626';

  if (aClassPct < 50 || wClassPct > 25) {
    instituteGrade = 'کمزور';
    instituteGradeColor = '#dc2626';
  } else if (aClassPct >= 65 && wClassPct <= 10) {
    instituteGrade = 'اعلیٰ A';
    instituteGradeColor = '#15803d';
  } else if (aClassPct >= 65 && wClassPct <= 20) {
    instituteGrade = 'اعلیٰ B';
    instituteGradeColor = '#166534';
  } else if (aClassPct >= 50 && wClassPct <= 25) {
    instituteGrade = 'اوسط';
    instituteGradeColor = '#b45309';
  }

  return {
    instituteGrade,
    instituteGradeColor,
    aClassCount,
    mClassCount,
    wClassCount,
    aClassPct: Number(aClassPct.toFixed(1)),
    mClassPct: Number(mClassPct.toFixed(1)),
    wClassPct: Number(wClassPct.toFixed(1)),
    totalClasses
  };
}
