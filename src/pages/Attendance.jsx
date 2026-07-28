import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { DEFAULT_CLASSES } from '../constants/defaults';
import './Entry.css';

export default function Attendance() {
  const { activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  
  const [dailyAttendance, setDailyAttendance] = useState({});
  const [attendance, setAttendance] = useState({});
  
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [staffAttendance, setStaffAttendance] = useState({});
  const [staffFlow, setStaffFlow] = useState({});

  const [activeView, setActiveView] = useState('class'); 
  // views: class, individual, studentreport, classreport, summary, staff
  
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const d = loadMadrasaData('hf_records_v1') || {};
    setRecords(d.records || []);
    if (d.classes && d.classes.length > 0) {
        setClassesList(d.classes);
    } else {
        setClassesList(DEFAULT_CLASSES);
    }
    setDailyAttendance(d.dailyAttendance || {});
    setAttendance(d.attendance || {});
    setStaffProfiles(d.staffProfiles || []);
    setStaffAttendance(d.staffAttendance || {});
    setStaffFlow(d.staffAttendanceFlow || {});
  }, [activeMadrasaId]); 

  const updateLocalStorage = (updates) => {
    const d = loadMadrasaData('hf_records_v1') || {};
    Object.assign(d, updates);
    saveMadrasaData('hf_records_v1', d);
    
    if (updates.dailyAttendance) setDailyAttendance(updates.dailyAttendance);
    if (updates.attendance) setAttendance(updates.attendance);
    if (updates.staffAttendance) setStaffAttendance(updates.staffAttendance);
    if (updates.staffAttendanceFlow) setStaffFlow(updates.staffAttendanceFlow);
  };

  // Switch View
  const switchView = (view) => {
    setActiveView(view);
    setShowHistory(false);
    
    const now = new Date();
    if (view === 'studentreport') {
        if (!srFrom) setSrFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10));
        if (!srTo) setSrTo(now.toISOString().slice(0,10));
    }
    if (view === 'classreport' && !crMonth) setCrMonth(now.toISOString().slice(0,7));
    if (view === 'summary' && !sumMonth) setSumMonth(now.toISOString().slice(0,7));
  };

  // --- View: class (student) ---
  const [studentAttDate, setStudentAttDate] = useState(new Date().toISOString().slice(0,10));
  const [studentAttClass, setStudentAttClass] = useState('');
  const [studentAttFormData, setStudentAttFormData] = useState(null);

  const studentsInClass = records.filter(r => r.isAdmissionProfile && r.admClass === studentAttClass && !r.isWithdrawn);

  useEffect(() => {
      if (activeView === 'class' && studentAttDate && studentAttClass) {
          const savedData = (dailyAttendance[studentAttClass] && dailyAttendance[studentAttClass][studentAttDate]) || {};
          const initialForm = {};
          studentsInClass.forEach(s => {
              initialForm[s.admRegNo] = {
                  status: savedData[s.admRegNo]?.status || 'present',
                  remarks: savedData[s.admRegNo]?.remarks || ''
              };
          });
          setStudentAttFormData(initialForm);
      } else {
          setStudentAttFormData(null);
      }
  }, [activeView, studentAttDate, studentAttClass, dailyAttendance, records]);

  const handleStudentAttChange = (regNo, field, value) => {
      setStudentAttFormData(prev => ({
          ...prev,
          [regNo]: { ...prev[regNo], [field]: value }
      }));
  };

  const saveStudentAttendance = () => {
      if (!studentAttDate || !studentAttClass) return;
      const updatedDailyAtt = JSON.parse(JSON.stringify(dailyAttendance));
      if (!updatedDailyAtt[studentAttClass]) updatedDailyAtt[studentAttClass] = {};
      updatedDailyAtt[studentAttClass][studentAttDate] = studentAttFormData;
      
      updateLocalStorage({ dailyAttendance: updatedDailyAtt });
      alert("حاضری کامیابی سے محفوظ ہو گئی۔");
      setShowHistory(true);
  };

  // --- View: individual ---
  const [indAttDate, setIndAttDate] = useState(new Date().toISOString().slice(0,10));
  const [indAttRegNo, setIndAttRegNo] = useState('');
  const [indAttStatus, setIndAttStatus] = useState('P');
  const [indAttStudent, setIndAttStudent] = useState(null);
  const [indAttMsg, setIndAttMsg] = useState('');

  const searchIndividualStudent = () => {
      const id = indAttRegNo.trim();
      if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
      const s = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
      if (!s) { alert('کوئی طالب علم نہیں ملا'); setIndAttStudent(null); return; }
      setIndAttStudent(s);
      setIndAttMsg('');
      if (!indAttDate) setIndAttDate(new Date().toISOString().slice(0,10));
  };

  const saveIndividualAttendance = () => {
      if (!indAttRegNo.trim() || !indAttDate) { alert('تاریخ اور رجسٹریشن نمبر ضروری ہے'); return; }
      const updatedAtt = JSON.parse(JSON.stringify(attendance));
      if (!updatedAtt[indAttDate]) updatedAtt[indAttDate] = {};
      updatedAtt[indAttDate][indAttRegNo.trim()] = indAttStatus;
      
      updateLocalStorage({ attendance: updatedAtt });
      setIndAttMsg(`محفوظ ہو گیا — ${indAttRegNo} کی حاضری ${indAttDate} کو "${indAttStatus}" درج ہوئی`);
  };

  // --- View: studentreport ---
  const [srId, setSrId] = useState('');
  const [srFrom, setSrFrom] = useState('');
  const [srTo, setSrTo] = useState('');
  const [srResult, setSrResult] = useState(null);
  
  const renderStudentAttReport = () => {
      const id = srId.trim();
      if (!id || !srFrom || !srTo) { alert('تمام فیلڈز بھریں'); return null; }
      const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
      if (!student) return <div className="empty-dashboard-state">طالب علم نہیں ملا</div>;

      const fromD = new Date(srFrom);
      const toD = new Date(srTo);
      let rows = [], P=0, A=0, L=0, E=0;

      for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate()+1)) {
          const key = d.toISOString().slice(0,10);
          if (attendance[key]) {
              const st = attendance[key][id];
              if (st) {
                  rows.push({ date: key, status: st });
                  if (st==='P') P++; else if (st==='A') A++; else if (st==='L') L++; else if (st==='E') E++;
              }
          }
      }
      const total = P+A+L+E;
      const pct = total ? Math.round((P/total)*100) : 0;

      return (
        <div id="studentAttReportArea">
            <div style={{background:"#fff", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px", marginTop:"14px"}}>
                <div style={{textAlign:"center", borderBottom:"2px solid var(--accent)", paddingBottom:"12px", marginBottom:"16px"}}>
                    <div style={{fontSize:"1.3rem", fontWeight:800, color:"var(--accent)"}}>حاضری رپورٹ</div>
                    <div style={{fontWeight:700}}>{student.name}</div>
                    <div style={{fontSize:"0.85rem", color:"var(--muted)"}}>{srFrom} تا {srTo}</div>
                </div>
                <div style={{display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"16px", justifyContent:"center"}}>
                    <div style={{background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"8px", padding:"10px 16px", textAlign:"center", minWidth:"70px"}}>
                        <div style={{fontSize:"1.4rem", fontWeight:800, color:"#15803d"}}>{P}</div>
                        <div style={{fontSize:"0.8rem", color:"#15803d"}}>حاضر</div>
                    </div>
                    <div style={{background:"#fff5f5", border:"1px solid #fecaca", borderRadius:"8px", padding:"10px 16px", textAlign:"center", minWidth:"70px"}}>
                        <div style={{fontSize:"1.4rem", fontWeight:800, color:"#dc2626"}}>{A}</div>
                        <div style={{fontSize:"0.8rem", color:"#dc2626"}}>غیر حاضر</div>
                    </div>
                    <div style={{background:"#fefce8", border:"1px solid #fde68a", borderRadius:"8px", padding:"10px 16px", textAlign:"center", minWidth:"70px"}}>
                        <div style={{fontSize:"1.4rem", fontWeight:800, color:"#b45309"}}>{L}</div>
                        <div style={{fontSize:"0.8rem", color:"#b45309"}}>لیٹ</div>
                    </div>
                    <div style={{background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:"8px", padding:"10px 16px", textAlign:"center", minWidth:"70px"}}>
                        <div style={{fontSize:"1.4rem", fontWeight:800, color:"#0369a1"}}>{pct}%</div>
                        <div style={{fontSize:"0.8rem", color:"#0369a1"}}>حاضری</div>
                    </div>
                </div>
                {rows.length > 0 ? (
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.88rem"}}>
                        <thead>
                            <tr style={{background:"var(--accent)", color:"#fff"}}>
                                <th style={{padding:"8px"}}>تاریخ</th>
                                <th style={{padding:"8px"}}>کیفیت</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                                    <td style={{padding:"8px", textAlign:"center"}}>{r.date}</td>
                                    <td style={{padding:"8px", textAlign:"center", fontWeight:700, color: r.status==='P'?'#15803d':r.status==='A'?'#dc2626':r.status==='L'?'#b45309':'#0369a1'}}>{r.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <div className="empty-dashboard-state">اس مدت میں کوئی ریکارڈ نہیں</div>}
            </div>
        </div>
      );
  };

  // --- View: classreport ---
  const [crClass, setCrClass] = useState('');
  const [crMonth, setCrMonth] = useState('');
  const [crResult, setCrResult] = useState(null);

  const renderClassAttReport = () => {
      if (!crClass || !crMonth) return null;
      const cls = classesList.find(c => c.id === crClass);
      const students = records.filter(r => r.isAdmissionProfile && r.classId === crClass && r.status !== 'withdrawn');
      const [yr, mo] = crMonth.split('-').map(Number);
      const days = new Date(yr, mo, 0).getDate();

      if (!students.length) return <div className="empty-dashboard-state">اس کلاس میں کوئی طالب علم نہیں</div>;

      const rows = students.map(s => {
          let P=0, A=0, L=0;
          for (let d=1; d<=days; d++) {
              const key = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const st = attendance[key]?.[s.admRegNo];
              if (st==='P') P++; else if (st==='A') A++; else if (st==='L') L++;
          }
          const total = P+A+L;
          const pct = total ? Math.round((P/total)*100) : 0;
          return { ...s, P, A, L, pct };
      });

      return (
        <div id="classAttReportArea">
            <div style={{background:"#fff", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px", marginTop:"14px"}}>
                <div style={{textAlign:"center", borderBottom:"2px solid var(--accent)", paddingBottom:"12px", marginBottom:"16px"}}>
                    <div style={{fontSize:"1.3rem", fontWeight:800, color:"var(--accent)"}}>کلاس حاضری رپورٹ</div>
                    <div style={{fontSize:"1rem", color:"var(--muted)"}}>{cls?.name || cls?.className || cls?.id || ''} — {crMonth}</div>
                </div>
                <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.88rem"}}>
                        <thead>
                            <tr style={{background:"var(--accent)", color:"#fff"}}>
                                <th style={{padding:"8px"}}>نام</th>
                                <th style={{padding:"8px"}}>ID</th>
                                <th style={{padding:"8px", color:"#86efac"}}>P</th>
                                <th style={{padding:"8px", color:"#fca5a5"}}>A</th>
                                <th style={{padding:"8px", color:"#fde68a"}}>L</th>
                                <th style={{padding:"8px"}}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.admRegNo} style={{borderBottom:"1px solid var(--border)"}}>
                                    <td style={{padding:"8px", textAlign:"right", fontWeight:700}}>{r.name||'—'}</td>
                                    <td style={{padding:"8px", textAlign:"center"}}>{r.admRegNo}</td>
                                    <td style={{padding:"8px", textAlign:"center", color:"#15803d", fontWeight:700}}>{r.P}</td>
                                    <td style={{padding:"8px", textAlign:"center", color:"#dc2626", fontWeight:700}}>{r.A}</td>
                                    <td style={{padding:"8px", textAlign:"center", color:"#b45309", fontWeight:700}}>{r.L}</td>
                                    <td style={{padding:"8px", textAlign:"center", fontWeight:800, color: r.pct>=75?'#15803d':r.pct>=50?'#b45309':'#dc2626'}}>{r.pct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      );
  };

  // --- View: summary ---
  const [sumMonth, setSumMonth] = useState('');
  const renderAttSummary = () => {
      if (!sumMonth) return null;
      const [yr, mo] = sumMonth.split('-').map(Number);
      const days = new Date(yr, mo, 0).getDate();

      if (!classesList.length) return <div className="empty-dashboard-state">کوئی کلاس موجود نہیں</div>;

      const rows = classesList.map(cls => {
          const students = records.filter(r => r.isAdmissionProfile && r.classId === cls.id && r.status !== 'withdrawn');
          let totalP=0, totalA=0, totalL=0, totalDays=0;
          students.forEach(s => {
              for (let d=1; d<=days; d++) {
                  const key = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const st = attendance[key]?.[s.admRegNo];
                  if (st) {
                      totalDays++;
                      if (st==='P') totalP++; else if (st==='A') totalA++; else if (st==='L') totalL++;
                  }
              }
          });
          const pct = totalDays ? Math.round((totalP/totalDays)*100) : 0;
          return { cls, count: students.length, totalP, totalA, totalL, pct };
      });

      return (
        <div id="attSummaryArea">
            <div style={{background:"#fff", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px", marginTop:"14px"}}>
                <div style={{textAlign:"center", borderBottom:"2px solid var(--accent)", paddingBottom:"12px", marginBottom:"16px"}}>
                    <div style={{fontSize:"1.3rem", fontWeight:800, color:"var(--accent)"}}>خلاصہ حاضری رپورٹ</div>
                    <div style={{fontSize:"1rem", color:"var(--muted)"}}>{sumMonth} — پورا ادارہ</div>
                </div>
                <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.9rem"}}>
                        <thead>
                            <tr style={{background:"var(--accent)", color:"#fff"}}>
                                <th style={{padding:"10px 14px"}}>کلاس</th>
                                <th style={{padding:"10px"}}>طلباء</th>
                                <th style={{padding:"10px", color:"#86efac"}}>حاضر</th>
                                <th style={{padding:"10px", color:"#fca5a5"}}>غیر حاضر</th>
                                <th style={{padding:"10px", color:"#fde68a"}}>لیٹ</th>
                                <th style={{padding:"10px"}}>% حاضری</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.cls.id} style={{borderBottom:"1px solid var(--border)"}}>
                                    <td style={{padding:"10px 14px", textAlign:"right", fontWeight:700}}>{r.cls.name || r.cls.className || r.cls.id}</td>
                                    <td style={{padding:"10px", textAlign:"center"}}>{r.count}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#15803d", fontWeight:700}}>{r.totalP}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#dc2626", fontWeight:700}}>{r.totalA}</td>
                                    <td style={{padding:"10px", textAlign:"center", color:"#b45309", fontWeight:700}}>{r.totalL}</td>
                                    <td style={{padding:"10px", textAlign:"center", fontWeight:800, fontSize:"1.05rem", color: r.pct>=75?'#15803d':r.pct>=50?'#b45309':'#dc2626'}}>{r.pct}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      );
  };

  // --- View: staff ---
  const [staffAttDate, setStaffAttDate] = useState(new Date().toISOString().slice(0,10));
  const [staffSession, setStaffSession] = useState('checkin');
  const [staffAttFormData, setStaffAttFormData] = useState({});
  const [staffFlowMsg, setStaffFlowMsg] = useState('');

  const getStaffForAttendance = () => {
      if (staffProfiles && staffProfiles.length > 0) {
          return [...staffProfiles]
              .sort((a, b) => Number(a.staffCode || 0) - Number(b.staffCode || 0))
              .map(s => ({
                  teacherId: String(s.staffCode),
                  name: s.name || '-',
                  shiftStart: s.shiftStart || '06:50',
                  shiftEnd: s.shiftEnd || '14:45'
              }));
      }
      const teachers = new Set();
      classesList.forEach(c => {
          if (c.teacher) teachers.add(c.teacher.trim());
      });
      return Array.from(teachers).map((name, idx) => ({
          teacherId: String(1001 + idx),
          name,
          shiftStart: '06:50',
          shiftEnd: '14:45'
      }));
  };
  const staffMembers = getStaffForAttendance();

  useEffect(() => {
      if (activeView === 'staff') {
          const lock = staffFlow || {};
          const lockedDate = lock.pendingDate || '';
          const hasPending = lock.checkInSaved && !lock.checkOutSaved && !!lockedDate;

          let targetDate = staffAttDate;
          if (hasPending && staffAttDate !== lockedDate) {
              setStaffAttDate(lockedDate);
              targetDate = lockedDate;
              setStaffFlowMsg(`اس وقت ${lockedDate} کی حاضری زیرِ تکمیل ہے۔ پہلے چیک آؤٹ مکمل کریں۔`);
          } else {
              setStaffFlowMsg('');
          }

          const savedData = staffAttendance[targetDate] || {};
          const initialForm = {};
          
          staffMembers.forEach((staff) => {
               const rec = savedData[staff.teacherId] || savedData[staff.name] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
               initialForm[staff.teacherId] = {
                   status: rec.status || 'present',
                   checkIn: rec.checkIn || staff.shiftStart,
                   checkOut: rec.checkOut || staff.shiftEnd,
                   remarks: rec.remarks || ''
               };
          });
          setStaffAttFormData(initialForm);
      }
  }, [activeView, staffAttDate, staffSession, staffProfiles, staffAttendance, staffFlow, classesList]);

  const handleStaffAttChange = (teacherId, field, value) => {
      setStaffAttFormData(prev => {
          const st = prev[teacherId];
          const newSt = { ...st, [field]: value };
          if (field === 'status' && value !== 'present') {
              newSt.checkIn = '';
              newSt.checkOut = '';
          } else if (field === 'status' && value === 'present') {
              const profile = staffMembers.find(s => s.teacherId === teacherId);
              newSt.checkIn = newSt.checkIn || profile?.shiftStart || '06:50';
              newSt.checkOut = newSt.checkOut || profile?.shiftEnd || '14:45';
          }
          return { ...prev, [teacherId]: newSt };
      });
  };

  const getMinutesDifference = (actualTime, expectedTime) => {
      if (!actualTime || !expectedTime) return 0;
      const [aH, aM] = actualTime.split(':').map(Number);
      const [eH, eM] = expectedTime.split(':').map(Number);
      if ([aH, aM, eH, eM].some(n => Number.isNaN(n))) return 0;
      return (aH * 60 + aM) - (eH * 60 + eM);
  };

  const saveStaffAttendanceCheckIn = () => {
      if (!staffAttDate) return;
      const updatedStaffAtt = JSON.parse(JSON.stringify(staffAttendance));
      const attRecord = updatedStaffAtt[staffAttDate] || {};

      staffMembers.forEach(staff => {
          const form = staffAttFormData[staff.teacherId];
          const prev = attRecord[staff.teacherId] || attRecord[staff.name] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
          const checkIn = (form.status !== 'present') ? '' : form.checkIn;
          const lateMinutes = (form.status === 'present' && checkIn) ? Math.max(getMinutesDifference(checkIn, staff.shiftStart), 0) : 0;
          
          attRecord[staff.teacherId] = {
              teacherId: staff.teacherId,
              teacherName: staff.name,
              status: form.status,
              checkIn,
              checkOut: prev.checkOut || '',
              lateMinutes,
              earlyLeaveMinutes: Number(prev.earlyLeaveMinutes || 0),
              remarks: form.remarks
          };
      });

      updatedStaffAtt[staffAttDate] = attRecord;
      
      updateLocalStorage({
          staffAttendance: updatedStaffAtt,
          staffAttendanceFlow: {
              pendingDate: staffAttDate,
              checkInSaved: true,
              checkOutSaved: false
          }
      });
      alert("چیک اِن حاضری کامیابی سے محفوظ ہو گئی۔ اب دن کے اختتام پر اسی تاریخ میں چیک آؤٹ درج کریں۔");
      setShowHistory(true);
  };

  const saveStaffAttendanceCheckOut = () => {
      if (!staffAttDate) return;
      const flow = staffFlow || {};
      if (flow.pendingDate && flow.pendingDate !== staffAttDate && flow.checkInSaved && !flow.checkOutSaved) {
          alert(`پہلے ${flow.pendingDate} کی چیک آؤٹ مکمل کریں۔`);
          setStaffAttDate(flow.pendingDate);
          return;
      }

      const updatedStaffAtt = JSON.parse(JSON.stringify(staffAttendance));
      const attRecord = updatedStaffAtt[staffAttDate] || {};

      staffMembers.forEach(staff => {
          const form = staffAttFormData[staff.teacherId];
          const prev = attRecord[staff.teacherId] || attRecord[staff.name] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
          const checkOut = (form.status !== 'present') ? '' : form.checkOut;
          
          const lateMinutes = (form.status === 'present' && prev.checkIn) ? Math.max(getMinutesDifference(prev.checkIn, staff.shiftStart), 0) : 0;
          const earlyLeaveMinutes = (form.status === 'present' && checkOut) ? Math.max(getMinutesDifference(staff.shiftEnd, checkOut), 0) : 0;
          
          attRecord[staff.teacherId] = {
              teacherId: staff.teacherId,
              teacherName: staff.name,
              status: form.status,
              checkIn: prev.checkIn || '',
              checkOut,
              lateMinutes,
              earlyLeaveMinutes,
              remarks: form.remarks
          };
      });

      updatedStaffAtt[staffAttDate] = attRecord;
      
      updateLocalStorage({
          staffAttendance: updatedStaffAtt,
          staffAttendanceFlow: {
              pendingDate: '',
              checkInSaved: true,
              checkOutSaved: true,
              completedDate: staffAttDate
          }
      });
      alert("چیک آؤٹ کامیابی سے محفوظ ہو گیا۔ اس تاریخ کی عملے کی حاضری مکمل ہو گئی۔");
      setShowHistory(true);
  };

  // --- History Panel ---
  const renderHistoryPanel = () => {
      if (!showHistory) return null;
      const type = activeView === 'staff' ? 'staff' : 'student';

      if (type === 'student') {
          const rows = [];
          Object.keys(dailyAttendance).forEach(classId => {
              const dateMap = dailyAttendance[classId] || {};
              Object.keys(dateMap).forEach(date => {
                  const entries = dateMap[date] || {};
                  const regNos = Object.keys(entries);
                  let present = 0, absent = 0, leave = 0;
                  regNos.forEach(reg => {
                      const status = entries[reg]?.status || 'present';
                      if (status === 'present') present++;
                      else if (status === 'absent') absent++;
                      else if (status === 'leave') leave++;
                  });
                  const cls = classesList.find(c => c.id === classId);
                  rows.push({
                      date,
                      className: cls ? (cls.name || cls.className || classId) : classId,
                      total: regNos.length,
                      present,
                      absent,
                      leave
                  });
              });
          });

          rows.sort((a, b) => new Date(b.date) - new Date(a.date));
          if (rows.length === 0) return <div className="empty-dashboard-state">طلباء کی کوئی محفوظ حاضری موجود نہیں۔</div>;

          return (
              <div className="table-responsive" style={{marginTop:"10px"}}>
                  <table>
                      <thead>
                          <tr>
                              <th>تاریخ</th>
                              <th>کلاس</th>
                              <th>کل طلباء</th>
                              <th>حاضر</th>
                              <th>غیر حاضر</th>
                              <th>رخصت</th>
                          </tr>
                      </thead>
                      <tbody>
                          {rows.map((r, i) => (
                              <tr key={i}>
                                  <td>{r.date}</td>
                                  <td>{r.className}</td>
                                  <td>{r.total}</td>
                                  <td style={{color:"#2e7d32", fontWeight:"bold"}}>{r.present}</td>
                                  <td style={{color:"#c62828", fontWeight:"bold"}}>{r.absent}</td>
                                  <td style={{color:"#ef6c00", fontWeight:"bold"}}>{r.leave}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          );
      } else {
          const detailedRows = [];
          Object.keys(staffAttendance).forEach(date => {
              const dateEntries = staffAttendance[date] || {};
              Object.keys(dateEntries).forEach(teacherKey => {
                  const rec = dateEntries[teacherKey] || {};
                  detailedRows.push({
                      date,
                      teacherId: rec.teacherId || teacherKey,
                      teacherName: rec.teacherName || teacherKey,
                      status: rec.status || 'present',
                      checkIn: rec.checkIn || '-',
                      checkOut: rec.checkOut || '-',
                      lateMinutes: Number(rec.lateMinutes || 0),
                      earlyLeaveMinutes: Number(rec.earlyLeaveMinutes || 0)
                  });
              });
          });
          detailedRows.sort((a, b) => new Date(b.date) - new Date(a.date) || a.teacherName.localeCompare(b.teacherName, 'ur'));

          if (detailedRows.length === 0) return <div className="empty-dashboard-state">عملے کی کوئی محفوظ حاضری موجود نہیں۔</div>;

          const monthlyMap = {};
          detailedRows.forEach(r => {
              const month = r.date.slice(0, 7);
              const key = `${month}|${r.teacherId}`;
              if (!monthlyMap[key]) {
                  monthlyMap[key] = { month, teacherId: r.teacherId, teacherName: r.teacherName, present: 0, absent: 0, leave: 0, totalLateMinutes: 0, totalEarlyLeaveMinutes: 0 };
              }
              if (r.status === 'present') monthlyMap[key].present++;
              else if (r.status === 'absent') monthlyMap[key].absent++;
              else if (r.status === 'leave') monthlyMap[key].leave++;
              monthlyMap[key].totalLateMinutes += r.lateMinutes;
              monthlyMap[key].totalEarlyLeaveMinutes += r.earlyLeaveMinutes;
          });
          const monthlyRows = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month) || Number(a.teacherId) - Number(b.teacherId));

          return (
              <>
                  <div className="table-responsive" style={{marginTop:"10px"}}>
                      <table>
                          <thead>
                              <tr>
                                  <th>تاریخ</th>
                                  <th>ٹیچر ID</th>
                                  <th>نام استاد</th>
                                  <th>حیثیت</th>
                                  <th>آمد</th>
                                  <th>روانگی</th>
                                  <th>دیر (منٹ)</th>
                                  <th>جلد روانگی (منٹ)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {detailedRows.map((r, i) => (
                                  <tr key={i}>
                                      <td>{r.date}</td>
                                      <td>{r.teacherId}</td>
                                      <td>{r.teacherName}</td>
                                      <td>{r.status}</td>
                                      <td>{r.checkIn}</td>
                                      <td>{r.checkOut}</td>
                                      <td style={{color: r.lateMinutes > 0 ? '#c62828' : '#2e7d32', fontWeight:"bold"}}>{r.lateMinutes}</td>
                                      <td style={{color: r.earlyLeaveMinutes > 0 ? '#f57c00' : '#2e7d32', fontWeight:"bold"}}>{r.earlyLeaveMinutes}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <h3 style={{margin:"18px 0 10px 0", color:"var(--accent)"}}>ماہانہ تنخواہ کیلکولیشن خلاصہ</h3>
                  <div className="table-responsive" style={{marginTop:"10px"}}>
                      <table>
                          <thead>
                              <tr>
                                  <th>ماہ</th>
                                  <th>ٹیچر ID</th>
                                  <th>نام استاد</th>
                                  <th>حاضر دن</th>
                                  <th>غیر حاضر</th>
                                  <th>رخصت</th>
                                  <th>کل دیر (منٹ)</th>
                                  <th>کل جلد روانگی (منٹ)</th>
                              </tr>
                          </thead>
                          <tbody>
                              {monthlyRows.map((r, i) => (
                                  <tr key={i}>
                                      <td>{r.month}</td>
                                      <td>{r.teacherId}</td>
                                      <td>{r.teacherName}</td>
                                      <td>{r.present}</td>
                                      <td>{r.absent}</td>
                                      <td>{r.leave}</td>
                                      <td>{r.totalLateMinutes}</td>
                                      <td>{r.totalEarlyLeaveMinutes}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </>
          );
      }
  };

  return (
    <div className="tab-content">
      
      {/* ===== حاضری بٹن گرڈ ===== */}
      <div className="adm-type-grid" style={{ marginBottom: "20px" }}>
        <button className={`adm-type-btn ${activeView === 'class' ? 'active' : ''}`} onClick={() => switchView('class')}>
          اندراج کلاس
        </button>
        <button className={`adm-type-btn ${activeView === 'individual' ? 'active' : ''}`} onClick={() => switchView('individual')}>
          اندراج انفرادی طالب علم
        </button>
        <button className={`adm-type-btn ${activeView === 'studentreport' ? 'active' : ''}`} onClick={() => switchView('studentreport')}>
          طالب علم کی رپورٹ
        </button>
        <button className={`adm-type-btn ${activeView === 'classreport' ? 'active' : ''}`} onClick={() => switchView('classreport')}>
          کلاس رپورٹ
        </button>
        <button className={`adm-type-btn ${activeView === 'summary' ? 'active' : ''}`} onClick={() => switchView('summary')}>
          خلاصہ رپورٹ
        </button>
        <button className={`adm-type-btn ${activeView === 'staff' ? 'active' : ''}`} onClick={() => switchView('staff')}>
          عملے کی حاضری
        </button>
      </div>

      {/* ریکارڈ پینل */}
      <div className="att-history-panel">
        <div className="att-history-btns">
          <button className="att-view-btn" onClick={() => setShowHistory(true)}>
            حاضری ریکارڈ دیکھیں
          </button>
          <button className="att-clear-btn" onClick={() => setShowHistory(false)}>
            پینل صاف کریں
          </button>
        </div>
        <div id="attendanceHistoryArea" style={{ marginTop: "14px" }}>
            {renderHistoryPanel()}
        </div>
      </div>

      {/* Student Attendance Container */}
      {activeView === 'class' && (
      <div id="studentAttendanceContainer">
        <h2>طلباء کی حاضری</h2>
        <div className="grid-row" style={{ marginBottom: "20px" }}>
          <div>
            <label>تاریخ</label>
            <input type="date" value={studentAttDate} onChange={(e) => setStudentAttDate(e.target.value)} />
          </div>
          <div>
            <label>کلاس</label>
            <select value={studentAttClass} onChange={(e) => setStudentAttClass(e.target.value)}>
              <option value="">کلاس منتخب کریں...</option>
              {classesList.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>
              ))}
            </select>
          </div>
        </div>
        <div id="studentAttendanceListArea">
            {!studentAttDate || !studentAttClass ? (
                <p style={{textAlign:"center", color:"var(--muted)"}}>تاریخ اور کلاس منتخب کریں۔</p>
            ) : studentsInClass.length === 0 ? (
                <p style={{textAlign:"center", color:"var(--muted)"}}>اس کلاس میں کوئی طالب علم موجود نہیں۔</p>
            ) : studentAttFormData && (
                <div className="table-responsive" style={{marginTop:"20px"}}>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>نام طالب علم</th>
                                <th>حاضری کی حیثیت</th>
                                <th>ریمارکس (اگر کوئی ہوں)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsInClass.map(s => {
                                const formData = studentAttFormData[s.admRegNo] || { status: 'present', remarks: '' };
                                return (
                                    <tr key={s.admRegNo}>
                                        <td>{s.admRegNo}</td>
                                        <td><strong>{s.name}</strong><br/><span style={{fontSize:"0.8rem", color:"#666"}}>{s.admFatherName}</span></td>
                                        <td>
                                            <select style={{width:"auto", minWidth:"150px", padding:"5px"}} value={formData.status} onChange={e => handleStudentAttChange(s.admRegNo, 'status', e.target.value)}>
                                                <option value="present">حاضر (Present)</option>
                                                <option value="absent">غیر حاضر (Absent)</option>
                                                <option value="leave">رخصت (Leave)</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" placeholder="ریمارکس..." style={{width:"100%", padding:"5px"}} value={formData.remarks} onChange={e => handleStudentAttChange(s.admRegNo, 'remarks', e.target.value)} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
        
        {studentAttFormData && studentsInClass.length > 0 && (
            <div className="btn-container" style={{ marginTop: "20px" }}>
            <button onClick={saveStudentAttendance} style={{ background: "linear-gradient(135deg,#1b5e20,#2e7d32)", fontSize: "1.1rem", padding: "13px 44px", borderRadius: "10px", boxShadow: "0 4px 14px rgba(27,94,32,0.28)" }}>
                حاضری محفوظ کریں
            </button>
            </div>
        )}
      </div>
      )}

      {/* اندراج انفرادی طالب علم */}
      {activeView === 'individual' && (
      <div id="attSection-individual">
        <div className="form-section-card">
          <div className="form-section-header" style={{ marginBottom: "16px" }}>
            <div className="form-section-icon icon-amber"></div>
            <div>
              <div className="form-section-title">اندراج انفرادی طالب علم</div>
              <div className="form-section-subtitle">غیر حاضر طالب علم کی حاضری بعد میں لگائیں یا درست کریں</div>
            </div>
          </div>
          <div className="grid-row" style={{ marginBottom: "14px" }}>
            <div>
              <label>تاریخ</label>
              <input type="date" value={indAttDate} onChange={e => setIndAttDate(e.target.value)} />
            </div>
            <div>
              <label>رجسٹریشن نمبر</label>
              <input type="text" value={indAttRegNo} onChange={e => setIndAttRegNo(e.target.value)} placeholder="رجسٹریشن نمبر..." />
            </div>
          </div>
          {indAttStudent && (
          <div id="indAttStudentInfo" className="fee-student-badge" style={{ display: 'flex' }}>
            <div className="fee-student-avatar"></div>
            <div>
              <div className="fee-student-name">{indAttStudent.name || '—'}</div>
              <div className="fee-student-father">والد: <span>{indAttStudent.admFatherName || '—'}</span></div>
            </div>
          </div>
          )}
          <div className="grid-row" style={{ marginTop: "12px" }}>
            <div>
              <label>حاضری کی کیفیت</label>
              <select value={indAttStatus} onChange={e => setIndAttStatus(e.target.value)}>
                <option value="P">حاضر (P)</option>
                <option value="A">غیر حاضر (A)</option>
                <option value="L">لیٹ (L)</option>
                <option value="E">معذور (E)</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <button onClick={searchIndividualStudent} style={{ background: "var(--accent)", flex: 1 }}>تلاش کریں</button>
              {indAttStudent && (
                  <button onClick={saveIndividualAttendance} style={{ background: "var(--accent-2)", flex: 1 }}>محفوظ کریں</button>
              )}
            </div>
          </div>
          {indAttMsg && <div id="indAttMsg" style={{ marginTop: "10px", fontSize: "0.9rem", whiteSpace: "pre-line" }}>{indAttMsg}</div>}
        </div>
      </div>
      )}

      {/* طالب علم کی انفرادی رپورٹ */}
      {activeView === 'studentreport' && (
      <div id="attSection-studentreport">
        <div className="form-section-card">
          <div className="form-section-header" style={{ marginBottom: "16px" }}>
            <div className="form-section-icon icon-blue"></div>
            <div>
              <div className="form-section-title">طالب علم کی حاضری رپورٹ</div>
              <div className="form-section-subtitle">کسی بھی تاریخ سے کسی بھی تاریخ تک حاضری دیکھیں</div>
            </div>
          </div>
          <div className="grid-row">
            <div>
              <label>رجسٹریشن نمبر</label>
              <input type="text" value={srId} onChange={e => setSrId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
            </div>
            <div>
              <label>شروع تاریخ</label>
              <input type="date" value={srFrom} onChange={e => setSrFrom(e.target.value)} />
            </div>
            <div>
              <label>اختتام تاریخ</label>
              <input type="date" value={srTo} onChange={e => setSrTo(e.target.value)} />
            </div>
          </div>
          <div className="btn-container" style={{ marginTop: "12px" }}>
            <button onClick={() => setSrResult(renderStudentAttReport())} style={{ background: "var(--accent)" }}>رپورٹ دیکھیں</button>
            <button onClick={() => { setSrResult(renderStudentAttReport()); setTimeout(() => window.print(), 100); }} style={{ background: "var(--accent-2)" }}>پرنٹ</button>
          </div>
        </div>
        {srResult}
      </div>
      )}

      {/* کلاس رپورٹ */}
      {activeView === 'classreport' && (
      <div id="attSection-classreport">
        <div className="form-section-card">
          <div className="form-section-header" style={{ marginBottom: "16px" }}>
            <div className="form-section-icon icon-green"></div>
            <div>
              <div className="form-section-title">کلاس حاضری رپورٹ</div>
              <div className="form-section-subtitle">پوری ایک کلاس کی حاضری کسی بھی مہینے کے لیے دیکھیں</div>
            </div>
          </div>
          <div className="grid-row">
            <div>
              <label>کلاس منتخب کریں</label>
              <select value={crClass} onChange={e => setCrClass(e.target.value)}>
                <option value="">کلاس منتخب کریں...</option>
                {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label>مہینہ</label>
              <input type="month" value={crMonth} onChange={e => setCrMonth(e.target.value)} />
            </div>
          </div>
          <div className="btn-container" style={{ marginTop: "12px" }}>
            <button onClick={() => setCrResult(renderClassAttReport())} style={{ background: "var(--accent)" }}>رپورٹ دیکھیں</button>
            <button onClick={() => { setCrResult(renderClassAttReport()); setTimeout(() => window.print(), 100); }} style={{ background: "var(--accent-2)" }}>پرنٹ</button>
          </div>
        </div>
        {crResult}
      </div>
      )}

      {/* خلاصہ رپورٹ */}
      {activeView === 'summary' && (
      <div id="attSection-summary">
        <div className="form-section-card">
          <div className="form-section-header" style={{ marginBottom: "16px" }}>
            <div className="form-section-icon icon-blue"></div>
            <div>
              <div className="form-section-title">خلاصہ رپورٹ</div>
              <div className="form-section-subtitle">پورے ادارے کی ماہانہ حاضری کا خلاصہ</div>
            </div>
          </div>
          <div className="grid-row">
            <div>
              <label>مہینہ منتخب کریں</label>
              <input type="month" value={sumMonth} onChange={e => setSumMonth(e.target.value)} />
            </div>
          </div>
        </div>
        {renderAttSummary()}
      </div>
      )}

      {/* Staff Attendance Container */}
      {activeView === 'staff' && (
      <div id="staffAttendanceContainer">
        <h2>عملے کی حاضری</h2>
        <div className="grid-row" style={{ marginBottom: "20px" }}>
          <div>
            <label>تاریخ</label>
            <input type="date" value={staffAttDate} onChange={e => setStaffAttDate(e.target.value)} />
          </div>
          <div>
            <label>اندراج مرحلہ</label>
            <div className="session-toggle-wrap">
              <button className={`session-btn checkin-btn ${staffSession === 'checkin' ? 'active' : ''}`} onClick={() => setStaffSession('checkin')}>
                چیک اِن
              </button>
              <button className={`session-btn checkout-btn ${staffSession === 'checkout' ? 'active' : ''}`} onClick={() => setStaffSession('checkout')}>
                چیک آؤٹ
              </button>
            </div>
          </div>
        </div>

        {/* لاک انفو وارننگ بینر */}
        {staffFlowMsg && (
            <div id="staffAttendanceLockInfo" className="att-lock-banner" style={{ display: 'block' }}>{staffFlowMsg}</div>
        )}

        <div id="staffAttendanceListArea">
            {!staffAttDate ? (
                <p style={{textAlign:"center", color:"var(--muted)"}}>پہلے تاریخ منتخب کریں۔</p>
            ) : staffMembers.length === 0 ? (
                <p style={{textAlign:"center", color:"var(--muted)"}}>سسٹم میں کوئی استاد موجود نہیں ہے۔ کلاسز والے حصے میں جا کر کلاس اور استاد شامل کریں۔</p>
            ) : (
                <div className="table-responsive" style={{marginTop:"20px"}}>
                    <table>
                        <thead>
                            <tr>
                                <th>ٹیچر ID</th>
                                <th>نام استاد</th>
                                <th>معیاری وقت</th>
                                <th>حیثیت</th>
                                <th>آمد کا وقت (Check-in)</th>
                                <th>روانگی کا وقت (Check-out)</th>
                                <th>ریمارکس</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffMembers.map(staff => {
                                const formData = staffAttFormData[staff.teacherId] || { status: 'present', checkIn: staff.shiftStart, checkOut: staff.shiftEnd, remarks: '' };
                                const disable = formData.status !== 'present';
                                return (
                                    <tr key={staff.teacherId}>
                                        <td><strong>{staff.teacherId}</strong></td>
                                        <td><strong>{staff.name}</strong></td>
                                        <td><span style={{fontSize:"0.85rem", color:"#555"}}>{staff.shiftStart} تا {staff.shiftEnd}</span></td>
                                        <td>
                                            <select style={{width:"auto", minWidth:"120px", padding:"5px"}} value={formData.status} onChange={e => handleStaffAttChange(staff.teacherId, 'status', e.target.value)}>
                                                <option value="present">حاضر (Present)</option>
                                                <option value="absent">غیر حاضر (Absent)</option>
                                                <option value="leave">رخصت (Leave)</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="time" value={formData.checkIn} onChange={e => handleStaffAttChange(staff.teacherId, 'checkIn', e.target.value)} disabled={disable || staffSession === 'checkout'} />
                                        </td>
                                        <td>
                                            <input type="time" value={formData.checkOut} onChange={e => handleStaffAttChange(staff.teacherId, 'checkOut', e.target.value)} disabled={disable || staffSession === 'checkin'} />
                                        </td>
                                        <td>
                                            <input type="text" placeholder="ریمارکس..." style={{width:"100%", padding:"5px"}} value={formData.remarks} onChange={e => handleStaffAttChange(staff.teacherId, 'remarks', e.target.value)} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {staffAttDate && staffMembers.length > 0 && (
            <div className="btn-container" style={{ marginTop: "20px", gap: "14px", justifyContent: "center" }}>
                {staffSession === 'checkin' && (
                    <button onClick={saveStaffAttendanceCheckIn} className="checkin-save-btn" style={{display:"inline-block"}}>
                        چیک اِن محفوظ کریں
                    </button>
                )}
                {staffSession === 'checkout' && (
                    <button onClick={saveStaffAttendanceCheckOut} className="checkout-save-btn" style={{display:"inline-block"}}>
                        چیک آؤٹ محفوظ کریں
                    </button>
                )}
            </div>
        )}
      </div>
      )}
    
    </div>
  );
}
