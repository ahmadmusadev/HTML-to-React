import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { getCurrentAcademicYearStart, formatAcademicYear, getAcademicYearOptions } from '../utils/academicYear';
import { DEFAULT_CLASSES } from '../constants/defaults';
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

const yearTargets = {
  1: [30, 29, 28, 27, 26, 1, 2, 3],
  2: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  3: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  4: [24, 25]
};
const PAGES_PER_JUZ = 20;

export default function Entry() {
  const { activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [activeTab, setActiveTab] = useState('monthly');
  
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [monthlyExams, setMonthlyExams] = useState([]);

  useEffect(() => {
    const storedData = loadMadrasaData('hf_records_v1') || {};
    setRecords(storedData.records || []);
    if (storedData.classes && storedData.classes.length > 0) {
        setClassesList(storedData.classes);
    } else {
        setClassesList(DEFAULT_CLASSES);
    }
    setMonthlyExams(storedData.monthlyExams || []);
  }, [activeMadrasaId]);

  const saveToLocal = (newMonthlyExams) => {
    let storedData = loadMadrasaData('hf_records_v1') || { monthlyExams: [] };
    storedData.monthlyExams = newMonthlyExams;
    saveMadrasaData('hf_records_v1', storedData);
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

  const meLoadStudents = () => {
    if (!meClassSelect) { alert('براہ کرم پہلے کلاس منتخب کریں۔'); return; }
    
    const cls = classesList.find(c => c.id === meClassSelect);
    const students = records.filter(r => r.isAdmissionProfile && r.admClass === meClassSelect && !r.isWithdrawn)
                            .sort((a,b) => Number(a.admRegNo || 0) - Number(b.admRegNo || 0));

    if (students.length === 0) {
      setMeStudents('empty');
      return;
    }

    const existing = monthlyExams.find(r => r.classId === meClassSelect && r.month === meMonth && r.year === meYear);
    
    const loadedStudents = students.map(s => {
      const prev = existing?.students?.find(r => r.regNo === s.admRegNo) || {};
      let item = { student: s };
      ME_COLS.forEach(c => { item[c.key] = prev[c.key] ?? ''; });
      
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

  const meSaveExam = () => {
    if (!meStudents || meStudents === 'empty') { alert('کوئی طالب علم نہیں۔'); return; }
    
    const studentData = meStudents.data.map(item => {
      const row = { regNo: item.student.admRegNo, name: item.student.name };
      ME_COLS.forEach(c => { row[c.key] = c.max ? Number(item[c.key] || 0) : (item[c.key] || ''); });
      row.total = item.total;
      row.pct = item.pct;
      row.grade = item.gradeObj.g;
      return row;
    });

    const record = {
      classId: meClassSelect, className: meStudents.clsName,
      month: meMonth, year: meYear, students: studentData,
      savedAt: new Date().toISOString()
    };

    let newExams = [...monthlyExams];
    const idx = newExams.findIndex(r => r.classId === meClassSelect && r.month === meMonth && r.year === meYear);
    if (idx > -1) newExams[idx] = record;
    else newExams.push(record);

    saveToLocal(newExams);
    const avg = studentData.reduce((s, r) => s + r.pct, 0) / studentData.length;
    alert(`${meStudents.clsName} — ${meMonth} ${meYear}\n${studentData.length} طلباء کا ریکارڈ محفوظ ہو گیا!\nکلاسی اوسط: ${avg.toFixed(1)}%`);
    meLoadStudents();
  };

  const meDeleteExam = (idx) => {
    if (!window.confirm('کیا آپ یہ ریکارڈ حذف کرنا چاہتے ہیں؟')) return;
    let filteredExams = monthlyExams.filter(r => (!meHistoryClassFilter || r.classId === meHistoryClassFilter) && (!meHistoryMonthFilter || r.month === meHistoryMonthFilter))
                                    .sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
    const target = filteredExams[idx];
    if (!target) return;
    const newExams = monthlyExams.filter(r => r !== target);
    saveToLocal(newExams);
  };

  // --- 2. Hifz Logic (ششماہی و سالانہ) ---
  const [selectYear, setSelectYear] = useState('1');
  const [selectHalfYear, setSelectHalfYear] = useState('1');

  const yearVal = Number(selectYear);
  const totalJuz = yearTargets[yearVal].length;
  const totalPagesOfYear = totalJuz * PAGES_PER_JUZ;
  const halfYearTarget = totalPagesOfYear / 2;

  let monthsConfig = [];
  if (selectHalfYear === '1') {
      monthsConfig = [{ name: 'اپریل', y: 2025 }, { name: 'مئی', y: 2025 }, { name: 'جون', y: 2025 }, { name: 'جولائی', y: 2025 }, { name: 'اگست', y: 2025 }, { name: 'ستمبر', y: 2025 }];
  } else {
      monthsConfig = [{ name: 'اکتوبر', y: 2025 }, { name: 'نومبر', y: 2025 }, { name: 'دسمبر', y: 2025 }, { name: 'جنوری', y: 2026 }, { name: 'فروری', y: 2026 }, { name: 'مارچ', y: 2026 }];
  }

  // --- 3. Class Report ---
  const [crClassSelect, setCrClassSelect] = useState('');
  const [crMonth, setCrMonth] = useState('اپریل');
  const [crYear, setCrYear] = useState(defaultYear);
  const [crResultsData, setCrResultsData] = useState(null);

  const renderClassReport = () => {
    if (!crClassSelect) { alert('کلاس منتخب کریں'); return; }
    const cls = classesList.find(c => c.id === crClassSelect);
    const exam = monthlyExams.find(r => r.classId === crClassSelect && r.month === crMonth && r.year == crYear);
    
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
    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!student) { setSrResultsData('notfound'); return; }
    
    const exams = monthlyExams.filter(exam => exam.students && exam.students.some(s => s.regNo === id))
                              .sort((a,b) => a.year - b.year || 0);
    
    if (!exams.length) { setSrResultsData({ empty: true, student }); return; }
    const avgAll = exams.reduce((s, e) => { const st = e.students.find(x => x.regNo === id); return s + (st?.pct || 0); }, 0) / exams.length;
    setSrResultsData({ student, exams, avgAll });
  };

  // --- 5. Institute Result ---
  const [irMonth, setIrMonth] = useState('اپریل');
  const [irYear, setIrYear] = useState(defaultYear);
  const [irResultsData, setIrResultsData] = useState(null);

  const renderInstituteResult = () => {
    const exams = monthlyExams.filter(r => r.month === irMonth && r.year == irYear);
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
                <label>کلاس منتخب کریں</label>
                <select value={meClassSelect} onChange={e => setMeClassSelect(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>)}
                </select>
              </div>
              <div>
                <label>ماہ</label>
                <select value={meMonth} onChange={e => setMeMonth(e.target.value)}>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>سال</label>
                <select value={meYear} onChange={e => setMeYear(e.target.value)}>
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
                        <th rowspan="2" style={{ minWidth: "48px" }}>نمبر</th>
                        <th rowspan="2" style={{ minWidth: "160px", textAlign: "right", paddingRight: "12px" }}>طالب علم</th>
                        {ME_COLS.filter(c => !c.sub).map(c => <th rowspan="2" key={c.key}>{c.label}<br/><span className="me-max-label">/ {c.max}</span></th>)}
                        <th colspan="2" className="me-literacy-group">خواندگی</th>
                        <th rowspan="2" style={{ minWidth: "80px" }}>کل<br/><span className="me-max-label">/ {ME_MAX_TOTAL}</span></th>
                      </tr>
                      <tr className="me-subhead">
                        {ME_COLS.filter(c => c.sub).map(c => <th className="me-literacy-sub" key={c.key}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {meStudents.data.map((item, idx) => (
                        <tr key={item.student.admRegNo}>
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
                  <button className="me-save-btn" onClick={meSaveExam}>💾 {meStudents.clsName} — {meMonth} {formatAcademicYear(meYear)} محفوظ کریں</button>
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
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>)}
                </select>
                <select value={meHistoryMonthFilter} onChange={e => setMeHistoryMonthFilter(e.target.value)} style={{ maxWidth: "160px" }}>
                  <option value="">تمام مہینے</option>
                  {['اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر','جنوری','فروری','مارچ'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div id="meHistoryArea">
                {(()=>{
                    const filtered = monthlyExams.filter(r => (!meHistoryClassFilter || r.classId === meHistoryClassFilter) && (!meHistoryMonthFilter || r.month === meHistoryMonthFilter))
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
                                    <button className="me-del-btn" onClick={() => meDeleteExam(ei)}>حذف</button>
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
              <div><label>بچے کا نام</label><input type="text" id="studentName" /></div>
              <div><label>آغازِ حفظ کی تاریخ</label><input type="date" id="startDate" /></div>
              <div><label>متوقع تکمیل</label><input type="text" id="expectedEnd" readOnly /></div>
            </div>

            <div id="targetsArea" style={{ marginTop: "20px", overflowX: "auto" }}>
              <h3>پارہ تقسیم — سالانہ حقائق پارے</h3>
              <div className="table-responsive">
                <table>
                  <thead><tr><th>سال</th><th>پارے</th><th>کل پارے</th><th>سالانہ کل صفحات</th><th>ششماہی ہدف صفحات</th></tr></thead>
                  <tbody>
                    {[1,2,3,4].map(y => {
                        const arr = yearTargets[y];
                        const total = arr.length * PAGES_PER_JUZ;
                        return (
                          <tr key={y}>
                            <td>سال {y}</td><td style={{ fontSize: "0.9rem" }}>{arr.join(', ')}</td>
                            <td>{arr.length}</td><td>{total}</td><td>{total / 2}</td>
                          </tr>
                        );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ background: "#eef2f6", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
              <h3 style={{ marginTop: "0", textAlign: "center", color: "var(--accent)" }}>سال اور ششماہی کا انتخاب</h3>
              <div className="grid-row">
                <div>
                  <label>حفظ کا سال</label>
                  <select value={selectYear} onChange={e => setSelectYear(e.target.value)}>
                    {[1,2,3,4].map(y => <option key={y} value={y}>سال {y} ({yearTargets[y].length} پارے)</option>)}
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
            <div style={{ fontSize: "0.9rem", color: "#666", textAlign: "center", marginBottom: "15px" }}>ایامِ کار خودکار طریقے سے کیلکولیٹ ہوئے ہیں، تاہم آپ دستی تبدیلی کر سکتے ہیں (غیر حاضری اور رخصت ضرور درج کریں)۔</div>

            <div id="attendanceInputArea">
              <div className="attendance-header">
                <div>مہینہ</div><div>ایامِ کار (W)</div><div>غیر حاضری (A)</div><div>رخصت (L)</div><div>کل حاضری (P) اور %</div>
              </div>
              {monthsConfig.map((m, index) => (
                  <div className="attendance-row" key={index}>
                    <div>{m.name} {m.y}</div>
                    <div><input type="number" min="0" defaultValue="0" className="working-days" style={{ width: "90px", textAlign: "center" }} /><br/><label style={{ fontSize: "0.75rem" }}>(ایامِ کار)</label></div>
                    <div><input type="number" min="0" defaultValue="0" className="absent-days" style={{ width: "90px", textAlign: "center" }} /><br/><label style={{ fontSize: "0.75rem" }}>(غیر حاضری)</label></div>
                    <div><input type="number" min="0" defaultValue="0" className="leave-days" style={{ width: "90px", textAlign: "center" }} /><br/><label style={{ fontSize: "0.75rem" }}>(رخصت)</label></div>
                    <div className="result-cell"><span className="present-days-display">0</span><span style={{ fontSize: "0.7rem", color: "#555" }}> ایام</span><br/>(<span className="monthly-pct-display">0.00%</span>)</div>
                  </div>
              ))}
            </div>

            <div className="grid-row" style={{ background: "#fff8f8", padding: "15px", borderRadius: "8px", border: "1px dashed #c62828", marginTop: "15px" }}>
                <div><label>ششماہی کل ایامِ کار</label><input type="text" readOnly /></div>
                <div><label>کل غیر حاضری + رخصت</label><input type="text" readOnly /></div>
                <div><label>ششماہی کل حاضر ایام</label><input type="text" readOnly /></div>
                <div><label>حاضری فیصد</label><input type="text" readOnly /></div>
            </div>

            <h2>2. مقدارِ خواندگی (تعلیمی ریکارڈ)</h2>
            <div className="grid-row">
                <div><label>ششماہی ہدف (صفحات)</label><input type="text" value={halfYearTarget} readOnly /></div>
            </div>
            
            <h3>ماہانہ صفحات کا اندراج</h3>
            <div id="monthlyInputArea" className="months-grid">
               {monthsConfig.map((m, index) => (
                  <div key={index}>
                    <label>{m.name} ({m.y})</label>
                    <input type="number" min="0" className="month-pages" placeholder="0" />
                  </div>
              ))}
            </div>

            <div className="grid-row" style={{ background: "#f8f9fa", padding: "15px", borderRadius: "8px", border: "1px dashed #ccc" }}>
              <div><label>کل پڑھے گئے صفحات</label><input type="text" readOnly /></div>
              <div><label>فیصد</label><input type="text" readOnly /></div>
              <div><label>اسکور</label><input type="text" readOnly /></div>
            </div>

            <div className="btn-container">
              <button>مکمل ریکارڈ (تعلیمی + حاضری) محفوظ کریں</button>
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
                  {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>)}
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
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "14px" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--accent)" }}>ماہانہ جائزہ رپورٹ</div>
                    <div style={{ fontSize: "1rem", color: "var(--muted)" }}>{crResultsData.exam.className} — {crResultsData.month} {crResultsData.year}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--accent-2)", marginTop: "4px" }}>اوسط: {crResultsData.avg.toFixed(1)}% ({meGrade(crResultsData.avg).g}) | طلباء: {crResultsData.exam.students.length}</div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr style={{ background: "var(--accent)", color: "#fff" }}>
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
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "14px" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--accent)" }}>انفرادی رپورٹ</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "700" }}>{srResultsData.student.name}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>والد: {srResultsData.student.admFatherName || '—'} | ID: {srStudentId}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--accent-2)", marginTop: "4px" }}>مجموعی اوسط: {srResultsData.avgAll.toFixed(1)}% ({meGrade(srResultsData.avgAll).g})</div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                      <thead>
                        <tr style={{ background: "var(--accent)", color: "#fff" }}>
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
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "14px" }}>
                <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "var(--accent)" }}>نتیجہ ماہانہ جائزہ</div>
                  <div style={{ fontSize: "1rem", color: "var(--muted)" }}>{irResultsData.month} {irResultsData.year} — پورا ادارہ</div>
                </div>

                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "20px" }}>
                  <div style={{ flex: "1", minWidth: "140px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#15803d" }}>کل کلاسز</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#15803d" }}>{irResultsData.exams.length}</div>
                  </div>
                  <div style={{ flex: "1", minWidth: "140px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#1d4ed8" }}>کل طلباء</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#1d4ed8" }}>{irResultsData.totalStudents}</div>
                  </div>
                  <div style={{ flex: "1", minWidth: "140px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.85rem", color: "#b45309" }}>مجموعی اوسط</div>
                    <div style={{ fontSize: "2rem", fontWeight: "800", color: "#b45309" }}>{irResultsData.overallAvg.toFixed(1)}%</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "#b45309" }}>{meGrade(irResultsData.overallAvg).g}</div>
                  </div>
                </div>

                <h4 style={{ color: "var(--accent)", margin: "0 0 10px 0" }}>کلاس وار نتیجہ</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ background: "var(--accent)", color: "#fff" }}>
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
