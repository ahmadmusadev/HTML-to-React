import React, { useState, useId, useMemo, useEffect } from 'react';
import {
  SYSTEM_FIELD_DEFS,
  autoDetectColumnMapping,
  parseImportFile,
  calculateNextSequentialRollNumber,
  buildBatchStudentPayloads,
  exportStudentsToExcel,
  exportStudentsToWord,
  printStudentsList,
  downloadSampleExcelTemplate,
  downloadSampleWordTemplate,
  reverseTableColumns,
  analyzeDuplicateStudents
} from '../utils/studentBulkImportExport';
import { mapSupabaseToUi } from '../pages/Admissions';

export default function BulkStudentImportExport({
  classesList = [],
  records = [],
  onStudentsAdded,
  preSelectedClassId = '',
  activeMadrasa = null,
  activeMadrasaId = '',
  addBulkStudentsToSupabase,
  onViewClass
}) {
  const fileInputId = useId();
  // Main mode: 'import' or 'export'
  const [activeMode, setActiveMode] = useState('import');

  // Export State
  const [selectedExportClasses, setSelectedExportClasses] = useState(
    preSelectedClassId ? [preSelectedClassId] : ['all']
  );
  const [masterExportFormat, setMasterExportFormat] = useState('excel');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(null);

  useEffect(() => {
    if (preSelectedClassId) {
      setSelectedExportClasses([preSelectedClassId]);
    }
  }, [preSelectedClassId]);

  // Derived Export Datasets
  const activeStudents = useMemo(() => {
    return records.filter((r) => !r.isWithdrawn && r.status !== 'left');
  }, [records]);

  const isAllClassesSelected =
    selectedExportClasses.includes('all') || selectedExportClasses.length === 0;

  const selectedStudents = useMemo(() => {
    if (isAllClassesSelected) {
      return activeStudents;
    }
    const idSet = new Set(selectedExportClasses);
    return activeStudents.filter((r) => idSet.has(r.class_id || r.admClass));
  }, [activeStudents, selectedExportClasses, isAllClassesSelected]);

  const selectionSummaryText = useMemo(() => {
    if (isAllClassesSelected) {
      return 'تمام کلاسز (مکمل ماسٹر لسٹ)';
    }
    const names = selectedExportClasses
      .map((id) => classesList.find((c) => c.id === id)?.class_name)
      .filter(Boolean);
    return names.length > 0 ? names.join('، ') : 'کوئی کلاس منتخب نہیں';
  }, [isAllClassesSelected, selectedExportClasses, classesList]);

  const targetExportTitle = useMemo(() => {
    if (isAllClassesSelected) {
      return 'تمام کلاسز (ماسٹر لسٹ)';
    }
    if (selectedExportClasses.length === 1) {
      const cls = classesList.find((c) => c.id === selectedExportClasses[0]);
      return cls ? cls.class_name : 'منتخب کلاس';
    }
    const names = selectedExportClasses
      .map((id) => classesList.find((c) => c.id === id)?.class_name)
      .filter(Boolean);
    return `منتخب کلاسز (${names.join(' - ')})`;
  }, [isAllClassesSelected, selectedExportClasses, classesList]);

  // Multi-select change handler (supporting Ctrl/Cmd selection)
  const handleClassSelectChange = (e) => {
    const options = Array.from(e.target.selectedOptions, (opt) => opt.value);
    if (options.length === 0) {
      setSelectedExportClasses(['all']);
      return;
    }
    const hadAll = selectedExportClasses.includes('all');
    const nowHasAll = options.includes('all');

    if (!hadAll && nowHasAll) {
      setSelectedExportClasses(['all']);
    } else if (hadAll && nowHasAll && options.length > 1) {
      setSelectedExportClasses(options.filter((v) => v !== 'all'));
    } else if (nowHasAll && options.length === 1) {
      setSelectedExportClasses(['all']);
    } else {
      setSelectedExportClasses(options.filter((v) => v !== 'all'));
    }
  };

  // Import State
  const [importStep, setImportStep] = useState(1); // 1: Upload, 2: Map, 3: Confirm, 4: Progress/Success
  const [targetClassId, setTargetClassId] = useState(preSelectedClassId || (classesList[0]?.id || ''));
  const [selectedFile, setSelectedFile] = useState(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null); // { headers, rows, totalRows }
  const [columnMapping, setColumnMapping] = useState({});
  const [mappingError, setMappingError] = useState(null);
  const [isRtlOrder, setIsRtlOrder] = useState(true);

  // Duplicate Detection State
  const [duplicateAction, setDuplicateAction] = useState('skip'); // 'skip' or 'allow'
  const [duplicateAnalysis, setDuplicateAnalysis] = useState(null);

  // Sequential Roll No calculation state
  const [startRollNo, setStartRollNo] = useState(1);
  const [previewPayloads, setPreviewPayloads] = useState([]);

  // Batch Save Progress State
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ saved: 0, total: 0 });
  const [saveError, setSaveError] = useState(null);
  const [saveSuccessInfo, setSaveSuccessInfo] = useState(null);

  // Madrasa display name
  const madrasaName = activeMadrasa?.name || activeMadrasa?.madrasa_name || 'جامعہ / مدرسہ';

  // --- EXPORT HANDLERS ---
  const handleExport = async (format) => {
    setExportLoading(true);
    setExportFeedback(null);
    try {
      if (selectedStudents.length === 0) {
        setExportFeedback({
          type: 'warning',
          message: 'منتخب کردہ کلاسز میں کوئی فعال طالب علم موجود نہیں ہے۔'
        });
        setExportLoading(false);
        return;
      }

      if (format === 'excel') {
        exportStudentsToExcel({
          students: selectedStudents,
          classes: classesList,
          className: targetExportTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: `ایکسل فائل برائے ${targetExportTitle} کامیابی سے ڈاؤن لوڈ ہو گئی ہے۔`
        });
      } else if (format === 'word') {
        await exportStudentsToWord({
          students: selectedStudents,
          classes: classesList,
          className: targetExportTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: `ورڈ فائل برائے ${targetExportTitle} کامیابی سے ڈاؤن لوڈ ہو گئی ہے۔`
        });
      } else if (format === 'pdf') {
        printStudentsList({
          students: selectedStudents,
          classes: classesList,
          className: targetExportTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: `پرنٹیبل شیٹ برائے ${targetExportTitle} کامیابی سے تیار ہو گئی ہے۔`
        });
      }
    } catch (err) {
      console.error('Export error:', err);
      setExportFeedback({
        type: 'error',
        message: err.message || 'ایکسپورٹ کے دوران خرابی پیش آئی۔'
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleMasterExport = async (format) => {
    setExportLoading(true);
    setExportFeedback(null);
    try {
      if (activeStudents.length === 0) {
        setExportFeedback({
          type: 'warning',
          message: 'مدرسے میں کوئی فعال طالب علم موجود نہیں ہے۔'
        });
        setExportLoading(false);
        return;
      }

      const masterTitle = 'تمام کلاسز (ماسٹر لسٹ)';

      if (format === 'excel') {
        exportStudentsToExcel({
          students: activeStudents,
          classes: classesList,
          className: masterTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: 'مکمل ماسٹر لسٹ (ایکسل) کامیابی سے ڈاؤن لوڈ ہو گئی ہے۔'
        });
      } else if (format === 'word') {
        await exportStudentsToWord({
          students: activeStudents,
          classes: classesList,
          className: masterTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: 'مکمل ماسٹر لسٹ (ورڈ) کامیابی سے ڈاؤن لوڈ ہو گئی ہے۔'
        });
      } else if (format === 'pdf') {
        printStudentsList({
          students: activeStudents,
          classes: classesList,
          className: masterTitle,
          madrasaName
        });
        setExportFeedback({
          type: 'success',
          message: 'مکمل ماسٹر لسٹ برائے پرنٹ / پی ڈی ایف کامیابی سے تیار ہو گئی ہے۔'
        });
      }
    } catch (err) {
      console.error('Master export error:', err);
      setExportFeedback({
        type: 'error',
        message: err.message || 'ماسٹر لسٹ ایکسپورٹ کرنے کے دوران خرابی پیش آئی۔'
      });
    } finally {
      setExportLoading(false);
    }
  };

  // --- IMPORT STEP 1: FILE SELECTION & PARSING ---
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMappingError(null);
    }
  };

  const handleProcessFile = async () => {
    if (!targetClassId) {
      setMappingError('برائے مہربانی پہلے ہدف کلاس کا انتخاب کریں۔');
      return;
    }
    if (!selectedFile) {
      setMappingError('برائے مہربانی اپلوڈ کے لیے ایکسل، ورڈ یا پی ڈی ایف فائل منتخب کریں۔');
      return;
    }

    setParseLoading(true);
    setMappingError(null);

    try {
      const result = await parseImportFile(selectedFile);
      if (!result.rows || result.rows.length === 0) {
        throw new Error('فائل میں طلباء کا کوئی ڈیٹا نہیں ملا۔');
      }

      setParsedData(result);
      setIsRtlOrder(result.isRtlReversed !== false);
      const initialMapping = autoDetectColumnMapping(result.headers);
      setColumnMapping(initialMapping);

      // Verify if student name was mapped
      if (initialMapping.name === -1) {
        setMappingError('طالب علم کے نام کا کالم خودکار طور پر نہیں پہچانا جا سکا، برائے مہربانی نیچے دیے گئے ڈراپ ڈاؤن سے درست کالم منتخب کریں۔');
      }

      setImportStep(2);
    } catch (err) {
      console.error('File parsing error:', err);
      setMappingError(err.message || 'فائل پڑھنے میں ناکامی۔ برائے مہربانی درست فارمیٹ استعمال کریں۔');
    } finally {
      setParseLoading(false);
    }
  };

  // Toggle RTL / LTR Column Orientation
  const handleToggleReverseColumns = () => {
    if (!parsedData || !parsedData.headers) return;
    const reversed = reverseTableColumns({
      headers: parsedData.headers,
      rows: parsedData.rows
    });
    setParsedData((prev) => ({
      ...prev,
      headers: reversed.headers,
      rows: reversed.rows
    }));
    setIsRtlOrder((prev) => !prev);
    const newMapping = autoDetectColumnMapping(reversed.headers);
    setColumnMapping(newMapping);
  };

  // --- IMPORT STEP 2: MAPPING CONFIRMATION ---
  const handleMappingChange = (fieldKey, columnIndex) => {
    setColumnMapping((prev) => ({
      ...prev,
      [fieldKey]: parseInt(columnIndex, 10)
    }));
  };

  const handleDuplicateActionChange = (policy) => {
    setDuplicateAction(policy);
    if (!parsedData || !columnMapping.name) return;

    const nextRoll = calculateNextSequentialRollNumber(records);
    const { payloads } = buildBatchStudentPayloads({
      rows: parsedData.rows,
      headers: parsedData.headers,
      mapping: columnMapping,
      targetClassId,
      startRollNo: nextRoll,
      madrasaId: activeMadrasaId
    });

    const dupAnalysis = analyzeDuplicateStudents({
      payloads,
      existingStudents: records
    });
    setDuplicateAnalysis(dupAnalysis);

    if (policy === 'skip' && dupAnalysis.fileDuplicates.length > 0) {
      let roll = nextRoll;
      const cleanWithRolls = dupAnalysis.cleanPayloads.map((p) => {
        const item = { ...p, roll_number: String(roll).padStart(2, '0') };
        roll++;
        return item;
      });
      setPreviewPayloads(cleanWithRolls);
    } else {
      setPreviewPayloads(payloads);
    }
  };

  const handleProceedToConfirmation = () => {
    if (columnMapping.name === undefined || columnMapping.name === -1) {
      setMappingError('طالب علم کا نام لازمی فیلڈ ہے۔ برائے مہربانی نام کے کالم کی میپنگ درست کریں۔');
      return;
    }

    // Calculate sequential roll number
    const nextRoll = calculateNextSequentialRollNumber(records);
    setStartRollNo(nextRoll);

    // Build preview payloads
    const { payloads } = buildBatchStudentPayloads({
      rows: parsedData.rows,
      headers: parsedData.headers,
      mapping: columnMapping,
      targetClassId,
      startRollNo: nextRoll,
      madrasaId: activeMadrasaId
    });

    if (payloads.length === 0) {
      setMappingError('منتخب کالمز کے مطابق کوئی درست طالب علم ریکارڈ نہیں مل سکا۔');
      return;
    }

    // Duplicate detection check
    const dupAnalysis = analyzeDuplicateStudents({
      payloads,
      existingStudents: records
    });
    setDuplicateAnalysis(dupAnalysis);

    if (duplicateAction === 'skip' && dupAnalysis.fileDuplicates.length > 0) {
      let roll = nextRoll;
      const cleanWithRolls = dupAnalysis.cleanPayloads.map((p) => {
        const item = { ...p, roll_number: String(roll).padStart(2, '0') };
        roll++;
        return item;
      });
      setPreviewPayloads(cleanWithRolls);
    } else {
      setPreviewPayloads(payloads);
    }

    setImportStep(3); // Confirmation dialog
  };

  // --- IMPORT STEP 3: EXECUTE BATCH SAVE ---
  const handleExecuteImport = async () => {
    if (!addBulkStudentsToSupabase) {
      alert('ڈیٹا بیس فنکشن دستیاب نہیں ہے۔');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveProgress({ saved: 0, total: previewPayloads.length });
    setImportStep(4);

    try {
      const insertedRows = await addBulkStudentsToSupabase(
        previewPayloads,
        activeMadrasaId,
        (saved, total) => {
          setSaveProgress({ saved, total });
        }
      );

      // Convert to UI structures
      const newUiRecords = (insertedRows || []).map((row) => mapSupabaseToUi(row));

      if (typeof onStudentsAdded === 'function') {
        onStudentsAdded(newUiRecords);
      }

      const targetCls = classesList.find((c) => c.id === targetClassId);

      setSaveSuccessInfo({
        count: newUiRecords.length,
        className: targetCls?.class_name || 'منتخب کلاس',
        startRoll: previewPayloads[0]?.roll_number,
        endRoll: previewPayloads[previewPayloads.length - 1]?.roll_number
      });
    } catch (err) {
      console.error('Batch save error:', err);
      setSaveError(err.message || 'طلباء کا ڈیٹا محفوظ کرنے کے دوران خرابی پیش آئی۔');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset import flow
  const handleResetImport = () => {
    setImportStep(1);
    setSelectedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setMappingError(null);
    setPreviewPayloads([]);
    setSaveError(null);
    setSaveSuccessInfo(null);
  };

  return (
    <div className="bulk-io-container" dir="rtl">
      {/* Top Navigation Tabs */}
      <div className="bulk-io-nav-tabs no-print">
        <button
          type="button"
          className={`bulk-io-tab-btn ${activeMode === 'import' ? 'active' : ''}`}
          onClick={() => {
            setActiveMode('import');
            setExportFeedback(null);
          }}
        >
          طلباء امپورٹ کریں (فائل اپلوڈ)
        </button>
        <button
          type="button"
          className={`bulk-io-tab-btn ${activeMode === 'export' ? 'active' : ''}`}
          onClick={() => {
            setActiveMode('export');
            setMappingError(null);
          }}
        >
          طلباء ایکسپورٹ کریں (لسٹ ڈاؤن لوڈ)
        </button>
      </div>

      {/* ============================================================== */}
      {/* EXPORT MODE                                                    */}
      {/* ============================================================== */}
      {activeMode === 'export' && (
        <div className="bulk-io-card">
          <div className="bulk-io-card-header">
            <h3>طلباء کی لسٹ ایکسپورٹ کریں (Export Students List)</h3>
            <p>
              کسی ایک کلاس کے تمام طلباء یا پورے مدرسے کے تمام طلباء کی مشترکہ ماسٹر لسٹ کو ایکسل، ورڈ یا پرنٹیبل فارمیٹ میں ڈاؤن لوڈ کریں۔
            </p>
          </div>

          {exportFeedback && (
            <div className={`bulk-io-alert ${exportFeedback.type}`}>
              <span>{exportFeedback.message}</span>
              <button
                type="button"
                className="bulk-io-alert-close"
                onClick={() => setExportFeedback(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* Master List Highlight Banner */}
          <div className="bulk-io-master-quick-bar">
            <div className="bulk-io-master-quick-text">
              <strong>پورے مدرسے کی مشترکہ ماسٹر لسٹ (All Students Master List):</strong>
              <span>
                تمام کلاسز کے طلباء (کل {activeStudents.length}) کی مکمل لسٹ کلاس نام کے ساتھ ایک ہی فائل میں ڈاؤن لوڈ کریں۔
              </span>
            </div>
            <div className="bulk-io-master-download-box">
              <label htmlFor="master-export-format-select" className="bulk-io-master-heading">
                مکمل ماسٹر لسٹ ڈاؤن لوڈ کریں:
              </label>
              <div className="bulk-io-master-controls">
                <select
                  id="master-export-format-select"
                  value={masterExportFormat}
                  onChange={(e) => setMasterExportFormat(e.target.value)}
                  className="bulk-io-select bulk-io-master-select"
                  aria-label="مکمل ماسٹر لسٹ کا فارمیٹ منتخب کریں"
                >
                  <option value="excel">ایکسل فائل (Excel .xlsx)</option>
                  <option value="word">ورڈ دستاویز (Word .docx)</option>
                  <option value="pdf">پرنٹ / پی ڈی ایف (Print / PDF)</option>
                </select>
                <button
                  type="button"
                  className="bulk-io-btn primary bulk-io-master-btn"
                  disabled={exportLoading}
                  onClick={() => handleMasterExport(masterExportFormat)}
                >
                  {exportLoading ? 'جاری ہے...' : 'ڈاؤن لوڈ کریں'}
                </button>
              </div>
            </div>
          </div>

          <div className="bulk-io-export-form">
            <div className="bulk-io-form-group">
              <div className="bulk-io-multiselect-header">
                <label htmlFor="export-scope-select" className="bulk-io-label">
                  کلاس منتخب کریں:
                </label>
                <div className="bulk-io-multiselect-actions">
                  <button
                    type="button"
                    className="bulk-io-pill-btn"
                    onClick={() => setSelectedExportClasses(['all'])}
                  >
                    تمام کلاسز
                  </button>
                  <button
                    type="button"
                    className="bulk-io-pill-btn"
                    onClick={() => setSelectedExportClasses([])}
                  >
                    انتخاب صاف کریں
                  </button>
                </div>
              </div>
              <select
                id="export-scope-select"
                multiple
                size={Math.min(Math.max(classesList.length + 1, 4), 7)}
                value={selectedExportClasses}
                onChange={handleClassSelectChange}
                className="bulk-io-multiselect"
                aria-label="کلاسز منتخب کریں"
              >
                <option value="all">
                  تمام کلاسز (Master List - کل {activeStudents.length} طلباء)
                </option>
                {classesList.map((cls) => {
                  const count = activeStudents.filter(
                    (r) => (r.class_id || r.admClass) === cls.id
                  ).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} ({count} طلباء)
                    </option>
                  );
                })}
              </select>
              <div className="bulk-io-form-hint">
                کی بورڈ پر <strong>Ctrl</strong> بٹن دبا کر رکھیں اور مطلوبہ کلاسز پر کلک کریں تاکہ ایک سے زائد کلاسز بیک وقت منتخب ہو سکیں۔
              </div>
              <div className="bulk-io-selection-summary">
                <span className="bulk-io-summary-label">منتخب شدہ:</span>
                <span className="bulk-io-summary-value">{selectionSummaryText}</span>
                <span className="bulk-io-summary-count">{selectedStudents.length} طلباء</span>
              </div>
            </div>

            <div className="bulk-io-export-formats-grid">
              {/* Excel Card */}
              <div className="bulk-io-format-card">
                <div className="bulk-io-format-title">ایکسل فائل (Excel .xlsx)</div>
                <div className="bulk-io-format-desc">
                  مکمل ڈیٹا بیس بمعہ رجسٹریشن نمبر، ولدیت، ب فارم اور موبائل نمبر۔ اردو رائٹ ٹو لیفٹ (RTL) شیٹ۔
                </div>
                <button
                  type="button"
                  className="bulk-io-btn primary"
                  disabled={exportLoading}
                  onClick={() => handleExport('excel')}
                >
                  {exportLoading ? 'تیار کیا جا رہا ہے...' : 'ایکسل میں ڈاؤن لوڈ کریں'}
                </button>
              </div>

              {/* Word Card */}
              <div className="bulk-io-format-card">
                <div className="bulk-io-format-title">ورڈ دستاویز (Word .docx)</div>
                <div className="bulk-io-format-desc">
                  سرکاری دفتری استعمال کے لیے منظم جدول (Table) مع ادارہ جاتی سرورق اور دستخطی جگہ۔
                </div>
                <button
                  type="button"
                  className="bulk-io-btn primary"
                  disabled={exportLoading}
                  onClick={() => handleExport('word')}
                >
                  {exportLoading ? 'تیار کیا جا رہا ہے...' : 'ورڈ میں ڈاؤن لوڈ کریں'}
                </button>
              </div>

              {/* PDF Card */}
              <div className="bulk-io-format-card">
                <div className="bulk-io-format-title">پرنٹ / پی ڈی ایف (Print / PDF)</div>
                <div className="bulk-io-format-desc">
                  A4 سائز پرنٹ ریڈی شیٹ برائے نوٹس بورڈ، کلاس حاضری یا کاغذی فائل ریکارڈ۔
                </div>
                <button
                  type="button"
                  className="bulk-io-btn secondary"
                  disabled={exportLoading}
                  onClick={() => handleExport('pdf')}
                >
                  پرنٹ یا پی ڈی ایف محفوظ کریں
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* IMPORT MODE                                                    */}
      {/* ============================================================== */}
      {activeMode === 'import' && (
        <div className="bulk-io-card">
          {/* Stepper Header */}
          <div className="bulk-io-stepper">
            <div className={`bulk-io-step-node ${importStep >= 1 ? 'active' : ''} ${importStep > 1 ? 'completed' : ''}`}>
              <span className="bulk-io-step-num">1</span>
              <span className="bulk-io-step-label">کلاس و فائل کا انتخاب</span>
            </div>
            <div className="bulk-io-step-line"></div>
            <div className={`bulk-io-step-node ${importStep >= 2 ? 'active' : ''} ${importStep > 2 ? 'completed' : ''}`}>
              <span className="bulk-io-step-num">2</span>
              <span className="bulk-io-step-label">کالمز کی تصدیق و میپنگ</span>
            </div>
            <div className="bulk-io-step-line"></div>
            <div className={`bulk-io-step-node ${importStep >= 3 ? 'active' : ''} ${importStep > 3 ? 'completed' : ''}`}>
              <span className="bulk-io-step-num">3</span>
              <span className="bulk-io-step-label">رجسٹریشن نمبر اور تصدیق</span>
            </div>
          </div>

          {mappingError && (
            <div className="bulk-io-alert error">
              <span>{mappingError}</span>
              <button
                type="button"
                className="bulk-io-alert-close"
                onClick={() => setMappingError(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* STEP 1: UPLOAD AND SELECT CLASS */}
          {importStep === 1 && (
            <div className="bulk-io-step-content">
              <div className="bulk-io-card-header">
                <h3>مرحلہ 1: ہدف کلاس اور فائل کا انتخاب کریں</h3>
                <p>
                  جس کلاس میں طلباء کو شامل کرنا ہے اسے منتخب کریں اور ایکسل، ورڈ یا پی ڈی ایف لسٹ اپلوڈ کریں۔
                </p>
              </div>

              {/* Sample template links */}
              <div className="bulk-io-templates-bar">
                <div className="bulk-io-template-info">
                  <strong className="bulk-io-template-title">
                    طلباء کی لسٹ تیار کرنے کے لیے بنا بنایا ٹیمپلیٹ:
                  </strong>
                  <span className="bulk-io-template-desc">
                    یہاں سے ایکسل یا ورڈ فائل ڈاؤن لوڈ کریں، اس میں اپنی کلاس کے طلباء کا ڈیٹا لکھیں اور نیچے اپلوڈ کریں۔
                  </span>
                </div>
                <div className="bulk-io-template-actions">
                  <button
                    type="button"
                    className="bulk-io-template-btn"
                    onClick={downloadSampleExcelTemplate}
                  >
                    ایکسل ٹیمپلیٹ ڈاؤن لوڈ
                  </button>
                  <button
                    type="button"
                    className="bulk-io-template-btn"
                    onClick={downloadSampleWordTemplate}
                  >
                    ورڈ ٹیمپلیٹ ڈاؤن لوڈ
                  </button>
                </div>
              </div>

              <div className="bulk-io-form-grid">
                <div className="bulk-io-form-group">
                  <label htmlFor="import-target-class-select">ہدف کلاس (جس میں طلباء شامل کرنے ہیں) *</label>
                  <select
                    id="import-target-class-select"
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="bulk-io-select"
                  >
                    <option value="">-- کلاس کا انتخاب کریں --</option>
                    {classesList.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bulk-io-form-group">
                  <label htmlFor={fileInputId}>فائل منتخب کریں (Excel / Word / PDF) *</label>
                  <div className="bulk-io-dropzone">
                    <input
                      id={fileInputId}
                      type="file"
                      accept=".xlsx,.xls,.csv,.docx,.doc,.pdf"
                      onChange={handleFileChange}
                      className="bulk-io-file-input"
                    />
                    <div className="bulk-io-dropzone-inner">
                      <div className="bulk-io-dropzone-title">
                        {selectedFile ? selectedFile.name : 'یہاں فائل منتخب کریں یا براؤز کریں'}
                      </div>
                      <div className="bulk-io-dropzone-hint">
                        سپورٹ شدہ فارمیٹس: ایکسل (.xlsx, .xls, .csv)، ورڈ (.docx) یا پی ڈی ایف (.pdf)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bulk-io-actions-bar">
                <button
                  type="button"
                  className="bulk-io-btn primary large"
                  disabled={!selectedFile || !targetClassId || parseLoading}
                  onClick={handleProcessFile}
                >
                  {parseLoading ? 'فائل کا تجزیہ کیا جا رہا ہے...' : 'اگلا مرحلہ: فائل پڑھیں اور میپنگ کریں ↓'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING & LIVE PREVIEW */}
          {importStep === 2 && parsedData && (
            <div className="bulk-io-step-content">
              <div className="bulk-io-card-header">
                <h3>مرحلہ 2: کالمز کی جانچ اور میپنگ کی تصدیق</h3>
                <p>
                  فائل میں کل <strong>{parsedData.totalRows}</strong> قطاریں پائی گئیں۔ سسٹم نے اردو RTL ترتیب کے تحت کالمز کو دائیں سے بائیں شمار کیا ہے۔ برائے مہربانی تصدیق کریں کہ کون سا کالم کس فیلڈ کے ساتھ جڑا ہے۔
                </p>
              </div>

              {/* RTL / LTR Direction Bar */}
              <div className="bulk-io-rtl-direction-bar">
                <div className="bulk-io-rtl-status">
                  <span className="bulk-io-rtl-label">کالمز کی گنتی و تحریری سمت:</span>
                  <span className="bulk-io-rtl-pill">
                    {isRtlOrder ? 'دائیں سے بائیں (RTL - اردو جدول ترتیب)' : 'بائیں سے دائیں (LTR ترتیب)'}
                  </span>
                </div>
                <button
                  type="button"
                  className="bulk-io-rtl-toggle-btn"
                  onClick={handleToggleReverseColumns}
                  title="اگر کالمز کی ترتیب الٹی ہو تو اسے تبدیل کریں"
                >
                  کالمز کی ترتیب الٹیں (RTL ⇄ LTR)
                </button>
              </div>

              {/* Duplicate Notice Banner (if any) */}
              {duplicateAnalysis && duplicateAnalysis.hasDuplicates && (
                <div className="bulk-io-dup-alert">
                  <div className="bulk-io-dup-alert-header">
                    <strong>توجہ فرمائیں: لسٹ میں ڈپلیکیٹ طلباء کی نشاندہی ہوئی ہے</strong>
                  </div>
                  <div className="bulk-io-dup-alert-body">
                    {duplicateAnalysis.fileDuplicates.length > 0 && (
                      <p>
                        اسی فائل میں <strong>{duplicateAnalysis.fileDuplicates.length}</strong> ریکارڈز مکرر (Duplicate) پائے گئے ہیں۔
                      </p>
                    )}
                    {duplicateAnalysis.systemDuplicates.length > 0 && (
                      <p>
                        مدرسے میں پہلے سے موجود <strong>{duplicateAnalysis.systemDuplicates.length}</strong> طلباء کے ساتھ ہم نامی یا ب فارم مماثلت پائی گئی ہے۔
                      </p>
                    )}
                  </div>
                  <div className="bulk-io-dup-options">
                    <label className="bulk-io-radio-label">
                      <input
                        type="radio"
                        name="dupPolicy"
                        value="skip"
                        checked={duplicateAction === 'skip'}
                        onChange={() => handleDuplicateActionChange('skip')}
                      />
                      <span>(تجویز کردہ) ڈپلیکیٹ طلباء کو خودکار چھوڑ دیں (صرف منفرد طلباء داخل ہوں)</span>
                    </label>
                    <label className="bulk-io-radio-label">
                      <input
                        type="radio"
                        name="dupPolicy"
                        value="allow"
                        checked={duplicateAction === 'allow'}
                        onChange={() => handleDuplicateActionChange('allow')}
                      />
                      <span>تمام طلباء کو شامل کریں (اگر ہم نام دو مختلف بچے ہوں)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="bulk-io-mapping-grid">
                {SYSTEM_FIELD_DEFS.map((field) => {
                  const currentMappedIdx = columnMapping[field.key] ?? -1;
                  return (
                    <div key={field.key} className="bulk-io-mapping-row">
                      <div className="bulk-io-field-info">
                        <span className="bulk-io-field-label">
                          {field.label} {field.required ? '*' : ''}
                        </span>
                        <span className="bulk-io-field-badge">
                          {field.required ? 'لازمی' : 'اختیاری'}
                        </span>
                      </div>
                      <div className="bulk-io-mapping-select-wrap">
                        <select
                          value={currentMappedIdx}
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          className={`bulk-io-select ${field.required && currentMappedIdx === -1 ? 'error-border' : ''}`}
                        >
                          <option value={-1}>-- شامل نہیں ہے (خالی چھوڑیں) --</option>
                          {parsedData.headers.map((h, idx) => {
                            const colNum = idx + 1;
                            const isFirst = idx === 0;
                            const isLast = idx === parsedData.headers.length - 1;
                            const posLabel = isFirst
                              ? ' (دائیں طرف پہلا کالم)'
                              : isLast
                              ? ' (بائیں طرف آخری کالم)'
                              : '';
                            return (
                              <option key={idx} value={idx}>
                                کالم {colNum}: {h || `(بے نام کالم ${colNum})`}{posLabel}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Preview Table */}
              <div className="bulk-io-preview-section">
                <h4>ڈیٹا پریویو (پہلے 3 ریکارڈز کا نمونہ):</h4>
                <div className="table-responsive">
                  <table className="bulk-io-table">
                    <thead>
                      <tr>
                        <th>نمبر</th>
                        <th>طالب علم کا نام</th>
                        <th>والد کا نام</th>
                        <th>انگریزی نام</th>
                        <th>جنس</th>
                        <th>تاریخ پیدائش</th>
                        <th>موبائل نمبر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.rows.slice(0, 3).map((row, rIdx) => {
                        const getVal = (key) => {
                          const idx = columnMapping[key];
                          return idx !== undefined && idx >= 0 && row[idx] ? String(row[idx]) : '-';
                        };
                        return (
                          <tr key={rIdx}>
                            <td>{rIdx + 1}</td>
                            <td><strong>{getVal('name')}</strong></td>
                            <td>{getVal('father_name')}</td>
                            <td>{getVal('name_english')}</td>
                            <td>{getVal('gender')}</td>
                            <td>{getVal('date_of_birth')}</td>
                            <td>{getVal('father_mobile')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bulk-io-actions-bar">
                <button
                  type="button"
                  className="bulk-io-btn secondary"
                  onClick={() => setImportStep(1)}
                >
                  ↑ واپس: فائل تبدیل کریں
                </button>
                <button
                  type="button"
                  className="bulk-io-btn primary large"
                  onClick={handleProceedToConfirmation}
                >
                  اگلا مرحلہ: رجسٹریشن نمبر کی تصدیق ↓
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SEQUENTIAL REGISTRATION NUMBER CONFIRMATION MODAL */}
          {importStep === 3 && (
            <div className="bulk-io-step-content">
              <div className="bulk-io-confirm-modal-box">
                <div className="bulk-io-confirm-header">
                  <h3>تصدیق برائے بلک داخلہ (Sequential Roll Number Confirmation)</h3>
                </div>

                <div className="bulk-io-confirm-body">
                  <div className="bulk-io-confirm-detail-row">
                    <span className="bulk-io-detail-key">منتخب ہدف کلاس:</span>
                    <span className="bulk-io-detail-val">
                      {classesList.find((c) => c.id === targetClassId)?.class_name || 'کلاس'}
                    </span>
                  </div>

                  <div className="bulk-io-confirm-detail-row">
                    <span className="bulk-io-detail-key">کل طلباء برائے اندراج:</span>
                    <span className="bulk-io-detail-val">
                      <strong>{previewPayloads.length}</strong> طلباء
                    </span>
                  </div>

                  {duplicateAnalysis && (duplicateAnalysis.fileDuplicates.length > 0 || duplicateAnalysis.systemDuplicates.length > 0) && (
                    <div className="bulk-io-confirm-detail-row">
                      <span className="bulk-io-detail-key">ڈپلیکیٹ کا تدارک:</span>
                      <span className="bulk-io-detail-val">
                        {duplicateAction === 'skip'
                          ? `${duplicateAnalysis.fileDuplicates.length} ڈپلیکیٹ طلباء کو چھوڑ کر ${previewPayloads.length} منفرد طلباء درج کیے جائیں گے`
                          : `تمام ${previewPayloads.length} طلباء بشمول ممکنہ ڈپلیکیٹس محفوظ کیے جائیں گے`}
                      </span>
                    </div>
                  )}

                  <div className="bulk-io-reg-notice-box">
                    <div className="bulk-io-reg-notice-title">
                      اہم اطلاع برائے رجسٹریشن نمبر
                    </div>
                    <div className="bulk-io-reg-notice-text">
                      سسٹم میں موجود آخری رجسٹریشن نمبر کے بعد، نئی لسٹ کے طلباء کو خودکار طور پر ترتیب وار نمبرز دیے جائیں گے۔
                    </div>
                    <div className="bulk-io-reg-range-badge">
                      اگلا رجسٹریشن نمبر <strong>{String(startRollNo).padStart(2, '0')}</strong> سے شروع ہو کر <strong>{String(startRollNo + previewPayloads.length - 1).padStart(2, '0')}</strong> پر مکمل ہوگا
                    </div>
                  </div>

                  <div className="bulk-io-confirm-summary-note">
                    کیا آپ ان تمام {previewPayloads.length} طلباء کو کلاس میں شامل کر کے محفوظ کرنا چاہتے ہیں؟
                  </div>
                </div>

                <div className="bulk-io-actions-bar centered">
                  <button
                    type="button"
                    className="bulk-io-btn secondary"
                    onClick={() => setImportStep(2)}
                  >
                    ↑ واپس: کالم میپنگ تبدیل کریں
                  </button>
                  <button
                    type="button"
                    className="bulk-io-btn primary large"
                    onClick={handleExecuteImport}
                  >
                    تصدیق کریں اور ڈیٹا محفوظ کریں
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PROGRESS & FINAL SUCCESS */}
          {importStep === 4 && (
            <div className="bulk-io-step-content">
              {isSaving && (
                <div className="bulk-io-progress-box">
                  <h3>ڈیٹا محفوظ کیا جا رہا ہے...</h3>
                  <p>برائے مہربانی انتظار فرمائیں، طلباء کا ریکارڈ لوکل اسٹوریج اور کلاؤڈ ڈیٹا بیس میں محفوظ ہو رہا ہے۔</p>
                  <div className="bulk-io-progress-bar-wrap">
                    <div
                      className="bulk-io-progress-bar-fill"
                      style={{
                        width: `${saveProgress.total > 0 ? (saveProgress.saved / saveProgress.total) * 100 : 10}%`
                      }}
                    ></div>
                  </div>
                  <div className="bulk-io-progress-text">
                    {saveProgress.saved} میں سے {saveProgress.total} طلباء محفوظ ہو گئے۔
                  </div>
                </div>
              )}

              {saveError && (
                <div className="bulk-io-alert error">
                  <span>{saveError}</span>
                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="bulk-io-btn primary"
                      onClick={handleExecuteImport}
                    >
                      دوبارہ کوشش کریں
                    </button>
                    <button
                      type="button"
                      className="bulk-io-btn secondary"
                      style={{ marginRight: '8px' }}
                      onClick={() => setImportStep(3)}
                    >
                      واپس
                    </button>
                  </div>
                </div>
              )}

              {!isSaving && saveSuccessInfo && (
                <div className="bulk-io-success-box">
                  <div className="bulk-io-success-badge">کامیاب عمل</div>
                  <h3>مبارک ہو! تمام طلباء کامیابی سے شامل کر دیے گئے ہیں۔</h3>
                  <div className="bulk-io-success-details">
                    <p>
                      کلاس: <strong>{saveSuccessInfo.className}</strong>
                    </p>
                    <p>
                      کل شامل شدہ طلباء: <strong>{saveSuccessInfo.count}</strong>
                    </p>
                    <p>
                      تفویض کردہ رجسٹریشن نمبرز: <strong>{saveSuccessInfo.startRoll}</strong> تا <strong>{saveSuccessInfo.endRoll}</strong>
                    </p>
                    <p className="bulk-io-sync-status">
                      ڈیٹا بیک وقت لوکل کیش اور سپابیس کلاؤڈ ڈیٹا بیس میں ہم آہنگ (Synced) ہو چکا ہے۔
                    </p>
                  </div>

                  <div className="bulk-io-actions-bar centered">
                    <button
                      type="button"
                      className="bulk-io-btn secondary"
                      onClick={handleResetImport}
                    >
                      مزید طلباء امپورٹ کریں
                    </button>
                    {typeof onViewClass === 'function' && targetClassId && (
                      <button
                        type="button"
                        className="bulk-io-btn primary"
                        onClick={() => onViewClass(targetClassId)}
                      >
                        کلاس لسٹ دیکھیں
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

