import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { DEFAULT_CLASSES } from '../constants/defaults';
import * as XLSX from 'xlsx';
import './DailyPerformanceReport.css';

const URDU_MONTHS = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'
];

const URDU_DAYS = [
  'اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'
];

export const formatDateUrdu = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dayName = URDU_DAYS[d.getDay()];
    const day = d.getDate();
    const monthName = URDU_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${monthName} ${year} (${dayName})`;
  } catch (_) {
    return dateStr;
  }
};

export const parseManzilAmountToJuz = (amountStr, paraNum) => {
  if (!amountStr && !paraNum) return 0;
  const str = String(amountStr || '').trim().toLowerCase();

  if (str.includes('پاؤ') || str.includes('1/4') || str.includes('0.25')) return 0.25;
  if (str.includes('آدھا') || str.includes('1/2') || str.includes('0.5')) return 0.50;
  if (str.includes('پونا') || str.includes('3/4') || str.includes('0.75')) return 0.75;
  if (str.includes('سوا') || str.includes('1.25')) return 1.25;
  if (str.includes('ڈیڑھ') || str.includes('1.5')) return 1.50;
  if (str.includes('پورا') || str.includes('ایک پارہ') || str.includes('1 پارہ') || str === '1') return 1.0;
  if (str.includes('دو پارے') || str.includes('2 پارے') || str === '2') return 2.0;

  // If para number is present but amount is unspecified, count as 1 juz
  if (paraNum) return 1.0;

  return 0.25;
};

export const formatTotalManzilJuz = (totalJuzFloat) => {
  const num = Number(totalJuzFloat) || 0;
  if (num <= 0) return '0 پارہ';

  const whole = Math.floor(num);
  const rem = Math.round((num - whole) * 100) / 100;

  let remText = '';
  if (rem >= 0.75) remText = '3 پاؤ';
  else if (rem >= 0.50) remText = 'آدھا پارہ';
  else if (rem >= 0.25) remText = '1 پاؤ';

  if (whole === 0) {
    return remText || '0 پارہ';
  }

  if (remText) {
    return `${whole} ${whole === 1 ? 'پارہ' : 'پارے'} اور ${remText}`;
  }

  return `${whole} ${whole === 1 ? 'پارہ' : 'پارے'}`;
};

export const computeDateRange = (periodType, customStart, customEnd) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (periodType === 'last_7_days') {
    const past = new Date(now);
    past.setDate(past.getDate() - 6);
    return {
      startDate: past.toISOString().split('T')[0],
      endDate: todayStr,
      label: 'پچھلا 1 ہفتہ (گزشتہ 7 دن)'
    };
  }

  if (periodType === 'current_week') {
    // Current week: Monday to Sunday
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
      label: 'موجودہ ہفتہ'
    };
  }

  if (periodType === 'first_fortnight') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return {
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-15`,
      label: `پندرہ روزہ اول (1 تا 15 ${URDU_MONTHS[now.getMonth()]})`
    };
  }

  if (periodType === 'second_fortnight') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      startDate: `${y}-${m}-16`,
      endDate: `${y}-${m}-${lastDay}`,
      label: `پندرہ روزہ ثانی (16 تا ${lastDay} ${URDU_MONTHS[now.getMonth()]})`
    };
  }

  if (periodType === 'current_month') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-${lastDay}`,
      label: `مکمل ماہ (${URDU_MONTHS[now.getMonth()]} ${y})`
    };
  }

  // Custom
  return {
    startDate: customStart || todayStr,
    endDate: customEnd || todayStr,
    label: `مخصوص مدت (${customStart || todayStr} تا ${customEnd || todayStr})`
  };
};

export default function DailyPerformanceReport() {
  const {
    activeMadrasaId,
    activeMadrasa,
    classesList: contextClassesList,
    fetchClassesFromSupabase,
    fetchStudentsFromSupabase,
    fetchDailyAcademicRecordsFromSupabase
  } = useMadrasa();

  const todayStr = new Date().toISOString().split('T')[0];

  // Filters state
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [reportMode, setReportMode] = useState('class_summary'); // 'class_summary' | 'student_individual'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [periodType, setPeriodType] = useState('last_7_days');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  // Loaded records
  const [dailyRecords, setDailyRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Load classes
  useEffect(() => {
    let isMounted = true;
    const loadClasses = async () => {
      try {
        const cls = fetchClassesFromSupabase ? await fetchClassesFromSupabase(activeMadrasaId) : null;
        if (!isMounted) return;
        if (Array.isArray(cls) && cls.length > 0) {
          setAvailableClasses(cls);
          setSelectedClassId(prev => prev || cls[0].id || cls[0].name || '');
        } else if (Array.isArray(contextClassesList) && contextClassesList.length > 0) {
          setAvailableClasses(contextClassesList);
          setSelectedClassId(prev => prev || contextClassesList[0].id || contextClassesList[0].name || '');
        } else {
          setAvailableClasses(DEFAULT_CLASSES);
          setSelectedClassId(prev => prev || DEFAULT_CLASSES[0].id || '');
        }
      } catch (err) {
        if (!isMounted) return;
        setAvailableClasses(DEFAULT_CLASSES);
        setSelectedClassId(prev => prev || DEFAULT_CLASSES[0].id || '');
      }
    };
    loadClasses();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // 2. Load students
  useEffect(() => {
    let isMounted = true;
    const loadStudents = async () => {
      try {
        if (fetchStudentsFromSupabase) {
          const raw = await fetchStudentsFromSupabase(activeMadrasaId);
          if (isMounted && Array.isArray(raw)) {
            setAllStudents(raw);
          }
        }
      } catch (e) {
        console.warn('Error loading students in DailyPerformanceReport:', e);
      }
    };
    loadStudents();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // Current class students
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const cls = availableClasses.find(c =>
      String(c.id) === String(selectedClassId) ||
      c.name === selectedClassId ||
      c.class_name === selectedClassId
    );

    return allStudents.filter(s => {
      const cId = s.class_id || s.admClass || '';
      const matchesClass =
        String(cId) === String(selectedClassId) ||
        String(s.admClass) === String(selectedClassId) ||
        String(s.class_id) === String(selectedClassId) ||
        (cls && (
          s.admClass === cls.name ||
          s.admClass === cls.class_name ||
          s.class_id === cls.id ||
          s.class_id === cls.name
        ));

      const isEnrolled =
        !s.status ||
        s.status === 'enrolled' ||
        s.status === 'active' ||
        s.status === 'داخل شدہ' ||
        s.admStatus === 'enrolled' ||
        s.admStatus === 'active' ||
        s.admStatus === 'داخل شدہ';

      const isNotLeft = !s.isWithdrawn && s.status !== 'left' && s.status !== 'withdrawn';

      return matchesClass && isEnrolled && isNotLeft;
    }).sort((a, b) => Number(a.roll_number || a.admRegNo || 0) - Number(b.roll_number || b.admRegNo || 0));
  }, [allStudents, selectedClassId, availableClasses]);

  // Automatically select first student if in individual mode and student not selected
  useEffect(() => {
    if (reportMode === 'student_individual' && classStudents.length > 0) {
      if (!selectedStudentId || !classStudents.some(s => s.id === selectedStudentId)) {
        setSelectedStudentId(classStudents[0].id);
      }
    }
  }, [reportMode, classStudents, selectedStudentId]);

  // Current selected class object
  const currentClassObj = useMemo(() => {
    return availableClasses.find(c =>
      String(c.id) === String(selectedClassId) ||
      c.name === selectedClassId ||
      c.class_name === selectedClassId
    ) || null;
  }, [availableClasses, selectedClassId]);

  // Current selected student object
  const currentStudentObj = useMemo(() => {
    return classStudents.find(s => s.id === selectedStudentId) || null;
  }, [classStudents, selectedStudentId]);

  // Active date range
  const { startDate, endDate, label: periodLabel } = useMemo(() => {
    return computeDateRange(periodType, customStart, customEnd);
  }, [periodType, customStart, customEnd]);

  // 3. Load daily records for this date range
  useEffect(() => {
    let isMounted = true;
    if (!selectedClassId || !startDate || !endDate) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        if (fetchDailyAcademicRecordsFromSupabase) {
          const recs = await fetchDailyAcademicRecordsFromSupabase({
            classId: selectedClassId,
            startDate,
            endDate
          }, activeMadrasaId);
          if (isMounted) {
            setDailyRecords(Array.isArray(recs) ? recs : []);
          }
        }
      } catch (err) {
        console.warn('Error loading periodic records:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRecords();
    return () => { isMounted = false; };
  }, [selectedClassId, startDate, endDate, activeMadrasaId]);

  // Distinct dates in the loaded records
  const distinctDates = useMemo(() => {
    const dates = new Set();
    dailyRecords.forEach(r => {
      if (r.date) dates.add(r.date);
    });
    return Array.from(dates).sort();
  }, [dailyRecords]);

  // Mode A: Aggregated stats per student across the period
  const classSummaryStats = useMemo(() => {
    const totalWorkingDays = distinctDates.length;

    return classStudents.map(student => {
      const sId = student.id;
      const sRecords = dailyRecords.filter(r => r.student_id === sId);

      let sabaqPresent = 0;
      let sabqiPresent = 0;
      let manzilPresent = 0;
      let mutalaahPresent = 0;
      let totalManzilJuz = 0;
      const kaifiyatCounts = {};

      sRecords.forEach(r => {
        if (r.sabaq) sabaqPresent++;
        if (r.sabqi) sabqiPresent++;
        if (r.manzil) {
          manzilPresent++;
          totalManzilJuz += parseManzilAmountToJuz(r.manzil_amount, r.manzil_para);
        }
        if (r.mutalaah) mutalaahPresent++;

        const kText = (r.kaifiyat_text || '').trim();
        if (kText) {
          kaifiyatCounts[kText] = (kaifiyatCounts[kText] || 0) + 1;
        }
      });

      const sabaqMissed = totalWorkingDays - sabaqPresent;
      const sabqiMissed = totalWorkingDays - sabqiPresent;
      const manzilMissed = totalWorkingDays - manzilPresent;
      const mutalaahMissed = totalWorkingDays - mutalaahPresent;

      const sabaqPct = totalWorkingDays > 0 ? Math.round((sabaqPresent / totalWorkingDays) * 100) : 0;
      const sabqiPct = totalWorkingDays > 0 ? Math.round((sabqiPresent / totalWorkingDays) * 100) : 0;
      const manzilPct = totalWorkingDays > 0 ? Math.round((manzilPresent / totalWorkingDays) * 100) : 0;
      const mutalaahPct = totalWorkingDays > 0 ? Math.round((mutalaahPresent / totalWorkingDays) * 100) : 0;

      // Common kaifiyat
      let mostCommonKaifiyat = '—';
      let maxKCount = 0;
      Object.entries(kaifiyatCounts).forEach(([k, c]) => {
        if (c > maxKCount) {
          maxKCount = c;
          mostCommonKaifiyat = k;
        }
      });

      // Composite academic grading
      const compositeScore = totalWorkingDays > 0
        ? (sabaqPct * 0.4) + (sabqiPct * 0.3) + (manzilPct * 0.3)
        : 0;

      let grade = '—';
      let gradeClass = 'daily-grade-none';
      if (totalWorkingDays > 0) {
        if (compositeScore >= 90) { grade = 'ممتاز'; gradeClass = 'daily-grade-mumtaz'; }
        else if (compositeScore >= 80) { grade = 'جید جدا'; gradeClass = 'daily-grade-jayyid-jiddan'; }
        else if (compositeScore >= 65) { grade = 'جید'; gradeClass = 'daily-grade-jayyid'; }
        else if (compositeScore >= 50) { grade = 'مقبول'; gradeClass = 'daily-grade-maqbool'; }
        else { grade = 'توجہ طلب'; gradeClass = 'daily-grade-weak'; }
      }

      return {
        student,
        workingDays: totalWorkingDays,
        sabaqPresent,
        sabaqMissed,
        sabaqPct,
        sabqiPresent,
        sabqiMissed,
        sabqiPct,
        manzilPresent,
        manzilMissed,
        manzilPct,
        totalManzilJuz,
        mutalaahPresent,
        mutalaahMissed,
        mutalaahPct,
        mostCommonKaifiyat,
        grade,
        gradeClass
      };
    });
  }, [classStudents, dailyRecords, distinctDates]);

  // Mode B: Individual Student Daily Timeline
  const studentTimelineData = useMemo(() => {
    if (!selectedStudentId) return { list: [], summary: null };

    const sRecords = dailyRecords.filter(r => r.student_id === selectedStudentId);
    const recMap = {};
    sRecords.forEach(r => {
      recMap[r.date] = r;
    });

    const list = distinctDates.map(date => {
      const rec = recMap[date] || null;
      return {
        date,
        sabaq: rec ? Boolean(rec.sabaq) : false,
        sabqi: rec ? Boolean(rec.sabqi) : false,
        manzil: rec ? Boolean(rec.manzil) : false,
        manzil_para: rec?.manzil_para || '',
        manzil_amount: rec?.manzil_amount || '',
        sami_name: rec?.sami_name || '',
        kaifiyat_text: rec?.kaifiyat_text || '',
        mutalaah: rec ? Boolean(rec.mutalaah) : false
      };
    });

    // Summary for this student
    const workingDays = distinctDates.length;
    let sabaqCount = 0;
    let sabqiCount = 0;
    let manzilCount = 0;
    let mutalaahCount = 0;
    let totalManzilJuz = 0;

    list.forEach(item => {
      if (item.sabaq) sabaqCount++;
      if (item.sabqi) sabqiCount++;
      if (item.manzil) {
        manzilCount++;
        totalManzilJuz += parseManzilAmountToJuz(item.manzil_amount, item.manzil_para);
      }
      if (item.mutalaah) mutalaahCount++;
    });

    return {
      list,
      summary: {
        workingDays,
        sabaqCount,
        sabaqMissed: workingDays - sabaqCount,
        sabaqPct: workingDays > 0 ? Math.round((sabaqCount / workingDays) * 100) : 0,
        sabqiCount,
        sabqiMissed: workingDays - sabqiCount,
        sabqiPct: workingDays > 0 ? Math.round((sabqiCount / workingDays) * 100) : 0,
        manzilCount,
        manzilMissed: workingDays - manzilCount,
        manzilPct: workingDays > 0 ? Math.round((manzilCount / workingDays) * 100) : 0,
        totalManzilJuz,
        mutalaahCount,
        mutalaahMissed: workingDays - mutalaahCount,
        mutalaahPct: workingDays > 0 ? Math.round((mutalaahCount / workingDays) * 100) : 0
      }
    };
  }, [selectedStudentId, dailyRecords, distinctDates]);

  // Print Handling (A4, Black & White)
  const handlePrint = () => {
    window.print();
  };

  // Excel Export Handler (Strict RTL Workbook)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };

    if (reportMode === 'class_summary') {
      const rows = [
        ['جامعہ / ادارہ:', activeMadrasa?.name || 'جامعہ دار العلوم'],
        ['رپورٹ:', `مجموعی میعادی تعلیمی رپورٹ (${periodLabel})`],
        ['کلاس:', currentClassObj?.name || selectedClassId],
        ['استادِ محترم:', currentClassObj?.teacher || '—'],
        ['تاریخ:', `${startDate} تا ${endDate}`],
        [],
        [
          'نمبر شمار',
          'نام مع ولدیت',
          'رول نمبر',
          'کل تعلیمی دن',
          'سبق سنایا (دن)',
          'سبق ناغہ (دن)',
          'سبق فیصد',
          'سبقی سنائی (دن)',
          'سبقی ناغہ (دن)',
          'منزل سنائی (دن)',
          'منزل ناغہ (دن)',
          'کل منزل پارے',
          'مطالعہ کیا (دن)',
          'عمومی کیفیت',
          'مجموعی درجہ بندی'
        ]
      ];

      classSummaryStats.forEach((item, idx) => {
        const s = item.student;
        const name = `${s.name || s.admName || ''} ${s.father_name || s.admFatherName ? `ولد ${s.father_name || s.admFatherName}` : ''}`;
        rows.push([
          idx + 1,
          name,
          s.roll_number || s.admRegNo || '—',
          item.workingDays,
          item.sabaqPresent,
          item.sabaqMissed,
          `${item.sabaqPct}%`,
          item.sabqiPresent,
          item.sabqiMissed,
          item.manzilPresent,
          item.manzilMissed,
          formatTotalManzilJuz(item.totalManzilJuz),
          item.mutalaahPresent,
          item.mostCommonKaifiyat,
          item.grade
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'کلاس سمری');
      XLSX.writeFile(wb, `Class_Academic_Report_${currentClassObj?.name || 'Class'}_${startDate}_to_${endDate}.xlsx`);
    } else {
      // Individual Student Mode
      const s = currentStudentObj;
      const sName = `${s?.name || s?.admName || 'طالب علم'} ${s?.father_name || s?.admFatherName ? `ولد ${s?.father_name || s?.admFatherName}` : ''}`;
      const sum = studentTimelineData.summary || {};

      const rows = [
        ['جامعہ / ادارہ:', activeMadrasa?.name || 'جامعہ دار العلوم'],
        ['رپورٹ:', `انفرادی تعلیمی کارکردگی روزنامچہ (${periodLabel})`],
        ['طالب علم:', sName],
        ['رول نمبر:', s?.roll_number || s?.admRegNo || '—'],
        ['کلاس:', currentClassObj?.name || selectedClassId],
        ['استادِ محترم:', currentClassObj?.teacher || '—'],
        ['دورانیہ:', `${startDate} تا ${endDate}`],
        [],
        ['خلاصہ کارکردگی:'],
        ['کل تعلیمی دن:', sum.workingDays || 0],
        ['سبق سنایا:', `${sum.sabaqCount || 0} دن (${sum.sabaqPct || 0}%)`],
        ['سبق ناغہ:', `${sum.sabaqMissed || 0} دن`],
        ['سبقی سنائی:', `${sum.sabqiCount || 0} دن`],
        ['سبقی ناغہ:', `${sum.sabqiMissed || 0} دن`],
        ['منزل سنائی:', `${sum.manzilCount || 0} دن`],
        ['کل دہرائی گئی منزل:', formatTotalManzilJuz(sum.totalManzilJuz || 0)],
        ['مطالعہ کی باقاعدگی:', `${sum.mutalaahCount || 0} دن (${sum.mutalaahPct || 0}%)`],
        [],
        [
          'نمبر شمار',
          'تاریخ',
          'دن',
          'سبق',
          'سبقی',
          'منزل',
          'پارہ نمبر',
          'مقدار',
          'سامع',
          'کیفیت',
          'مطالعہ'
        ]
      ];

      studentTimelineData.list.forEach((item, idx) => {
        const dObj = new Date(item.date);
        const dayName = !isNaN(dObj.getTime()) ? URDU_DAYS[dObj.getDay()] : '—';

        rows.push([
          idx + 1,
          item.date,
          dayName,
          item.sabaq ? 'سنایا' : 'ناغہ',
          item.sabqi ? 'سنائی' : 'ناغہ',
          item.manzil ? 'سنائی' : 'ناغہ',
          item.manzil_para || '—',
          item.manzil_amount || '—',
          item.sami_name || '—',
          item.kaifiyat_text || '—',
          item.mutalaah ? 'کیا' : 'نہیں کیا'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'انفرادی روزنامچہ');
      XLSX.writeFile(wb, `Student_Academic_Report_${s?.name || 'Student'}_${startDate}_to_${endDate}.xlsx`);
    }
  };

  return (
    <div className="daily-report-wrapper" dir="rtl">
      {/* 1. Control & Filter Card (Screen only) */}
      <div className="daily-report-card daily-report-no-print">
        <div className="daily-report-header">
          <div>
            <h2 className="daily-report-title">میعادی تعلیمی رپورٹ و کارکردگی جائزہ</h2>
            <div className="daily-report-subtitle">
              ہفتہ وار، 15 روزہ یا ماہانہ بنیادوں پر پوری کلاس یا انفرادی طالب علم کا تفصیلی تعلیمی روزنامچہ
            </div>
          </div>
          <div className="daily-report-btn-group">
            <button
              type="button"
              className="daily-report-btn"
              onClick={handleExportExcel}
              disabled={loading || distinctDates.length === 0}
            >
              ایکسل ڈاؤنلوڈ (.xlsx)
            </button>
            <button
              type="button"
              className="daily-report-btn daily-report-btn-secondary"
              onClick={handlePrint}
              disabled={loading || distinctDates.length === 0}
            >
              پرنٹ نکالیں (A4)
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="daily-report-filters">
          {/* Class Select */}
          <div className="daily-report-field daily-report-field-class">
            <label className="daily-report-label" htmlFor="dailyRepClassSelect">کلاس منتخب کریں</label>
            <select
              id="dailyRepClassSelect"
              className="daily-report-select"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              {availableClasses.map(c => {
                const val = c.id || c.name;
                const label = c.name || c.class_name || c.id;
                const teacher = c.teacher || c.teacher_name;
                return (
                  <option key={c.id || c.name} value={val}>
                    {label} {teacher ? `(استاد: ${teacher})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Report Mode */}
          <div className="daily-report-field daily-report-field-mode">
            <label className="daily-report-label">رپورٹ کی نوعیت</label>
            <div className="daily-report-mode-toggle">
              <button
                type="button"
                className={`daily-report-mode-btn ${reportMode === 'class_summary' ? 'active' : ''}`}
                onClick={() => setReportMode('class_summary')}
              >
                پوری کلاس کی مجموعی رپورٹ
              </button>
              <button
                type="button"
                className={`daily-report-mode-btn ${reportMode === 'student_individual' ? 'active' : ''}`}
                onClick={() => setReportMode('student_individual')}
              >
                انفرادی طالب علم کا روزنامچہ
              </button>
            </div>
          </div>

          {/* Individual Student Select (Shown only in individual mode) */}
          {reportMode === 'student_individual' && (
            <div className="daily-report-field daily-report-field-student">
              <label className="daily-report-label" htmlFor="dailyRepStudentSelect">طالب علم منتخب کریں</label>
              <select
                id="dailyRepStudentSelect"
                className="daily-report-select"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
              >
                {classStudents.map(s => {
                  const name = s.name || s.admName || '';
                  const father = s.father_name || s.admFatherName ? `ولد ${s.father_name || s.admFatherName}` : '';
                  const roll = s.roll_number || s.admRegNo ? `(رول: ${s.roll_number || s.admRegNo})` : '';
                  return (
                    <option key={s.id} value={s.id}>
                      {name} {father} {roll}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Period Selection */}
          <div className="daily-report-field daily-report-field-period">
            <label className="daily-report-label" htmlFor="dailyRepPeriodSelect">مدت / دورانیہ</label>
            <select
              id="dailyRepPeriodSelect"
              className="daily-report-select"
              value={periodType}
              onChange={e => setPeriodType(e.target.value)}
            >
              <option value="last_7_days">پچھلا 1 ہفتہ (گزشتہ 7 دن)</option>
              <option value="current_week">موجودہ ہفتہ (پیر تا اتوار)</option>
              <option value="first_fortnight">پندرہ روزہ اول (1 تا 15 تاریخ)</option>
              <option value="second_fortnight">پندرہ روزہ ثانی (16 تا آخرِ ماہ)</option>
              <option value="current_month">مکمل ماہ (موجودہ مہینہ)</option>
              <option value="custom">مخصوص تاریخ منتخب کریں...</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {periodType === 'custom' && (
            <>
              <div className="daily-report-field daily-report-field-date">
                <label className="daily-report-label" htmlFor="dailyRepStartInput">از تاریخ</label>
                <input
                  id="dailyRepStartInput"
                  type="date"
                  className="daily-report-input"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </div>
              <div className="daily-report-field daily-report-field-date">
                <label className="daily-report-label" htmlFor="dailyRepEndInput">تا تاریخ</label>
                <input
                  id="dailyRepEndInput"
                  type="date"
                  className="daily-report-input"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Active Range Tag */}
        <div className="daily-report-active-range">
          <span><strong>منتخب دورانیہ:</strong> {periodLabel} ({startDate} تا {endDate})</span>
          <span><strong>ریکارڈ شدہ دن:</strong> {distinctDates.length} دن</span>
        </div>
      </div>

      {/* 2. Print Header (Shown only during print) */}
      <div className="daily-report-print-header daily-report-print-only">
        <h1 className="daily-report-print-title">
          {activeMadrasa?.name || 'جامعہ / مدرسہ'}
        </h1>
        <div style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '6px' }}>
          {reportMode === 'class_summary'
            ? 'مجموعی میعادی تعلیمی رپورٹ'
            : 'انفرادی تعلیمی کارکردگی روزنامچہ'}
        </div>
        <div className="daily-report-print-meta">
          <div><strong>کلاس:</strong> {currentClassObj?.name || '—'}</div>
          <div><strong>استادِ محترم:</strong> {currentClassObj?.teacher || '—'}</div>
          {reportMode === 'student_individual' && currentStudentObj && (
            <div>
              <strong>طالب علم:</strong> {currentStudentObj.name || currentStudentObj.admName}{' '}
              {currentStudentObj.father_name || currentStudentObj.admFatherName ? `ولد ${currentStudentObj.father_name || currentStudentObj.admFatherName}` : ''}{' '}
              (رول: {currentStudentObj.roll_number || currentStudentObj.admRegNo || '—'})
            </div>
          )}
          <div><strong>مدت:</strong> {startDate} تا {endDate} ({distinctDates.length} دن)</div>
        </div>
      </div>

      {/* 3. Main Report Content */}
      {loading ? (
        <div className="daily-report-empty">رپورٹ لوڈ ہو رہی ہے، براہ کرم انتظار کریں...</div>
      ) : distinctDates.length === 0 ? (
        <div className="daily-report-empty">
          منتخب کردہ مدت ({startDate} تا {endDate}) میں اس کلاس کا کوئی روزانہ تعلیمی ریکارڈ درج نہیں ہے۔
        </div>
      ) : reportMode === 'class_summary' ? (
        /* MODE A: Class Summary Table */
        <div className="daily-report-table-wrap">
          <table className="daily-report-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>نمبر شمار</th>
                <th style={{ minWidth: '160px' }}>نام مع ولدیت</th>
                <th style={{ width: '60px' }}>کل دن</th>
                <th style={{ minWidth: '100px' }}>سبق کارکردگی</th>
                <th style={{ minWidth: '100px' }}>سبقی کارکردگی</th>
                <th style={{ minWidth: '140px' }}>منزل خلاصہ و کل پارے</th>
                <th style={{ minWidth: '90px' }}>مطالعہ</th>
                <th style={{ minWidth: '110px' }}>عمومی کیفیت</th>
                <th style={{ minWidth: '85px' }}>درجہ بندی</th>
              </tr>
            </thead>
            <tbody>
              {classSummaryStats.map((item, idx) => {
                const s = item.student;
                const studentName = s.name || s.admName || 'طالب علم';
                const fatherName = s.father_name || s.admFatherName || '';
                const rollNo = s.roll_number || s.admRegNo || '';

                return (
                  <tr key={s.id || idx}>
                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                    <td>
                      <div className="daily-report-std-name">
                        {studentName} {fatherName ? `ولد ${fatherName}` : ''}
                      </div>
                      {rollNo && (
                        <div className="daily-report-std-sub">رول نمبر: {rollNo}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.workingDays}</td>

                    {/* Sabaq */}
                    <td>
                      <div>سنایا: {item.sabaqPresent} دن ({item.sabaqPct}%)</div>
                      {item.sabaqMissed > 0 && (
                        <div className="daily-report-missed-tag">ناغہ: {item.sabaqMissed} دن</div>
                      )}
                    </td>

                    {/* Sabqi */}
                    <td>
                      <div>سنائی: {item.sabqiPresent} دن ({item.sabqiPct}%)</div>
                      {item.sabqiMissed > 0 && (
                        <div className="daily-report-missed-tag">ناغہ: {item.sabqiMissed} دن</div>
                      )}
                    </td>

                    {/* Manzil */}
                    <td>
                      <div style={{ fontWeight: '600' }}>{formatTotalManzilJuz(item.totalManzilJuz)}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        سنائی: {item.manzilPresent} دن / ناغہ: {item.manzilMissed} دن
                      </div>
                    </td>

                    {/* Mutalaah */}
                    <td>
                      <div>{item.mutalaahPresent} دن ({item.mutalaahPct}%)</div>
                    </td>

                    {/* Kaifiyat */}
                    <td>{item.mostCommonKaifiyat}</td>

                    {/* Grade */}
                    <td style={{ textAlign: 'center' }}>
                      <span className={`daily-report-badge ${item.gradeClass}`}>
                        {item.grade}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* MODE B: Individual Student Detailed Daily Timeline */
        <div>
          {/* Top KPI Summary Cards */}
          {studentTimelineData.summary && (
            <div className="daily-report-kpi-grid">
              <div className="daily-report-kpi-card">
                <div className="daily-report-kpi-label">کل تعلیمی دن</div>
                <div className="daily-report-kpi-val">{studentTimelineData.summary.workingDays} دن</div>
              </div>
              <div className="daily-report-kpi-card">
                <div className="daily-report-kpi-label">سبق کی شرح</div>
                <div className="daily-report-kpi-val">
                  {studentTimelineData.summary.sabaqCount}/{studentTimelineData.summary.workingDays}
                  <span style={{ fontSize: '0.85rem', marginRight: '4px' }}>({studentTimelineData.summary.sabaqPct}%)</span>
                </div>
                {studentTimelineData.summary.sabaqMissed > 0 && (
                  <div className="daily-report-kpi-sub" style={{ color: '#dc2626' }}>
                    {studentTimelineData.summary.sabaqMissed} ناغہ
                  </div>
                )}
              </div>
              <div className="daily-report-kpi-card">
                <div className="daily-report-kpi-label">سبقی کی شرح</div>
                <div className="daily-report-kpi-val">
                  {studentTimelineData.summary.sabqiCount}/{studentTimelineData.summary.workingDays}
                </div>
                {studentTimelineData.summary.sabqiMissed > 0 && (
                  <div className="daily-report-kpi-sub" style={{ color: '#dc2626' }}>
                    {studentTimelineData.summary.sabqiMissed} ناغہ
                  </div>
                )}
              </div>
              <div className="daily-report-kpi-card" style={{ minWidth: '170px' }}>
                <div className="daily-report-kpi-label">کل دہرائے گئے پارے (منزل)</div>
                <div className="daily-report-kpi-val" style={{ fontSize: '1.15rem' }}>
                  {formatTotalManzilJuz(studentTimelineData.summary.totalManzilJuz)}
                </div>
                <div className="daily-report-kpi-sub">
                  {studentTimelineData.summary.manzilCount} دن سنائی
                </div>
              </div>
              <div className="daily-report-kpi-card">
                <div className="daily-report-kpi-label">مطالعہ کی پابندی</div>
                <div className="daily-report-kpi-val">
                  {studentTimelineData.summary.mutalaahCount}/{studentTimelineData.summary.workingDays}
                  <span style={{ fontSize: '0.85rem', marginRight: '4px' }}>({studentTimelineData.summary.mutalaahPct}%)</span>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Table */}
          <div className="daily-report-table-wrap">
            <table className="daily-report-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>نمبر</th>
                  <th style={{ minWidth: '130px' }}>تاریخ و دن</th>
                  <th style={{ width: '80px' }}>سبق</th>
                  <th style={{ width: '80px' }}>سبقی</th>
                  <th style={{ minWidth: '150px' }}>منزل (پارہ و مقدار)</th>
                  <th style={{ minWidth: '110px' }}>سامع</th>
                  <th style={{ minWidth: '120px' }}>کیفیت</th>
                  <th style={{ width: '80px' }}>مطالعہ</th>
                </tr>
              </thead>
              <tbody>
                {studentTimelineData.list.map((item, idx) => {
                  return (
                    <tr key={item.date || idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{formatDateUrdu(item.date)}</div>
                      </td>

                      {/* Sabaq */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`daily-report-status-pill ${item.sabaq ? 'daily-status-pass' : 'daily-status-fail'}`}>
                          {item.sabaq ? 'سنایا' : 'ناغہ'}
                        </span>
                      </td>

                      {/* Sabqi */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`daily-report-status-pill ${item.sabqi ? 'daily-status-pass' : 'daily-status-fail'}`}>
                          {item.sabqi ? 'سنائی' : 'ناغہ'}
                        </span>
                      </td>

                      {/* Manzil */}
                      <td>
                        {item.manzil ? (
                          <div>
                            <span className="daily-report-status-pill daily-status-pass" style={{ marginLeft: '6px' }}>
                              سنائی
                            </span>
                            <span>
                              {item.manzil_para ? `پارہ ${item.manzil_para}` : ''}{' '}
                              {item.manzil_amount ? `(${item.manzil_amount})` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="daily-report-status-pill daily-status-fail">ناغہ</span>
                        )}
                      </td>

                      {/* Sami */}
                      <td>{item.sami_name || '—'}</td>

                      {/* Kaifiyat */}
                      <td>{item.kaifiyat_text || '—'}</td>

                      {/* Mutalaah */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`daily-report-status-pill ${item.mutalaah ? 'daily-status-pass' : 'daily-status-neutral'}`}>
                          {item.mutalaah ? 'کیا' : 'نہیں'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Footer & Signature Block (Render only when records exist) */}
      {!loading && distinctDates.length > 0 && (
        <div className="daily-report-footer">
          <div className="daily-report-signature-grid">
            <div className="daily-report-signature-box">
              <div className="daily-report-signature-line" />
              <div className="daily-report-signature-text">دستخط استادِ محترم</div>
              <div className="daily-report-signature-sub">
                {currentClassObj?.teacher ? `محترم ${currentClassObj.teacher}` : 'نام و دستخط'}
              </div>
            </div>
            <div className="daily-report-signature-box">
              <div className="daily-report-signature-line" />
              <div className="daily-report-signature-text">دستخط ناظم تعلیمات / مہتمم</div>
              <div className="daily-report-signature-sub">جامعہ / ادارہ ہذا</div>
            </div>
            {reportMode === 'student_individual' && (
              <div className="daily-report-signature-box">
                <div className="daily-report-signature-line" />
                <div className="daily-report-signature-text">دستخط سرپرست / والدین</div>
                <div className="daily-report-signature-sub">برائے اطلاع و ملاحظہ</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
