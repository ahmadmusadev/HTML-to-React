import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import PrintPortal from './PrintPortal';
import {
  calculateDuration,
  calculateAgeAtBenchmark,
  toHijriDateString,
  getGradeFromScore,
  mapCompletionFormSupabaseToUi,
  mapCompletionFormUiToSupabase
} from '../utils/hifzCompletionFormLogic';
import './CumulativeHifzForm.css';

export default function CumulativeHifzForm({ initialStudentId = null, onSelectStudent = null }) {
  const {
    activeMadrasaId,
    activeMadrasa,
    activeLogo,
    fetchStudentsFromSupabase,
    fetchClassesFromSupabase,
    fetchExamResultsFromSupabase,
    fetchHifzCompletionFormsFromSupabase,
    fetchHifzCompletionFormForStudent,
    saveHifzCompletionFormToSupabase,
    classesList: contextClassesList
  } = useMadrasa();

  const [classesList, setClassesList] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [viewMode, setViewMode] = useState('form'); // 'form' | 'preview'

  const todayIso = new Date().toISOString().split('T')[0];

  const emptyFormData = {
    id: null,
    computerId: '',
    initialDepartment: '',
    admissionDate: '',
    qaidaStartDate: '',
    qaidaCompletionDate: '',
    naziraStartDate: '',
    naziraCompletionDate: '',
    hifzStartDate: '',
    hifzCompletionDate: '',
    hifzCompletionHijri: '',
    hifzDurationText: '',
    daurDurationText: '',
    branchName: '',
    areaName: '',
    teacherName: '',
    overallQuality: 'اوسط',
    shishmahiMarks: '',
    shishmahiGrade: '',
    salanaMarks: '',
    salanaGrade: '',
    wifaqMarks: '',
    wifaqGrade: '',
    attendanceQuality: 'بہترین',
    parentsConduct: 'مناسب',
    monthlyFee: '',
    feeConcession: '0',
    concessionType: '—',
    specialNotes: '',
    formDate: todayIso,
    preparerName: 'ایڈمن'
  };

  const [formData, setFormData] = useState(emptyFormData);

  // Load classes and students
  useEffect(() => {
    let isMounted = true;
    const loadInit = async () => {
      try {
        const [clsData, stdsData] = await Promise.all([
          fetchClassesFromSupabase ? fetchClassesFromSupabase(activeMadrasaId) : Promise.resolve([]),
          fetchStudentsFromSupabase ? fetchStudentsFromSupabase(activeMadrasaId) : Promise.resolve([])
        ]);
        if (!isMounted) return;
        if (Array.isArray(clsData)) setClassesList(clsData);
        else if (Array.isArray(contextClassesList)) setClassesList(contextClassesList);
        if (Array.isArray(stdsData)) setStudents(stdsData);
      } catch (err) {
        console.warn('Error loading classes/students in CumulativeHifzForm:', err);
      }
    };
    loadInit();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // Selected student object
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => s.id === selectedStudentId || s.admRegNo === selectedStudentId || s.roll_number === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // Filtered students by class or search
  const filteredStudents = useMemo(() => {
    let list = students.filter(s => {
      if (s.isWithdrawn === true || s.status === 'left' || s.status === 'withdrawn') return false;
      if (s.isFeeRecord || s.isExamRecord) return false;
      return true;
    });

    if (selectedClassId) {
      list = list.filter(s => {
        const cId = s.class_id || s.admClass || s.classId;
        return String(cId) === String(selectedClassId);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => {
        const name = (s.name || s.admName || '').toLowerCase();
        const father = (s.father_name || s.admFatherName || '').toLowerCase();
        const roll = String(s.roll_number || s.admRegNo || '').toLowerCase();
        return name.includes(q) || father.includes(q) || roll.includes(q);
      });
    }

    return list;
  }, [students, selectedClassId, searchQuery]);

  // When student changes, fetch saved form or pre-fill from student/madrasa context
  useEffect(() => {
    let isMounted = true;
    if (!selectedStudent) {
      setFormData(emptyFormData);
      return;
    }

    const loadFormForStudent = async () => {
      let existingForm = null;
      if (fetchHifzCompletionFormForStudent && selectedStudent.id) {
        try {
          existingForm = await fetchHifzCompletionFormForStudent(selectedStudent.id, activeMadrasaId);
        } catch (e) {
          console.warn('Error fetching completion form:', e);
        }
      }

      if (!isMounted) return;

      if (existingForm) {
        setFormData(mapCompletionFormSupabaseToUi(existingForm));
        return;
      }

      // Pre-fill from student data
      const roll = selectedStudent.roll_number || selectedStudent.admRegNo || '';
      const admDate = selectedStudent.admission_date || selectedStudent.admDate || '';
      const initDept = selectedStudent.initial_department || selectedStudent.department || selectedStudent.admDepartment || 'قاعدہ';
      const qStart = selectedStudent.qaida_start_date || (initDept === 'قاعدہ' ? admDate : '');
      const qEnd = selectedStudent.qaida_completion_date || '';
      const nStart = selectedStudent.nazira_start_date || (initDept === 'ناظرہ' ? admDate : '');
      const nEnd = selectedStudent.nazira_completion_date || '';
      const hStart = selectedStudent.hifz_start_date || selectedStudent.hifzStartDate || (initDept === 'حفظ' ? admDate : '');
      const hEnd = selectedStudent.hifz_completion_date || selectedStudent.completion_date || todayIso;

      // Auto durations
      const hDuration = hStart && hEnd ? calculateDuration(hStart, hEnd).text : '';
      const hHijri = hEnd ? toHijriDateString(hEnd) : '';

      // Teacher Name from class
      const cls = classesList.find(c => String(c.id) === String(selectedStudent.class_id || selectedStudent.admClass));
      const teacher = cls?.teacher_name || cls?.teacher || '';

      // Branch & Area
      const branch = activeMadrasa?.name || '';
      const area = activeMadrasa?.district || selectedStudent.address || '';

      setFormData({
        ...emptyFormData,
        id: null,
        computerId: roll,
        initialDepartment: initDept,
        admissionDate: admDate,
        qaidaStartDate: qStart,
        qaidaCompletionDate: qEnd,
        naziraStartDate: nStart,
        naziraCompletionDate: nEnd,
        hifzStartDate: hStart,
        hifzCompletionDate: hEnd,
        hifzCompletionHijri: hHijri,
        hifzDurationText: hDuration,
        daurDurationText: '',
        branchName: branch,
        areaName: area,
        teacherName: teacher,
        overallQuality: 'اوسط',
        shishmahiMarks: '',
        shishmahiGrade: '',
        salanaMarks: '',
        salanaGrade: '',
        wifaqMarks: '',
        wifaqGrade: '',
        attendanceQuality: 'بہترین',
        parentsConduct: 'مناسب',
        monthlyFee: '',
        feeConcession: '0',
        concessionType: '—',
        specialNotes: '',
        formDate: todayIso,
        preparerName: 'ایڈمن'
      });
    };

    loadFormForStudent();
    return () => { isMounted = false; };
  }, [selectedStudent, activeMadrasaId]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      // Auto recalculate Hifz duration when start or completion date changes
      if (field === 'hifzStartDate' || field === 'hifzCompletionDate') {
        const s = field === 'hifzStartDate' ? value : next.hifzStartDate;
        const e = field === 'hifzCompletionDate' ? value : next.hifzCompletionDate;
        if (s && e) {
          next.hifzDurationText = calculateDuration(s, e).text;
          if (field === 'hifzCompletionDate' && e && !next.hifzCompletionHijri) {
            next.hifzCompletionHijri = toHijriDateString(e);
          }
        }
      }

      // Auto calculate exam grades from marks
      if (field === 'shishmahiMarks') {
        next.shishmahiGrade = getGradeFromScore(value);
      } else if (field === 'salanaMarks') {
        next.salanaGrade = getGradeFromScore(value);
      } else if (field === 'wifaqMarks') {
        next.wifaqGrade = getGradeFromScore(value);
      }

      return next;
    });
  };

  // Student DOB & Age calculations
  const dobParts = useMemo(() => {
    if (!selectedStudent) return { year: '—', month: '—', day: '—' };
    const dob = selectedStudent.date_of_birth || selectedStudent.admDobFull || '';
    if (!dob) return { year: '—', month: '—', day: '—' };
    const parts = dob.split(/[-/]/);
    if (parts.length === 3) {
      return {
        year: parts[0],
        month: parts[1],
        day: parts[2]
      };
    }
    return { year: '—', month: '—', day: '—' };
  }, [selectedStudent]);

  const benchmarkAge = useMemo(() => {
    if (!selectedStudent) return '—';
    const dob = selectedStudent.date_of_birth || selectedStudent.admDobFull;
    if (!dob) return '—';
    const targetDate = formData.hifzCompletionDate || todayIso;
    const res = calculateAgeAtBenchmark(dob, targetDate);
    return res || '—';
  }, [selectedStudent, formData.hifzCompletionDate, todayIso]);

  // Save form
  const handleSave = async () => {
    if (!selectedStudent || !selectedStudent.id) {
      alert('براہِ کرم پہلے کسی طالب علم کا انتخاب کریں۔');
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const payload = mapCompletionFormUiToSupabase(formData, activeMadrasaId, selectedStudent.id);
      const saved = await saveHifzCompletionFormToSupabase(payload, activeMadrasaId);
      if (saved) {
        setFormData(mapCompletionFormSupabaseToUi(saved));
      }
      setSaveMessage('کارکردگی فارم کامیابی سے محفوظ ہو گیا ہے۔');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      console.error('Error saving completion form:', err);
      alert(err.message || 'فارم محفوظ کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setIsSaving(false);
    }
  };

  // Print form
  const handlePrint = () => {
    if (!selectedStudent) {
      alert('پرنٹ کرنے سے پہلے طالب علم کا انتخاب کریں۔');
      return;
    }
    setIsPrinting(true);
    document.body.classList.add('printing-hifz-completion');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-hifz-completion');
        setIsPrinting(false);
      }, 500);
    }, 150);
  };

  const madrasaNameUrdu = activeMadrasa?.name || 'جامعہ حفظ القرآن الکریم';
  const madrasaNameEnglish = activeMadrasa?.name_english || activeMadrasa?.nameEnglish || 'JAMIA HIFZ-UL-QURAN';

  return (
    <div className="cumulative-hifz-container" dir="rtl">
      {/* Top Action Bar & Student Selector */}
      <div className="card cumulative-controls-card no-print">
        <div className="cumulative-controls-header">
          <div>
            <h2 className="cumulative-main-title">مجموعی حفظ کارکردگی فارم</h2>
            <p className="cumulative-sub-title">تکمیلِ حفظ کے بعد طالب علم کے جامع تعلیمی دورانیے، مراحلِ ترقی اور کارکردگی کی تفصیلی رپورٹ</p>
          </div>
          <div className="cumulative-actions-wrap">
            <button
              type="button"
              className={`tab-btn-pill ${viewMode === 'form' ? 'active' : ''}`}
              onClick={() => setViewMode('form')}
            >
              اندراج فارم
            </button>
            <button
              type="button"
              className={`tab-btn-pill ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              پرنٹ پری ویو (A4)
            </button>
            <button
              type="button"
              className="action-btn-save"
              onClick={handleSave}
              disabled={isSaving || !selectedStudent}
            >
              {isSaving ? 'محفوظ ہو رہا ہے...' : 'محفوظ کریں'}
            </button>
            <button
              type="button"
              className="action-btn-print"
              onClick={handlePrint}
              disabled={!selectedStudent}
            >
              پرنٹ / پی ڈی ایف ڈاؤن لوڈ
            </button>
          </div>
        </div>

        {saveMessage && (
          <div className="alert-success-banner">
            {saveMessage}
          </div>
        )}

        <div className="cumulative-selector-grid">
          <div>
            <label htmlFor="cumStudentSearch">تلاش (نام یا رجسٹریشن نمبر)</label>
            <input
              id="cumStudentSearch"
              type="text"
              placeholder="طالب علم تلاش کریں..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="cumClassSelect">کلاس فلٹر</label>
            <select
              id="cumClassSelect"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStudentId('');
              }}
            >
              <option value="">تمام کلاسز</option>
              {classesList.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.class_name || c.className || c.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cumStudentSelect">طالب علم منتخب کریں</label>
            <select
              id="cumStudentSelect"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">طالب علم کا انتخاب کریں...</option>
              {filteredStudents.map(s => {
                const roll = s.roll_number || s.admRegNo || '—';
                const name = s.name || s.admName || '';
                const father = s.father_name || s.admFatherName || '';
                return (
                  <option key={s.id} value={s.id}>
                    {name} ولد {father} (رول نمبر: {roll})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {!selectedStudent && (
        <div className="card cumulative-empty-card no-print">
          <p className="empty-text">براہِ کرم اوپر دی گئی فہرست میں سے کسی طالب علم کا انتخاب کریں تاکہ فارم دیکھا یا پُر کیا جا سکے۔</p>
        </div>
      )}

      {selectedStudent && viewMode === 'form' && (
        <div className="cumulative-form-sections-wrap no-print">
          {/* Section 1: طالب علم کے بنیادی کوائف */}
          <div className="card form-section-card">
            <h3 className="section-heading">1. کوائفِ طالب علم (خودکار سنک شدہ)</h3>
            <div className="grid-3">
              <div>
                <label>نام طالب علم</label>
                <input type="text" readOnly value={selectedStudent.name || selectedStudent.admName || '—'} className="readonly-input" />
              </div>
              <div>
                <label>ولدیت</label>
                <input type="text" readOnly value={selectedStudent.father_name || selectedStudent.admFatherName || '—'} className="readonly-input" />
              </div>
              <div>
                <label>رجسٹریشن نمبر</label>
                <input type="text" readOnly value={selectedStudent.roll_number || selectedStudent.admRegNo || '—'} className="readonly-input" />
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '12px' }}>
              <div>
                <label>کمپیوٹر آئی ڈی نمبر</label>
                <input
                  type="text"
                  value={formData.computerId}
                  onChange={(e) => handleFieldChange('computerId', e.target.value)}
                  placeholder="آئی ڈی درج کریں"
                />
              </div>
              <div>
                <label>رہائشی پتہ</label>
                <input type="text" readOnly value={selectedStudent.address || selectedStudent.admAddress || '—'} className="readonly-input" />
              </div>
              <div>
                <label>علاقہ / ضلع</label>
                <input
                  type="text"
                  value={formData.areaName}
                  onChange={(e) => handleFieldChange('areaName', e.target.value)}
                  placeholder="شہر / علاقہ"
                />
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '12px' }}>
              <div>
                <label>فون نمبر گھر</label>
                <input type="text" readOnly value={selectedStudent.father_mobile || selectedStudent.guardian_mobile || '—'} className="readonly-input" />
              </div>
              <div>
                <label>تاریخ پیدائش (دن - مہینہ - سال)</label>
                <input type="text" readOnly value={`${dobParts.day} / ${dobParts.month} / ${dobParts.year}`} className="readonly-input" />
              </div>
              <div>
                <label>تکمیل پر تخمینی عمر</label>
                <input type="text" readOnly value={benchmarkAge} className="readonly-input" />
              </div>
            </div>
          </div>

          {/* Section 2: داخلہ اور مراحلِ ترقی */}
          <div className="card form-section-card">
            <h3 className="section-heading">2. داخلہ اور مراحلِ ترقی (قاعدہ، ناظرہ، حفظ)</h3>
            <div className="grid-2">
              <div>
                <label>پہلا داخلہ کس شعبہ میں ہوا</label>
                <select
                  value={formData.initialDepartment}
                  onChange={(e) => handleFieldChange('initialDepartment', e.target.value)}
                >
                  <option value="قاعدہ">شعبہ قاعدہ</option>
                  <option value="ناظرہ">شعبہ ناظرہ</option>
                  <option value="حفظ">شعبہ حفظ</option>
                </select>
              </div>
              <div>
                <label>تاریخ داخلہ</label>
                <input
                  type="date"
                  value={formData.admissionDate}
                  onChange={(e) => handleFieldChange('admissionDate', e.target.value)}
                />
              </div>
            </div>

            <div className="milestones-table-wrap" style={{ marginTop: '15px' }}>
              <table className="milestones-input-table">
                <thead>
                  <tr>
                    <th>شعبہ</th>
                    <th>تاریخ آغاز</th>
                    <th>تاریخ تکمیل</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>شعبہ قاعدہ</strong></td>
                    <td>
                      <input
                        type="date"
                        value={formData.qaidaStartDate}
                        onChange={(e) => handleFieldChange('qaidaStartDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={formData.qaidaCompletionDate}
                        onChange={(e) => handleFieldChange('qaidaCompletionDate', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td><strong>شعبہ ناظرہ</strong></td>
                    <td>
                      <input
                        type="date"
                        value={formData.naziraStartDate}
                        onChange={(e) => handleFieldChange('naziraStartDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={formData.naziraCompletionDate}
                        onChange={(e) => handleFieldChange('naziraCompletionDate', e.target.value)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td><strong>شعبہ حفظ</strong></td>
                    <td>
                      <input
                        type="date"
                        value={formData.hifzStartDate}
                        onChange={(e) => handleFieldChange('hifzStartDate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={formData.hifzCompletionDate}
                        onChange={(e) => handleFieldChange('hifzCompletionDate', e.target.value)}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid-3" style={{ marginTop: '15px' }}>
              <div>
                <label>ہجری تاریخ تکمیل</label>
                <input
                  type="text"
                  value={formData.hifzCompletionHijri}
                  onChange={(e) => handleFieldChange('hifzCompletionHijri', e.target.value)}
                  placeholder="مثلاً 1447-11-20"
                />
              </div>
              <div>
                <label>تکمیلِ حفظ کی مدت</label>
                <input
                  type="text"
                  value={formData.hifzDurationText}
                  onChange={(e) => handleFieldChange('hifzDurationText', e.target.value)}
                  placeholder="مثلاً 5 سال، 6 ماہ، 18 دن"
                />
              </div>
              <div>
                <label>گردان کی مدت</label>
                <input
                  type="text"
                  value={formData.daurDurationText}
                  onChange={(e) => handleFieldChange('daurDurationText', e.target.value)}
                  placeholder="مثلاً 0 سال، 1 ماہ، 19 دن"
                />
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '15px' }}>
              <div>
                <label>شاخ</label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => handleFieldChange('branchName', e.target.value)}
                />
              </div>
              <div>
                <label>معلم / معلمہ</label>
                <input
                  type="text"
                  value={formData.teacherName}
                  onChange={(e) => handleFieldChange('teacherName', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="cumOverallQuality">مجموعی کیفیت</label>
                <select
                  id="cumOverallQuality"
                  value={formData.overallQuality}
                  onChange={(e) => handleFieldChange('overallQuality', e.target.value)}
                >
                  <option value="بہترین">بہترین</option>
                  <option value="بہتر">بہتر</option>
                  <option value="اوسط">اوسط</option>
                  <option value="قدرے اوسط">قدرے اوسط</option>
                  <option value="کمزور">کمزور</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: تکمیل کے سال کے امتحانی نتائج */}
          <div className="card form-section-card">
            <h3 className="section-heading">3. تکمیلِ حفظ کے سال کے نتائج</h3>
            <div className="table-responsive">
              <table className="results-input-table">
                <thead>
                  <tr>
                    <th>امتحان</th>
                    <th>حاصل کردہ نمبرات</th>
                    <th>درجہ کامیابی</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>ششماہی امتحان</strong></td>
                    <td>
                      <input
                        type="number"
                        value={formData.shishmahiMarks}
                        onChange={(e) => handleFieldChange('shishmahiMarks', e.target.value)}
                        placeholder="نمبرات"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={formData.shishmahiGrade}
                        onChange={(e) => handleFieldChange('shishmahiGrade', e.target.value)}
                        placeholder="درجہ (مثلاً جید / ممتاز)"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td><strong>امتحان سالانہ / تکمیل حفظ</strong></td>
                    <td>
                      <input
                        type="number"
                        value={formData.salanaMarks}
                        onChange={(e) => handleFieldChange('salanaMarks', e.target.value)}
                        placeholder="نمبرات"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={formData.salanaGrade}
                        onChange={(e) => handleFieldChange('salanaGrade', e.target.value)}
                        placeholder="درجہ"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td><strong>امتحان وفاق المدارس</strong></td>
                    <td>
                      <input
                        type="number"
                        value={formData.wifaqMarks}
                        onChange={(e) => handleFieldChange('wifaqMarks', e.target.value)}
                        placeholder="نمبرات"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={formData.wifaqGrade}
                        onChange={(e) => handleFieldChange('wifaqGrade', e.target.value)}
                        placeholder="درجہ"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: حاضری، فیس، والدین کا رویہ */}
          <div className="card form-section-card">
            <h3 className="section-heading">4. حاضری، والدین کا رویہ، فیس و رعایت</h3>
            <div className="grid-2">
              <div>
                <label>حاضری کی نوعیت</label>
                <select
                  value={formData.attendanceQuality}
                  onChange={(e) => handleFieldChange('attendanceQuality', e.target.value)}
                >
                  <option value="بہترین">بہترین</option>
                  <option value="مناسب">مناسب</option>
                  <option value="اطمینان بخش">اطمینان بخش</option>
                  <option value="غیر تسلی بخش">غیر تسلی بخش</option>
                </select>
              </div>
              <div>
                <label>والدین کا رویہ</label>
                <select
                  value={formData.parentsConduct}
                  onChange={(e) => handleFieldChange('parentsConduct', e.target.value)}
                >
                  <option value="بہترین">بہترین</option>
                  <option value="مناسب">مناسب</option>
                  <option value="تعاون بخش">تعاون بخش</option>
                  <option value="غیر سنجیدہ">غیر سنجیدہ</option>
                </select>
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '15px' }}>
              <div>
                <label>مقررہ فیس</label>
                <input
                  type="number"
                  value={formData.monthlyFee}
                  onChange={(e) => handleFieldChange('monthlyFee', e.target.value)}
                  placeholder="ماہانہ فیس"
                />
              </div>
              <div>
                <label>اگر رعایت تھی تو کس قدر</label>
                <input
                  type="number"
                  value={formData.feeConcession}
                  onChange={(e) => handleFieldChange('feeConcession', e.target.value)}
                  placeholder="رعایت کی رقم"
                />
              </div>
              <div>
                <label>رعایت کی نوعیت</label>
                <input
                  type="text"
                  value={formData.concessionType}
                  onChange={(e) => handleFieldChange('concessionType', e.target.value)}
                  placeholder="مثلاً یتیم / مستحق / کوئی نہیں"
                />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label>کوئی خاص بات</label>
              <textarea
                rows="2"
                value={formData.specialNotes}
                onChange={(e) => handleFieldChange('specialNotes', e.target.value)}
                placeholder="اساتذہ یا ناظم کے خصوصی تاثرات و ریمارکس"
              ></textarea>
            </div>
          </div>

          {/* Section 5: دستخط اور فارم کی تاریخ */}
          <div className="card form-section-card">
            <h3 className="section-heading">5. توثیق و دستخط</h3>
            <div className="grid-3">
              <div>
                <label>دستخط مرتب (نام)</label>
                <input
                  type="text"
                  value={formData.preparerName}
                  onChange={(e) => handleFieldChange('preparerName', e.target.value)}
                />
              </div>
              <div>
                <label>تاریخ فارم</label>
                <input
                  type="date"
                  value={formData.formDate}
                  onChange={(e) => handleFieldChange('formDate', e.target.value)}
                />
              </div>
              <div>
                <label>ادارہ کی مہر</label>
                <input type="text" readOnly value="مہر کے لیے مخصوص جگہ" className="readonly-input" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Preview Mode (When user switches to A4 preview tab) */}
      {selectedStudent && viewMode === 'preview' && (
        <div className="cumulative-screen-preview-wrap no-print">
          <div className="a4-preview-notice">
            <span>A4 پرنٹ پری ویو — پرنٹ یا پی ڈی ایف ڈاؤن لوڈ کرنے کے لیے 'پرنٹ / پی ڈی ایف ڈاؤن لوڈ' کے بٹن پر کلک کریں۔</span>
          </div>
          <div className="a4-sheet-container">
            <HifzCompletionPrintDocument
              formData={formData}
              student={selectedStudent}
              dobParts={dobParts}
              benchmarkAge={benchmarkAge}
              madrasaNameUrdu={madrasaNameUrdu}
              madrasaNameEnglish={madrasaNameEnglish}
              activeLogo={activeLogo}
            />
          </div>
        </div>
      )}

      {/* Actual Print Portal Document (Rendered only during print or via PrintPortal) */}
      {selectedStudent && (
        <PrintPortal>
          <div className="hifz-completion-print-root">
            <HifzCompletionPrintDocument
              formData={formData}
              student={selectedStudent}
              dobParts={dobParts}
              benchmarkAge={benchmarkAge}
              madrasaNameUrdu={madrasaNameUrdu}
              madrasaNameEnglish={madrasaNameEnglish}
              activeLogo={activeLogo}
            />
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

/**
 * Pure Presentational Component: The A4 Printed Sheet.
 * Exact visual structure as per reference image, strictly Black & White.
 */
function HifzCompletionPrintDocument({
  formData,
  student,
  dobParts,
  benchmarkAge,
  madrasaNameUrdu,
  madrasaNameEnglish,
  activeLogo
}) {
  const stdName = student?.name || student?.admName || '—';
  const stdFather = student?.father_name || student?.admFatherName || '—';
  const stdRoll = student?.roll_number || student?.admRegNo || '—';
  const stdAddress = student?.address || student?.admAddress || '00';
  const stdPhone = student?.father_mobile || student?.guardian_mobile || '00';

  return (
    <div className="a4-hifz-print-page" dir="rtl">
      <div className="a4-border-frame">
        {/* Header: English Name (Left), Logo (Center), Urdu Name (Right) */}
        <div className="a4-header-row">
          <div className="a4-header-left-eng">
            <div className="eng-title-line1">{madrasaNameEnglish}</div>
            <div className="eng-title-line2">TRUST / FOUNDATION</div>
          </div>

          <div className="a4-header-center-logo">
            {activeLogo ? (
              <img src={activeLogo} alt="Madrasa Logo" className="a4-logo-img" />
            ) : (
              <div className="a4-logo-placeholder">ادارہ</div>
            )}
          </div>

          <div className="a4-header-right-urdu">
            <div className="urdu-main-title">{madrasaNameUrdu}</div>
          </div>
        </div>

        {/* Title Banner & Computer ID */}
        <div className="a4-banner-row">
          <div className="a4-banner-bar">
            <span>کارکردگی فارم برائے طلباء و طالبات حفظ</span>
          </div>
          <div className="a4-computer-id-box">
            <span className="computer-id-label">کمپیوٹر آئی ڈی نمبر</span>
            <span className="computer-id-value">{formData.computerId || stdRoll || '—'}</span>
          </div>
        </div>

        {/* Student Personal Information */}
        <div className="a4-details-section">
          {/* Row 1 */}
          <div className="a4-line-row">
            <div className="field-block col-name">
              <span className="field-lbl">نام طالب علم:</span>
              <span className="field-val underline">{stdName}</span>
            </div>
            <div className="field-block col-father">
              <span className="field-lbl">ولدیت:</span>
              <span className="field-val underline">{stdFather}</span>
            </div>
            <div className="field-block col-reg">
              <span className="field-lbl">رجسٹریشن نمبر:</span>
              <span className="field-val underline">{stdRoll}</span>
            </div>
          </div>

          {/* Row 2 */}
          <div className="a4-line-row">
            <div className="field-block full-width">
              <span className="field-lbl">پتہ:</span>
              <span className="field-val underline">{stdAddress}</span>
            </div>
          </div>

          {/* Row 3 */}
          <div className="a4-line-row">
            <div className="field-block col-area">
              <span className="field-lbl">علاقہ:</span>
              <span className="field-val underline">{formData.areaName || '—'}</span>
            </div>
            <div className="field-block col-home-phone">
              <span className="field-lbl">فون نمبر گھر:</span>
              <span className="phone-rect-box"></span>
            </div>
            <div className="field-block col-mobile">
              <span className="field-lbl">دفتر / موبائل:</span>
              <span className="field-val underline">{stdPhone}</span>
            </div>
          </div>

          {/* Row 4: DOB & Age */}
          <div className="a4-line-row dob-age-row">
            <div className="field-block dob-group">
              <span className="field-lbl">تاریخ پیدائش:</span>
              <div className="dob-box-group">
                <span className="dob-unit">
                  <span className="unit-label">سال</span>
                  <span className="unit-box">{dobParts.year}</span>
                </span>
                <span className="dob-unit">
                  <span className="unit-label">مہینہ</span>
                  <span className="unit-box">{dobParts.month}</span>
                </span>
                <span className="dob-unit">
                  <span className="unit-label">دن</span>
                  <span className="unit-box">{dobParts.day}</span>
                </span>
              </div>
            </div>

            <div className="field-block age-group">
              <span className="field-lbl">تکمیل پر عمر کتنی ہے؟</span>
              <span className="field-val underline">{benchmarkAge}</span>
            </div>
          </div>
        </div>

        <div className="a4-divider-line"></div>

        {/* Admission & Progression Stages */}
        <div className="a4-admission-header-row">
          <div className="admission-dept-col">
            <span>{madrasaNameUrdu} میں سب سے پہلے داخلہ کس شعبہ میں ہوا:</span>
            <span className="field-val underline" style={{ marginRight: '8px' }}>
              {formData.initialDepartment ? `شعبہ ${formData.initialDepartment}` : '—'}
            </span>
          </div>
          <div className="admission-date-col">
            <span>تاریخ داخلہ:</span>
            <span className="field-val underline" style={{ marginRight: '8px' }}>
              {formData.admissionDate || '—'}
            </span>
          </div>
        </div>

        {/* Section Heading: مراحل ترقی */}
        <div className="a4-section-banner">
          <span>مراحل ترقی</span>
        </div>

        {/* Stages Grid */}
        <div className="a4-stages-section">
          {/* Row 1: Qaida & Nazira */}
          <div className="a4-line-row stages-row">
            <div className="field-block col-route">
              <span className="field-lbl">(تاریخ آغاز / روٹ):</span>
            </div>
            <div className="field-block col-qaida">
              <span className="field-lbl">قاعدہ:</span>
              <span className="field-val underline">{formData.qaidaStartDate || '00-00-0000'}</span>
            </div>
            <div className="field-block col-nazira-start">
              <span className="field-lbl">ناظرہ:</span>
              <span className="field-val underline">{formData.naziraStartDate || '00-00-0000'}</span>
            </div>
            <div className="field-block col-nazira-end">
              <span className="field-lbl">تا ناظرہ:</span>
              <span className="field-val underline">{formData.naziraCompletionDate || '00-00-0000'}</span>
            </div>
          </div>

          {/* Row 2: Hifz start, completion, hijri */}
          <div className="a4-line-row stages-row">
            <div className="field-block col-hifz-start">
              <span className="field-lbl">تاریخ آغاز حفظ:</span>
              <span className="field-val underline">{formData.hifzStartDate || '00-00-0000'}</span>
            </div>
            <div className="field-block col-hifz-end">
              <span className="field-lbl">تاریخ تکمیل حفظ:</span>
              <span className="field-val underline">{formData.hifzCompletionDate || '00-00-0000'}</span>
            </div>
            <div className="field-block col-hijri">
              <span className="field-lbl">ہجری تاریخ:</span>
              <span className="field-val underline">{formData.hifzCompletionHijri || '00-00-0000'}</span>
            </div>
          </div>

          {/* Row 3: Durations */}
          <div className="a4-line-row stages-row">
            <div className="field-block col-hifz-duration">
              <span className="field-lbl">تکمیلِ حفظ کی مدت:</span>
              <span className="field-val underline">{formData.hifzDurationText || '—'}</span>
            </div>
            <div className="field-block col-daur-duration">
              <span className="field-lbl">گردان کی مدت:</span>
              <span className="field-val underline">{formData.daurDurationText || '—'}</span>
            </div>
          </div>

          {/* Row 4: Branch, Area, Teacher */}
          <div className="a4-line-row stages-row">
            <div className="field-block col-branch">
              <span className="field-lbl">شاخ:</span>
              <span className="field-val underline">{formData.branchName || '—'}</span>
            </div>
            <div className="field-block col-branch-area">
              <span className="field-lbl">علاقہ:</span>
              <span className="field-val underline">{formData.areaName || '—'}</span>
            </div>
            <div className="field-block col-teacher">
              <span className="field-lbl">معلم / معلمہ:</span>
              <span className="field-val underline">{formData.teacherName || '—'}</span>
            </div>
          </div>

          {/* Row 5: Overall Quality */}
          <div className="a4-line-row stages-row">
            <div className="field-block col-quality">
              <span className="field-lbl">مجموعی کیفیت:</span>
              <span className="field-val underline">{formData.overallQuality || 'اوسط'}</span>
            </div>
          </div>
        </div>

        <div className="a4-divider-line"></div>

        {/* Section Heading: تکمیلِ حفظ کے سال کے نتائج */}
        <div className="a4-section-banner">
          <span>تکمیلِ حفظ کے سال کے نتائج</span>
        </div>

        {/* Results Table (RTL Order) */}
        <table className="a4-results-table">
          <thead>
            <tr>
              <th colSpan="2" className="th-exam">ششماہی امتحان</th>
              <th colSpan="2" className="th-exam">امتحان سالانہ / تکمیل حفظ</th>
              <th colSpan="2" className="th-exam">امتحان وفاق المدارس</th>
            </tr>
            <tr className="sub-th-row">
              <th className="sub-th">نمبرات</th>
              <th className="sub-th">درجہ کامیابی</th>
              <th className="sub-th">نمبرات</th>
              <th className="sub-th">درجہ کامیابی</th>
              <th className="sub-th">نمبرات</th>
              <th className="sub-th">درجہ کامیابی</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="td-val">{formData.shishmahiMarks || 0}</td>
              <td className="td-val">{formData.shishmahiGrade || '—'}</td>
              <td className="td-val">{formData.salanaMarks || 0}</td>
              <td className="td-val">{formData.salanaGrade || '—'}</td>
              <td className="td-val">{formData.wifaqMarks || 0}</td>
              <td className="td-val">{formData.wifaqGrade || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Conduct, Attendance & Fee details */}
        <div className="a4-conduct-section">
          {/* Row 1 */}
          <div className="a4-line-row">
            <div className="field-block col-attendance">
              <span className="field-lbl">حاضری کی نوعیت:</span>
              <span className="field-val underline">{formData.attendanceQuality || 'بہترین'}</span>
            </div>
            <div className="field-block col-parents">
              <span className="field-lbl">والدین کا رویہ:</span>
              <span className="field-val underline">{formData.parentsConduct || 'مناسب'}</span>
            </div>
          </div>

          {/* Row 2: Fees */}
          <div className="a4-line-row">
            <div className="field-block col-fee">
              <span className="field-lbl">مقررہ فیس:</span>
              <span className="field-val underline">{formData.monthlyFee || '0'}</span>
            </div>
            <div className="field-block col-concession">
              <span className="field-lbl">اگر رعایت تھی تو کس قدر:</span>
              <span className="field-val underline">{formData.feeConcession || '0'}</span>
            </div>
            <div className="field-block col-concession-type">
              <span className="field-lbl">رعایت کی نوعیت:</span>
              <span className="field-val underline">{formData.concessionType || '—'}</span>
            </div>
          </div>

          {/* Row 3: Special Notes */}
          <div className="a4-line-row">
            <div className="field-block full-width">
              <span className="field-lbl">کوئی خاص بات:</span>
              <span className="field-val underline">{formData.specialNotes || '—'}</span>
            </div>
          </div>
        </div>

        <div className="a4-divider-line"></div>

        {/* Signatures & Stamp Footer (Strictly adapted according to user instructions) */}
        <div className="a4-footer-row">
          <div className="footer-stamp-area">
            <span className="footer-lbl">ادارہ کی مہر:</span>
            <div className="stamp-underline-box"></div>
          </div>

          <div className="footer-signatures-area">
            <div className="sig-line-item">
              <span className="footer-lbl">دستخط ناظم تعلیمات:</span>
              <div className="sig-underline"></div>
            </div>
            <div className="sig-line-item">
              <span className="footer-lbl">دستخط مرتب:</span>
              <div className="sig-underline"></div>
            </div>
            <div className="sig-line-item">
              <span className="footer-lbl">تاریخ:</span>
              <span className="date-underline-val">{formData.formDate || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
