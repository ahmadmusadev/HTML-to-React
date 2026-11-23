import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { DEFAULT_CLASSES } from '../constants/defaults';
import PrintPortal from './PrintPortal';
import { parseDailyPerformanceSheet, fileToBase64 } from '../utils/dailyPerformanceSheetOcr';
import DailyPerformanceReport from './DailyPerformanceReport';
import './DailyAcademicPerformance.css';

const mapStudentToUi = (s) => {
  if (!s) return null;
  return {
    id: s.id,
    name: s.name || s.admName || '',
    father_name: s.father_name || s.admFatherName || '',
    roll_number: s.roll_number || s.admRegNo || '',
    admRegNo: s.roll_number || s.admRegNo || '',
    class_id: s.class_id || s.admClass || '',
    admClass: s.class_id || s.admClass || '',
    status: s.status || s.admStatus || 'enrolled',
    admStatus: s.status || s.admStatus || 'enrolled',
    isWithdrawn: s.isWithdrawn || false
  };
};

const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

const PRESET_KAIFIYAT = [
  'بہترین',
  'مناسب',
  'روانی کمزور',
  'توجہ طلب'
];

export default function DailyAcademicPerformance({ initialView = 'entry' }) {
  const {
    activeMadrasaId,
    activeMadrasa,
    classesList: contextClassesList,
    fetchClassesFromSupabase,
    fetchStudentsFromSupabase,
    fetchDailyAcademicRecordsFromSupabase,
    saveDailyAcademicRecordsToSupabase
  } = useMadrasa();

  const [activeView, setActiveView] = useState(initialView);

  useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
    }
  }, [initialView]);

  const todayStr = new Date().toISOString().split('T')[0];

  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [allStudents, setAllStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Daily records map: { [studentId]: recordData }
  const [recordsMap, setRecordsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('success');
  const [isPrinting, setIsPrinting] = useState(false);

  // AI Vision OCR Sheet Scanner states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [userApiKey, setUserApiKey] = useState(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem('gemini_vision_api_key') || '') : '';
  });
  const fileInputRef = useRef(null);

  // Revoke object URL on change or unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // 1. Load Classes Once when activeMadrasaId changes
  useEffect(() => {
    let isMounted = true;
    const loadClasses = async () => {
      try {
        const cls = fetchClassesFromSupabase
          ? await fetchClassesFromSupabase(activeMadrasaId)
          : null;
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
        const fallback = Array.isArray(contextClassesList) && contextClassesList.length > 0
          ? contextClassesList
          : DEFAULT_CLASSES;
        setAvailableClasses(fallback);
        setSelectedClassId(prev => prev || fallback[0].id || '');
      }
    };

    loadClasses();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // Sync availableClasses with contextClassesList if updated externally
  useEffect(() => {
    if (Array.isArray(contextClassesList) && contextClassesList.length > 0) {
      setAvailableClasses(contextClassesList);
      setSelectedClassId(prev => prev || contextClassesList[0].id || contextClassesList[0].name || '');
    }
  }, [contextClassesList]);

  // 2. Load Students Once when activeMadrasaId changes
  useEffect(() => {
    let isMounted = true;
    const loadStudents = async () => {
      try {
        if (fetchStudentsFromSupabase) {
          const raw = await fetchStudentsFromSupabase(activeMadrasaId);
          if (isMounted && Array.isArray(raw)) {
            const mapped = raw.map(mapStudentToUi).filter(Boolean);
            setAllStudents(mapped);
          }
        }
      } catch (e) {
        console.warn('Failed to load students in DailyAcademicPerformance:', e);
      }
    };

    loadStudents();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // 3. Robust Class Students Matching (supports UUIDs, Name, Class_name)
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

  // Filtered by search query if any
  const displayedStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.trim().toLowerCase();
    return classStudents.filter(s => {
      const name = (s.name || s.admName || '').toLowerCase();
      const father = (s.father_name || s.admFatherName || '').toLowerCase();
      const roll = String(s.admRegNo || s.roll_number || '').toLowerCase();
      return name.includes(q) || father.includes(q) || roll.includes(q);
    });
  }, [classStudents, searchQuery]);

  // Current selected class object
  const currentClassObj = useMemo(() => {
    return availableClasses.find(c =>
      String(c.id) === String(selectedClassId) ||
      c.name === selectedClassId ||
      c.class_name === selectedClassId
    ) || null;
  }, [availableClasses, selectedClassId]);

  // 4. Load Existing Records for Selected Class and Date (stable trigger)
  useEffect(() => {
    let isMounted = true;
    if (!selectedClassId || !selectedDate) return;

    const loadExistingRecords = async () => {
      setLoading(true);
      setStatusMessage(null);
      try {
        if (fetchDailyAcademicRecordsFromSupabase) {
          const existing = await fetchDailyAcademicRecordsFromSupabase({
            date: selectedDate,
            classId: selectedClassId
          }, activeMadrasaId);

          if (isMounted) {
            const newMap = {};
            if (Array.isArray(existing) && existing.length > 0) {
              existing.forEach(r => {
                const sId = r.student_id;
                if (sId) {
                  newMap[sId] = {
                    id: r.id,
                    sabaq: Boolean(r.sabaq),
                    sabqi: Boolean(r.sabqi),
                    manzil: Boolean(r.manzil),
                    manzil_para: r.manzil_para || '',
                    manzil_amount: r.manzil_amount || '',
                    sami_name: r.sami_name || '',
                    kaifiyat_checked: Boolean(r.kaifiyat_checked),
                    kaifiyat_text: r.kaifiyat_text || '',
                    mutalaah: Boolean(r.mutalaah)
                  };
                }
              });
            }
            setRecordsMap(newMap);
          }
        }
      } catch (err) {
        console.warn('Error loading daily records:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadExistingRecords();
    return () => { isMounted = false; };
  }, [selectedClassId, selectedDate, activeMadrasaId]);

  // Handle cell updates
  const handleFieldChange = (studentId, field, value) => {
    setRecordsMap(prev => {
      const current = prev[studentId] || {
        sabaq: false,
        sabqi: false,
        manzil: false,
        manzil_para: '',
        manzil_amount: '',
        sami_name: '',
        kaifiyat_checked: false,
        kaifiyat_text: '',
        mutalaah: false
      };

      const updated = { ...current, [field]: value };

      return {
        ...prev,
        [studentId]: updated
      };
    });
  };

  // Bulk actions
  const handleMarkAll = (field, targetValue) => {
    setRecordsMap(prev => {
      const next = { ...prev };
      classStudents.forEach(s => {
        const sId = s.id;
        const current = next[sId] || {
          sabaq: false,
          sabqi: false,
          manzil: false,
          manzil_para: '',
          manzil_amount: '',
          sami_name: '',
          kaifiyat_checked: false,
          kaifiyat_text: '',
          mutalaah: false
        };
        next[sId] = { ...current, [field]: targetValue };
      });
      return next;
    });
  };

  // Save records
  const handleSave = async () => {
    if (!classStudents.length) {
      setStatusMessage('اندراج کے لیے اس کلاس میں کوئی طالب علم موجود نہیں ہے۔');
      setStatusType('error');
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      const payload = classStudents.map(s => {
        const sId = s.id;
        const rec = recordsMap[sId] || {};
        return {
          id: rec.id,
          student_id: sId,
          class_id: selectedClassId,
          date: selectedDate,
          sabaq: Boolean(rec.sabaq),
          sabqi: Boolean(rec.sabqi),
          manzil: Boolean(rec.manzil),
          manzil_para: rec.manzil_para ? Number(rec.manzil_para) : null,
          manzil_amount: rec.manzil_amount || null,
          sami_name: rec.sami_name || null,
          kaifiyat_checked: Boolean(rec.kaifiyat_checked),
          kaifiyat_text: rec.kaifiyat_text || null,
          mutalaah: Boolean(rec.mutalaah)
        };
      });

      const res = await saveDailyAcademicRecordsToSupabase(payload, activeMadrasaId);

      // Update ids if returned
      if (Array.isArray(res)) {
        setRecordsMap(prev => {
          const next = { ...prev };
          res.forEach(r => {
            if (r.student_id && next[r.student_id]) {
              next[r.student_id].id = r.id;
            }
          });
          return next;
        });
      }

      setStatusMessage('روزانہ تعلیمی کارکردگی کا ریکارڈ کامیابی سے محفوظ ہو گیا ہے۔');
      setStatusType('success');
    } catch (e) {
      console.error('Save daily records error:', e);
      setStatusMessage('ریکارڈ محفوظ کرنے میں دشواری پیش آئی، براہ کرم دوبارہ کوشش کریں۔');
      setStatusType('error');
    } finally {
      setSaving(false);
    }
  };

  // Print Handling (A4, Black & White)
  const handlePrint = () => {
    if (!classStudents.length) {
      alert('پرنٹ کرنے کے لیے طلبہ کا ریکارڈ موجود نہیں ہے۔');
      return;
    }
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
      }, 500);
    }, 150);
  };

  // AI Sheet OCR Scanner Handlers
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('برائے کرم درست تصویری فائل (JPG, PNG, WebP) منتخب کریں۔');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setScanError(null);
  };

  const handleClearSelectedImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleApiKeyChange = (val) => {
    setUserApiKey(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_vision_api_key', val.trim());
    }
  };

  const handleScanSheet = async () => {
    if (!selectedImageFile) {
      setScanError('برائے کرم پہلے شیٹ کی تصویر منتخب کریں۔');
      return;
    }

    if (!classStudents.length) {
      setScanError('اس کلاس میں کوئی طالب علم موجود نہیں ہے۔');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const { base64, mimeType } = await fileToBase64(selectedImageFile);
      const result = await parseDailyPerformanceSheet({
        base64Data: base64,
        mimeType,
        students: classStudents,
        apiKey: userApiKey
      });

      if (result.matchedCount > 0) {
        setRecordsMap(prev => {
          const next = { ...prev };
          Object.entries(result.mappedRecords).forEach(([sId, newRec]) => {
            const existing = next[sId] || {};
            next[sId] = {
              ...existing,
              ...newRec,
              id: existing.id // preserve DB record id if already exists
            };
          });
          return next;
        });

        setIsUploadModalOpen(false);
        handleClearSelectedImage();

        setStatusMessage(`کامیابی سے شیٹ اسکین ہو گئی اور ${result.matchedCount} طلبہ کا ڈیٹا درج ہو گیا۔ برائے کرم جائزہ لے کر "ریکارڈ محفوظ کریں" دبائیں۔`);
        setStatusType('success');
      } else {
        setScanError('تصویر سے طلبہ کا ڈیٹا مطابقت نہ رکھ سکا۔ برائے کرم واضح، سیدھی اور متعلقہ کلاس کی تصویر منتخب کریں۔');
      }
    } catch (err) {
      console.error('Scan sheet error:', err);
      setScanError(err.message || 'شیٹ کا تجزیہ کرنے میں دشواری پیش آئی۔');
    } finally {
      setIsScanning(false);
    }
  };

  // Summary statistics calculation
  const stats = useMemo(() => {
    let sabaqCount = 0;
    let sabqiCount = 0;
    let manzilCount = 0;
    let mutalaahCount = 0;

    classStudents.forEach(s => {
      const rec = recordsMap[s.id] || {};
      if (rec.sabaq) sabaqCount++;
      if (rec.sabqi) sabqiCount++;
      if (rec.manzil) manzilCount++;
      if (rec.mutalaah) mutalaahCount++;
    });

    return {
      total: classStudents.length,
      sabaq: sabaqCount,
      sabqi: sabqiCount,
      manzil: manzilCount,
      mutalaah: mutalaahCount
    };
  }, [classStudents, recordsMap]);

  return (
    <div className="daily-perf-wrapper" dir="rtl">
      {/* Top View Selector: Daily Entry vs Periodic Report */}
      <div className="daily-perf-view-toggle-bar daily-perf-no-print">
        <button
          type="button"
          className={`daily-perf-view-btn ${activeView === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveView('entry')}
        >
          روزانہ اندراج و اے آئی اسکین
        </button>
        <button
          type="button"
          className={`daily-perf-view-btn ${activeView === 'report' ? 'active' : ''}`}
          onClick={() => setActiveView('report')}
        >
          میعادی تعلیمی رپورٹ و کارکردگی جائزہ
        </button>
      </div>

      {activeView === 'report' ? (
        <DailyPerformanceReport />
      ) : (
        <>
          {/* 1. Control & Filter Card (Screen only) */}
      <div className="daily-perf-card daily-perf-no-print">
        <div className="daily-perf-header">
          <div>
            <h2 className="daily-perf-title">روزانہ تعلیمی کارکردگی</h2>
            <div className="daily-perf-subtitle">
              ہر کلاس کی روزمرہ کی تعلیمی پیش رفت (سبق، سبقی، منزل، سامع، کیفیت و مطالعہ) کا تفصیلی اندراج
            </div>
          </div>
          <div className="daily-perf-bulk-group">
            <button
              type="button"
              className="daily-perf-btn daily-perf-btn-accent"
              onClick={() => {
                setIsUploadModalOpen(true);
                setScanError(null);
              }}
              disabled={loading || classStudents.length === 0}
              title="پُر شدہ شیٹ کی تصویر اپلوڈ کر کے خودکار اندراج کریں"
            >
              پُر شدہ شیٹ اپلوڈ کریں (AI Scan)
            </button>
            <button
              type="button"
              className="daily-perf-btn daily-perf-btn-secondary"
              onClick={handlePrint}
              disabled={loading || classStudents.length === 0}
            >
              پرنٹ نکالیں (A4)
            </button>
            <button
              type="button"
              className="daily-perf-btn daily-perf-btn-primary"
              onClick={handleSave}
              disabled={loading || saving || classStudents.length === 0}
            >
              {saving ? 'محفوظ ہو رہا ہے...' : 'ریکارڈ محفوظ کریں'}
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="daily-perf-filters">
          <div className="daily-perf-field">
            <label className="daily-perf-label" htmlFor="dailyPerfClassSelect">کلاس منتخب کریں</label>
            <select
              id="dailyPerfClassSelect"
              className="daily-perf-select"
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
              }}
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

          <div className="daily-perf-field">
            <label className="daily-perf-label" htmlFor="dailyPerfDateInput">تاریخ</label>
            <input
              id="dailyPerfDateInput"
              type="date"
              className="daily-perf-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="daily-perf-field" style={{ minWidth: '220px' }}>
            <label className="daily-perf-label" htmlFor="dailyPerfSearchInput">طالب علم تلاش کریں</label>
            <input
              id="dailyPerfSearchInput"
              type="text"
              className="daily-perf-input"
              placeholder="نام، ولدیت یا رول نمبر..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="daily-perf-bulk-bar">
          <div className="daily-perf-bulk-group">
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>فوری انتخاب:</span>
            <button
              type="button"
              className="daily-perf-btn"
              onClick={() => handleMarkAll('sabaq', true)}
              title="تمام طلبہ کے لیے سبق نشان زد کریں"
            >
              سبق (سب پاس)
            </button>
            <button
              type="button"
              className="daily-perf-btn"
              onClick={() => handleMarkAll('sabqi', true)}
              title="تمام طلبہ کے لیے سبقی نشان زد کریں"
            >
              سبقی (سب پاس)
            </button>
            <button
              type="button"
              className="daily-perf-btn"
              onClick={() => handleMarkAll('mutalaah', true)}
              title="تمام طلبہ کے لیے مطالعہ نشان زد کریں"
            >
              مطالعہ (سب کا ہوا)
            </button>
          </div>

          <div className="daily-perf-bulk-group">
            <button
              type="button"
              className="daily-perf-btn"
              onClick={() => {
                handleMarkAll('sabaq', false);
                handleMarkAll('sabqi', false);
                handleMarkAll('mutalaah', false);
              }}
              style={{ color: '#dc2626' }}
            >
              تمام نشانات ہٹائیں
            </button>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className={`daily-perf-alert ${statusType === 'success' ? 'daily-perf-alert-success' : 'daily-perf-alert-error'} daily-perf-no-print`}>
          {statusMessage}
        </div>
      )}

      {/* 2. Printable Header (Shown only during print) */}
      <div className="daily-perf-print-header daily-perf-print-only">
        <h1 className="daily-perf-print-title">
          {activeMadrasa?.name || 'جامعہ / مدرسہ'}
        </h1>
        <div style={{ fontSize: '1.15rem', fontStyle: 'normal', fontWeight: 'bold', marginBottom: '6px' }}>
          روزانہ تعلیمی کارکردگی و روزنامچہ
        </div>
        <div className="daily-perf-print-meta">
          <div><strong>کلاس:</strong> {currentClassObj?.name || '—'}</div>
          <div><strong>استادِ محترم:</strong> {currentClassObj?.teacher || '—'}</div>
          <div><strong>تاریخ:</strong> {selectedDate}</div>
          <div><strong>کل طلبہ:</strong> {classStudents.length}</div>
        </div>
      </div>

      {/* 3. Main Academic Performance Table */}
      <div className="daily-perf-table-wrap">
        {loading ? (
          <div className="daily-perf-empty">ریکارڈ لوڈ ہو رہا ہے، براہ کرم انتظار کریں...</div>
        ) : displayedStudents.length === 0 ? (
          <div className="daily-perf-empty">
            {classStudents.length === 0
              ? 'اس کلاس میں فی الوقت کوئی طالب علم داخل نہیں ہے۔'
              : 'تلاش کے مطابق کوئی طالب علم نہیں ملا۔'}
          </div>
        ) : (
          <table className="daily-perf-table">
            <thead>
              <tr>
                <th className="daily-perf-col-index">نمبر شمار</th>
                <th className="daily-perf-col-student">نام مع ولدیت</th>
                <th className="daily-perf-col-checkbox">سبق</th>
                <th className="daily-perf-col-checkbox">سبقی</th>
                <th className="daily-perf-col-manzil">منزل (پارہ و مقدار)</th>
                <th className="daily-perf-col-sami">سامع</th>
                <th className="daily-perf-col-kaifiyat">کیفیت</th>
                <th className="daily-perf-col-checkbox">مطالعہ</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map((student, idx) => {
                const sId = student.id;
                const rec = recordsMap[sId] || {
                  sabaq: false,
                  sabqi: false,
                  manzil: false,
                  manzil_para: '',
                  manzil_amount: '',
                  sami_name: '',
                  kaifiyat_checked: false,
                  kaifiyat_text: '',
                  mutalaah: false
                };

                const studentName = student.name || student.admName || 'طالب علم';
                const fatherName = student.father_name || student.admFatherName || '';
                const rollNo = student.admRegNo || student.roll_number || '';

                return (
                  <tr key={sId || idx}>
                    {/* 1. نمبر شمار */}
                    <td className="daily-perf-col-index">{idx + 1}</td>

                    {/* 2. نام مع ولدیت */}
                    <td className="daily-perf-col-student">
                      <div className="daily-perf-student-name">
                        {studentName} {fatherName ? `ولد ${fatherName}` : ''}
                      </div>
                      {rollNo && (
                        <div className="daily-perf-student-sub">
                          رول نمبر: {rollNo}
                        </div>
                      )}
                    </td>

                    {/* 3. سبق (چیک باکس) */}
                    <td className="daily-perf-col-checkbox">
                      <div className="daily-perf-no-print">
                        <input
                          type="checkbox"
                          className="daily-perf-checkbox"
                          checked={rec.sabaq}
                          onChange={e => handleFieldChange(sId, 'sabaq', e.target.checked)}
                          aria-label={`سبق برائے ${studentName}`}
                        />
                      </div>
                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-cell-center">
                          <span className="daily-perf-print-box">{rec.sabaq ? '✓' : ''}</span>
                        </div>
                      </div>
                    </td>

                    {/* 4. سبقی (چیک باکس) */}
                    <td className="daily-perf-col-checkbox">
                      <div className="daily-perf-no-print">
                        <input
                          type="checkbox"
                          className="daily-perf-checkbox"
                          checked={rec.sabqi}
                          onChange={e => handleFieldChange(sId, 'sabqi', e.target.checked)}
                          aria-label={`سبقی برائے ${studentName}`}
                        />
                      </div>
                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-cell-center">
                          <span className="daily-perf-print-box">{rec.sabqi ? '✓' : ''}</span>
                        </div>
                      </div>
                    </td>

                    {/* 5. منزل (چیک باکس + پارہ و مقدار ان پٹ) */}
                    <td className="daily-perf-col-manzil">
                      <div className="daily-perf-no-print">
                        <div className="daily-perf-manzil-flex">
                          <label className="daily-perf-manzil-check-label">
                            <input
                              type="checkbox"
                              className="daily-perf-checkbox"
                              checked={rec.manzil}
                              onChange={e => handleFieldChange(sId, 'manzil', e.target.checked)}
                            />
                            <span>سنائی</span>
                          </label>

                          {rec.manzil && (
                            <div className="daily-perf-manzil-inputs">
                              <select
                                className="daily-perf-para-select"
                                value={rec.manzil_para}
                                onChange={e => handleFieldChange(sId, 'manzil_para', e.target.value)}
                                title="پارہ نمبر منتخب کریں"
                              >
                                <option value="">پارہ...</option>
                                {JUZ_OPTIONS.map(j => (
                                  <option key={j} value={j}>پارہ {j}</option>
                                ))}
                              </select>

                              <input
                                type="text"
                                className="daily-perf-amount-input"
                                placeholder="کتنا سنایا؟ (مثلاً: 1 پاؤ / آدھا پارہ)"
                                value={rec.manzil_amount}
                                onChange={e => handleFieldChange(sId, 'manzil_amount', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Print presentation for Manzil with square box and lines */}
                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-manzil-wrap">
                          <span className="daily-perf-print-box">{rec.manzil ? '✓' : ''}</span>
                          <div className="daily-perf-print-manzil-text">
                            <span>پارہ: {rec.manzil_para ? <strong>{rec.manzil_para}</strong> : '___'}</span>
                            <span>مقدار: {rec.manzil_amount ? <strong>{rec.manzil_amount}</strong> : '________'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 6. سامع (منزل سننے والے کا نام) */}
                    <td className="daily-perf-col-sami">
                      <div className="daily-perf-no-print">
                        <input
                          type="text"
                          className="daily-perf-sami-input"
                          placeholder="سامع کا نام..."
                          value={rec.sami_name}
                          onChange={e => handleFieldChange(sId, 'sami_name', e.target.value)}
                        />
                      </div>
                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-text-line">
                          {rec.sami_name ? rec.sami_name : '........................'}
                        </div>
                      </div>
                    </td>

                    {/* 7. کیفیت (چیک باکس + 3 تا 4 الفاظ) */}
                    <td className="daily-perf-col-kaifiyat">
                      <div className="daily-perf-no-print">
                        <div className="daily-perf-kaifiyat-flex">
                          <div className="daily-perf-kaifiyat-top">
                            <input
                              type="checkbox"
                              className="daily-perf-checkbox"
                              checked={rec.kaifiyat_checked}
                              onChange={e => handleFieldChange(sId, 'kaifiyat_checked', e.target.checked)}
                              title="کیفیت نشان زد کریں"
                            />
                            <input
                              type="text"
                              className="daily-perf-kaifiyat-input"
                              placeholder="کیفیت (3 تا 4 الفاظ)..."
                              maxLength={100}
                              value={rec.kaifiyat_text}
                              onChange={e => handleFieldChange(sId, 'kaifiyat_text', e.target.value)}
                            />
                          </div>
                          <div className="daily-perf-presets">
                            {PRESET_KAIFIYAT.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                className="daily-perf-preset-pill"
                                onClick={() => {
                                  handleFieldChange(sId, 'kaifiyat_checked', true);
                                  handleFieldChange(sId, 'kaifiyat_text', preset);
                                }}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-kaifiyat-wrap">
                          <span className="daily-perf-print-box">{rec.kaifiyat_checked ? '✓' : ''}</span>
                          <div className="daily-perf-print-kaifiyat-text">
                            {rec.kaifiyat_text ? rec.kaifiyat_text : '........................'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 8. مطالعہ (چیک باکس) */}
                    <td className="daily-perf-col-checkbox">
                      <div className="daily-perf-no-print">
                        <input
                          type="checkbox"
                          className="daily-perf-checkbox"
                          checked={rec.mutalaah}
                          onChange={e => handleFieldChange(sId, 'mutalaah', e.target.checked)}
                          aria-label={`مطالعہ برائے ${studentName}`}
                        />
                      </div>
                      <div className="daily-perf-print-only">
                        <div className="daily-perf-print-cell-center">
                          <span className="daily-perf-print-box">{rec.mutalaah ? '✓' : ''}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Footer & Signature Section */}
      <div className="daily-perf-footer">
        {/* Statistics Bar */}
        <div className="daily-perf-stats-grid">
          <div className="daily-perf-stat-card">
            <div className="daily-perf-stat-label">کل طلبہ</div>
            <div className="daily-perf-stat-value">{stats.total}</div>
          </div>
          <div className="daily-perf-stat-card">
            <div className="daily-perf-stat-label">سبق سنانے والے</div>
            <div className="daily-perf-stat-value">{stats.sabaq}</div>
          </div>
          <div className="daily-perf-stat-card">
            <div className="daily-perf-stat-label">سبقی سنانے والے</div>
            <div className="daily-perf-stat-value">{stats.sabqi}</div>
          </div>
          <div className="daily-perf-stat-card">
            <div className="daily-perf-stat-label">منزل سنانے والے</div>
            <div className="daily-perf-stat-value">{stats.manzil}</div>
          </div>
          <div className="daily-perf-stat-card">
            <div className="daily-perf-stat-label">مطالعہ کرنے والے</div>
            <div className="daily-perf-stat-value">{stats.mutalaah}</div>
          </div>
        </div>

        {/* Signature Line Section */}
        <div className="daily-perf-signature-grid">
          <div className="daily-perf-signature-box">
            <div className="daily-perf-signature-line" />
            <div className="daily-perf-signature-text">دستخط استادِ محترم</div>
            <div className="daily-perf-signature-sub">
              {currentClassObj?.teacher ? `محترم ${currentClassObj.teacher}` : 'نام و دستخط'}
            </div>
          </div>
          <div className="daily-perf-signature-box">
            <div className="daily-perf-signature-line" />
            <div className="daily-perf-signature-text">دستخط ناظم تعلیمات / مہتمم</div>
            <div className="daily-perf-signature-sub">جامعہ / مدرسہ ہذا</div>
          </div>
        </div>
      </div>

      {/* 5. AI Vision Sheet Scanner Modal (Screen only) */}
      {isUploadModalOpen && (
        <div
          className="daily-perf-modal-backdrop daily-perf-no-print"
          onClick={() => !isScanning && setIsUploadModalOpen(false)}
        >
          <div
            className="daily-perf-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="daily-perf-modal-header">
              <h3 className="daily-perf-modal-title">پُر شدہ شیٹ کا خودکار اسکین و اندراج</h3>
              <button
                type="button"
                className="daily-perf-btn daily-perf-modal-close"
                onClick={() => !isScanning && setIsUploadModalOpen(false)}
                disabled={isScanning}
              >
                بند کریں
              </button>
            </div>

            <div className="daily-perf-modal-body">
              <div className="daily-perf-modal-note">
                پرنٹ شدہ اور ہاتھ سے پُر کردہ اے فور شیٹ کی صاف اور سیدھی تصویر یا اسکین فائل اپلوڈ کریں۔ سسٹم خودکار طور پر تمام کالمز (سبق، سبقی، منزل، سامع، کیفیت، مطالعہ) کا تجزیہ کر کے متعلقہ طلبہ کے سامنے اندراج کر دے گا۔
              </div>

              {scanError && (
                <div className="daily-perf-alert daily-perf-alert-error" style={{ marginBottom: '14px' }}>
                  {scanError}
                </div>
              )}

              {/* Upload Dropzone */}
              {!selectedImageFile ? (
                <div
                  className="daily-perf-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) {
                      handleFileChange({ target: { files: e.dataTransfer.files } });
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div className="daily-perf-dropzone-prompt">
                    تصویر یہاں ڈریگ کریں یا فائل منتخب کرنے کے لیے کلک کریں
                  </div>
                  <div className="daily-perf-dropzone-sub">
                    جے پی جی (JPG)، پی این جی (PNG) یا ویب پی (WebP) فارمیٹ
                  </div>
                </div>
              ) : (
                <div className="daily-perf-preview-container">
                  <img
                    src={imagePreviewUrl}
                    alt="منتخب شیٹ"
                    className="daily-perf-preview-img"
                  />
                  <div className="daily-perf-preview-actions">
                    <span className="daily-perf-file-info">{selectedImageFile.name}</span>
                    <button
                      type="button"
                      className="daily-perf-btn"
                      onClick={handleClearSelectedImage}
                      disabled={isScanning}
                    >
                      دوسری تصویر منتخب کریں
                    </button>
                  </div>
                </div>
              )}

              {/* API Key Configuration (Optional) */}
              <div className="daily-perf-field" style={{ marginTop: '16px' }}>
                <label className="daily-perf-label" htmlFor="geminiApiKeyInput">
                  گوگل جیمنائی API Key (اختیاری اگر ماحول میں سیٹ ہو):
                </label>
                <input
                  id="geminiApiKeyInput"
                  type="password"
                  className="daily-perf-input"
                  placeholder="AIzaSy..."
                  value={userApiKey}
                  onChange={e => handleApiKeyChange(e.target.value)}
                  disabled={isScanning}
                />
              </div>
            </div>

            <div className="daily-perf-modal-footer">
              <button
                type="button"
                className="daily-perf-btn"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isScanning}
              >
                منسوخ کریں
              </button>
              <button
                type="button"
                className="daily-perf-btn daily-perf-btn-accent"
                onClick={handleScanSheet}
                disabled={isScanning || !selectedImageFile}
              >
                {isScanning ? 'تجزیہ جاری ہے، براہ کرم انتظار فرمائیں...' : 'تجزیہ و خودکار اندراج شروع کریں'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
