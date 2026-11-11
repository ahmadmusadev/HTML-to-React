import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import {
  REVERSE_PARAS_LIST,
  FIVE_PARA_REVIEW_SLOTS,
  calculateDaysTaken,
  createInitialParasArray,
  createInitialReviewsArray
} from '../utils/paraRecordsConstants';
import './StudentParaRecords.css';

export default function StudentParaRecords() {
  const {
    activeMadrasa,
    activeMadrasaId,
    loadMadrasaData,
    fetchClassesFromSupabase,
    fetchStudentsFromSupabase,
    fetchStudentParaRecordFromSupabase,
    saveStudentParaRecordToSupabase
  } = useMadrasa();

  // State
  const [classesList, setClassesList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Mid-Hifz Transfer State
  const [isMidHifz, setIsMidHifz] = useState(false);
  const [startingPara, setStartingPara] = useState(30);
  const [priorMadrasaName, setPriorMadrasaName] = useState('');
  const [priorParasCount, setPriorParasCount] = useState(0);
  const [priorParasNote, setPriorParasNote] = useState('');

  // 30 Paras & 6 Reviews State
  const [paras, setParas] = useState(() => createInitialParasArray());
  const [reviews, setReviews] = useState(() => createInitialReviewsArray());
  const [completionStatus, setCompletionStatus] = useState('in_progress'); // 'in_progress' | 'completed'
  const [completionDate, setCompletionDate] = useState('');

  // UI state
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null); // { type: 'success' | 'error' | 'info', text: '' }

  // Auto-Save State & Refs
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState('');
  const isLoadedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // 1. Initial Load of Classes & Students
  useEffect(() => {
    let isMounted = true;
    const loadClassesAndStudents = async () => {
      try {
        const [clsData, stdsData] = await Promise.all([
          fetchClassesFromSupabase ? fetchClassesFromSupabase(activeMadrasaId).catch(() => null) : null,
          fetchStudentsFromSupabase ? fetchStudentsFromSupabase(activeMadrasaId).catch(() => null) : null
        ]);

        if (!isMounted) return;

        if (clsData && Array.isArray(clsData)) {
          setClassesList(clsData);
        } else {
          const stored = loadMadrasaData ? loadMadrasaData('hf_classes_v1', activeMadrasaId) : null;
          if (Array.isArray(stored)) setClassesList(stored);
        }

        if (stdsData && Array.isArray(stdsData)) {
          // Keep active/enrolled students
          const valid = stdsData.filter(s => s && s.name && s.status !== 'withdrawn');
          setStudentsList(valid);
        } else {
          const stored = loadMadrasaData ? loadMadrasaData('hf_records_v1', activeMadrasaId) : null;
          const recs = (stored?.records || []).filter(r => r.isAdmissionProfile && r.status !== 'withdrawn');
          setStudentsList(recs);
        }
      } catch (err) {
        console.warn('Error loading classes/students in StudentParaRecords:', err);
      }
    };

    loadClassesAndStudents();
    return () => {
      isMounted = false;
    };
  }, [activeMadrasaId]);

  // Filter students by selected class and search query
  const filteredStudents = useMemo(() => {
    return studentsList.filter(s => {
      // Class filter
      if (selectedClassId) {
        const cId = s.class_id || s.classId;
        const cName = s.class_name || s.className;
        if (cId !== selectedClassId && cName !== selectedClassId) {
          return false;
        }
      }

      // Search query filter (by name, roll/reg number, or father's name)
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.trim().toLowerCase();
        const name = (s.name || s.admName || '').toLowerCase();
        const roll = String(s.roll_number || s.admRegNo || '').toLowerCase();
        const father = (s.father_name || s.admFatherName || '').toLowerCase();
        if (!name.includes(q) && !roll.includes(q) && !father.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [studentsList, selectedClassId, studentSearchQuery]);

  // 2. When a student is selected, fetch their record
  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedStudent(null);
      resetForm();
      return;
    }

    const currentStudent = studentsList.find(s => (s.id || s.roll_number) === selectedStudentId);
    setSelectedStudent(currentStudent || null);

    let isMounted = true;
    const loadStudentRecord = async () => {
      setLoadingData(true);
      setAlertMsg(null);
      isLoadedRef.current = false;
      isDirtyRef.current = false;
      setAutoSaveStatus('idle');

      try {
        let record = null;
        if (fetchStudentParaRecordFromSupabase) {
          record = await fetchStudentParaRecordFromSupabase(selectedStudentId, activeMadrasaId);
        }

        if (!isMounted) return;

        if (record) {
          setIsMidHifz(!!record.is_mid_hifz);
          setStartingPara(record.starting_para !== undefined ? record.starting_para : 30);
          setPriorMadrasaName(record.prior_madrasa_name || '');
          setPriorParasCount(record.prior_paras_count || 0);
          setPriorParasNote(record.prior_paras_note || '');
          setCompletionStatus(record.completion_status || 'in_progress');
          setCompletionDate(record.completion_date || '');

          // Merge paras safely with template
          const templateParas = createInitialParasArray();
          const savedParas = Array.isArray(record.paras) ? record.paras : [];
          const mergedParas = templateParas.map(tp => {
            const found = savedParas.find(sp => sp.serialNo === tp.serialNo || sp.paraNumber === tp.paraNumber);
            return found ? { ...tp, ...found } : tp;
          });
          setParas(mergedParas);

          // Merge reviews safely with template
          const templateReviews = createInitialReviewsArray();
          const savedReviews = Array.isArray(record.reviews) ? record.reviews : [];
          const mergedReviews = templateReviews.map(tr => {
            const found = savedReviews.find(sr => sr.slot === tr.slot);
            return found ? { ...tr, ...found } : tr;
          });
          setReviews(mergedReviews);

          if (record.saved_at || record.updated_at) {
            const d = new Date(record.saved_at || record.updated_at);
            if (!isNaN(d.getTime())) {
              setLastSavedTime(d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
            }
          }
        } else {
          // Fresh record
          resetForm();
        }

        // Allow React state updates to commit before enabling auto-save listener
        setTimeout(() => {
          if (isMounted) {
            isLoadedRef.current = true;
            isDirtyRef.current = false;
            setAutoSaveStatus('saved');
          }
        }, 120);
      } catch (err) {
        console.warn('Error loading student para record:', err);
        setAlertMsg({ type: 'error', text: 'طالب علم کا سابقہ ریکارڈ لوڈ کرنے میں خرابی پیش آئی۔' });
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };

    loadStudentRecord();
    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedStudentId, studentsList, activeMadrasaId]);

  const resetForm = () => {
    setIsMidHifz(false);
    setStartingPara(30);
    setPriorMadrasaName('');
    setPriorParasCount(0);
    setPriorParasNote('');
    setParas(createInitialParasArray());
    setReviews(createInitialReviewsArray());
    setCompletionStatus('in_progress');
    setCompletionDate('');
    isDirtyRef.current = false;
    setAutoSaveStatus('idle');
  };

  // 3. Handle Para Field Changes
  const handleParaChange = (serialNo, field, value) => {
    isDirtyRef.current = true;
    setAutoSaveStatus('saving');

    setParas(prev => {
      return prev.map(p => {
        if (p.serialNo !== serialNo) return p;

        const updated = { ...p, [field]: value };

        // Auto-calculate days taken if start date or end date changed
        if (field === 'startDate' || field === 'endDate') {
          const start = field === 'startDate' ? value : updated.startDate;
          const end = field === 'endDate' ? value : updated.endDate;
          if (start && end) {
            const days = calculateDaysTaken(start, end);
            updated.daysTaken = days !== '' ? days : updated.daysTaken;
          }
        }

        return updated;
      });
    });
  };

  // 4. Handle Review Field Changes
  const handleReviewChange = (slot, field, value) => {
    isDirtyRef.current = true;
    setAutoSaveStatus('saving');

    setReviews(prev => {
      return prev.map(r => {
        if (r.slot !== slot) return r;
        return { ...r, [field]: value };
      });
    });
  };

  // 5. Auto-mark prior paras if student joined mid-hifz
  const handleAutoMarkPriorParas = () => {
    if (!isMidHifz) {
      alert('پہلے منتقلی کی تفصیلات منتخب کریں۔');
      return;
    }

    isDirtyRef.current = true;
    setAutoSaveStatus('saving');

    const startParaNum = Number(startingPara);
    // In reverse order, paras greater than startParaNum were memorized at prior madrasa
    // E.g., if student starts at Para 25, then paras 30, 29, 28, 27, 26 were at prior madrasa
    setParas(prev => {
      return prev.map(p => {
        if (p.paraNumber > startParaNum) {
          return {
            ...p,
            isPriorMadrasa: true,
            shortReport: p.shortReport || 'سابقہ مدرسہ میں مکمل شدہ'
          };
        } else {
          return {
            ...p,
            isPriorMadrasa: false
          };
        }
      });
    });

    setAlertMsg({
      type: 'info',
      text: `پارہ 30 تا ${startParaNum + 1} کو سابقہ مدرسے کے مکمل شدہ پارے کے طور پر نشان زد کر دیا گیا ہے۔`
    });
  };

  // 6. Summary Stats Calculations
  const stats = useMemo(() => {
    let completedCount = 0;
    let thisMadrasaCompleted = 0;
    let priorCompleted = 0;
    let totalDays = 0;

    paras.forEach(p => {
      const hasFinished = !!p.endDate || !!p.examDate || p.isPriorMadrasa;
      if (hasFinished) {
        completedCount++;
        if (p.isPriorMadrasa) {
          priorCompleted++;
        } else {
          thisMadrasaCompleted++;
        }
      }
      if (p.daysTaken && !isNaN(Number(p.daysTaken))) {
        totalDays += Number(p.daysTaken);
      }
    });

    return {
      completedCount,
      thisMadrasaCompleted,
      priorCompleted,
      totalDays,
      isFullyCompleted: completedCount === 30
    };
  }, [paras]);

  // 7. Auto-Save Effect (Debounced background sync & instant local cache)
  useEffect(() => {
    if (!selectedStudentId || !isLoadedRef.current || !isDirtyRef.current) {
      return;
    }

    // 1. Instant Local Storage Sync so no single change is lost
    try {
      const localStore = loadMadrasaData ? (loadMadrasaData('hf_student_para_records_v1', activeMadrasaId) || {}) : {};
      localStore[selectedStudentId] = {
        student_id: selectedStudentId,
        is_mid_hifz: isMidHifz,
        starting_para: Number(startingPara),
        prior_madrasa_name: priorMadrasaName.trim(),
        prior_paras_count: Number(priorParasCount) || 0,
        prior_paras_note: priorParasNote.trim(),
        paras: paras,
        reviews: reviews,
        completion_status: stats.isFullyCompleted ? 'completed' : completionStatus,
        completion_date: completionDate || (stats.isFullyCompleted ? new Date().toISOString().split('T')[0] : null),
        saved_at: new Date().toISOString()
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`hf_student_para_records_v1_madrasa_${activeMadrasaId}`, JSON.stringify(localStore));
      }
    } catch (e) {}

    // 2. Debounced Remote Supabase Upsert
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          student_id: selectedStudentId,
          is_mid_hifz: isMidHifz,
          starting_para: Number(startingPara),
          prior_madrasa_name: priorMadrasaName.trim(),
          prior_paras_count: Number(priorParasCount) || 0,
          prior_paras_note: priorParasNote.trim(),
          paras: paras,
          reviews: reviews,
          completion_status: stats.isFullyCompleted ? 'completed' : completionStatus,
          completion_date: completionDate || (stats.isFullyCompleted ? new Date().toISOString().split('T')[0] : null)
        };

        if (saveStudentParaRecordToSupabase) {
          await saveStudentParaRecordToSupabase(payload, activeMadrasaId);
        }

        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        setLastSavedTime(timeStr);
      } catch (err) {
        console.warn('Auto-save background sync error:', err);
        setAutoSaveStatus('error');
      }
    }, 750);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [paras, reviews, isMidHifz, startingPara, priorMadrasaName, priorParasCount, priorParasNote, completionStatus, completionDate, selectedStudentId, activeMadrasaId, stats.isFullyCompleted]);

  // Immediate Save on Blur or Field Completion
  const handleFlushSave = async () => {
    if (!selectedStudentId || !isDirtyRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    try {
      setAutoSaveStatus('saving');
      const payload = {
        student_id: selectedStudentId,
        is_mid_hifz: isMidHifz,
        starting_para: Number(startingPara),
        prior_madrasa_name: priorMadrasaName.trim(),
        prior_paras_count: Number(priorParasCount) || 0,
        prior_paras_note: priorParasNote.trim(),
        paras: paras,
        reviews: reviews,
        completion_status: stats.isFullyCompleted ? 'completed' : completionStatus,
        completion_date: completionDate || (stats.isFullyCompleted ? new Date().toISOString().split('T')[0] : null)
      };
      if (saveStudentParaRecordToSupabase) {
        await saveStudentParaRecordToSupabase(payload, activeMadrasaId);
      }
      isDirtyRef.current = false;
      setAutoSaveStatus('saved');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setLastSavedTime(timeStr);
    } catch (err) {
      console.warn('Immediate save on blur error:', err);
      setAutoSaveStatus('error');
    }
  };

  // 8. Manual Save Handler
  const handleSave = async () => {
    if (!selectedStudentId) {
      setAlertMsg({ type: 'error', text: 'برائے مہربانی پہلے طالب علم منتخب کریں۔' });
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaving(true);
    setAlertMsg(null);
    try {
      const recordPayload = {
        student_id: selectedStudentId,
        is_mid_hifz: isMidHifz,
        starting_para: Number(startingPara),
        prior_madrasa_name: priorMadrasaName.trim(),
        prior_paras_count: Number(priorParasCount) || 0,
        prior_paras_note: priorParasNote.trim(),
        paras: paras,
        reviews: reviews,
        completion_status: stats.isFullyCompleted ? 'completed' : completionStatus,
        completion_date: completionDate || (stats.isFullyCompleted ? new Date().toISOString().split('T')[0] : null)
      };

      if (saveStudentParaRecordToSupabase) {
        await saveStudentParaRecordToSupabase(recordPayload, activeMadrasaId);
      }

      isDirtyRef.current = false;
      setAutoSaveStatus('saved');
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setLastSavedTime(timeStr);

      setAlertMsg({ type: 'success', text: 'طالب علم کا پارہ بہ پارہ ریکارڈ کامیابی کے ساتھ محفوظ ہو گیا ہے۔' });
    } catch (err) {
      console.error('Error saving student para record:', err);
      setAutoSaveStatus('error');
      setAlertMsg({ type: 'error', text: 'ریکارڈ محفوظ کرنے میں خرابی: ' + (err.message || err) });
    } finally {
      setSaving(false);
    }
  };

  // 8. Print Handler
  const handlePrint = () => {
    window.print();
  };

  // 9. Reset with confirmation
  const handleResetConfirm = () => {
    if (window.confirm('کیا آپ تمام درج شدہ معلومات صاف کرنا چاہتے ہیں؟')) {
      resetForm();
      setAlertMsg({ type: 'info', text: 'تمام فیلڈز صاف کر دی گئی ہیں۔' });
    }
  };

  return (
    <div className="para-records-container">
      {/* Printable Header (Visible Only in Print) */}
      <div className="print-only-header">
        <h1 className="print-madrasa-name">{activeMadrasa?.name || 'جامعہ / مدرسہ'}</h1>
        <h2 className="print-document-title">پارہ بہ پارہ تکمیلِ حفظ و تفصیلی جائزہ</h2>
        <div className="print-student-info-box">
          <div className="print-student-info-item">
            <b>نام طالب علم:</b>
            <span>{selectedStudent?.name || selectedStudent?.admName || '—'}</span>
          </div>
          <div className="print-student-info-item">
            <b>ولدیت:</b>
            <span>{selectedStudent?.father_name || selectedStudent?.admFatherName || '—'}</span>
          </div>
          <div className="print-student-info-item">
            <b>رول نمبر:</b>
            <span>{selectedStudent?.roll_number || selectedStudent?.admRegNo || '—'}</span>
          </div>
          <div className="print-student-info-item">
            <b>کلاس:</b>
            <span>{selectedStudent?.class_name || selectedStudent?.className || '—'}</span>
          </div>
        </div>
        {isMidHifz && (
          <div style={{ textAlign: 'right', fontSize: '9pt', marginBottom: '8px', padding: '4px', border: '1px solid #333' }}>
            <b>سابقہ تعلیمی کیفیت:</b> طالب علم کا داخلہ درمیانِ حفظ میں ہوا۔ سابقہ مدرسہ: {priorMadrasaName || '—'} | مکمل شدہ پارے: {priorParasCount || '0'} | اس مدرسے میں آغاز پارہ: {startingPara}
          </div>
        )}
      </div>

      {/* Screen Header */}
      <div className="para-records-header no-print">
        <h2>پارہ بہ پارہ تکمیلِ حفظ و تفصیلی جائزہ</h2>
        <p>طالب علم کے ہر پارے کے آغاز و اختتام، ایام، جائزہ اور ہر 5 پارے پر تفصیلی جائزے کا باضابطہ ریکارڈ</p>
      </div>

      {/* Alerts */}
      {alertMsg && (
        <div className={`para-records-alert para-records-alert-${alertMsg.type} no-print`}>
          {alertMsg.text}
        </div>
      )}

      {/* Student & Class Selection Card */}
      <div className="para-records-card no-print">
        <h3 className="para-records-card-title">طالب علم کا انتخاب</h3>
        <div className="para-records-grid">
          {/* 1. Class Dropdown */}
          <div className="para-records-field">
            <label htmlFor="paraClassSelect">کلاس منتخب کریں</label>
            <select
              id="paraClassSelect"
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                setSelectedStudentId('');
              }}
            >
              <option value="">تمام کلاسز</option>
              {classesList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.class_name || c.className || c.id}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Registration / Roll Number Dropdown */}
          <div className="para-records-field">
            <label htmlFor="paraRegSelect">رجسٹریشن / رول نمبر سے انتخاب</label>
            <select
              id="paraRegSelect"
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
            >
              <option value="">رجسٹریشن نمبر منتخب کریں...</option>
              {filteredStudents
                .filter(s => s.roll_number || s.admRegNo)
                .sort((a, b) => {
                  const rA = parseInt(a.roll_number || a.admRegNo, 10);
                  const rB = parseInt(b.roll_number || b.admRegNo, 10);
                  if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
                  return String(a.roll_number || a.admRegNo).localeCompare(String(b.roll_number || b.admRegNo));
                })
                .map(s => {
                  const id = s.id || s.roll_number;
                  const roll = s.roll_number || s.admRegNo;
                  const name = s.name || s.admName;
                  return (
                    <option key={`reg-${id}`} value={id}>
                      {roll} — {name}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* 3. Student Name Dropdown */}
          <div className="para-records-field">
            <label htmlFor="paraStudentSelect">نام سے طالب علم منتخب کریں</label>
            <select
              id="paraStudentSelect"
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
            >
              <option value="">نام سے انتخاب کریں...</option>
              {filteredStudents
                .slice()
                .sort((a, b) => (a.name || a.admName || '').localeCompare(b.name || b.admName || ''))
                .map(s => {
                  const id = s.id || s.roll_number;
                  const name = s.name || s.admName;
                  const roll = s.roll_number || s.admRegNo || '—';
                  return (
                    <option key={`name-${id}`} value={id}>
                      {name} ({roll})
                    </option>
                  );
                })}
            </select>
          </div>
        </div>

        {/* Live Search Box */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="para-table-input"
              placeholder="فوری تلاش: بچے کا نام یا رجسٹریشن نمبر لکھیں..."
              value={studentSearchQuery}
              onChange={e => setStudentSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.9rem' }}
            />
          </div>
          {studentSearchQuery && (
            <button
              type="button"
              className="para-btn para-btn-secondary"
              onClick={() => setStudentSearchQuery('')}
              style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            >
              صاف کریں
            </button>
          )}
        </div>

        {/* Selected Student Details Strip */}
        {selectedStudent && (
          <div className="para-records-student-strip">
            <div className="para-records-student-item">
              <span className="para-records-student-label">نام طالب علم:</span>
              <span className="para-records-student-val">{selectedStudent.name || selectedStudent.admName}</span>
            </div>
            <div className="para-records-student-item">
              <span className="para-records-student-label">ولدیت:</span>
              <span className="para-records-student-val">{selectedStudent.father_name || selectedStudent.admFatherName || '—'}</span>
            </div>
            <div className="para-records-student-item">
              <span className="para-records-student-label">رول نمبر:</span>
              <span className="para-records-student-val">{selectedStudent.roll_number || selectedStudent.admRegNo || '—'}</span>
            </div>
            <div className="para-records-student-item">
              <span className="para-records-student-label">کلاس:</span>
              <span className="para-records-student-val">{selectedStudent.class_name || selectedStudent.className || '—'}</span>
            </div>
            <div className="para-records-student-item">
              <span className="para-records-student-label">آغازِ حفظ:</span>
              <span className="para-records-student-val">{selectedStudent.hifz_start_date || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mid-Hifz Transfer / Prior Madrasa Card */}
      {selectedStudent && (
        <div className="para-records-card no-print">
          <div
            className="para-records-checkbox-row"
            onClick={() => {
              const nextVal = !isMidHifz;
              setIsMidHifz(nextVal);
              isDirtyRef.current = true;
              setAutoSaveStatus('saving');
            }}
          >
            <input
              type="checkbox"
              id="isMidHifzCheckbox"
              checked={isMidHifz}
              onChange={e => {
                setIsMidHifz(e.target.checked);
                isDirtyRef.current = true;
                setAutoSaveStatus('saving');
              }}
              onClick={e => e.stopPropagation()}
            />
            <label htmlFor="isMidHifzCheckbox">
              طالب علم کا داخلہ درمیانِ حفظ میں ہوا ہے (سابقہ مدرسے سے منتقلی)
            </label>
          </div>

          {isMidHifz && (
            <div style={{ marginTop: '14px' }}>
              <div className="para-records-grid">
                <div className="para-records-field">
                  <label htmlFor="priorMadrasaNameInput">سابقہ مدرسے کا نام</label>
                  <input
                    type="text"
                    id="priorMadrasaNameInput"
                    placeholder="مثلاً: جامعہ دارالعلوم..."
                    value={priorMadrasaName}
                    onChange={e => {
                      setPriorMadrasaName(e.target.value);
                      isDirtyRef.current = true;
                      setAutoSaveStatus('saving');
                    }}
                    onBlur={handleFlushSave}
                  />
                </div>

                <div className="para-records-field">
                  <label htmlFor="priorParasCountInput">سابقہ مدرسے میں مکمل شدہ پارے</label>
                  <input
                    type="number"
                    id="priorParasCountInput"
                    min="1"
                    max="29"
                    placeholder="تعداد پارے"
                    value={priorParasCount || ''}
                    onChange={e => {
                      setPriorParasCount(e.target.value);
                      isDirtyRef.current = true;
                      setAutoSaveStatus('saving');
                    }}
                    onBlur={handleFlushSave}
                  />
                </div>

                <div className="para-records-field">
                  <label htmlFor="startingParaSelect">اس مدرسے میں آغاز پارہ</label>
                  <select
                    id="startingParaSelect"
                    value={startingPara}
                    onChange={e => {
                      setStartingPara(Number(e.target.value));
                      isDirtyRef.current = true;
                      setAutoSaveStatus('saving');
                    }}
                    onBlur={handleFlushSave}
                  >
                    {REVERSE_PARAS_LIST.map(p => (
                      <option key={p.paraNumber} value={p.paraNumber}>
                        پارہ {p.paraNumber} ({p.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="para-records-field" style={{ marginTop: '12px' }}>
                <label htmlFor="priorParasNoteInput">سابقہ تعلیمی کیفیت / وضاحتی نوٹ</label>
                <input
                  type="text"
                  id="priorParasNoteInput"
                  placeholder="سابقہ مدرسے سے منتقلی کی تفصیلات یا تصدیق..."
                  value={priorParasNote}
                  onChange={e => {
                    setPriorParasNote(e.target.value);
                    isDirtyRef.current = true;
                    setAutoSaveStatus('saving');
                  }}
                  onBlur={handleFlushSave}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="para-btn para-btn-secondary"
                  onClick={handleAutoMarkPriorParas}
                >
                  سابقہ پارے خودکار نشان زد کریں
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Statistics Bar */}
      {selectedStudent && (
        <div className="para-records-stats no-print">
          <div className="para-records-stat-box">
            <div className="para-records-stat-num">{stats.completedCount} / 30</div>
            <div className="para-records-stat-label">کل مکمل شدہ پارے</div>
          </div>
          <div className="para-records-stat-box">
            <div className="para-records-stat-num">{stats.thisMadrasaCompleted}</div>
            <div className="para-records-stat-label">اس مدرسے میں مکمل</div>
          </div>
          {isMidHifz && (
            <div className="para-records-stat-box">
              <div className="para-records-stat-num">{stats.priorCompleted}</div>
              <div className="para-records-stat-label">سابقہ مدرسے میں مکمل</div>
            </div>
          )}
          <div className="para-records-stat-box">
            <div className="para-records-stat-num">{stats.totalDays}</div>
            <div className="para-records-stat-label">کل ایامِ صرف</div>
          </div>
          <div className="para-records-stat-box">
            <div className="para-records-stat-num">
              {stats.isFullyCompleted ? (
                <span style={{ color: 'var(--success, #1a6b3c)' }}>حفظ مکمل</span>
              ) : (
                <span style={{ color: 'var(--accent, #0d3b66)' }}>جاری ہے</span>
              )}
            </div>
            <div className="para-records-stat-label">حالتِ حفظ</div>
          </div>
        </div>
      )}

      {/* Mid-Hifz Completion Certificate Notice if Applicable */}
      {isMidHifz && stats.isFullyCompleted && (
        <div className="para-records-alert para-records-alert-success">
          <b>تکمیلِ حفظِ قرآنِ کریم وضاحتی سند:</b> طالب علم نے ابتدائی {priorParasCount || '—'} پارے سابقہ مدرسہ ({priorMadrasaName || 'سابقہ مدرسہ'}) میں مکمل کیے اور بقیہ پارے اس مدرسے میں بحسن و خوبی مکمل کیے۔
        </div>
      )}

      {/* Auto-Save Status Ambient Bar */}
      {selectedStudent && (
        <div className="para-records-autosave-bar no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text)' }}>خودکار سیو:</span>
            {autoSaveStatus === 'saving' && (
              <span className="auto-save-pill auto-save-saving">
                تبدیلیاں خودکار محفوظ کی جا رہی ہیں...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="auto-save-pill auto-save-saved">
                تمام تبدیلیاں خودکار محفوظ ہیں {lastSavedTime ? `(آخری بار: ${lastSavedTime})` : ''}
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="auto-save-pill auto-save-error">
                لوکل محفوظ ہے، سرور پر سیو کی کوشش جاری ہے...
              </span>
            )}
            {autoSaveStatus === 'idle' && (
              <span className="auto-save-pill auto-save-saved">
                تمام تبدیلیاں محفوظ ہیں
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            تاریخ یا کسی بھی خانے میں چھوٹی سے چھوٹی تبدیلی خود بخود محفوظ ہو جاتی ہے۔
          </div>
        </div>
      )}

      {/* 30-Para Table with Every-5-Para Detailed Review Rows */}
      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
          طالب علم کا ریکارڈ لوڈ ہو رہا ہے...
        </div>
      ) : !selectedStudent ? (
        <div className="para-records-card" style={{ textAlign: 'center', padding: '35px', color: 'var(--muted)' }}>
          ریکارڈ دیکھنے یا اندراج کے لیے اوپر سے طالب علم منتخب کریں۔
        </div>
      ) : (
        <div className="para-records-table-wrap">
          <table className="para-records-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>نمبر شمار</th>
                <th style={{ width: '85px' }}>نام پارہ</th>
                <th style={{ width: '105px' }}>آغاز پارہ</th>
                <th style={{ width: '105px' }}>اختتام پارہ</th>
                <th style={{ width: '55px', textAlign: 'center' }}>ایام لگے</th>
                <th style={{ width: '105px' }}>تاریخ جائزہ</th>
                <th style={{ width: '105px' }}>نام ممتحن</th>
                <th style={{ minWidth: '260px' }}>مختصر رپورٹ</th>
              </tr>
            </thead>
            <tbody>
              {paras.map((p, index) => {
                const serial = p.serialNo;
                // Find if there is a 5-para review slot after this serial
                const reviewSlot = FIVE_PARA_REVIEW_SLOTS.find(r => r.afterSerial === serial);
                const reviewData = reviewSlot
                  ? reviews.find(rv => rv.slot === reviewSlot.slot) || {}
                  : null;

                return (
                  <React.Fragment key={`para-row-${p.serialNo}`}>
                    {/* Para Row */}
                    <tr className={p.isPriorMadrasa ? 'prior-madrasa-row' : ''}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {p.serialNo}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <b>{p.paraName}</b>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          پارہ {p.paraNumber}
                          {p.isPriorMadrasa && (
                            <span className="para-badge para-badge-prior" style={{ marginRight: '4px' }}>
                              سابقہ
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="date"
                          className="para-table-date-input"
                          value={p.startDate || ''}
                          onChange={e => handleParaChange(p.serialNo, 'startDate', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="para-table-date-input"
                          value={p.endDate || ''}
                          onChange={e => handleParaChange(p.serialNo, 'endDate', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="para-table-num-input"
                          value={p.daysTaken || ''}
                          onChange={e => handleParaChange(p.serialNo, 'daysTaken', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="para-table-date-input"
                          value={p.examDate || ''}
                          onChange={e => handleParaChange(p.serialNo, 'examDate', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="para-table-input"
                          style={{ fontSize: '0.84rem', padding: '4px 6px' }}
                          placeholder="نام ممتحن..."
                          value={p.examinerName || ''}
                          onChange={e => handleParaChange(p.serialNo, 'examinerName', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          list="shortReportPhrases"
                          className="para-table-report-input"
                          placeholder="مثلاً: یادداشت بہتر ہے، تجوید میں بہتری ضروری ہے..."
                          value={p.shortReport || ''}
                          onChange={e => handleParaChange(p.serialNo, 'shortReport', e.target.value)}
                          onBlur={handleFlushSave}
                        />
                      </td>
                    </tr>

                    {/* Every 5 Paras Detailed Evaluation Block */}
                    {reviewSlot && (
                      <tr className="para-review-row">
                        <td colSpan="8">
                          <div className="para-review-card">
                            <div className="para-review-header">
                              <h4 className="para-review-title">{reviewSlot.title}</h4>
                              <div className="para-review-meta">
                                <label>
                                  <span>تاریخ جائزہ:</span>
                                  <input
                                    type="date"
                                    value={reviewData?.reviewDate || ''}
                                    onChange={e => handleReviewChange(reviewSlot.slot, 'reviewDate', e.target.value)}
                                    onBlur={handleFlushSave}
                                  />
                                </label>
                                <label>
                                  <span>نام ممتحن / ناظم:</span>
                                  <input
                                    type="text"
                                    placeholder="نام ممتحن..."
                                    value={reviewData?.examinerName || ''}
                                    onChange={e => handleReviewChange(reviewSlot.slot, 'examinerName', e.target.value)}
                                    onBlur={handleFlushSave}
                                  />
                                </label>
                              </div>
                            </div>

                            {/* 2-line Ruled Evaluation Notes */}
                            <div className="para-review-notes-container">
                              <label className="para-review-notes-label no-print">
                                تفصیلی جائزہ و کیفیات (2 سطور میں اردو تفصیل لکھیں):
                              </label>
                              {/* Screen View: Ruled Textarea */}
                              <textarea
                                className="para-review-textarea no-print"
                                rows="2"
                                placeholder="طالب علم کی تجوید، لہجہ، یادداشت اور تفصیلی کیفیت یہاں دو سطور میں تحریر کریں..."
                                value={reviewData?.detailedNotes || ''}
                                onChange={e => handleReviewChange(reviewSlot.slot, 'detailedNotes', e.target.value)}
                                onBlur={handleFlushSave}
                              />
                              {/* Print View: Two Ruled Lines */}
                              <div className="print-ruled-lines">
                                <div className="print-ruled-line">
                                  {reviewData?.detailedNotes ? reviewData.detailedNotes.split('\n')[0] : ''}
                                </div>
                                <div className="print-ruled-line">
                                  {reviewData?.detailedNotes && reviewData.detailedNotes.split('\n')[1]
                                    ? reviewData.detailedNotes.split('\n')[1]
                                    : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Quick Suggestions for Short Report */}
          <datalist id="shortReportPhrases">
            <option value="یادداشت بہترین ہے" />
            <option value="یادداشت بہتر ہے" />
            <option value="یادداشت پر گرفت کریں" />
            <option value="تجوید میں بہتری ضروری ہے" />
            <option value="روانی اور مخارج معیاری ہیں" />
            <option value="تکرار اور دور پر زیادہ توجہ دیں" />
            <option value="سابقہ مدرسہ میں مکمل شدہ" />
          </datalist>
        </div>
      )}

      {/* Printable Signatures Footer (Print View Only) */}
      <div className="print-signatures-footer">
        <div className="print-signature-block">
          <div className="print-signature-line"></div>
          <span>دستخط ممتحن</span>
        </div>
        <div className="print-signature-block">
          <div className="print-signature-line"></div>
          <span>دستخط استاد / نگران</span>
        </div>
        <div className="print-signature-block">
          <div className="print-signature-line"></div>
          <span>دستخط مہتمم / ناظم تعلیمات</span>
        </div>
      </div>

      {/* Action Buttons (Screen View Only) */}
      {selectedStudent && (
        <div className="para-records-actions no-print">
          <button
            type="button"
            className="para-btn para-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'محفوظ ہو رہا ہے...' : 'محفوظ کریں'}
          </button>

          <button
            type="button"
            className="para-btn para-btn-success"
            onClick={handlePrint}
          >
            پرنٹ / پی ڈی ایف
          </button>

          <button
            type="button"
            className="para-btn para-btn-secondary"
            onClick={handleResetConfirm}
          >
            صاف کریں
          </button>
        </div>
      )}
    </div>
  );
}

