import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import './Dashboard.css';

export default function Dashboard() {
  const { activeMadrasaId, loadMadrasaData } = useMadrasa();
  const [currentDateStr, setCurrentDateStr] = useState('لوڈ ہو رہا ہے...');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [staffProfiles, setStaffProfiles] = useState([]);

  useEffect(() => {
    // Clock
    const updateClock = () => {
      const now = new Date();
      setCurrentDateStr(now.toLocaleDateString('ur-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      setCurrentTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateClock();
    const intervalId = setInterval(updateClock, 1000);

    // Data Load per Active Madrasa
    const d = loadMadrasaData('hf_records_v1') || {};
    setRecords(d.records || []);
    setClassesList(d.classes || []);
    setStaffProfiles(d.staffProfiles || []);

    return () => clearInterval(intervalId);
  }, [activeMadrasaId]);

  // --- Helpers ---
  const getUniqueTeachers = () => {
      const teachers = new Set();
      staffProfiles.forEach(s => {
          if (s.name) teachers.add(s.name.trim());
      });
      classesList.forEach(c => {
          if (c.teacher) teachers.add(c.teacher.trim());
      });
      return Array.from(teachers);
  };

  const isStudentCompleted = (profile, progressRecords) => {
      const statusText = [
          profile?.status,
          profile?.admStatus,
          profile?.completionStatus,
          profile?.studentStatus
      ].filter(Boolean).join(' ').toLowerCase();

      if (profile?.isCompleted || profile?.completed || profile?.isHafiz) return true;
      if (/(hafiz|complete|completed|graduate|graduated|فارغ|مکمل|حافظ)/i.test(statusText)) return true;

      return progressRecords.some(record => {
          const joined = Object.values(record || {}).join(' ').toLowerCase();
          return /(hafiz|complete|completed|فارغ|مکمل|حافظ)/i.test(joined);
      });
  };

  // --- Metrics Calculation ---
  const admissionProfiles = records.filter(r => r.isAdmissionProfile);
  const activeAdmissions = admissionProfiles.filter(r => !r.isWithdrawn);
  const withdrawnAdmissions = admissionProfiles.filter(r => r.isWithdrawn);
  const progressRecords = records.filter(r => !r.isAdmissionProfile);

  const totalStudents = activeAdmissions.length;
  const withdrawnStudents = withdrawnAdmissions.length;
  const totalAdmitted = admissionProfiles.length;
  const staffCount = getUniqueTeachers().length;
  const completedStudents = admissionProfiles.filter(profile => {
      const relatedRecords = progressRecords.filter(record =>
          record.studentId === profile.admRegNo ||
          record.studentName === profile.name ||
          record.name === profile.name
      );
      return isStudentCompleted(profile, relatedRecords);
  }).length;

  const learningRecordsCount = progressRecords.length;
  const classCount = classesList.length;
  const activeRate = totalAdmitted > 0 ? ((totalStudents / totalAdmitted) * 100).toFixed(1) : '0.0';
  const completionRate = totalAdmitted > 0 ? ((completedStudents / totalAdmitted) * 100).toFixed(1) : '0.0';

  const studentsByClass = classesList.map(cls => {
      const count = activeAdmissions.filter(student => student.admClass === cls.id).length;
      return {
          id: cls.id,
          name: cls.className || 'بلا نام کلاس',
          teacher: cls.teacher || 'استاد درج نہیں',
          count
      };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ur'));

  const recentAdmissions = [...admissionProfiles]
      .sort((a, b) => {
          const dA = new Date(a.admDate || 0).getTime();
          const dB = new Date(b.admDate || 0).getTime();
          if (dA !== dB) return dB - dA;
          const regA = String(a.admRegNo || '').toLowerCase();
          const regB = String(b.admRegNo || '').toLowerCase();
          return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' });
      })
      .slice(0, 5);

  const totalRecordsCount = records.length;
  const highestClassStrength = Math.max(...studentsByClass.map(c => c.count), 1);
  const activeClassesCount = studentsByClass.filter(c => c.count > 0).length;
  const avgStudentsPerClass = classCount > 0 ? (totalStudents / classCount).toFixed(1) : '0.0';

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
                                <div key={student.admRegNo} className="dashboard-list-item">
                                    <div className="dashboard-list-text">
                                        <strong>{student.name || '-'}</strong>
                                        <small>{student.admFatherName || '-'} | داخلہ: {student.admDate || '-'}</small>
                                    </div>
                                    <div className="dashboard-pill">Reg # {student.admRegNo || '-'}</div>
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
