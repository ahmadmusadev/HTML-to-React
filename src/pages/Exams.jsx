import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { mapSupabaseToUi as mapStudentToUi } from './Admissions';
import { DEFAULT_CLASSES } from '../constants/defaults';
import {
  calculateTargetRuku,
  calculatePct,
  getExamGrade,
  getPctColor,
  mapExamMiqdarToUi,
  mapUiToExamMiqdarPayload,
  mapExamResultToUi,
  mapUiToExamResultPayload
} from '../utils/ExamsMappers';

export default function Exams() {
  const {
    activeMadrasaId,
    loadMadrasaData,
    saveMadrasaData,
    fetchStudentsFromSupabase,
    fetchClassesFromSupabase,
    fetchExamMiqdarFromSupabase,
    upsertExamMiqdarToSupabase,
    upsertExamMiqdarSingle,
    fetchExamResultsFromSupabase,
    upsertExamResultsToSupabase
  } = useMadrasa();

  const [activeTab, setActiveTab] = useState('miqdar-class');
  
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [examMiqdar, setExamMiqdar] = useState([]);
  const [examResults, setExamResults] = useState([]);

  // Sync state with active madrasa
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const storedData = loadMadrasaData('hf_records_v1') || {};
      if (isMounted) {
        setRecords(storedData.records || []);
        setClassesList(storedData.classes && storedData.classes.length > 0 ? storedData.classes : DEFAULT_CLASSES);
        setExamMiqdar((storedData.examMiqdar || []).map(mapExamMiqdarToUi).filter(Boolean));
        setExamResults((storedData.examResults || []).map(mapExamResultToUi).filter(Boolean));
      }

      try {
        const [stdData, clsData, miqdarData, resultsData] = await Promise.all([
          fetchStudentsFromSupabase(activeMadrasaId).catch(() => null),
          fetchClassesFromSupabase(activeMadrasaId).catch(() => null),
          fetchExamMiqdarFromSupabase({}, activeMadrasaId).catch(() => null),
          fetchExamResultsFromSupabase({}, activeMadrasaId).catch(() => null)
        ]);

        if (isMounted) {
          if (stdData && stdData.length > 0) {
            setRecords(stdData.map(s => mapStudentToUi(s)));
          }
          if (clsData && clsData.length > 0) {
            setClassesList(clsData);
          }
          if (miqdarData && miqdarData.length > 0) {
            setExamMiqdar(miqdarData.map(mapExamMiqdarToUi).filter(Boolean));
          }
          if (resultsData && resultsData.length > 0) {
            setExamResults(resultsData.map(mapExamResultToUi).filter(Boolean));
          }
        }
      } catch (err) {
        console.warn('Initial data load warning in Exams:', err);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

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
      (r.admClass === clsId || r.classId === clsId || r.class_id === clsId) && 
      !r.isWithdrawn && 
      r.status !== 'left' &&
      r.status !== 'withdrawn'
    );
  };

  // Load Sub-tab 1: Miqdar Class
  const loadMiqdarClass = async () => {
    if (!mqClassSelect) { alert('کلاس منتخب کریں'); return; }
    const students = getActiveStudentsByClass(mqClassSelect);
    if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); setMqClassStudents(null); return; }
    
    const cls = classesList.find(c => c.id === mqClassSelect);

    let existing = [];
    try {
      const fetched = await fetchExamMiqdarFromSupabase({
        class_id: mqClassSelect,
        term: mqTermSelect,
        year: parseInt(mqYear)
      });
      existing = (fetched || []).map(mapExamMiqdarToUi).filter(Boolean);
    } catch (e) {
      console.warn('Failed to fetch miqdar from Supabase, checking local state:', e);
      existing = examMiqdar.filter(m => (m.classId === mqClassSelect || m.class_id === mqClassSelect) && m.term === mqTermSelect && String(m.year) === String(mqYear));
    }
    
    const loadedStudents = students.map(s => {
      const prev = existing.find(m => (m.studentId && m.studentId === s.id) || (m.regNo && (m.regNo === s.admRegNo || m.regNo === s.roll_number))) || {};
      return {
        student: s,
        startPara: prev.startPara !== undefined ? prev.startPara : '',
        startRuku: prev.startRuku !== undefined ? prev.startRuku : '',
        endPara: prev.endPara !== undefined ? prev.endPara : '',
        endRuku: prev.endRuku !== undefined ? prev.endRuku : '',
        targetRuku: prev.targetRuku || 0
      };
    });
    setMqClassStudents({
      title: `${cls ? (cls.class_name || cls.name) : ''} — ${mqTermSelect === 'first' ? 'پہلی' : 'دوسری'} ششماہی ${mqYear}`,
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
    newList[index].targetRuku = calculateTargetRuku(sp, sr, ep, er);
    setMqClassStudents({ ...mqClassStudents, list: newList });
  };

  const saveMiqdarClass = async () => {
    if (!mqClassStudents || !mqClassStudents.list) return;
    const year = parseInt(mqYear);
    
    const payload = mqClassStudents.list.map(item => {
      const sp = parseInt(item.startPara) || 0;
      const sr = parseInt(item.startRuku) || 0;
      const ep = parseInt(item.endPara) || 0;
      const er = parseInt(item.endRuku) || 0;
      const targetRuku = calculateTargetRuku(sp, sr, ep, er);
      
      return {
        student_id: item.student.id,
        class_id: mqClassSelect,
        term: mqTermSelect,
        year: year,
        start_para: sp,
        start_ruku: sr,
        end_para: ep,
        end_ruku: er,
        target_ruku: targetRuku,
        regNo: item.student.admRegNo
      };
    });

    try {
      await upsertExamMiqdarToSupabase(payload);
      // Update local state
      const updatedMapped = payload.map(p => ({
        studentId: p.student_id,
        regNo: p.regNo,
        classId: p.class_id,
        term: p.term,
        year: p.year,
        startPara: p.start_para,
        startRuku: p.start_ruku,
        endPara: p.end_para,
        endRuku: p.end_ruku,
        targetRuku: p.target_ruku
      }));
      setExamMiqdar(prev => {
        const next = [...prev];
        updatedMapped.forEach(u => {
          const idx = next.findIndex(m =>
            (u.studentId && (m.studentId === u.studentId || m.student_id === u.studentId)) ||
            (u.regNo && m.regNo === u.regNo) &&
            m.term === u.term &&
            String(m.year) === String(u.year)
          );
          if (idx >= 0) next[idx] = { ...next[idx], ...u };
          else next.push(u);
        });
        return next;
      });
      alert('مقدار خواندگی محفوظ ہو گئی');
    } catch (e) {
      console.error('Failed to save exam miqdar:', e);
      alert('مقدار خواندگی محفوظ کرنے میں خرابی: ' + (e.message || e));
    }
  };

  // Load Sub-tab 2: Miqdar Individual
  const loadMiqdarIndividual = async () => {
    const id = mqIndId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const s = records.find(r => r.isAdmissionProfile && (String(r.admRegNo).trim() === id || String(r.roll_number || '').trim() === id || String(r.id).trim() === id));
    if (!s) { alert('طالب علم نہیں ملا'); setMqIndStudent(null); return; }
    
    let prev = {};
    try {
      const fetched = await fetchExamMiqdarFromSupabase({
        student_id: s.id,
        term: mqIndTerm,
        year: parseInt(mqIndYear)
      });
      if (fetched && fetched.length > 0) {
        prev = mapExamMiqdarToUi(fetched[0]) || {};
      }
    } catch (e) {
      console.warn('Failed to fetch individual miqdar from Supabase, checking local:', e);
    }

    if (!prev.id && !prev.targetRuku) {
      prev = examMiqdar.find(m => ((m.studentId && m.studentId === s.id) || m.regNo === id) && m.term === mqIndTerm && String(m.year) === String(mqIndYear)) || {};
    }

    setMqIndStudent(s);
    setMqIndStartPara(prev.startPara !== undefined ? prev.startPara : '');
    setMqIndStartRuku(prev.startRuku !== undefined ? prev.startRuku : '');
    setMqIndEndPara(prev.endPara !== undefined ? prev.endPara : '');
    setMqIndEndRuku(prev.endRuku !== undefined ? prev.endRuku : '');
    setMqIndMsg('');
  };

  const saveMiqdarIndividual = async () => {
    const id = mqIndId.trim();
    if (!mqIndStudent || !id) return;
    const year = parseInt(mqIndYear);
    const sp = parseInt(mqIndStartPara) || 0;
    const sr = parseInt(mqIndStartRuku) || 0;
    const ep = parseInt(mqIndEndPara) || 0;
    const er = parseInt(mqIndEndRuku) || 0;
    const targetRuku = calculateTargetRuku(sp, sr, ep, er);
    
    const rec = {
      student_id: mqIndStudent.id,
      class_id: mqIndStudent.admClass || mqIndStudent.classId || mqIndStudent.class_id || null,
      term: mqIndTerm,
      year: year,
      start_para: sp,
      start_ruku: sr,
      end_para: ep,
      end_ruku: er,
      target_ruku: targetRuku,
      regNo: mqIndStudent.admRegNo || id
    };

    try {
      await upsertExamMiqdarSingle(rec);
      setExamMiqdar(prev => {
        const next = [...prev];
        const idx = next.findIndex(m =>
          (rec.student_id && (m.studentId === rec.student_id || m.student_id === rec.student_id)) ||
          (rec.regNo && m.regNo === rec.regNo) &&
          m.term === rec.term &&
          String(m.year) === String(rec.year)
        );
        const mappedItem = {
          studentId: rec.student_id,
          classId: rec.class_id,
          term: rec.term,
          year: rec.year,
          startPara: rec.start_para,
          startRuku: rec.start_ruku,
          endPara: rec.end_para,
          endRuku: rec.end_ruku,
          targetRuku: rec.target_ruku,
          regNo: rec.regNo
        };
        if (idx >= 0) next[idx] = { ...next[idx], ...mappedItem };
        else next.push(mappedItem);
        return next;
      });
      setMqIndMsg(`محفوظ ہو گیا — ہدف: ${targetRuku} رکوع`);
    } catch (e) {
      console.error('Failed to save individual miqdar:', e);
      setMqIndMsg('محفوظ کرنے میں خرابی: ' + (e.message || e));
    }
  };

  // Load Sub-tab 3: Result Entry
  const loadResultEntry = async () => {
    if (!reClassSelect) { alert('کلاس منتخب کریں'); return; }
    const students = getActiveStudentsByClass(reClassSelect);
    if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); setReStudents(null); return; }
    
    const cls = classesList.find(c => c.id === reClassSelect);

    let miqdarList = [];
    let resultsList = [];

    try {
      const [fetchedMiqdar, fetchedResults] = await Promise.all([
        fetchExamMiqdarFromSupabase({
          class_id: reClassSelect,
          term: reTermSelect,
          year: parseInt(reYear)
        }),
        fetchExamResultsFromSupabase({
          class_id: reClassSelect,
          term: reTermSelect,
          year: parseInt(reYear)
        })
      ]);
      miqdarList = (fetchedMiqdar || []).map(mapExamMiqdarToUi).filter(Boolean);
      resultsList = (fetchedResults || []).map(mapExamResultToUi).filter(Boolean);
    } catch (e) {
      console.warn('Failed to fetch from Supabase, checking local state:', e);
      miqdarList = examMiqdar.filter(m => (m.classId === reClassSelect || m.class_id === reClassSelect) && m.term === reTermSelect && String(m.year) === String(reYear));
      resultsList = examResults.filter(e => (e.classId === reClassSelect || e.class_id === reClassSelect) && e.term === reTermSelect && String(e.year) === String(reYear));
    }

    const loadedStudents = students.map(s => {
      const mq = miqdarList.find(m => (m.studentId && m.studentId === s.id) || (m.regNo && (m.regNo === s.admRegNo || m.regNo === s.roll_number)));
      const prev = resultsList.find(e => (e.studentId && e.studentId === s.id) || (e.regNo && (e.regNo === s.admRegNo || e.regNo === s.roll_number)));
      const tgt = mq ? (mq.targetRuku || 0) : 0;
      return {
        student: s,
        targetRuku: tgt,
        achievedRuku: prev ? (prev.achievedRuku !== undefined ? prev.achievedRuku : '') : '',
        pct: prev && prev.pct !== undefined ? prev.pct : null
      };
    });

    setReStudents({
      title: `${cls ? (cls.class_name || cls.name) : ''} — ${reTermSelect === 'first' ? 'پہلی' : 'دوسری'} ششماہی ${reYear}`,
      list: loadedStudents
    });
  };

  const handleResultChange = (index, value) => {
    const newList = [...reStudents.list];
    newList[index].achievedRuku = value;
    const achieved = parseInt(value) || 0;
    const target = newList[index].targetRuku || 0;
    newList[index].pct = calculatePct(achieved, target);
    setReStudents({ ...reStudents, list: newList });
  };

  const saveResultEntry = async () => {
    if (!reStudents || !reStudents.list) return;
    const year = parseInt(reYear);
    const cls = classesList.find(c => c.id === reClassSelect);
    
    const payload = reStudents.list.map(item => {
      const target = item.targetRuku || 0;
      const achieved = parseInt(item.achievedRuku) || 0;
      const pct = calculatePct(achieved, target);
      return {
        student_id: item.student.id,
        class_id: reClassSelect,
        term: reTermSelect,
        year: year,
        target_ruku: target,
        achieved_ruku: achieved,
        pct: pct,
        studentName: item.student.name || '',
        classNm: cls ? (cls.class_name || cls.name) : '',
        regNo: item.student.admRegNo
      };
    });

    try {
      await upsertExamResultsToSupabase(payload);
      // Update local state
      const updatedMapped = payload.map(p => ({
        studentId: p.student_id,
        studentName: p.studentName,
        regNo: p.regNo,
        classId: p.class_id,
        classNm: p.classNm,
        term: p.term,
        year: p.year,
        targetRuku: p.target_ruku,
        achievedRuku: p.achieved_ruku,
        pct: p.pct
      }));
      setExamResults(prev => {
        const next = [...prev];
        updatedMapped.forEach(u => {
          const idx = next.findIndex(e =>
            (u.studentId && (e.studentId === u.studentId || e.student_id === u.studentId)) ||
            (u.regNo && e.regNo === u.regNo) &&
            e.term === u.term &&
            String(e.year) === String(u.year)
          );
          if (idx >= 0) next[idx] = { ...next[idx], ...u };
          else next.push(u);
        });
        return next;
      });
      alert('رزلٹ محفوظ ہو گیا');
    } catch (e) {
      console.error('Failed to save exam results:', e);
      alert('رزلٹ محفوظ کرنے میں خرابی: ' + (e.message || e));
    }
  };

  // Sub-tab 4: Class Exam Result
  const renderClassExamResult = async () => {
    if (!crExamClass) { alert('کلاس منتخب کریں'); return; }
    const cls = classesList.find(c => c.id === crExamClass);
    const yr = parseInt(crExamYear);

    let results = [];
    try {
      const filters = {
        class_id: crExamClass,
        year: yr
      };
      if (crExamTerm !== 'annual') {
        filters.term = crExamTerm;
      }
      const fetched = await fetchExamResultsFromSupabase(filters);
      results = (fetched || []).map(mapExamResultToUi).filter(Boolean);
    } catch (e) {
      console.warn('Failed to query class exam results from Supabase, checking local:', e);
      results = examResults.filter(e => (e.classId === crExamClass || e.class_id === crExamClass) && Number(e.year) === yr);
      if (crExamTerm !== 'annual') results = results.filter(e => e.term === crExamTerm);
    }

    if (!results.length) { setCrResultsData('empty'); return; }
    const avg = results.reduce((s, r) => s + (r.pct || 0), 0) / results.length;
    setCrResultsData({ clsName: cls ? (cls.class_name || cls.name) : '', term: crExamTerm, year: yr, results, avg });
  };

  const printClassExamResult = async () => {
    if (!crResultsData || crResultsData === 'empty') {
      await renderClassExamResult();
    }
    setTimeout(() => window.print(), 100);
  };

  // Sub-tab 5: Individual Exam Result
  const renderIndividualExamResult = async () => {
    const id = indExamId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const yr = parseInt(indExamYear);
    const s = records.find(r => r.isAdmissionProfile && (String(r.admRegNo).trim() === id || String(r.roll_number || '').trim() === id || String(r.id).trim() === id));
    if (!s) { setIndResultsData('notfound'); return; }
    
    let results = [];
    try {
      const fetched = await fetchExamResultsFromSupabase({
        student_id: s.id,
        year: yr
      });
      results = (fetched || []).map(mapExamResultToUi).filter(Boolean);
    } catch (e) {
      console.warn('Failed to query individual exam results from Supabase, checking local:', e);
      results = examResults.filter(e => ((e.studentId && e.studentId === s.id) || e.regNo === id) && Number(e.year) === yr);
    }

    if (!results.length) { setIndResultsData({ empty: true, student: s, year: yr }); return; }
    
    const avg = results.reduce((sum, r) => sum + (r.pct || 0), 0) / results.length;
    setIndResultsData({ student: s, results, avg, year: yr });
  };

  const printIndividualExamResult = async () => {
    if (!indResultsData || indResultsData === 'notfound') {
      await renderIndividualExamResult();
    }
    setTimeout(() => window.print(), 100);
  };

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
                    <option key={c.id} value={c.id}>{c.name || c.className || c.class_name || c.id}</option>
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
                    <option key={c.id} value={c.id}>{c.name || c.className || c.class_name || c.id}</option>
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
                    <option key={c.id} value={c.id}>{c.name || c.className || c.class_name || c.id}</option>
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
