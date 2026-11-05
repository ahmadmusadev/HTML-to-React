
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { getCurrentAcademicYearStart, formatAcademicYear, getAcademicYearOptions } from '../utils/academicYear';
import { DEFAULT_CLASSES } from '../constants/defaults';
import { isValidUUID } from '../lib/supabaseClient';
import { mapSupabaseToUi as mapStudentToUi } from './Admissions';
import './Entry.css';

// Constants from edit.html
const ME_COLS = [
  { key: 'attendance', label: 'حاضری', max: 10, icon: '' },
  { key: 'manzil', label: 'منزل', max: 60, icon: '' },
  { key: 'tajweed', label: 'تجوید', max: 10, icon: '' },
  { key: 'islamiat', label: 'اسلامیات', max: 10, icon: '' },
  { key: 'itmaad', label: 'اعتماد', max: 10, icon: '' },
  { key: 'para', label: 'پارہ نمبر', max: null, icon: '', group: 'literacy', sub: true },
  { key: 'tarkoo', label: 'ترکو نمبر', max: null, icon: '', group: 'literacy', sub: true },
];
const ME_MAX_TOTAL = ME_COLS.filter(c => c.max).reduce((s, c) => s + c.max, 0);

export const PAGES_PER_PAO = 5;
export const PAGES_PER_JUZ = 20;

// Correct yearTargets matching original edit.html
export const yearTargets = {
  1: [30, 29, 28],
  2: [27, 26, 25, 24, 23, 22],
  3: [21, 20, 19, 18, 17, 16, 15, 14, 13],
  4: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
};

export const scoreThresholds = [
  { pct: 100, score: 100 },
  { pct: 75, score: 75 },
  { pct: 50, score: 50 },
  { pct: 25, score: 25 }
];

/* ========== HOLIDAY & WORKING DAYS LOGIC (2025-2026) ========== */
const getDateRange = (start, end) => {
  let arr = [];
  let dt = new Date(start + 'T00:00:00');
  let endDt = new Date(end + 'T00:00:00');

  while (dt <= endDt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    arr.push(`${y}-${m}-${d}`);
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
};

const specialHolidays = [
  ...getDateRange("2025-04-01", "2025-04-05"),
  ...getDateRange("2025-06-06", "2025-07-01"),
  "2025-07-05", "2025-07-06",
  "2025-08-14",
  "2025-09-06",
  "2026-02-05",
  ...getDateRange("2026-03-17", "2026-03-25")
];

export const calculateWorkingDays = (year, monthIndex) => {
  let date = new Date(year, monthIndex, 1);

  let days = 0;
  while (date.getMonth() === monthIndex) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateString = `${y}-${m}-${d}`;
    const dayOfWeek = date.getDay(); // 0 = Sunday

    if (dayOfWeek !== 0 && !specialHolidays.includes(dateString)) {
      days++;
    }
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export default function Entry() {
  const {
    activeMadrasaId,
    loadMadrasaData,
    saveMadrasaData,
    fetchStudentsFromSupabase,
    fetchClassesFromSupabase,
    fetchMonthlyEvaluationsFromSupabase,
    saveMonthlyEvaluationToSupabase,
    deleteMonthlyEvaluationFromSupabase,
    classesList: contextClassesList,
    setClassesList: setContextClassesList,
    fetchHifzHalfYearRecordsFromSupabase,
    saveHifzHalfYearRecordToSupabase,
    updateStudentHifzStartDate,
    fetchStudentAttendanceFromSupabase
  } = useMadrasa();

  const [activeTab, setActiveTab] = useState('monthly');
  
  const [records, setRecords] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [classesList, setClassesList] = useState(() => (
    contextClassesList && contextClassesList.length > 0 ? contextClassesList : []
  ));
  const [monthlyExams, setMonthlyExams] = useState([]);

  // Keep classes synchronized with central MadrasaContext
  useEffect(() => {
    if (contextClassesList && Array.isArray(contextClassesList) && contextClassesList.length > 0) {
      setClassesList(contextClassesList);
    }
  }, [contextClassesList]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      const storedData = loadMadrasaData('hf_records_v1', activeMadrasaId) || {};
      const storedMonthly = loadMadrasaData('hf_monthly_exams_v1', activeMadrasaId);
      const storedClasses = loadMadrasaData('hf_classes_v1', activeMadrasaId) || {};

      setRecords(storedData.records || []);
      const initialMonthly = (Array.isArray(storedMonthly) && storedMonthly.length > 0)
        ? storedMonthly
        : (storedData.monthlyExams || []);
      setMonthlyExams(initialMonthly);

      const initialClasses = (contextClassesList && contextClassesList.length > 0)
        ? contextClassesList
        : ((storedClasses.classes && storedClasses.classes.length > 0)
          ? storedClasses.classes
          : ((storedData.classes && storedData.classes.length > 0)
            ? storedData.classes
            : (isValidUUID(activeMadrasaId) ? [] : DEFAULT_CLASSES)));
      setClassesList(initialClasses);

      try {
        const [stds, clsData, monthlyData, hifzData] = await Promise.all([
          fetchStudentsFromSupabase(activeMadrasaId).catch(err => {
            console.warn('Could not fetch students in Entry:', err);
            return null;
          }),
          fetchClassesFromSupabase(activeMadrasaId).catch(err => {
            console.warn('Could not fetch classes in Entry:', err);
            return null;
          }),
          fetchMonthlyEvaluationsFromSupabase ? fetchMonthlyEvaluationsFromSupabase({}, activeMadrasaId).catch(err => {
            console.warn('Could not fetch monthly evaluations in Entry:', err);
            return null;
          }) : null,
          fetchHifzHalfYearRecordsFromSupabase ? fetchHifzHalfYearRecordsFromSupabase(activeMadrasaId).catch(err => {
            console.warn('Could not fetch Hifz half-year records in Entry:', err);
            return null;
          }) : null
        ]);

        if (isMounted) {
          let mergedRecs = [];
          if (stds && Array.isArray(stds)) {
            setStudentsList(stds);
            mergedRecs = stds.map(mapStudentToUi).filter(Boolean);
          } else {
            mergedRecs = (storedData.records || []).filter(r => r.isAdmissionProfile);
          }

          if (hifzData && Array.isArray(hifzData) && hifzData.length > 0) {
            mergedRecs = [...mergedRecs, ...hifzData];
          } else {
            const localHifz = (storedData.records || []).filter(r => !r.isAdmissionProfile && !r.isFeeRecord);
            mergedRecs = [...mergedRecs, ...localHifz];
          }
          setRecords(mergedRecs);

          if (clsData && Array.isArray(clsData) && clsData.length > 0) {
            setClassesList(clsData);
            if (setContextClassesList) setContextClassesList(clsData);
          }
          if (monthlyData && Array.isArray(monthlyData)) {
            setMonthlyExams(monthlyData);
          }
        }
      } catch (err) {
        console.warn('Could not fetch data in Entry:', err);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  const saveToLocal = (newMonthlyExams) => {
    saveMadrasaData('hf_monthly_exams_v1', newMonthlyExams, activeMadrasaId);
    let storedData = loadMadrasaData('hf_records_v1', activeMadrasaId) || {};
    storedData.monthlyExams = newMonthlyExams;
    saveMadrasaData('hf_records_v1', storedData, activeMadrasaId);
    setMonthlyExams(newMonthlyExams);
  };

  const meGrade = (pct) => {
    if (pct >= 90) return { g: 'A+', cls: 'me-total-a', color: '#15803d' };
    if (pct >= 75) return { g: 'A', cls: 'me-total-a', color: '#15803d' };
    if (pct >= 60) return { g: 'B', cls: 'me-total-b', color: '#1d4ed8' };
    if (pct >= 50) return { g: 'C', cls: 'me-total-c', color: '#d97706' };
    return { g: 'D', cls: 'me-total-d', color: '#dc2626' };
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setMeStudents(null);
    setCrResultsData(null);
    setSrResultsData(null);
    setIrResultsData(null);
  };

  const defaultYear = String(getCurrentAcademicYearStart());

  // --- 1. Monthly Entry (ماہانہ جائزہ) ---
  const [meClassSelect, setMeClassSelect] = useState('');
  const [meMonth, setMeMonth] = useState('اپریل');
  const [meYear, setMeYear] = useState(defaultYear);
  const [meStudents, setMeStudents] = useState(null);

  const [meHistoryClassFilter, setMeHistoryClassFilter] = useState('');
  const [meHistoryMonthFilter, setMeHistoryMonthFilter] = useState('');

  const meLoadStudents = (overrideExams) => {
    if (!meClassSelect) { alert('براہ کرم پہلے کلاس منتخب کریں۔'); return; }
    
    const cls = classesList.find(c => c.id === meClassSelect || c.name === meClassSelect || c.class_name === meClassSelect);
    const students = records.filter(r => 
      r.isAdmissionProfile && 
      (r.admClass === meClassSelect || r.class_id === meClassSelect || r.classId === meClassSelect || (cls && (r.admClass === cls.name || r.admClass === cls.class_name || r.admClass === cls.id))) && 
      !r.isWithdrawn &&
      r.status !== 'left' &&
      r.status !== 'withdrawn'
    ).sort((a,b) => Number(a.admRegNo || 0) - Number(b.admRegNo || 0));

    if (students.length === 0) {
      setMeStudents('empty');
      return;
    }

    const examList = Array.isArray(overrideExams) ? overrideExams : monthlyExams;
    const existing = examList.find(r => 
      (r.classId === meClassSelect || (cls && (r.className === cls.name || r.className === cls.class_name))) && 
      r.month === meMonth && 
      String(r.year) === String(meYear)
    );
    
    const loadedStudents = students.map(s => {
      const prev = existing?.students?.find(r => 
        (r.student_id && s.id && String(r.student_id) === String(s.id)) || 
        String(r.regNo) === String(s.admRegNo)
      ) || {};
      let item = { student: s };
      ME_COLS.forEach(c => { 
        item[c.key] = (prev[c.key] !== undefined && prev[c.key] !== null) ? prev[c.key] : ''; 
      });
      
      // Compute total
      item.total = ME_COLS.filter(c => c.max).reduce((sum, c) => sum + Math.min(Number(item[c.key] || 0), c.max), 0);
      const pct = ME_MAX_TOTAL > 0 ? (item.total / ME_MAX_TOTAL) * 100 : 0;
      item.pct = +pct.toFixed(1);
      item.gradeObj = meGrade(pct);
      
      return item;
    });
    
    setMeStudents({ clsName: cls ? (cls.name || cls.className || meClassSelect) : meClassSelect, data: loadedStudents, existing: !!existing });
  };

  const meCalcRow = (index, key, value, isSub) => {
    const list = [...meStudents.data];
    list[index][key] = value;
    
    if (!isSub) {
      list[index].total = ME_COLS.filter(c => c.max).reduce((sum, c) => sum + Math.min(Number(list[index][c.key] || 0), c.max), 0);
      const pct = ME_MAX_TOTAL > 0 ? (list[index].total / ME_MAX_TOTAL) * 100 : 0;
      list[index].pct = +pct.toFixed(1);
      list[index].gradeObj = meGrade(pct);
    }
    setMeStudents({ ...meStudents, data: list });
  };

  const [isSavingExam, setIsSavingExam] = useState(false);

  const meSaveExam = async () => {
    if (!meStudents || meStudents === 'empty') { alert('کوئی طالب علم نہیں۔'); return; }
    
    setIsSavingExam(true);
    try {
      const studentData = meStudents.data.map(item => {
        const row = {
          student_id: item.student?.id || null,
          regNo: item.student?.admRegNo || '',
          name: item.student?.name || ''
        };
        ME_COLS.forEach(c => { row[c.key] = c.max ? Number(item[c.key] || 0) : (item[c.key] || ''); });
        const pct = (item.pct !== null && item.pct !== undefined) ? Number(item.pct) : (ME_MAX_TOTAL > 0 ? (Number(item.total || 0) / ME_MAX_TOTAL) * 100 : 0);
        const gradeObj = item.gradeObj || meGrade(pct);
        row.total = Number(item.total) || 0;
        row.pct = Number(pct.toFixed(1));
        row.grade = gradeObj?.g || 'D';
        return row;
      });

      const record = {
        classId: meClassSelect,
        className: meStudents.clsName,
        month: meMonth,
        year: String(meYear),
        students: studentData,
        savedAt: new Date().toISOString()
      };

      // 1. Save to Supabase (and its local cache)
      if (saveMonthlyEvaluationToSupabase) {
        try {
          const remoteRes = await saveMonthlyEvaluationToSupabase(record, activeMadrasaId);
          if (remoteRes?.id) {
            record.id = remoteRes.id;
          }
        } catch (supaErr) {
          console.warn('Could not save monthly evaluation to Supabase, continuing locally:', supaErr);
        }
      }

      // 2. Save locally
      let newExams = [...monthlyExams];
      const idx = newExams.findIndex(r =>
        (r.classId === meClassSelect || r.className === meStudents.clsName) &&
        r.month === meMonth &&
        String(r.year) === String(meYear)
      );
      if (idx > -1) newExams[idx] = { ...newExams[idx], ...record };
      else newExams.push(record);

      saveToLocal(newExams);
      const avg = studentData.reduce((s, r) => s + r.pct, 0) / (studentData.length || 1);
      alert(`${meStudents.clsName} — ${meMonth} ${formatAcademicYear(meYear)}\n${studentData.length} طلباء کا ریکارڈ محفوظ ہو گیا!\nکلاسی اوسط: ${avg.toFixed(1)}%`);
      
      // Reload table with newly saved data
      meLoadStudents(newExams);
    } catch (err) {
      console.error('Error saving exam:', err);
      alert('ریکارڈ محفوظ کرنے میں خرابی پیش آئی۔');
    } finally {
      setIsSavingExam(false);
    }
  };

  const meDeleteExam = async (targetExam) => {
    if (!window.confirm('کیا آپ یہ ریکارڈ حذف کرنا چاہتے ہیں؟')) return;
    const examToDelete = (typeof targetExam === 'number') ? monthlyExams[targetExam] : targetExam;
    if (!examToDelete) return;

    try {
      if (deleteMonthlyEvaluationFromSupabase) {
        await deleteMonthlyEvaluationFromSupabase(examToDelete, activeMadrasaId);
      }
    } catch (supaErr) {
      console.warn('Could not delete monthly evaluation from Supabase:', supaErr);
    }

    const newExams = monthlyExams.filter(r => r !== examToDelete && (examToDelete.id ? r.id !== examToDelete.id : true));
    saveToLocal(newExams);
  };

  // --- 2. Hifz Logic (ششماہی و سالانہ) ---
  const [selectYear, setSelectYear] = useState('1');
  const [selectHalfYear, setSelectHalfYear] = useState('1');
  const [hifzStudentId, setHifzStudentId] = useState('');
  const [hifzStudentName, setHifzStudentName] = useState('');
  const [hifzStartDate, setHifzStartDate] = useState('');
  const [hifzSaving, setHifzSaving] = useState(false);

  // Dynamic base start year for academic calculations
  const baseStartYear = useMemo(() => {
    if (hifzStartDate) {
      const d = new Date(hifzStartDate);
      if (!isNaN(d.getTime())) {
        const base = getCurrentAcademicYearStart(d);
        return base + (Number(selectYear) - 1);
      }
    }
    return getCurrentAcademicYearStart() + (Number(selectYear) - 1);
  }, [hifzStartDate, selectYear]);

  // Month configs for Half Year 1 and 2
  const monthsConfig = useMemo(() => {
    return selectHalfYear === '1' ? [
      { name: 'اپریل', mIdx: 3, y: baseStartYear },
      { name: 'مئی', mIdx: 4, y: baseStartYear },
      { name: 'جون', mIdx: 5, y: baseStartYear },
      { name: 'جولائی', mIdx: 6, y: baseStartYear },
      { name: 'اگست', mIdx: 7, y: baseStartYear },
      { name: 'ستمبر', mIdx: 8, y: baseStartYear }
    ] : [
      { name: 'اکتوبر', mIdx: 9, y: baseStartYear },
      { name: 'نومبر', mIdx: 10, y: baseStartYear },
      { name: 'دسمبر', mIdx: 11, y: baseStartYear },
      { name: 'جنوری', mIdx: 0, y: baseStartYear + 1 },
      { name: 'فروری', mIdx: 1, y: baseStartYear + 1 },
      { name: 'مارچ', mIdx: 2, y: baseStartYear + 1 }
    ];
  }, [selectHalfYear, baseStartYear]);

  // Attendance rows state
  const [attendanceRows, setAttendanceRows] = useState(() => {
    const curYear = getCurrentAcademicYearStart();
    return [
      { name: 'اپریل', y: curYear, working: calculateWorkingDays(curYear, 3), absent: 0, leave: 0 },
      { name: 'مئی', y: curYear, working: calculateWorkingDays(curYear, 4), absent: 0, leave: 0 },
      { name: 'جون', y: curYear, working: calculateWorkingDays(curYear, 5), absent: 0, leave: 0 },
      { name: 'جولائی', y: curYear, working: calculateWorkingDays(curYear, 6), absent: 0, leave: 0 },
      { name: 'اگست', y: curYear, working: calculateWorkingDays(curYear, 7), absent: 0, leave: 0 },
      { name: 'ستمبر', y: curYear, working: calculateWorkingDays(curYear, 8), absent: 0, leave: 0 }
    ];
  });

  // Pages input state: { [monthName]: pagesRead }
  const [monthlyPages, setMonthlyPages] = useState({});
  const [attSyncedFromDaily, setAttSyncedFromDaily] = useState(false);
  const [isLoadingDailyAtt, setIsLoadingDailyAtt] = useState(false);

  // Synchronize monthly attendance and academic details from Daily Attendance & records
  const populateAttendanceAndAcademic = useCallback(async (studentId, yearVal, halfYearVal, overrideStartDate) => {
    if (!studentId) return;

    const std = studentsList.find(s => s.id === studentId || s.roll_number === studentId) ||
                records.find(r => r.id === studentId || r.admRegNo === studentId || r.name === studentId);
    const targetUuid = std?.id || studentId;
    const targetRegNo = std?.admRegNo || std?.roll_number || '';
    const startDateToUse = overrideStartDate !== undefined ? overrideStartDate : (std?.hifz_start_date || std?.admission_date || std?.admDate || hifzStartDate || '');

    let bYear = getCurrentAcademicYearStart();
    if (startDateToUse) {
      const d = new Date(startDateToUse);
      if (!isNaN(d.getTime())) {
        bYear = getCurrentAcademicYearStart(d) + (Number(yearVal) - 1);
      }
    }

    const currentMonths = String(halfYearVal) === '1' ? [
      { name: 'اپریل', mIdx: 3, y: bYear },
      { name: 'مئی', mIdx: 4, y: bYear },
      { name: 'جون', mIdx: 5, y: bYear },
      { name: 'جولائی', mIdx: 6, y: bYear },
      { name: 'اگست', mIdx: 7, y: bYear },
      { name: 'ستمبر', mIdx: 8, y: bYear }
    ] : [
      { name: 'اکتوبر', mIdx: 9, y: bYear },
      { name: 'نومبر', mIdx: 10, y: bYear },
      { name: 'دسمبر', mIdx: 11, y: bYear },
      { name: 'جنوری', mIdx: 0, y: bYear + 1 },
      { name: 'فروری', mIdx: 1, y: bYear + 1 },
      { name: 'مارچ', mIdx: 2, y: bYear + 1 }
    ];

    setIsLoadingDailyAtt(true);
    let dailyMap = {};
    let hasDailyRecords = false;

    try {
      // 1. Check local storage dailyAttendance
      const localHfData = loadMadrasaData('hf_records_v1', activeMadrasaId) || {};
      const localDaily = localHfData.dailyAttendance || {};
      Object.keys(localDaily).forEach(clsId => {
        const dateEntries = localDaily[clsId] || {};
        Object.keys(dateEntries).forEach(dStr => {
          const studentEntries = dateEntries[dStr] || {};
          const matched = studentEntries[targetUuid] || (targetRegNo && studentEntries[targetRegNo]);
          if (matched) {
            const st = typeof matched === 'string' ? matched : matched.status;
            if (st) {
              dailyMap[dStr] = st;
              hasDailyRecords = true;
            }
          }
        });
      });

      // 2. Check local storage hf_student_attendance_v1
      const localAttList = loadMadrasaData('hf_student_attendance_v1', activeMadrasaId) || [];
      if (Array.isArray(localAttList)) {
        localAttList.forEach(item => {
          if (item && (item.student_id === targetUuid || (targetRegNo && item.student_id === targetRegNo))) {
            if (item.date && item.status) {
              dailyMap[item.date] = item.status;
              hasDailyRecords = true;
            }
          }
        });
      }

      // 3. Fetch from Supabase student_attendance
      if (fetchStudentAttendanceFromSupabase && isValidUUID(activeMadrasaId)) {
        try {
          const remoteAtt = await fetchStudentAttendanceFromSupabase({ studentId: targetUuid }, activeMadrasaId);
          if (Array.isArray(remoteAtt) && remoteAtt.length > 0) {
            remoteAtt.forEach(item => {
              if (item.date && item.status) {
                dailyMap[item.date] = item.status;
                hasDailyRecords = true;
              }
            });
          }
        } catch (remoteErr) {
          console.warn('Could not fetch student attendance from Supabase, using local cache:', remoteErr);
        }
      }
    } catch (e) {
      console.warn('Error reading daily attendance:', e);
    } finally {
      setIsLoadingDailyAtt(false);
    }

    // Check if an existing half-year record exists in records
    const existingRec = records.find(r =>
      !r.isAdmissionProfile &&
      !r.isFeeRecord &&
      Number(r.year || r.hifz_year) === Number(yearVal) &&
      Number(r.halfYear || r.half_year) === Number(halfYearVal) &&
      ((targetUuid && (r.student_id === targetUuid || r.id === targetUuid)) ||
       (std?.name && r.name === std.name))
    );

    // If existing pages read exist, populate them
    if (existingRec?.monthly_academic_details || existingRec?.monthlyAcademicDetails) {
      setMonthlyPages(existingRec.monthly_academic_details || existingRec.monthlyAcademicDetails || {});
    } else {
      setMonthlyPages({});
    }

    // Build the 6 attendance rows
    const savedMonthlyAtt = existingRec?.monthly_attendance_details || existingRec?.attendance?.monthlyDetails || {};

    const computedRows = currentMonths.map(m => {
      const working = calculateWorkingDays(m.y, m.mIdx);
      const mNum = String(m.mIdx + 1).padStart(2, '0');
      const prefix = `${m.y}-${mNum}`;

      let monthAbsent = 0;
      let monthLeave = 0;
      let foundInDaily = false;

      // Count from dailyMap
      Object.keys(dailyMap).forEach(dStr => {
        if (dStr.startsWith(prefix)) {
          foundInDaily = true;
          const st = dailyMap[dStr];
          if (st === 'absent' || st === 'غائب' || st === 'A') {
            monthAbsent++;
          } else if (st === 'leave' || st === 'رخصت' || st === 'L') {
            monthLeave++;
          } else if (st === 'half_leave') {
            monthLeave += 0.5;
          }
        }
      });

      if (foundInDaily) {
        return {
          name: m.name,
          y: m.y,
          working: working,
          absent: monthAbsent,
          leave: monthLeave
        };
      }

      // If not found in daily, check if previously saved in existing record
      const prevSaved = savedMonthlyAtt[m.name];
      if (prevSaved) {
        return {
          name: m.name,
          y: m.y,
          working: prevSaved.working !== undefined ? Number(prevSaved.working) : working,
          absent: Number(prevSaved.absent || 0),
          leave: Number(prevSaved.leave || 0)
        };
      }

      // Default
      return {
        name: m.name,
        y: m.y,
        working: working,
        absent: 0,
        leave: 0
      };
    });

    setAttendanceRows(computedRows);
    setAttSyncedFromDaily(hasDailyRecords);
  }, [studentsList, records, activeMadrasaId, fetchStudentAttendanceFromSupabase, loadMadrasaData, hifzStartDate]);

  // Re-run attendance calculation when student, year, or half-year changes
  useEffect(() => {
    if (hifzStudentId) {
      populateAttendanceAndAcademic(hifzStudentId, selectYear, selectHalfYear);
    } else {
      setAttendanceRows(monthsConfig.map(m => ({
        name: m.name,
        y: m.y,
        working: calculateWorkingDays(m.y, m.mIdx),
        absent: 0,
        leave: 0
      })));
      setMonthlyPages({});
      setAttSyncedFromDaily(false);
    }
  }, [hifzStudentId, selectYear, selectHalfYear, populateAttendanceAndAcademic, monthsConfig]);

  // Expected completion calculation (+3 years)
  const calculateExpectedEnd = (start) => {
    if (!start) return '';
    try {
      const d = new Date(start);
      if (isNaN(d.getTime())) return '';
      d.setFullYear(d.getFullYear() + 3);
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const expectedEnd = calculateExpectedEnd(hifzStartDate);

  // Student selection helper
  const handleStudentSelect = (selectedId) => {
    setHifzStudentId(selectedId);
    if (!selectedId) {
      setHifzStudentName('');
      setHifzStartDate('');
      setAttSyncedFromDaily(false);
      return;
    }

    const std = studentsList.find(s => s.id === selectedId || s.roll_number === selectedId) ||
                records.find(r => r.id === selectedId || r.admRegNo === selectedId || r.name === selectedId);

    if (std) {
      setHifzStudentName(std.name || std.admName || '');
      const sDate = std.hifz_start_date || std.admission_date || std.admDate || '';
      const cleanDate = sDate ? sDate.split('T')[0] : '';
      setHifzStartDate(cleanDate);
      populateAttendanceAndAcademic(selectedId, selectYear, selectHalfYear, cleanDate);
    }
  };

  const handleAttendanceChange = (index, field, value) => {
    const next = [...attendanceRows];
    next[index] = {
      ...next[index],
      [field]: Math.max(0, Number(value) || 0)
    };
    setAttendanceRows(next);
  };

  const handlePagesChange = (monthName, value) => {
    setMonthlyPages(prev => ({
      ...prev,
      [monthName]: Math.max(0, Number(value) || 0)
    }));
  };

  // Calculations for Attendance and Academic targets
  const yearVal = Number(selectYear);
  const totalJuz = (yearTargets[yearVal] || []).length;
  const totalPagesOfYear = totalJuz * PAGES_PER_JUZ;
  const standardTargetHalf = totalPagesOfYear / 2;

  // Attendance summary totals
  let totalWorking = 0;
  let totalAbsent = 0;
  let totalLeave = 0;
  let totalPresent = 0;
  const attendanceMonthlyDetails = {};

  attendanceRows.forEach(row => {
    const w = Number(row.working) || 0;
    const a = Number(row.absent) || 0;
    const l = Number(row.leave) || 0;
    const p = Math.max(0, w - (a + l));
    totalWorking += w;
    totalAbsent += a;
    totalLeave += l;
    totalPresent += p;
    attendanceMonthlyDetails[row.name] = { working: w, absent: a, leave: l, present: p };
  });

  const totalAbsentLeave = totalAbsent + totalLeave;
  const attPct = totalWorking ? +((totalPresent / totalWorking) * 100).toFixed(2) : 0;

  // Proportional target calculation (from edit.html)
  let targetHalf = standardTargetHalf;
  if (totalWorking > 0) {
    targetHalf = +(standardTargetHalf * (totalPresent / totalWorking)).toFixed(1);
  }

  // Academic pages totals
  let totalPages = 0;
  const academicMonthlyDetails = {};
  monthsConfig.forEach(m => {
    const val = Number(monthlyPages[m.name] || 0);
    totalPages += val;
    academicMonthlyDetails[m.name] = val;
  });

  const eduPct = targetHalf > 0 ? +((totalPages / targetHalf) * 100).toFixed(2) : 0;
  const pao = +(totalPages / PAGES_PER_PAO).toFixed(2);
  const juz = +(totalPages / PAGES_PER_JUZ).toFixed(2);

  let score = 0;
  for (const t of scoreThresholds) {
    if (eduPct >= t.pct) {
      score = t.score;
      break;
    }
  }

  // Save Hifz Record
  const handleSaveHifzRecord = async () => {
    const name = hifzStudentName.trim();
    const start = hifzStartDate;

    if (!name || !start) {
      alert('براہِ کرم بچے کا نام اور آغازِ تاریخ درج کریں۔');
      return;
    }

    if (totalPages === 0 && totalPresent === 0) {
      alert('براہِ کرم کوئی تعلیمی یا حاضری کا ریکارڈ درج کریں۔');
      return;
    }

    // Resolve student ID
    const matchedStudent = studentsList.find(s => s.id === hifzStudentId || s.name === name || s.roll_number === hifzStudentId) ||
                           records.find(r => r.id === hifzStudentId || r.name === name);
    const resolvedStudentId = matchedStudent?.id || (hifzStudentId || null);

    // Duplicate check matching original edit.html confirmation behavior
    const existingRecord = records.find(r =>
      !r.isAdmissionProfile &&
      Number(r.year || r.hifz_year) === yearVal &&
      Number(r.halfYear || r.half_year) === Number(selectHalfYear) &&
      ((resolvedStudentId && (r.student_id === resolvedStudentId || r.id === resolvedStudentId || r.studentUuid === resolvedStudentId)) ||
       (name && r.name === name))
    );

    if (existingRecord) {
      const confirmOverwrite = window.confirm(`سال ${yearVal} ششماہی ${selectHalfYear} کا ریکارڈ موجود ہے۔ کیا آپ تبدیل کرنا چاہتے ہیں؟`);
      if (!confirmOverwrite) return;
    }

    const payload = {
      student_id: resolvedStudentId,
      student_name: name,
      hifz_year: yearVal,
      half_year: Number(selectHalfYear),
      total_pages: totalPages,
      pao: pao,
      juz: juz,
      pct: eduPct,
      score: score,
      total_working: totalWorking,
      total_present: totalPresent,
      total_absent: totalAbsent,
      total_leave: totalLeave,
      attendance_pct: attPct,
      monthly_academic_details: academicMonthlyDetails,
      monthly_attendance_details: attendanceMonthlyDetails
    };

    try {
      setHifzSaving(true);
      await saveHifzHalfYearRecordToSupabase(payload, activeMadrasaId);

      if (resolvedStudentId && start) {
        await updateStudentHifzStartDate(resolvedStudentId, start, activeMadrasaId);
      }

      alert(`سال ${yearVal} ششماہی ${selectHalfYear} کا ریکارڈ کامیابی سے محفوظ ہو گیا!\nطالب علم: ${name}\nکل صفحات: ${totalPages} (${eduPct}%)\nحاضری: ${attPct}%`);

      // Update in-memory records so existing record is immediately present
      setRecords(prev => {
        const next = [...prev];
        const idx = next.findIndex(r =>
          !r.isAdmissionProfile &&
          Number(r.year || r.hifz_year) === yearVal &&
          Number(r.halfYear || r.half_year) === Number(selectHalfYear) &&
          ((resolvedStudentId && (r.student_id === resolvedStudentId || r.id === resolvedStudentId)) ||
           (name && r.name === name))
        );
        const newRec = {
          ...payload,
          id: existingRecord?.id || `rec_${Date.now()}`,
          name: name,
          year: yearVal,
          halfYear: Number(selectHalfYear),
          pages: totalPages,
          attendance: {
            working: totalWorking,
            present: totalPresent,
            absent: totalAbsent,
            leave: totalLeave,
            pct: attPct,
            monthlyDetails: attendanceMonthlyDetails
          },
          monthlyAcademicDetails: academicMonthlyDetails
        };
        if (idx > -1) next[idx] = newRec;
        else next.unshift(newRec);
        return next;
      });
    } catch (err) {
      console.error('Error saving Hifz record:', err);
      alert('ریکارڈ محفوظ کرنے میں خرابی پیش آئی: ' + (err.message || err));
    } finally {
      setHifzSaving(false);
    }
  };

  // Enrolled students for dropdown autocomplete
  const enrolledStudents = studentsList.length > 0
    ? studentsList
    : records.filter(r => r.isAdmissionProfile && !r.isWithdrawn);

  // --- 3. Class Report ---
  const [crClassSelect, setCrClassSelect] = useState('');
  const [crMonth, setCrMonth] = useState('اپریل');
  const [crYear, setCrYear] = useState(defaultYear);
  const [crResultsData, setCrResultsData] = useState(null);

  const renderClassReport = () => {
    if (!crClassSelect) { alert('کلاس منتخب کریں'); return; }
    const cls = classesList.find(c => c.id === crClassSelect || c.name === crClassSelect || c.class_name === crClassSelect);
    const exam = monthlyExams.find(r => 
      (r.classId === crClassSelect || (cls && (r.className === cls.name || r.className === cls.class_name || r.classId === cls.id || r.classId === cls.name))) && 
      r.month === crMonth && 
      String(r.year) === String(crYear)
    );
    
    if (!exam) { setCrResultsData('empty'); return; }
    const avg = exam.students.reduce((s, r) => s + (r.pct || 0), 0) / exam.students.length;
    setCrResultsData({ clsName: cls ? (cls.name || cls.className || crClassSelect) : '', month: crMonth, year: crYear, exam, avg });
  };

  // --- 4. Student Report ---
  const [srStudentId, setSrStudentId] = useState('');
  const [srResultsData, setSrResultsData] = useState(null);

  const renderStudentReport = () => {
    const id = srStudentId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id) ||
                    studentsList.find(s => s.roll_number === id || s.id === id);
    if (!student) { setSrResultsData('notfound'); return; }
    
    const exams = monthlyExams.filter(exam => exam.students && exam.students.some(s => String(s.regNo) === id || (s.student_id && String(s.student_id) === id)))
                              .sort((a,b) => Number(a.year) - Number(b.year) || 0);
    
    if (!exams.length) { setSrResultsData({ empty: true, student }); return; }
    const avgAll = exams.reduce((s, e) => { const st = e.students.find(x => x.regNo === id); return s + (st?.pct || 0); }, 0) / exams.length;
    setSrResultsData({ student, exams, avgAll });
  };

  // --- 5. Institute Result ---
  const [irMonth, setIrMonth] = useState('اپریل');
  const [irYear, setIrYear] = useState(defaultYear);
  const [irResultsData, setIrResultsData] = useState(null);

  const renderInstituteResult = () => {
    const exams = monthlyExams.filter(r => r.month === irMonth && String(r.year) === String(irYear));
    if (!exams.length) { setIrResultsData('empty'); return; }
    
    const totalStudents = exams.reduce((s, e) => s + e.students.length, 0);
    const overallAvg = exams.reduce((s, e) => s + e.students.reduce((ss, st) => ss + (st.pct || 0), 0), 0) / totalStudents;
    setIrResultsData({ month: irMonth, year: irYear, exams, totalStudents, overallAvg });
  };

  return (
    <div className="tab-content">
      <div className="adm-type-grid no-print" style={{ marginBottom: "20px" }}>
        {[
          { id: 'monthly', label: 'اندراج ماہانہ جائزہ' },
          { id: 'hifz', label: 'ششماہی و سالانہ خواندگی' },
          { id: 'classreport', label: 'کلاس کی انفرادی رپورٹ' },
          { id: 'studentreport', label: 'طالب علم کی انفرادی رپورٹ' },
          { id: 'instituteresult', label: 'نتیجہ ماہانہ جائزہ — پورا ادارہ' }
        ].map(t => (
          <button key={t.id} className={`adm-type-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => switchTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Monthly Exam Entry */}
      {activeTab === 'monthly' && (
        <div id="entrySection-monthly" className="no-print">
          <div className="me-control-card">
            <div className="form-section-header" style={{ marginBottom: "18px" }}>
              <div className="form-section-icon icon-amber"></div>
              <div>
                <div className="form-section-title">ماہانہ جائزہ نمبرات اندراج</div>
                <div className="form-section-subtitle">کلاس اور مہینہ منتخب کر کے نمبرات درج کریں</div>
              </div>
            </div>
            <div className="me-control-row">
              <div>
                <label htmlFor="meClassSelect">کلاس منتخب کریں</label>
                <select id="meClassSelect" value={meClassSelect} onChange={e => setMeClassSelect(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.class_name || c.className || c.id}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="meMonthSelect">ماہ</label>
                <select id="meMonthSelect" value={meMonth} onChange={e => setMeMonth(e.target.value)}>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="meYearSelect">سال</label>
                <select id="meYearSelect" value={meYear} onChange={e => setMeYear(e.target.value)}>
                  {getAcademicYearOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button className="me-load-btn" onClick={meLoadStudents}>طلباء لوڈ کریں</button>
            </div>
          </div>

          <div id="meTableArea">
            {meStudents === 'empty' ? <div className="empty-dashboard-state">اس کلاس میں کوئی طالب علم موجود نہیں۔</div> :
             meStudents && (
              <>
                <div className="me-table-wrap">
                  <table className="me-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" style={{ minWidth: "48px" }}>نمبر</th>
                        <th rowSpan="2" style={{ minWidth: "160px", textAlign: "right", paddingRight: "12px" }}>طالب علم</th>
                        {ME_COLS.filter(c => !c.sub).map(c => <th rowSpan="2" key={c.key}>{c.label}<br/><span className="me-max-label">/ {c.max}</span></th>)}
                        <th colSpan="2" className="me-literacy-group">خواندگی</th>
                        <th rowSpan="2" style={{ minWidth: "80px" }}>کل<br/><span className="me-max-label">/ {ME_MAX_TOTAL}</span></th>
                      </tr>
                      <tr className="me-subhead">
                        {ME_COLS.filter(c => c.sub).map(c => <th className="me-literacy-sub" key={c.key}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {meStudents.data.map((item, idx) => (
                        <tr key={item.student.admRegNo || idx}>
                          <td><span className="me-reg">{item.student.admRegNo || '-'}</span></td>
                          <td className="me-td-info"><span className="me-name">{item.student.name || '-'}</span></td>
                          {ME_COLS.map(c => (
                            <td key={c.key}>
                                {c.sub ? (
                                    <input type="text" className="me-input" style={{ width: "70px" }} value={item[c.key]} placeholder={c.label.charAt(0)} onChange={e => meCalcRow(idx, c.key, e.target.value, true)} />
                                ) : (
                                    <input type="number" className={`me-input ${Number(item[c.key]||0) > c.max ? 'me-invalid' : ''}`} min="0" max={c.max} value={item[c.key]} placeholder="0" onChange={e => meCalcRow(idx, c.key, e.target.value, false)} />
                                )}
                            </td>
                          ))}
                          <td><span className={`me-total-cell ${item.gradeObj.cls}`} title={`${item.pct.toFixed(1)}% — ${item.gradeObj.g}`}>{item.total}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="me-save-bar" style={{ marginTop: "18px" }}>
                  <button className="me-save-btn" onClick={meSaveExam} disabled={isSavingExam}>
                    {isSavingExam ? 'محفوظ ہو رہا ہے...' : `${meStudents.clsName} — ${meMonth} ${formatAcademicYear(meYear)} محفوظ کریں`}
                  </button>
                  <div className="me-summary-chips">
                    <span className="me-chip me-chip-green">طلباء: {meStudents.data.length}</span>
                    <span className="me-chip me-chip-blue">کل نمبر: {ME_MAX_TOTAL}</span>
                  </div>
                  {meStudents.existing && <span style={{ color: "#16a34a", fontSize: "0.88rem", fontWeight: "700" }}>پہلے سے ریکارڈ موجود — اپ ڈیٹ ہو گا</span>}
                </div>
              </>
            )}
          </div>

          <div className="me-history-section">
            <div className="form-section-card">
              <div className="form-section-header">
                <div className="form-section-icon icon-green"></div>
                <div>
                  <div className="form-section-title">ماہانہ جائزہ — سابقہ ریکارڈ</div>
                  <div className="form-section-subtitle">Monthly Exam History</div>
                </div>
              </div>
              <div className="me-history-controls">
                <select value={meHistoryClassFilter} onChange={e => setMeHistoryClassFilter(e.target.value)} style={{ maxWidth: "220px" }}>
                  <option value="">تمام کلاسز</option>
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.class_name || c.className || c.id}</option>)}
                </select>
                <select value={meHistoryMonthFilter} onChange={e => setMeHistoryMonthFilter(e.target.value)} style={{ maxWidth: "160px" }}>
                  <option value="">تمام مہینے</option>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div id="meHistoryArea">
                {(()=>{
                    const filtered = monthlyExams.filter(r => (!meHistoryClassFilter || r.classId === meHistoryClassFilter || (classesList.find(c => c.id === meHistoryClassFilter)?.name === r.className)) && (!meHistoryMonthFilter || r.month === meHistoryMonthFilter))
                                                 .sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
                    if (!filtered.length) return <div className="empty-dashboard-state">کوئی ریکارڈ موجود نہیں۔</div>;
                    return filtered.map((exam, ei) => {
                        const avg = exam.students.reduce((s, r) => s + (r.pct || 0), 0) / exam.students.length;
                        const gd = meGrade(avg);
                        return (
                            <div className="me-history-card" key={ei}>
                                <div className="me-history-header">
                                  <div><span className="me-history-title">{exam.className}</span><span className="me-history-badge" style={{ marginRight: "8px" }}>{exam.month} {exam.year}</span></div>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span className="me-chip me-chip-green">اوسط: {avg.toFixed(1)}% {gd.g}</span>
                                    <span className="me-chip me-chip-blue">طلباء: {exam.students.length}</span>
                                    <button className="me-del-btn" onClick={() => meDeleteExam(exam)}>حذف</button>
                                  </div>
                                </div>
                                <div className="me-table-wrap" style={{ marginBottom: "0" }}>
                                  <table className="me-table" style={{ minWidth: "700px" }}>
                                    <thead>
                                      <tr>
                                        <th>نمبر</th><th>نام</th>
                                        {ME_COLS.filter(c => !c.sub && c.max).map(c => <th key={c.key}>{c.label}</th>)}
                                        <th>پارہ</th><th>ترکو</th><th>کل</th><th>فیصد</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {exam.students.map((s, i) => {
                                          const sg = meGrade(s.pct || 0);
                                          return (
                                              <tr key={i}>
                                                  <td><span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{s.regNo || '-'}</span></td>
                                                  <td style={{ textAlign: "right", fontWeight: "700", paddingRight: "10px" }}>{s.name || '-'}</td>
                                                  {ME_COLS.filter(c => !c.sub && c.max).map(c => <td key={c.key} style={{ textAlign: "center" }}>{s[c.key] ?? 0}/{c.max}</td>)}
                                                  <td style={{ textAlign: "center" }}>{s.para || '—'}</td>
                                                  <td style={{ textAlign: "center" }}>{s.tarkoo || '—'}</td>
                                                  <td style={{ textAlign: "center" }}><span className={`me-total-cell ${sg.cls}`} style={{ fontSize: "0.88rem" }}>{s.total}</span></td>
                                                  <td style={{ textAlign: "center" }}><span style={{ fontSize: "0.8rem", fontWeight: "700", color: sg.color }}>{s.pct}% ({s.grade})</span></td>
                                              </tr>
                                          );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                            </div>
                        );
                    });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Hifz Entry */}
      {activeTab === 'hifz' && (
        <div id="entrySection-hifz" className="no-print">
            <div className="grid-row" style={{ marginTop: "20px" }}>
              <div>
                <label htmlFor="hifzStudentSelect">طالب علم منتخب کریں</label>
                <select 
                  id="hifzStudentSelect"
                  value={hifzStudentId} 
                  onChange={e => handleStudentSelect(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                >
                  <option value="">طالب علم کا انتخاب کریں...</option>
                  {enrolledStudents.map(s => (
                    <option key={s.id || s.roll_number} value={s.id || s.roll_number}>
                      {s.name || s.admName} ({s.roll_number || s.admRegNo || '—'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>بچے کا نام (دستی)</label>
                <input 
                  type="text" 
                  id="studentName" 
                  value={hifzStudentName} 
                  onChange={e => setHifzStudentName(e.target.value)} 
                  placeholder="بچے کا نام لکھیں..."
                />
              </div>
              <div>
                <label>آغازِ حفظ کی تاریخ</label>
                <input 
                  type="date" 
                  id="startDate" 
                  value={hifzStartDate} 
                  onChange={e => setHifzStartDate(e.target.value)} 
                />
              </div>
              <div>
                <label>متوقع تکمیل (خودکار)</label>
                <input 
                  type="text" 
                  id="expectedEnd" 
                  value={expectedEnd} 
                  readOnly 
                  className="expected-end-input"
                />
              </div>
            </div>

            <div id="targetsArea" style={{ marginTop: "20px", overflowX: "auto" }}>
              <h3>پارہ تقسیم — سالانہ حقائق پارے</h3>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>سال</th>
                      <th>پارے</th>
                      <th>کل پارے</th>
                      <th>سالانہ کل صفحات</th>
                      <th>ششماہی ہدف صفحات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map(y => {
                        const arr = yearTargets[y] || [];
                        const total = arr.length * PAGES_PER_JUZ;
                        return (
                          <tr key={y} className={Number(selectYear) === y ? 'selected-target-row' : ''}>
                            <td>سال {y}</td>
                            <td style={{ fontSize: "0.9rem" }}>{arr.join(', ')}</td>
                            <td>{arr.length}</td>
                            <td>{total}</td>
                            <td>{total / 2}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hifz-selection-card" style={{ padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
              <h3 style={{ marginTop: "0", textAlign: "center", color: "var(--accent)" }}>سال اور ششماہی کا انتخاب</h3>
              <div className="grid-row">
                <div>
                  <label>حفظ کا سال</label>
                  <select value={selectYear} onChange={e => setSelectYear(e.target.value)}>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>سال {y} ({(yearTargets[y] || []).length} پارے)</option>)}
                  </select>
                </div>
                <div>
                  <label>ششماہی (تعلیمی سال: اپریل تا مارچ)</label>
                  <select value={selectHalfYear} onChange={e => setSelectHalfYear(e.target.value)}>
                    <option value="1">ششماہی اول (اپریل تا ستمبر)</option>
                    <option value="2">ششماہی دوم (اکتوبر تا مارچ)</option>
                  </select>
                </div>
              </div>
            </div>

            <h2>1. حاضری کا ریکارڈ (ایامِ کار)</h2>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
              <div className="hifz-instruction-text" style={{ margin: "0" }}>
                ایامِ کار خودکار طریقے سے کیلکولیٹ ہوئے ہیں، تاہم آپ دستی تبدیلی کر سکتے ہیں (غیر حاضری اور رخصت ضرور درج کریں)۔
              </div>
              {attSyncedFromDaily && (
                <span className="me-chip me-chip-green" style={{ fontSize: "0.82rem", fontWeight: "700" }}>
                  روزانہ حاضری سے خودکار ہم آہنگ
                </span>
              )}
              {isLoadingDailyAtt && (
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>حاضری لوڈ ہو رہی ہے...</span>
              )}
            </div>

            <div id="attendanceInputArea">
              <div className="attendance-header">
                <div>مہینہ</div>
                <div>ایامِ کار (W)</div>
                <div>غیر حاضری (A)</div>
                <div>رخصت (L)</div>
                <div>کل حاضری (P) اور %</div>
              </div>
              {attendanceRows.map((row, index) => {
                const w = Number(row.working) || 0;
                const a = Number(row.absent) || 0;
                const l = Number(row.leave) || 0;
                const p = Math.max(0, w - (a + l));
                const rowPct = w ? ((p / w) * 100).toFixed(2) : '0.00';

                return (
                  <div className="attendance-row" key={index}>
                    <div>{row.name} {row.y}</div>
                    <div>
                      <input 
                        type="number" 
                        min="0" 
                        value={row.working} 
                        onChange={e => handleAttendanceChange(index, 'working', e.target.value)}
                        className="working-days" 
                        style={{ width: "90px", textAlign: "center" }} 
                      />
                      <br/>
                      <label style={{ fontSize: "0.75rem" }}>(ایامِ کار)</label>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        min="0" 
                        value={row.absent} 
                        onChange={e => handleAttendanceChange(index, 'absent', e.target.value)}
                        className="absent-days" 
                        style={{ width: "90px", textAlign: "center" }} 
                      />
                      <br/>
                      <label style={{ fontSize: "0.75rem" }}>(غیر حاضری)</label>
                    </div>
                    <div>
                      <input 
                        type="number" 
                        min="0" 
                        value={row.leave} 
                        onChange={e => handleAttendanceChange(index, 'leave', e.target.value)}
                        className="leave-days" 
                        style={{ width: "90px", textAlign: "center" }} 
                      />
                      <br/>
                      <label style={{ fontSize: "0.75rem" }}>(رخصت)</label>
                    </div>
                    <div className="result-cell">
                      <span className="present-days-display" style={{ fontWeight: "700" }}>{p}</span>
                      <span className="days-label"> ایام</span>
                      <br/>
                      (<span className="monthly-pct-display" style={{ fontWeight: "700" }}>{rowPct}%</span>)
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid-row hifz-summary-card hifz-summary-att" style={{ padding: "15px", borderRadius: "8px", marginTop: "15px" }}>
                <div>
                  <label>ششماہی کل ایامِ کار</label>
                  <input type="text" value={totalWorking} readOnly />
                </div>
                <div>
                  <label>کل غیر حاضری + رخصت</label>
                  <input type="text" value={totalAbsentLeave} readOnly />
                </div>
                <div>
                  <label>ششماہی کل حاضر ایام</label>
                  <input type="text" value={totalPresent} readOnly style={{ fontWeight: 'bold' }} />
                </div>
                <div>
                  <label>حاضری فیصد</label>
                  <input 
                    type="text" 
                    value={`${attPct}%`} 
                    readOnly 
                    style={{ fontWeight: 'bold', color: attPct >= 80 ? 'var(--accent)' : 'var(--danger)' }} 
                  />
                </div>
            </div>

            <h2>2. مقدارِ خواندگی (تعلیمی ریکارڈ)</h2>
            <div className="grid-row">
                <div>
                  <label>ششماہی ہدف (صفحات — حاضری کے تناسب سے)</label>
                  <input type="text" value={targetHalf} readOnly style={{ fontWeight: 'bold', color: 'var(--accent)' }} />
                </div>
                <div>
                  <label>معیاری ششماہی ہدف (مکمل ایام)</label>
                  <input type="text" value={standardTargetHalf} readOnly />
                </div>
            </div>
            
            <h3>ماہانہ صفحات کا اندراج</h3>
            <div id="monthlyInputArea" className="months-grid">
               {monthsConfig.map((m, index) => (
                  <div key={index}>
                    <label>{m.name} ({m.y})</label>
                    <input 
                      type="number" 
                      min="0" 
                      className="month-pages" 
                      placeholder="0" 
                      value={monthlyPages[m.name] ?? ''}
                      onChange={e => handlePagesChange(m.name, e.target.value)}
                    />
                  </div>
              ))}
            </div>

            <div className="grid-row hifz-summary-card hifz-summary-edu" style={{ padding: "15px", borderRadius: "8px", marginTop: "15px" }}>
              <div>
                <label>کل پڑھے گئے صفحات</label>
                <input type="text" value={totalPages} readOnly style={{ fontWeight: 'bold' }} />
              </div>
              <div>
                <label>پاؤ / پارہ</label>
                <input type="text" value={`${pao} پاؤ / ${juz} پارہ`} readOnly />
              </div>
              <div>
                <label>تعلیمی فیصد</label>
                <input 
                  type="text" 
                  value={`${eduPct}%`} 
                  readOnly 
                  style={{ fontWeight: 'bold', color: eduPct >= 75 ? 'var(--accent)' : 'var(--danger)' }} 
                />
              </div>
              <div>
                <label>اسکور</label>
                <input type="text" value={score} readOnly style={{ fontWeight: 'bold' }} />
              </div>
            </div>

            <div className="btn-container" style={{ marginTop: "20px" }}>
              <button 
                onClick={handleSaveHifzRecord} 
                disabled={hifzSaving}
                className="hifz-save-btn"
              >
                {hifzSaving ? 'محفوظ ہو رہا ہے...' : 'مکمل ریکارڈ (تعلیمی + حاضری) محفوظ کریں'}
              </button>
            </div>
        </div>
      )}

      {/* 3. Class Report */}
      {activeTab === 'classreport' && (
        <div id="entrySection-classreport">
          <div className="form-section-card no-print">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-blue"></div>
              <div>
                <div className="form-section-title">کلاس کی انفرادی رپورٹ</div>
                <div className="form-section-subtitle">کلاس اور مہینہ منتخب کر کے رپورٹ پرنٹ کریں</div>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>کلاس منتخب کریں</label>
                <select value={crClassSelect} onChange={e => setCrClassSelect(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.class_name || c.className || c.id}</option>)}
                </select>
              </div>
              <div>
                <label>مہینہ</label>
                <select value={crMonth} onChange={e => setCrMonth(e.target.value)}>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>سال</label>
                <select value={crYear} onChange={e => setCrYear(e.target.value)}>
                  <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option>
                </select>
              </div>
            </div>
            <div className="btn-container" style={{ marginTop: "14px" }}>
              <button onClick={renderClassReport} style={{ background: "var(--accent)" }}>رپورٹ دیکھیں</button>
              <button onClick={() => window.print()} style={{ background: "var(--accent-2)" }}>پرنٹ کریں</button>
            </div>
          </div>
          <div className="printable-area">
            {crResultsData === 'empty' ? <div className="empty-dashboard-state">{crClassSelect} — {crMonth} {crYear} کا کوئی ریکارڈ موجود نہیں</div> :
             crResultsData && (
                <div className="report-result-card" style={{ padding: "20px", marginTop: "14px" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--accent)" }}>ماہانہ جائزہ رپورٹ</div>
                    <div style={{ fontSize: "1rem", color: "var(--muted)" }}>{crResultsData.exam.className} — {crResultsData.month} {crResultsData.year}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--accent-2)", marginTop: "4px" }}>اوسط: {crResultsData.avg.toFixed(1)}% ({meGrade(crResultsData.avg).g}) | طلباء: {crResultsData.exam.students.length}</div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr className="report-table-header">
                          <th style={{ padding: "8px" }}>نمبر</th><th style={{ padding: "8px" }}>ID</th><th style={{ padding: "8px" }}>نام</th>
                          {ME_COLS.filter(c => !c.sub && c.max).map(c => <th key={c.key} style={{ padding: "8px" }}>{c.label}</th>)}
                          <th style={{ padding: "8px" }}>پارہ</th><th style={{ padding: "8px" }}>ترکو</th><th style={{ padding: "8px" }}>کل</th><th style={{ padding: "8px" }}>فیصد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crResultsData.exam.students.map((s, i) => {
                          const sg = meGrade(s.pct || 0);
                          return (
                            <tr key={i}>
                              <td style={{ textAlign: "center" }}>{i + 1}</td>
                              <td style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--muted)" }}>{s.regNo || '-'}</td>
                              <td style={{ textAlign: "right", fontWeight: "700", paddingRight: "10px" }}>{s.name || '-'}</td>
                              {ME_COLS.filter(c => !c.sub && c.max).map(c => <td key={c.key} style={{ textAlign: "center" }}>{s[c.key] ?? 0}/{c.max}</td>)}
                              <td style={{ textAlign: "center" }}>{s.para || '—'}</td>
                              <td style={{ textAlign: "center" }}>{s.tarkoo || '—'}</td>
                              <td style={{ textAlign: "center", fontWeight: "700" }}>{s.total}</td>
                              <td style={{ textAlign: "center", fontWeight: "700", color: sg.color }}>{s.pct}% ({s.grade})</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* 4. Student Report */}
      {activeTab === 'studentreport' && (
        <div id="entrySection-studentreport">
          <div className="form-section-card no-print">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-amber"></div>
              <div>
                <div className="form-section-title">طالب علم کی انفرادی رپورٹ</div>
                <div className="form-section-subtitle">رجسٹریشن نمبر سے کسی بھی طالب علم کی رپورٹ دیکھیں</div>
              </div>
            </div>
            <div className="search-container">
              <input type="text" value={srStudentId} onChange={e => setSrStudentId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
              <button onClick={renderStudentReport}>رپورٹ دیکھیں</button>
            </div>
          </div>
          <div className="printable-area">
            {srResultsData === 'notfound' ? <div className="empty-dashboard-state">کوئی طالب علم نہیں ملا</div> :
             srResultsData && srResultsData.empty ? <div className="empty-dashboard-state">{srResultsData.student.name} کا کوئی جائزہ ریکارڈ موجود نہیں</div> :
             srResultsData && (
                <div className="report-result-card" style={{ padding: "20px", marginTop: "14px" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--accent)" }}>انفرادی رپورٹ</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "700" }}>{srResultsData.student.name}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>والد: {srResultsData.student.admFatherName || '—'} | ID: {srStudentId}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--accent-2)", marginTop: "4px" }}>مجموعی اوسط: {srResultsData.avgAll.toFixed(1)}% ({meGrade(srResultsData.avgAll).g})</div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr className="report-table-header">
                          <th style={{ padding: "8px" }}>مہینہ</th><th style={{ padding: "8px" }}>کلاس</th>
                          {ME_COLS.filter(c => !c.sub && c.max).map(c => <th key={c.key} style={{ padding: "8px" }}>{c.label}</th>)}
                          <th style={{ padding: "8px" }}>پارہ</th><th style={{ padding: "8px" }}>ترکو</th><th style={{ padding: "8px" }}>کل</th><th style={{ padding: "8px" }}>فیصد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {srResultsData.exams.map((exam, i) => {
                          const s = exam.students.find(x => x.regNo === srStudentId);
                          const sg = meGrade(s?.pct || 0);
                          return (
                            <tr key={i}>
                              <td style={{ textAlign: "center" }}>{exam.month} {exam.year}</td>
                              <td style={{ textAlign: "right", paddingRight: "10px" }}>{exam.className}</td>
                              {ME_COLS.filter(c => !c.sub && c.max).map(c => <td key={c.key} style={{ textAlign: "center" }}>{s?.[c.key] ?? 0}/{c.max}</td>)}
                              <td style={{ textAlign: "center" }}>{s?.para || '—'}</td>
                              <td style={{ textAlign: "center" }}>{s?.tarkoo || '—'}</td>
                              <td style={{ textAlign: "center", fontWeight: "700" }}>{s?.total ?? 0}</td>
                              <td style={{ textAlign: "center", fontWeight: "700", color: sg.color }}>{s?.pct ?? 0}% ({s?.grade || '—'})</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ textAlign: "center", marginTop: "14px" }} className="no-print">
                    <button onClick={() => window.print()} style={{ background: "var(--accent-2)", color: "#fff", border: "none", padding: "10px 28px", borderRadius: "8px", cursor: "pointer", fontWeight: "700" }}>پرنٹ کریں</button>
                  </div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* 5. Institute Result */}
      {activeTab === 'instituteresult' && (
        <div id="entrySection-instituteresult">
          <div className="form-section-card no-print">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-green"></div>
              <div>
                <div className="form-section-title">نتیجہ ماہانہ جائزہ — پورا ادارہ</div>
                <div className="form-section-subtitle">مہینہ اور سال منتخب کر کے ادارے کا مکمل خلاصہ دیکھیں</div>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>مہینہ</label>
                <select value={irMonth} onChange={e => setIrMonth(e.target.value)}>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>سال</label>
                <select value={irYear} onChange={e => setIrYear(e.target.value)}>
                  <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option><option value="2027">2027</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                <button onClick={renderInstituteResult} style={{ background: "var(--accent)", flex: "1" }}>خلاصہ دیکھیں</button>
                <button onClick={() => window.print()} style={{ background: "var(--accent-2)", flex: "1" }}>پرنٹ</button>
              </div>
            </div>
          </div>
          <div className="printable-area">
            {irResultsData === 'empty' ? <div className="empty-dashboard-state">{irMonth} {irYear} کا کوئی ریکارڈ موجود نہیں</div> :
             irResultsData && (
              <div className="report-result-card" style={{ padding: "20px", marginTop: "14px" }}>
                <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--accent)" }}>نتیجہ ماہانہ جائزہ</div>
                  <div style={{ fontSize: "1rem", color: "var(--muted)" }}>{irResultsData.month} {irResultsData.year} — پورا ادارہ</div>
                </div>

                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "20px" }}>
                  <div className="ir-stat-card ir-stat-green">
                    <div style={{ fontSize: "0.85rem", color: "#15803d" }}>کل کلاسز</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#15803d" }}>{irResultsData.exams.length}</div>
                  </div>
                  <div className="ir-stat-card ir-stat-blue">
                    <div style={{ fontSize: "0.85rem", color: "#1d4ed8" }}>کل طلباء</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1d4ed8" }}>{irResultsData.totalStudents}</div>
                  </div>
                  <div className="ir-stat-card ir-stat-amber">
                    <div style={{ fontSize: "0.85rem", color: "#b45309" }}>مجموعی اوسط</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#b45309" }}>{irResultsData.overallAvg.toFixed(1)}%</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#b45309" }}>{meGrade(irResultsData.overallAvg).g}</div>
                  </div>
                </div>

                <h4 style={{ color: "var(--accent)", margin: "0 0 10px 0" }}>کلاس وار نتیجہ</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr className="report-table-header">
                        <th style={{ padding: "10px 14px" }}>کلاس</th><th style={{ padding: "10px" }}>طلباء</th><th style={{ padding: "10px" }}>اوسط</th><th style={{ padding: "10px" }}>گریڈ</th><th style={{ padding: "10px" }}>نمایاں طالب علم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irResultsData.exams.map((exam, i) => {
                        const avg = exam.students.reduce((s, r) => s + (r.pct || 0), 0) / exam.students.length;
                        const gd = meGrade(avg);
                        const best = exam.students.reduce((a, b) => (a.pct || 0) >= (b.pct || 0) ? a : b, exam.students[0]);
                        return (
                          <tr key={i}>
                            <td style={{ textAlign: "right", fontWeight: "700", padding: "10px 14px" }}>{exam.className}</td>
                            <td style={{ textAlign: "center", padding: "10px" }}>{exam.students.length}</td>
                            <td style={{ textAlign: "center", padding: "10px", fontWeight: "700", color: gd.color }}>{avg.toFixed(1)}%</td>
                            <td style={{ textAlign: "center", padding: "10px", fontWeight: "700" }}>{gd.g}</td>
                            <td style={{ textAlign: "right", padding: "10px" }}>{best?.name || '—'} ({best?.pct || 0}%)</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
             )}
          </div>
        </div>
      )}

    </div>
  );
}
