import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { DEFAULT_CLASSES } from '../constants/defaults';
import {
  calculateStudentCounts,
  calculateStudentsByClass,
  calculateRecentAdmissions,
  calculateStaffCount,
  calculateTodayAttendanceRate,
  calculateMonthFeesRate,
  calculateLatestExamAverage,
  getTodayDateIso,
  getCurrentMonthIso
} from '../utils/DashboardMappers';
import './Dashboard.css';

export default function Dashboard() {
  const {
    activeMadrasaId,
    loadMadrasaData,
    fetchStudentsFromSupabase,
    fetchClassesFromSupabase,
    fetchStaffFromSupabase,
    fetchHifzRecordsFromSupabase,
    fetchStudentAttendanceFromSupabase,
    fetchStaffAttendanceFromSupabase,
    fetchFeesFromSupabase,
    fetchExamResultsFromSupabase
  } = useMadrasa();

  const [currentDateStr, setCurrentDateStr] = useState('لوڈ ہو رہا ہے...');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  
  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hifzRecords, setHifzRecords] = useState([]);

  // Today's Snapshot state
  const [todayStudentAttendance, setTodayStudentAttendance] = useState([]);
  const [todayStaffAttendance, setTodayStaffAttendance] = useState([]);
  const [currentMonthFees, setCurrentMonthFees] = useState([]);
  const [examResults, setExamResults] = useState([]);

  useEffect(() => {
    // Clock
    const updateClock = () => {
      const now = new Date();
      setCurrentDateStr(now.toLocaleDateString('ur-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      setCurrentTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateClock();
    const intervalId = setInterval(updateClock, 1000);

    // Initial local fallback load
    let isMounted = true;
    const d = loadMadrasaData('hf_records_v1') || {};
    const localAdmissions = (d.records || []).filter(r => r.isAdmissionProfile);
    const localProgress = (d.records || []).filter(r => !r.isAdmissionProfile);
    setStudents(localAdmissions);
    setClassesList(d.classes && d.classes.length > 0 ? d.classes : DEFAULT_CLASSES);
    setStaffList(d.staffProfiles || []);
    setHifzRecords(localProgress);

    // Live fetch from Supabase
    const todayIso = getTodayDateIso();
    const currentMonthIso = getCurrentMonthIso();

    const loadDashboardData = async () => {
      try {
        const [
          fetchedStudents,
          fetchedClasses,
          fetchedStaff,
          fetchedHifz,
          fetchedStdAtt,
          fetchedStaffAtt,
          fetchedFees,
          fetchedExams
        ] = await Promise.all([
          fetchStudentsFromSupabase(activeMadrasaId).catch(() => null),
          fetchClassesFromSupabase(activeMadrasaId).catch(() => null),
          fetchStaffFromSupabase(activeMadrasaId).catch(() => null),
          fetchHifzRecordsFromSupabase ? fetchHifzRecordsFromSupabase(activeMadrasaId).catch(() => null) : null,
          fetchStudentAttendanceFromSupabase ? fetchStudentAttendanceFromSupabase({ date: todayIso }, activeMadrasaId).catch(() => null) : null,
          fetchStaffAttendanceFromSupabase ? fetchStaffAttendanceFromSupabase(activeMadrasaId, todayIso).catch(() => null) : null,
          fetchFeesFromSupabase ? fetchFeesFromSupabase(activeMadrasaId, { month_year: currentMonthIso }).catch(() => null) : null,
          fetchExamResultsFromSupabase ? fetchExamResultsFromSupabase({}, activeMadrasaId).catch(() => null) : null
        ]);

        if (isMounted) {
          if (fetchedStudents && Array.isArray(fetchedStudents)) {
            setStudents(fetchedStudents);
          }
          if (fetchedClasses && Array.isArray(fetchedClasses)) {
            setClassesList(fetchedClasses);
          }
          if (fetchedStaff && Array.isArray(fetchedStaff)) {
            setStaffList(fetchedStaff);
          }
          if (fetchedHifz && Array.isArray(fetchedHifz)) {
            setHifzRecords(fetchedHifz);
          }
          if (fetchedStdAtt && Array.isArray(fetchedStdAtt)) {
            setTodayStudentAttendance(fetchedStdAtt);
          }
          if (fetchedStaffAtt && Array.isArray(fetchedStaffAtt)) {
            setTodayStaffAttendance(fetchedStaffAtt);
          }
          if (fetchedFees && Array.isArray(fetchedFees)) {
            setCurrentMonthFees(fetchedFees);
          }
          if (fetchedExams && Array.isArray(fetchedExams)) {
            setExamResults(fetchedExams);
          }
        }
      } catch (err) {
        console.warn('Dashboard data load warning:', err);
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [activeMadrasaId]);

  // --- Metrics Calculation ---
  const {
    totalStudents,
    completedStudents,
    withdrawnStudents,
    totalAdmitted,
    activeRate,
    completionRate
  } = calculateStudentCounts(students);

  const staffCount = calculateStaffCount(staffList, classesList);
  const classCount = classesList.length;
  const learningRecordsCount = hifzRecords.length;
  const totalRecordsCount = students.length + hifzRecords.length;

  const studentsByClass = calculateStudentsByClass(classesList, students);
  const highestClassStrength = Math.max(...studentsByClass.map(c => c.count), 1);
  const activeClassesCount = studentsByClass.filter(c => c.count > 0).length;
  const avgStudentsPerClass = classCount > 0 ? (totalStudents / classCount).toFixed(1) : '0.0';

  const recentAdmissions = calculateRecentAdmissions(students, 5);

  // Today's Snapshot metrics
  const currentMonthIso = getCurrentMonthIso();
  const todayStudentAttRate = calculateTodayAttendanceRate(todayStudentAttendance);
  const todayStaffAttRate = calculateTodayAttendanceRate(todayStaffAttendance);
  const currentMonthFeeRate = calculateMonthFeesRate(currentMonthFees, currentMonthIso);
  const latestExamAvg = calculateLatestExamAverage(examResults);

  return (
    <div className="dashboard-wrapper">
      
        <div className="dashboard-hero">
            <div className="dashboard-hero-top">
                <div>
                    <h2>ادارہ جاتی ڈیش بورڈ</h2>
                    <p>مدرسہ یا ادارے کے تمام اہم اعدادوشمار، طلباء کی صورتحال، اور مجموعی پیش رفت ایک ہی نظر میں۔</p>
                </div>
                <div className="dashboard-badge">
                  <span className="badge-label">آج کی تاریخ</span>
                  <span className="badge-date" id="dashboardDate">{currentDateStr}</span>
                  <span className="badge-time" id="dashboardTime" style={{ display: "block", fontSize: "1.1rem", fontWeight: "700", marginTop: "4px", opacity: "0.9" }}>
                      {currentTimeStr}
                  </span>
                </div>
            </div>
        </div>

        <div className="dashboard-container" id="dashboardMetrics">
            <div className="dashboard-card success">
                <div className="dashboard-icon"></div>
                <div className="card-label">فی الوقت طلباء</div>
                <div className="card-number">{totalStudents}</div>
                <div className="card-description">فعال اور داخل شدہ</div>
            </div>
            
            <div className="dashboard-card warning">
                <div className="dashboard-icon"></div>
                <div className="card-label">تکمیل شدہ</div>
                <div className="card-number">{completedStudents}</div>
                <div className="card-description">حافظ / مکمل شدہ طلباء</div>
            </div>
            
            <div className="dashboard-card danger">
                <div className="dashboard-icon"></div>
                <div className="card-label">خارج شدہ</div>
                <div className="card-number">{withdrawnStudents}</div>
                <div className="card-description">نکالے گئے طلباء</div>
            </div>
            
            <div className="dashboard-card info">
                <div className="dashboard-icon"></div>
                <div className="card-label">عملہ</div>
                <div className="card-number">{staffCount}</div>
                <div className="card-description">اساتذہ / درسگاہ</div>
            </div>
        </div>

        <div className="dashboard-grid-secondary" style={{ gridTemplateColumns: "1fr" }}>
            <div className="dashboard-panel">
                <h3>اعداد و شمار اور جھلکیاں</h3>
                
                <div className="mini-stat-grid" id="detailedStats" style={{ marginTop: "14px" }}>
                    <div className="mini-stat">
                        <div className="mini-stat-label">کل داخلے</div>
                        <div className="mini-stat-value">{totalAdmitted}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">فعال شرح</div>
                        <div className="mini-stat-value">{activeRate}%</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">کلاسز</div>
                        <div className="mini-stat-value">{classCount}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">کل ریکارڈز</div>
                        <div className="mini-stat-value">{totalRecordsCount}</div>
                    </div>
                </div>

                <div className="mini-stat-grid" id="dashboardHighlights" style={{ marginTop: "12px" }}>
                    <div className="mini-stat">
                        <div className="mini-stat-label">تکمیل کی شرح</div>
                        <div className="mini-stat-value">{completionRate}%</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">تعلیمی اندراجات</div>
                        <div className="mini-stat-value">{learningRecordsCount}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">فعال کلاسز</div>
                        <div className="mini-stat-value">{activeClassesCount}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">اوسط طلباء فی کلاس</div>
                        <div className="mini-stat-value">{avgStudentsPerClass}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* آج کی جھلک (Today's Snapshot) */}
        <div className="dashboard-grid-secondary" style={{ gridTemplateColumns: "1fr" }}>
            <div className="dashboard-panel">
                <h3>آج کی جھلک</h3>
                
                <div className="mini-stat-grid" id="todaySnapshot" style={{ marginTop: "14px" }}>
                    <div className="mini-stat">
                        <div className="mini-stat-label">آج طلباء کی حاضری</div>
                        <div className="mini-stat-value">{todayStudentAttRate}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">آج عملے کی حاضری</div>
                        <div className="mini-stat-value">{todayStaffAttRate}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">رواں ماہ فیس وصولی</div>
                        <div className="mini-stat-value">{currentMonthFeeRate}</div>
                    </div>
                    <div className="mini-stat">
                        <div className="mini-stat-label">تازہ ترین امتحانی نتائج</div>
                        <div className="mini-stat-value">{latestExamAvg}</div>
                    </div>
                </div>
            </div>
        </div>

        <div className="dashboard-grid-secondary">
            <div className="dashboard-panel">
                <h3>کلاس وار تقسیم</h3>
                <div id="dashboardClassOverview">
                    {studentsByClass.length === 0 ? (
                        <div className="empty-dashboard-state">ابھی تک کوئی کلاس درج نہیں کی گئی۔</div>
                    ) : (
                        <div className="progress-list">
                            {studentsByClass.map(cls => (
                                <div key={cls.id}>
                                    <div className="progress-item-header">
                                        <div>{cls.name}<br/><span style={{fontSize:"0.82rem", color:"var(--muted)"}}>{cls.teacher}</span></div>
                                        <strong>{cls.count} طلباء</strong>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${(cls.count / highestClassStrength) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="dashboard-panel">
                <h3>حالیہ داخلے</h3>
                <div id="dashboardRecentAdmissions">
                    {recentAdmissions.length === 0 ? (
                        <div className="empty-dashboard-state">ابھی تک کوئی داخلہ محفوظ نہیں ہوا۔</div>
                    ) : (
                        <div className="dashboard-list">
                            {recentAdmissions.map(student => (
                                <div key={student.id || student.roll_number || student.admRegNo} className="dashboard-list-item">
                                    <div className="dashboard-list-text">
                                        <strong>{student.name || '-'}</strong>
                                        <small>{student.father_name || student.admFatherName || '-'} | داخلہ: {student.admission_date || student.admDate || '-'}</small>
                                    </div>
                                    <div className="dashboard-pill">Reg # {student.roll_number || student.admRegNo || '-'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    
    </div>
  );
}
