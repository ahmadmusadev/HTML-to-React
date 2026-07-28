import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';

export default function Exams() {
  const { activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [activeTab, setActiveTab] = useState('miqdar-class');
  
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [examMiqdar, setExamMiqdar] = useState([]);
  const [examResults, setExamResults] = useState([]);

  // Sync state with active madrasa
  const loadLocalData = () => {
    const storedData = loadMadrasaData('hf_records_v1') || {};
    setRecords(storedData.records || []);
    setClassesList(storedData.classes || []);
    setExamMiqdar(storedData.examMiqdar || []);
    setExamResults(storedData.examResults || []);
  };

  useEffect(() => {
    loadLocalData();
  }, [activeMadrasaId]);

  const saveToLocalData = (newMiqdar, newResults) => {
    let storedData = loadMadrasaData('hf_records_v1') || { records: [], classes: [], examMiqdar: [], examResults: [] };
    if (newMiqdar !== null) storedData.examMiqdar = newMiqdar;
    if (newResults !== null) storedData.examResults = newResults;
    saveMadrasaData('hf_records_v1', storedData);
    
    if (newMiqdar !== null) setExamMiqdar(newMiqdar);
    if (newResults !== null) setExamResults(newResults);
  };

  // Sub-tab 1: Miqdar Class state
  const [mqClassSelect, setMqClassSelect] = useState('');
  const [mqTermSelect, setMqTermSelect] = useState('first');
  const [mqYear, setMqYear] = useState('2025');
  const [mqClassStudents, setMqClassStudents] = useState(null);

  // Sub-tab 2: Miqdar Individual state
  const [mqIndId, setMqIndId] = useState('');
  const [mqIndTerm, setMqIndTerm] = useState('first');
  const [mqIndYear, setMqIndYear] = useState('2025');
  const [mqIndStudent, setMqIndStudent] = useState(null);
  const [mqIndStartPara, setMqIndStartPara] = useState('');
  const [mqIndStartRuku, setMqIndStartRuku] = useState('');
  const [mqIndEndPara, setMqIndEndPara] = useState('');
  const [mqIndEndRuku, setMqIndEndRuku] = useState('');
  const [mqIndMsg, setMqIndMsg] = useState('');

  // Sub-tab 3: Result Entry state
  const [reClassSelect, setReClassSelect] = useState('');
  const [reTermSelect, setReTermSelect] = useState('first');
  const [reYear, setReYear] = useState('2025');
  const [reStudents, setReStudents] = useState(null);

  // Sub-tab 4: Class Result state
  const [crExamClass, setCrExamClass] = useState('');
  const [crExamTerm, setCrExamTerm] = useState('first');
  const [crExamYear, setCrExamYear] = useState('2025');
  const [crResultsData, setCrResultsData] = useState(null);

  // Sub-tab 5: Individual Result state
  const [indExamId, setIndExamId] = useState('');
  const [indExamYear, setIndExamYear] = useState('2025');
  const [indResultsData, setIndResultsData] = useState(null);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setMqClassStudents(null);
    setMqIndStudent(null);
    setMqIndMsg('');
    setReStudents(null);
    setCrResultsData(null);
    setIndResultsData(null);
  };

  // Helper to filter active students by class
  const getActiveStudentsByClass = (clsId) => {
    return records.filter(r => 
      r.isAdmissionProfile && 
      (r.admClass === clsId || r.classId === clsId) && 
      !r.isWithdrawn && 
      r.status !== 'withdrawn'
    );
  };

  // Load Sub-tab 1: Miqdar Class
  const loadMiqdarClass = () => {
    if (!mqClassSelect) { alert('کلاس منتخب کریں'); return; }
    const students = getActiveStudentsByClass(mqClassSelect);
    if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); setMqClassStudents(null); return; }
    
    const cls = classesList.find(c => c.id === mqClassSelect);
    const existing = examMiqdar.filter(m => m.classId === mqClassSelect && m.term === mqTermSelect && String(m.year) === String(mqYear));
    
    const loadedStudents = students.map(s => {
      const prev = existing.find(m => m.regNo === s.admRegNo) || {};
      return {
        student: s,
        startPara: prev.startPara || '',
        startRuku: prev.startRuku || '',
        endPara: prev.endPara || '',
        endRuku: prev.endRuku || '',
        targetRuku: prev.targetRuku || 0
      };
    });
    setMqClassStudents({
      title: `${cls ? cls.name : ''} — ${mqTermSelect === 'first' ? 'پہلی' : 'دوسری'} ششماہی ${mqYear}`,
      list: loadedStudents
    });
  };

  const handleMqClassChange = (index, field, value) => {
    const newList = [...mqClassStudents.list];
    newList[index][field] = value;
    const sp = parseInt(newList[index].startPara) || 0;
    const sr = parseInt(newList[index].startRuku) || 0;
    const ep = parseInt(newList[index].endPara) || 0;
    const er = parseInt(newList[index].endRuku) || 0;
    newList[index].targetRuku = Math.max(0, (ep - sp) * 8 + (er - sr));
    setMqClassStudents({ ...mqClassStudents, list: newList });
  };

  const saveMiqdarClass = () => {
    if (!mqClassStudents || !mqClassStudents.list) return;
    let newMiqdar = [...examMiqdar];
    const year = parseInt(mqYear);
    
    mqClassStudents.list.forEach(item => {
      const sp = parseInt(item.startPara) || 0;
      const sr = parseInt(item.startRuku) || 0;
      const ep = parseInt(item.endPara) || 0;
      const er = parseInt(item.endRuku) || 0;
      const targetRuku = Math.max(0, (ep - sp) * 8 + (er - sr));
      
      const rec = {
        regNo: item.student.admRegNo,
        classId: mqClassSelect,
        term: mqTermSelect,
        year: year,
        startPara: sp,
        startRuku: sr,
        endPara: ep,
        endRuku: er,
        targetRuku: targetRuku
      };
      
      const idx = newMiqdar.findIndex(m => m.regNo === rec.regNo && m.classId === rec.classId && m.term === rec.term && m.year === rec.year);
      if (idx >= 0) newMiqdar[idx] = rec; else newMiqdar.push(rec);
    });
    
    saveToLocalData(newMiqdar, null);
    alert('مقدار خواندگی محفوظ ہو گئی');
  };

  // Load Sub-tab 2: Miqdar Individual
  const loadMiqdarIndividual = () => {
    const id = mqIndId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const s = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!s) { alert('طالب علم نہیں ملا'); setMqIndStudent(null); return; }
    
    const prev = examMiqdar.find(m => m.regNo === id && m.term === mqIndTerm && m.year == mqIndYear) || {};
    setMqIndStudent(s);
    setMqIndStartPara(prev.startPara || '');
    setMqIndStartRuku(prev.startRuku || '');
    setMqIndEndPara(prev.endPara || '');
    setMqIndEndRuku(prev.endRuku || '');
    setMqIndMsg('');
  };

  const saveMiqdarIndividual = () => {
    const id = mqIndId.trim();
    if (!mqIndStudent || !id) return;
    const year = parseInt(mqIndYear);
    const sp = parseInt(mqIndStartPara) || 0;
    const sr = parseInt(mqIndStartRuku) || 0;
    const ep = parseInt(mqIndEndPara) || 0;
    const er = parseInt(mqIndEndRuku) || 0;
    const targetRuku = Math.max(0, (ep - sp) * 8 + (er - sr));
    
    let newMiqdar = [...examMiqdar];
    const rec = {
      regNo: id,
      classId: mqIndStudent.admClass || mqIndStudent.classId || '',
      term: mqIndTerm,
      year: year,
      startPara: sp,
      startRuku: sr,
      endPara: ep,
      endRuku: er,
      targetRuku: targetRuku
    };
    
    const idx = newMiqdar.findIndex(m => m.regNo === id && m.term === mqIndTerm && m.year === year);
    if (idx >= 0) newMiqdar[idx] = rec; else newMiqdar.push(rec);
    
    saveToLocalData(newMiqdar, null);
    setMqIndMsg(`محفوظ ہو گیا — ہدف: ${targetRuku} رکوع`);
  };

  // Load Sub-tab 3: Result Entry
  const loadResultEntry = () => {
    if (!reClassSelect) { alert('کلاس منتخب کریں'); return; }
    const students = getActiveStudentsByClass(reClassSelect);
    if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); setReStudents(null); return; }
    
    const cls = classesList.find(c => c.id === reClassSelect);
    const loadedStudents = students.map(s => {
      const mq = examMiqdar.find(m => m.regNo === s.admRegNo && m.term === reTermSelect && m.year == reYear);
      const prev = examResults.find(e => e.regNo === s.admRegNo && e.term === reTermSelect && e.year == reYear);
      const tgt = mq ? mq.targetRuku : 0;
      return {
        student: s,
        targetRuku: tgt,
        achievedRuku: prev ? prev.achievedRuku : '',
        pct: prev && prev.pct !== undefined ? prev.pct : null
      };
    });
    setReStudents({
      title: `${cls ? cls.name : ''} — ${reTermSelect === 'first' ? 'پہلی' : 'دوسری'} ششماہی ${reYear}`,
      list: loadedStudents
    });
  };

  const handleResultChange = (index, value) => {
    const newList = [...reStudents.list];
    newList[index].achievedRuku = value;
    const achieved = parseInt(value) || 0;
    const target = newList[index].targetRuku || 0;
    newList[index].pct = target ? Math.round((achieved / target) * 100) : 0;
    setReStudents({ ...reStudents, list: newList });
  };

  const saveResultEntry = () => {
    if (!reStudents || !reStudents.list) return;
    let newResults = [...examResults];
    const year = parseInt(reYear);
    const cls = classesList.find(c => c.id === reClassSelect);
    
    reStudents.list.forEach(item => {
      const target = item.targetRuku || 0;
      const achieved = parseInt(item.achievedRuku) || 0;
      const pct = target ? Math.round((achieved / target) * 100) : 0;
      const rec = {
        regNo: item.student.admRegNo,
        classId: reClassSelect,
        term: reTermSelect,
        year: year,
        targetRuku: target,
        achievedRuku: achieved,
        pct: pct,
        studentName: item.student.name || '',
        classNm: cls ? cls.name : ''
      };
      const idx = newResults.findIndex(e => e.regNo === rec.regNo && e.term === rec.term && e.year === rec.year);
      if (idx >= 0) newResults[idx] = rec; else newResults.push(rec);
    });
    
    saveToLocalData(null, newResults);
    alert('رزلٹ محفوظ ہو گیا');
  };

  // Sub-tab 4: Class Exam Result
  const renderClassExamResult = () => {
    if (!crExamClass) { alert('کلاس منتخب کریں'); return; }
    const cls = classesList.find(c => c.id === crExamClass);
    const yr = parseInt(crExamYear);
    let results = examResults.filter(e => e.classId === crExamClass && e.year === yr);
    if (crExamTerm !== 'annual') results = results.filter(e => e.term === crExamTerm);
    
    if (!results.length) { setCrResultsData('empty'); return; }
    const avg = results.reduce((s, r) => s + (r.pct || 0), 0) / results.length;
    setCrResultsData({ clsName: cls ? cls.name : '', term: crExamTerm, year: yr, results, avg });
  };

  const printClassExamResult = () => {
    if (!crResultsData || crResultsData === 'empty') {
      renderClassExamResult();
    }
    setTimeout(() => window.print(), 100);
  };

  // Sub-tab 5: Individual Exam Result
  const renderIndividualExamResult = () => {
    const id = indExamId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const yr = parseInt(indExamYear);
    const s = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!s) { setIndResultsData('notfound'); return; }
    
    const results = examResults.filter(e => e.regNo === id && e.year === yr);
    if (!results.length) { setIndResultsData({ empty: true, student: s, year: yr }); return; }
    
    const avg = results.reduce((sum, r) => sum + (r.pct || 0), 0) / results.length;
    setIndResultsData({ student: s, results, avg, year: yr });
  };

  const printIndividualExamResult = () => {
    if (!indResultsData || indResultsData === 'notfound') {
      renderIndividualExamResult();
    }
    setTimeout(() => window.print(), 100);
  };

  const getPctColor = (pct) => pct >= 80 ? '#15803d' : pct >= 60 ? '#b45309' : '#dc2626';

  return (
    <div className="tab-content" id="tab-exams">
      {/* Sub-tab Navigation Buttons */}
      <div className="adm-type-grid no-print" style={{ marginBottom: "20px" }}>
        {[
          { id: 'miqdar-class', label: 'اندراج مقدار خواندگی کلاس' },
          { id: 'miqdar-individual', label: 'اندراج انفرادی طالب علم' },
          { id: 'result-entry', label: 'اندراج کلاس رزلٹ' },
          { id: 'class-result', label: 'کلاس کا رزلٹ' },
          { id: 'individual-result', label: 'انفرادی رزلٹ' }
        ].map(t => (
          <button 
            key={t.id} 
            className={`adm-type-btn ${activeTab === t.id ? 'active' : ''}`} 
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1: اندراج مقدار خواندگی کلاس */}
      {activeTab === 'miqdar-class' && (
        <div id="examSection-miqdar-class" className="no-print">
          <div className="form-section-card">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-green"></div>
              <div>
                <div className="form-section-title">اندراج مقدار خواندگی کلاس</div>
                <div className="form-section-subtitle">ششماہی شروع ہونے پر ہر طالب علم کا ہدف درج کریں</div>
              </div>
            </div>
            <div className="grid-row" style={{ marginBottom: "14px" }}>
              <div>
                <label>کلاس منتخب کریں</label>
                <select id="mqClassSelect" value={mqClassSelect} onChange={e => setMqClassSelect(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>ششماہی</label>
                <select id="mqTermSelect" value={mqTermSelect} onChange={e => setMqTermSelect(e.target.value)}>
                  <option value="first">پہلی ششماہی</option>
                  <option value="second">دوسری ششماہی</option>
                </select>
              </div>
              <div>
                <label>سال</label>
                <input type="number" id="mqYear" value={mqYear} onChange={e => setMqYear(e.target.value)} min="2020" max="2035" />
              </div>
            </div>
            <div className="btn-container" style={{ marginTop: "0" }}>
              <button onClick={loadMiqdarClass} style={{ background: "var(--accent)" }}>طلباء لوڈ کریں</button>
            </div>
          </div>

          {mqClassStudents && (
            <div id="miqdarClassArea" className="form-section-card" style={{ marginTop: "14px" }}>
              <h3 id="miqdarClassTitle" style={{ margin: "0 0 14px 0", color: "var(--accent)" }}>
                {mqClassStudents.title}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--accent)", color: "#fff" }}>
                      <th style={{ padding: "10px" }}>نام</th>
                      <th style={{ padding: "10px" }}>ID</th>
                      <th style={{ padding: "10px" }}>شروع (پارہ/رکوع)</th>
                      <th style={{ padding: "10px" }}>ہدف اختتام (پارہ/رکوع)</th>
                      <th style={{ padding: "10px" }}>کل رکوع ہدف</th>
                    </tr>
                  </thead>
                  <tbody id="miqdarClassTableBody">
                    {mqClassStudents.list.map((item, idx) => (
                      <tr key={item.student.admRegNo} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>{item.student.name || '—'}</td>
                        <td style={{ padding: "8px", textAlign: "center", fontSize: "0.82rem", color: "var(--muted)" }}>{item.student.admRegNo}</td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <input 
                              type="number" 
                              className="mq-start-para" 
                              data-id={item.student.admRegNo} 
                              min="1" 
                              max="30" 
                              value={item.startPara} 
                              placeholder="پارہ" 
                              onChange={e => handleMqClassChange(idx, 'startPara', e.target.value)} 
                              style={{ width: "60px", padding: "5px", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center" }} 
                            />
                            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>پ</span>
                            <input 
                              type="number" 
                              className="mq-start-ruku" 
                              data-id={item.student.admRegNo} 
                              min="1" 
                              max="40" 
                              value={item.startRuku} 
                              placeholder="رکوع" 
                              onChange={e => handleMqClassChange(idx, 'startRuku', e.target.value)} 
                              style={{ width: "60px", padding: "5px", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center" }} 
                            />
                            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>ر</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px" }}>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <input 
                              type="number" 
                              className="mq-end-para" 
                              data-id={item.student.admRegNo} 
                              min="1" 
                              max="30" 
                              value={item.endPara} 
                              placeholder="پارہ" 
                              onChange={e => handleMqClassChange(idx, 'endPara', e.target.value)} 
                              style={{ width: "60px", padding: "5px", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center" }} 
                            />
                            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>پ</span>
                            <input 
                              type="number" 
                              className="mq-end-ruku" 
                              data-id={item.student.admRegNo} 
                              min="1" 
                              max="40" 
                              value={item.endRuku} 
                              placeholder="رکوع" 
                              onChange={e => handleMqClassChange(idx, 'endRuku', e.target.value)} 
                              style={{ width: "60px", padding: "5px", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center" }} 
                            />
                            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>ر</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px", textAlign: "center" }} id={`mqTarget-${item.student.admRegNo}`}>
                          {item.targetRuku ? <strong style={{ color: "var(--accent-2)" }}>{item.targetRuku} رکوع</strong> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="btn-container" style={{ marginTop: "16px" }}>
                <button onClick={saveMiqdarClass} style={{ background: "var(--accent-2)", padding: "12px 36px" }}>مقدار خواندگی محفوظ کریں</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2: اندراج انفرادی طالب علم */}
      {activeTab === 'miqdar-individual' && (
        <div id="examSection-miqdar-individual" className="no-print">
          <div className="form-section-card">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-amber"></div>
              <div>
                <div className="form-section-title">اندراج انفرادی طالب علم</div>
                <div className="form-section-subtitle">کسی ایک طالب علم کا ہدف الگ سے درج کریں</div>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>رجسٹریشن نمبر</label>
                <input type="text" id="mqIndId" value={mqIndId} onChange={e => setMqIndId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
              </div>
              <div>
                <label>ششماہی</label>
                <select id="mqIndTerm" value={mqIndTerm} onChange={e => setMqIndTerm(e.target.value)}>
                  <option value="first">پہلی ششماہی</option>
                  <option value="second">دوسری ششماہی</option>
                </select>
              </div>
              <div>
                <label>سال</label>
                <input type="number" id="mqIndYear" value={mqIndYear} onChange={e => setMqIndYear(e.target.value)} min="2020" max="2035" />
              </div>
            </div>
            <div className="btn-container" style={{ marginTop: "12px" }}>
              <button onClick={loadMiqdarIndividual} style={{ background: "var(--accent)" }}>تلاش کریں</button>
            </div>
          </div>

          {mqIndStudent && (
            <div id="miqdarIndArea" className="form-section-card" style={{ marginTop: "14px" }}>
              <div className="fee-student-badge" style={{ marginBottom: "16px" }}>
                <div className="fee-student-avatar"></div>
                <div>
                  <div className="fee-student-name" id="mqIndName">{mqIndStudent.name || '—'}</div>
                  <div className="fee-student-father">والد: <span id="mqIndFather">{mqIndStudent.admFatherName || '—'}</span></div>
                </div>
              </div>
              <div className="grid-row">
                <div>
                  <label>شروع پارہ</label>
                  <input type="number" id="mqIndStartPara" min="1" max="30" placeholder="1" value={mqIndStartPara} onChange={e => setMqIndStartPara(e.target.value)} />
                </div>
                <div>
                  <label>شروع رکوع</label>
                  <input type="number" id="mqIndStartRuku" min="1" max="40" placeholder="1" value={mqIndStartRuku} onChange={e => setMqIndStartRuku(e.target.value)} />
                </div>
                <div>
                  <label>ہدف اختتام پارہ</label>
                  <input type="number" id="mqIndEndPara" min="1" max="30" placeholder="5" value={mqIndEndPara} onChange={e => setMqIndEndPara(e.target.value)} />
                </div>
                <div>
                  <label>ہدف اختتام رکوع</label>
                  <input type="number" id="mqIndEndRuku" min="1" max="40" placeholder="1" value={mqIndEndRuku} onChange={e => setMqIndEndRuku(e.target.value)} />
                </div>
              </div>
              <div className="btn-container" style={{ marginTop: "14px" }}>
                <button onClick={saveMiqdarIndividual} style={{ background: "var(--accent-2)", padding: "12px 36px" }}>محفوظ کریں</button>
              </div>
              <div id="mqIndMsg" style={{ marginTop: "10px", fontSize: "0.9rem" }}>
                {mqIndMsg && <span style={{ color: "var(--accent-2)", fontWeight: "700" }}>{mqIndMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3: اندراج کلاس رزلٹ */}
      {activeTab === 'result-entry' && (
        <div id="examSection-result-entry" className="no-print">
          <div className="form-section-card">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-blue"></div>
              <div>
                <div className="form-section-title">اندراج کلاس رزلٹ</div>
                <div className="form-section-subtitle">امتحان کے بعد حاصل شدہ مقدار درج کریں</div>
              </div>
            </div>
            <div className="grid-row" style={{ marginBottom: "14px" }}>
              <div>
                <label>کلاس</label>
                <select id="reClassSelect" value={reClassSelect} onChange={e => setReClassSelect(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>ششماہی</label>
                <select id="reTermSelect" value={reTermSelect} onChange={e => setReTermSelect(e.target.value)}>
                  <option value="first">پہلی ششماہی</option>
                  <option value="second">دوسری ششماہی</option>
                </select>
              </div>
              <div>
                <label>سال</label>
                <input type="number" id="reYear" value={reYear} onChange={e => setReYear(e.target.value)} min="2020" max="2035" />
              </div>
            </div>
            <div className="btn-container">
              <button onClick={loadResultEntry} style={{ background: "var(--accent)" }}>طلباء لوڈ کریں</button>
            </div>
          </div>

          {reStudents && (
            <div id="resultEntryArea" className="form-section-card" style={{ marginTop: "14px" }}>
              <h3 id="resultEntryTitle" style={{ margin: "0 0 14px 0", color: "var(--accent)" }}>
                {reStudents.title}
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--accent)", color: "#fff" }}>
                      <th style={{ padding: "10px" }}>نام</th>
                      <th style={{ padding: "10px" }}>ID</th>
                      <th style={{ padding: "10px" }}>ہدف (رکوع)</th>
                      <th style={{ padding: "10px" }}>حاصل شدہ (رکوع)</th>
                      <th style={{ padding: "10px" }}>فیصد</th>
                    </tr>
                  </thead>
                  <tbody id="resultEntryTableBody">
                    {reStudents.list.map((item, idx) => (
                      <tr key={item.student.admRegNo} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: "600" }}>{item.student.name || '—'}</td>
                        <td style={{ padding: "8px", textAlign: "center", fontSize: "0.82rem", color: "var(--muted)" }}>{item.student.admRegNo}</td>
                        <td style={{ padding: "8px", textAlign: "center", fontWeight: "700", color: "var(--accent-2)" }}>{item.targetRuku || '—'}</td>
                        <td style={{ padding: "8px" }}>
                          <input 
                            type="number" 
                            className="re-achieved" 
                            data-id={item.student.admRegNo} 
                            data-target={item.targetRuku || 0} 
                            min="0" 
                            value={item.achievedRuku} 
                            placeholder="رکوع" 
                            onChange={e => handleResultChange(idx, e.target.value)} 
                            style={{ width: "80px", padding: "6px", border: "1px solid var(--border)", borderRadius: "6px", textAlign: "center" }} 
                          />
                        </td>
                        <td style={{ padding: "8px", textAlign: "center", fontWeight: "700" }} id={`rePct-${item.student.admRegNo}`}>
                          {item.pct !== null ? <span style={{ color: getPctColor(item.pct) }}>{item.pct}%</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="btn-container" style={{ marginTop: "16px" }}>
                <button onClick={saveResultEntry} style={{ background: "var(--accent-2)", padding: "12px 36px" }}>رزلٹ محفوظ کریں</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4: کلاس کا رزلٹ */}
      {activeTab === 'class-result' && (
        <div id="examSection-class-result">
          <div className="form-section-card no-print">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-green"></div>
              <div>
                <div className="form-section-title">کلاس کا رزلٹ</div>
                <div className="form-section-subtitle">کسی بھی کلاس کا ششماہی یا سالانہ رزلٹ دیکھیں</div>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>کلاس</label>
                <select id="crExamClass" value={crExamClass} onChange={e => setCrExamClass(e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>ششماہی</label>
                <select id="crExamTerm" value={crExamTerm} onChange={e => setCrExamTerm(e.target.value)}>
                  <option value="first">پہلی ششماہی</option>
                  <option value="second">دوسری ششماہی</option>
                  <option value="annual">سالانہ (دونوں)</option>
                </select>
              </div>
              <div>
                <label>سال</label>
                <input type="number" id="crExamYear" value={crExamYear} onChange={e => setCrExamYear(e.target.value)} min="2020" max="2035" />
              </div>
            </div>
            <div className="btn-container" style={{ marginTop: "12px" }}>
              <button onClick={renderClassExamResult} style={{ background: "var(--accent)" }}>رزلٹ دیکھیں</button>
              <button onClick={printClassExamResult} style={{ background: "var(--accent-2)" }}>پرنٹ کریں</button>
            </div>
          </div>
          
          <div id="classExamResultArea">
            {crResultsData === 'empty' ? (
              <div className="empty-dashboard-state">رزلٹ موجود نہیں</div>
            ) : crResultsData && (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "14px" }}>
                <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--accent)" }}>کلاس رزلٹ</div>
                  <div style={{ color: "var(--muted)" }}>
                    {crResultsData.clsName} — {crResultsData.term === 'annual' ? 'سالانہ' : crResultsData.term === 'first' ? 'پہلی' : 'دوسری'} ششماہی {crResultsData.year}
                  </div>
                  <div style={{ color: "var(--accent-2)", fontWeight: "700", marginTop: "4px" }}>
                    اوسط: {crResultsData.avg.toFixed(1)}%
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ background: "var(--accent)", color: "#fff" }}>
                        <th style={{ padding: "10px" }}>#</th>
                        <th style={{ padding: "10px" }}>نام</th>
                        <th style={{ padding: "10px" }}>ID</th>
                        <th style={{ padding: "10px" }}>ششماہی</th>
                        <th style={{ padding: "10px" }}>ہدف</th>
                        <th style={{ padding: "10px" }}>حاصل</th>
                        <th style={{ padding: "10px" }}>فیصد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crResultsData.results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px", textAlign: "center" }}>{i + 1}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontWeight: "700" }}>{r.studentName || '—'}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{r.regNo}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{r.term === 'first' ? 'پہلی' : 'دوسری'}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{r.targetRuku}</td>
                          <td style={{ padding: "10px", textAlign: "center" }}>{r.achievedRuku}</td>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: "800", color: getPctColor(r.pct) }}>{r.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div id="classExamResultPrint" style={{ display: "none" }}></div>
        </div>
      )}

      {/* 5: انفرادی رزلٹ */}
      {activeTab === 'individual-result' && (
        <div id="examSection-individual-result">
          <div className="form-section-card no-print">
            <div className="form-section-header" style={{ marginBottom: "16px" }}>
              <div className="form-section-icon icon-amber"></div>
              <div>
                <div className="form-section-title">انفرادی رزلٹ</div>
                <div className="form-section-subtitle">رجسٹریشن نمبر سے کسی بھی طالب علم کا رزلٹ دیکھیں</div>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>رجسٹریشن نمبر</label>
                <input type="text" id="indExamId" value={indExamId} onChange={e => setIndExamId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
              </div>
              <div>
                <label>سال</label>
                <input type="number" id="indExamYear" value={indExamYear} onChange={e => setIndExamYear(e.target.value)} min="2020" max="2035" />
              </div>
            </div>
            <div className="btn-container" style={{ marginTop: "12px" }}>
              <button onClick={renderIndividualExamResult} style={{ background: "var(--accent)" }}>رزلٹ دیکھیں</button>
              <button onClick={printIndividualExamResult} style={{ background: "var(--accent-2)" }}>پرنٹ کریں</button>
            </div>
          </div>
          
          <div id="individualExamResultArea">
            {indResultsData === 'notfound' ? (
              <div className="empty-dashboard-state">طالب علم نہیں ملا</div>
            ) : indResultsData && indResultsData.empty ? (
              <div className="empty-dashboard-state">{indResultsData.student.name} کا {indResultsData.year} میں کوئی رزلٹ نہیں</div>
            ) : indResultsData && !indResultsData.empty && (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "14px" }}>
                <div style={{ textAlign: "center", borderBottom: "2px solid var(--accent)", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--accent)" }}>انفرادی رزلٹ {indResultsData.year}</div>
                  <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>{indResultsData.student.name}</div>
                  <div style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                    والد: {indResultsData.student.admFatherName || '—'} | ID: {indExamId}
                  </div>
                  <div style={{ color: "var(--accent-2)", fontWeight: "700", marginTop: "4px" }}>
                    سالانہ اوسط: {indResultsData.avg.toFixed(1)}%
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--accent)", color: "#fff" }}>
                      <th style={{ padding: "10px" }}>ششماہی</th>
                      <th style={{ padding: "10px" }}>ہدف (رکوع)</th>
                      <th style={{ padding: "10px" }}>حاصل (رکوع)</th>
                      <th style={{ padding: "10px" }}>فیصد</th>
                      <th style={{ padding: "10px" }}>درجہ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indResultsData.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px", textAlign: "center" }}>{r.term === 'first' ? 'پہلی' : 'دوسری'} ششماہی</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>{r.targetRuku}</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>{r.achievedRuku}</td>
                        <td style={{ padding: "10px", textAlign: "center", fontWeight: "800", color: getPctColor(r.pct) }}>{r.pct}%</td>
                        <td style={{ padding: "10px", textAlign: "center", fontWeight: "700" }}>
                          {r.pct >= 80 ? 'ممتاز' : r.pct >= 60 ? 'اچھا' : r.pct >= 40 ? 'اوسط' : 'ضعیف'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div id="individualExamResultPrint" style={{ display: "none" }}></div>
        </div>
      )}
    </div>
  );
}
