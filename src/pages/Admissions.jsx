import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { DEFAULT_CLASSES } from '../constants/defaults';
import { isValidUUID } from '../lib/supabaseClient';
import './Admissions.css';

export const calculateAge = (dVal, mVal, yVal, admVal) => {
  dVal = parseInt(dVal, 10); mVal = parseInt(mVal, 10); yVal = parseInt(yVal, 10);
  if (!dVal || !mVal || !yVal || !admVal || isNaN(dVal) || isNaN(mVal) || isNaN(yVal)) return '';
  if (mVal < 1 || mVal > 12 || dVal < 1 || dVal > 31 || yVal < 1900) return 'غلط تاریخ';
  const dob = new Date(yVal, mVal - 1, dVal);
  if (dob.getDate() !== dVal || dob.getMonth() !== (mVal - 1)) return 'غلط تاریخ';
  const adm = new Date(admVal);
  if (adm < dob) return 'غلط تاریخ';

  let years = adm.getFullYear() - dob.getFullYear();
  let months = adm.getMonth() - dob.getMonth();
  let days = adm.getDate() - dob.getDate();

  if (days < 0) { months--; const prevMonth = new Date(adm.getFullYear(), adm.getMonth(), 0); days += prevMonth.getDate(); }
  if (months < 0) { years--; months += 12; }

  let ageStr = [];
  if (years > 0) ageStr.push(`${years} سال`);
  if (months > 0) ageStr.push(`${months} ماہ`);
  if (days > 0) ageStr.push(`${days} دن`);
  return ageStr.length > 0 ? ageStr.join('، ') : '0 دن';
};

export const parseDobString = (dobStr) => {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const trimmed = dobStr.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[-/.\s]+/);
  if (parts.length !== 3) return null;

  let y = '', m = '', d = '';
  if (parts[0].length === 4 && !isNaN(parts[0])) {
    y = parts[0];
    m = parts[1].padStart(2, '0');
    d = parts[2].padStart(2, '0');
  } else if (parts[2].length === 4 && !isNaN(parts[2])) {
    d = parts[0].padStart(2, '0');
    m = parts[1].padStart(2, '0');
    y = parts[2];
  } else {
    return null;
  }

  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  const dNum = parseInt(d, 10);

  if (yNum >= 1900 && yNum <= 2100 && mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
    return { year: y, month: m, day: d, formatted: `${y}-${m}-${d}` };
  }
  return null;
};

export const mapSupabaseToUi = (row) => {
  if (!row) return null;
  if (row.isAdmissionProfile) return row;

  let dobYear = '', dobMonth = '', dobDay = '';
  if (row.date_of_birth) {
    const parts = row.date_of_birth.split('-');
    if (parts.length === 3) {
      dobYear = parts[0];
      dobMonth = parts[1];
      dobDay = parts[2];
    }
  }
  const fatherNameVal = row.father_name || '';
  const computedAge = (dobDay && dobMonth && dobYear && row.admission_date)
    ? calculateAge(dobDay, dobMonth, dobYear, row.admission_date)
    : '';

  return {
    id: row.id,
    isAdmissionProfile: true,
    admRegNo: row.roll_number || '',
    admDate: row.admission_date || '',
    name: row.name || '',
    admFatherName: fatherNameVal,
    fatherName: fatherNameVal,
    admClass: row.class_id || '',
    admGender: row.gender || 'لڑکا',
    admDobFull: row.date_of_birth || '',
    admDobDay: dobDay,
    admDobMonth: dobMonth,
    admDobYear: dobYear,
    admAge: computedAge,
    admBForm: row.b_form_number || '',
    admAddress: row.address || '',
    fatherCnic: row.father_cnic || '',
    fatherEdu: row.father_education || '',
    fatherOcc: row.father_occupation || '',
    fatherMobile: row.father_mobile || '',
    fatherWhatsapp: row.father_whatsapp || '',
    fatherEmail: row.father_email || '',
    fatherIncome: row.father_income || '',
    isFatherGuardian: row.is_father_guardian === false ? 'no' : 'yes',
    motherName: row.mother_name || '',
    motherCnic: row.mother_cnic || '',
    motherEdu: row.mother_education || '',
    motherOcc: row.mother_occupation || '',
    motherMobile: row.mother_mobile || '',
    motherWhatsapp: row.mother_whatsapp || '',
    motherIncome: row.mother_income || '',
    guardianName: row.guardian_name || '',
    guardianRel: row.guardian_relation || '',
    guardianCnic: row.guardian_cnic || '',
    guardianEdu: row.guardian_education || '',
    guardianOcc: row.guardian_occupation || '',
    guardianIncome: row.guardian_income || '',
    guardianMobile: row.guardian_mobile || '',
    guardianWhatsapp: row.guardian_whatsapp || '',
    isWithdrawn: row.status === 'left',
    status: row.status || 'active',
    withdrawDate: row.withdrawal_date || '',
    withdrawReason: row.withdrawal_reason || ''
  };
};

export const mapUiToSupabase = (data) => {
  let date_of_birth = null;

  if (data.admDobFull && typeof data.admDobFull === 'string' && data.admDobFull.trim()) {
    const parsed = parseDobString(data.admDobFull);
    if (parsed) date_of_birth = parsed.formatted;
  }

  if (!date_of_birth && data.admDobYear && data.admDobMonth && data.admDobDay) {
    const y = String(data.admDobYear).padStart(4, '0');
    const m = String(data.admDobMonth).padStart(2, '0');
    const d = String(data.admDobDay).padStart(2, '0');
    date_of_birth = `${y}-${m}-${d}`;
  }

  const father_name = (data.admFatherName || data.fatherName || '').trim();

  return {
    roll_number: data.admRegNo || null,
    admission_date: data.admDate || null,
    name: (data.admName || data.name || '').trim(),
    father_name: father_name,
    class_id: isValidUUID(data.admClass) ? data.admClass : null,
    gender: data.admGender || 'لڑکا',
    date_of_birth: date_of_birth,
    b_form_number: data.admBForm || null,
    address: data.admAddress || null,
    father_cnic: data.fatherCnic || null,
    father_education: data.fatherEdu || null,
    father_occupation: data.fatherOcc || null,
    father_mobile: data.fatherMobile || null,
    father_whatsapp: data.fatherWhatsapp || null,
    father_email: data.fatherEmail || null,
    father_income: data.fatherIncome || null,
    is_father_guardian: data.isFatherGuardian === 'yes',
    mother_name: data.motherName || null,
    mother_cnic: data.motherCnic || null,
    mother_education: data.motherEdu || null,
    mother_occupation: data.motherOcc || null,
    mother_mobile: data.motherMobile || null,
    mother_whatsapp: data.motherWhatsapp || null,
    mother_income: data.motherIncome || null,
    guardian_name: data.guardianName || null,
    guardian_relation: data.guardianRel || null,
    guardian_cnic: data.guardianCnic || null,
    guardian_education: data.guardianEdu || null,
    guardian_occupation: data.guardianOcc || null,
    guardian_income: data.guardianIncome || null,
    guardian_mobile: data.guardianMobile || null,
    guardian_whatsapp: data.guardianWhatsapp || null,
    guardian_phone: data.fatherMobile || data.guardianMobile || null,
    status: data.isWithdrawn ? 'left' : (data.status || 'active'),
    withdrawal_date: data.withdrawDate || null,
    withdrawal_reason: data.withdrawReason || null
  };
};

export default function Admissions() {
  const {
    activeMadrasaId,
    fetchClassesFromSupabase,
    fetchStudentsFromSupabase,
    addStudentToSupabase,
    updateStudentInSupabase,
    withdrawStudentInSupabase
  } = useMadrasa();
  const [activeTab, setActiveTab] = useState('new');
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingStudentId, setEditingStudentId] = useState(null);

  const initialFormData = {
    admRegNo: '', admDate: '', admName: '', admFatherName: '', admClass: '', admGender: 'لڑکا',
    admDobDay: '', admDobMonth: '', admDobYear: '', admAge: '', admBForm: '', admAddress: '',
    fatherName: '', fatherCnic: '', fatherEdu: '', fatherOcc: '', fatherMobile: '', fatherWhatsapp: '', fatherEmail: '', fatherIncome: '', isFatherGuardian: 'yes',
    motherName: '', motherCnic: '', motherEdu: '', motherOcc: '', motherMobile: '', motherWhatsapp: '', motherIncome: '',
    guardianName: '', guardianRel: '', guardianCnic: '', guardianEdu: '', guardianOcc: '', guardianIncome: '', guardianMobile: '', guardianWhatsapp: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');

  const [withdrawSearchId, setWithdrawSearchId] = useState('');
  const [withdrawStudent, setWithdrawStudent] = useState(null);
  const [withdrawDate, setWithdrawDate] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');

  const [profileModal, setProfileModal] = useState(null);
  const [printStudentId, setPrintStudentId] = useState('');

  const selectedPrintStudent = records.find(r => r.isAdmissionProfile && r.admRegNo === printStudentId) || null;

  const getClassName = (clsId) => {
    if (!clsId) return '';
    const cls = classesList.find(c => c.id === clsId);
    return cls ? (cls.name || cls.className || clsId) : clsId;
  };

  const getAgeParts = (student) => {
    if (!student || !student.admAge) return { day: '', month: '', year: '' };
    const ageStr = student.admAge;
    const yearMatch = ageStr.match(/(\d+)\s*سال/);
    const monthMatch = ageStr.match(/(\d+)\s*ماہ/);
    const dayMatch = ageStr.match(/(\d+)\s*دن/);
    return {
      year: yearMatch ? yearMatch[1] : '',
      month: monthMatch ? monthMatch[1] : '',
      day: dayMatch ? dayMatch[1] : ''
    };
  };

  const printAgeParts = getAgeParts(selectedPrintStudent);

  const generateNewAdmissionId = (currentRecords = records) => {
    let maxId = 0;
    currentRecords.forEach(r => {
      if (r.admRegNo && !isNaN(r.admRegNo)) maxId = Math.max(maxId, parseInt(r.admRegNo, 10));
    });
    const nextRegNo = (maxId + 1).toString().padStart(2, '0');
    setFormData(prev => ({ ...prev, admRegNo: nextRegNo }));
  };

  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        let hasError = false;
        const [clsData, stdData] = await Promise.all([
          fetchClassesFromSupabase(activeMadrasaId).catch(err => {
            console.error('Classes fetch error:', err);
            hasError = true;
            return null;
          }),
          fetchStudentsFromSupabase(activeMadrasaId).catch(err => {
            console.error('Students fetch error:', err);
            hasError = true;
            return null;
          })
        ]);

        if (!isMounted) return;

        if (clsData && clsData.length > 0) {
          setClassesList(clsData);
        } else {
          setClassesList(prev => (prev && prev.length > 0 ? prev : DEFAULT_CLASSES));
        }

        if (stdData) {
          const mapped = stdData.map(mapSupabaseToUi).filter(Boolean);
          setRecords(mapped);
          generateNewAdmissionId(mapped);
        }

        if (hasError) {
          setFetchError('سرور سے ڈیٹا حاصل کرنے میں دشواری پیش آئی ہے۔ براہ کرم صفحہ ریفریش کریں یا اپنا انٹرنیٹ کنکشن چیک کریں۔');
        }
      } catch (err) {
        console.error('Data loading error:', err);
        if (isMounted) {
          setFetchError('سرور سے ڈیٹا حاصل کرنے میں دشواری پیش آئی ہے۔ براہ کرم صفحہ ریفریش کریں۔');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, admDate: prev.admDate || today }));

    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  const formatBForm = (val) => {
    let clean = (val || '').replace(/\D/g, ''); 
    if (clean.length > 13) clean = clean.substring(0, 13);
    let formatted = clean;
    if (clean.length > 5 && clean.length <= 12) formatted = clean.substring(0, 5) + '-' + clean.substring(5);
    else if (clean.length > 12) formatted = clean.substring(0, 5) + '-' + clean.substring(5, 12) + '-' + clean.substring(12, 13);
    return formatted;
  };

  const formatPhoneNumber = (val) => {
    let clean = (val || '').replace(/\D/g, '');
    if (clean.length > 11) clean = clean.substring(0, 11);
    let formatted = clean;
    if (clean.length > 4) formatted = clean.substring(0, 4) + '-' + clean.substring(4);
    return formatted;
  };

  const handleInputChange = (e) => {
    const { id, name, value, type } = e.target;
    const field = type === 'radio' ? name : (id || name);
    let val = value;

    if (['admBForm', 'fatherCnic', 'motherCnic', 'guardianCnic'].includes(field)) val = formatBForm(value);
    else if (['fatherMobile', 'fatherWhatsapp', 'motherMobile', 'motherWhatsapp', 'guardianMobile', 'guardianWhatsapp'].includes(field)) val = formatPhoneNumber(value);

    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (['admDobDay', 'admDobMonth', 'admDobYear', 'admDate'].includes(field)) {
        next.admAge = calculateAge(next.admDobDay, next.admDobMonth, next.admDobYear, next.admDate);
      }
      return next;
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'new') {
      setWizardStep(1);
      generateNewAdmissionId(records);
      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, admDate: prev.admDate || today }));
    } else if (tab === 'withdraw') {
      setWithdrawSearchId('');
      setWithdrawStudent(null);
    } else if (tab === 'search' || tab === 'all') {
      setSearchId('');
      setSearchName('');
    }
  };

  const wizardNext = () => {
    if (wizardStep === 1 && !formData.admName.trim()) { alert('براہ کرم طالب علم کا نام درج کریں۔'); return; }
    setWizardStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const wizardBack = () => {
    setWizardStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveAdmission = async () => {
    if(!formData.admName.trim() || !formData.admRegNo) { alert("براہ کرم طالب علم کا نام درج کریں۔"); return; }
    
    try {
      const payload = mapUiToSupabase(formData);
      const insertedRow = await addStudentToSupabase(payload, activeMadrasaId);
      const newUiRecord = mapSupabaseToUi(insertedRow);
      
      setRecords(prev => [...prev, newUiRecord]);
      alert("داخلہ کامیابی سے محفوظ ہو چکا ہے۔");
      setFormData(initialFormData);
      handleTabChange('all');
    } catch (err) {
      console.error('Save admission error:', err);
      alert(`⚠️ داخلہ محفوظ نہیں ہو سکا!\n${err.message || 'سرور سے رابطہ قائم نہیں ہو سکا یا ڈیٹا میں خرابی ہے۔'}`);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (['admBForm', 'fatherCnic', 'motherCnic', 'guardianCnic'].includes(name)) val = formatBForm(value);
    else if (['fatherMobile', 'fatherWhatsapp', 'motherMobile', 'motherWhatsapp', 'guardianMobile', 'guardianWhatsapp'].includes(name)) val = formatPhoneNumber(value);

    setProfileModal(prev => {
      const next = { ...prev, [name]: val };

      if (name === 'admDobFull') {
        const parsed = parseDobString(val);
        if (parsed) {
          next.admDobYear = parsed.year;
          next.admDobMonth = parsed.month;
          next.admDobDay = parsed.day;
          if (next.admDate) {
            next.admAge = calculateAge(parsed.day, parsed.month, parsed.year, next.admDate);
          }
        } else {
          next.admDobYear = '';
          next.admDobMonth = '';
          next.admDobDay = '';
          next.admAge = '';
        }
      } else if (name === 'admDate' && next.admDobYear && next.admDobMonth && next.admDobDay) {
        next.admAge = calculateAge(next.admDobDay, next.admDobMonth, next.admDobYear, val);
      }

      return next;
    });
  };

  const saveStudentProfile = async () => {
    if (!profileModal || !profileModal.id) {
      alert("طالب علم کے شناختی نمبر (ID) کی کمی ہے۔");
      return;
    }
    
    try {
      const payload = mapUiToSupabase(profileModal);
      const updatedRow = await updateStudentInSupabase(profileModal.id, payload);
      const updatedRecord = mapSupabaseToUi(updatedRow);

      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
      alert("پروفائل کامیابی سے محفوظ ہو گئی۔");
      setProfileModal(null);
    } catch (err) {
      console.error('Save profile error:', err);
      alert(`⚠️ پروفائل محفوظ نہیں ہو سکی!\n${err.message || 'سرور سے رابطہ قائم نہیں ہو سکا یا ڈیٹا میں خرابی ہے۔'}`);
    }
  };

  const getRegistrationSortValue = (regNo) => {
    const numeric = String(regNo || '').trim().match(/\d+/);
    if (numeric) return parseInt(numeric[0], 10);
    return Number.MAX_SAFE_INTEGER;
  };

  const filteredRecords = records.filter(r => {
    if (!r.isAdmissionProfile) return false;
    if (activeTab === 'search') {
      let matchId   = searchId   ? (r.admRegNo && r.admRegNo.includes(searchId)) : true;
      let matchName = searchName ? (r.name && r.name.toLowerCase().includes(searchName.toLowerCase())) : true;
      return matchId && matchName;
    }
    return true;
  }).sort((a, b) => {
    const diff = getRegistrationSortValue(a.admRegNo) - getRegistrationSortValue(b.admRegNo);
    if (diff !== 0) return diff;
    return String(a.admRegNo || '').localeCompare(String(b.admRegNo || ''), 'en', { numeric: true, sensitivity: 'base' });
  });

  const withdrawnRecords = records.filter(r => r.isAdmissionProfile && r.isWithdrawn).sort((a, b) => new Date(b.withdrawDate) - new Date(a.withdrawDate));

  const loadStudentForWithdrawal = () => {
    if (!withdrawSearchId.trim()) { alert("براہ کرم رجسٹریشن نمبر درج کریں۔"); return; }
    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === withdrawSearchId);
    if (!student) { alert("اس رجسٹریشن نمبر سے کوئی طالب علم نہیں ملا۔"); setWithdrawStudent(null); return; }
    if (student.isWithdrawn) { alert(`یہ طالب علم پہلے ہی ${student.withdrawDate} کو خارج کیا جا چکا ہے۔\nوجہ: ${student.withdrawReason}`); setWithdrawStudent(null); return; }
    setWithdrawStudent(student);
    setWithdrawDate(new Date().toISOString().split('T')[0]);
    setWithdrawReason('');
  };

  const processWithdrawal = async () => {
    if (!withdrawStudent || !withdrawStudent.id) return;
    if (!withdrawDate || !withdrawReason) { alert("براہ کرم تاریخ اخراج اور وجہ اخراج دونوں درج کریں۔"); return; }
    if (!window.confirm("کیا آپ واقعی اس طالب علم کا اخراج محفوظ کرنا چاہتے ہیں؟ یہ عمل ناقابل واپسی ہے۔")) return;

    try {
      const updatedRow = await withdrawStudentInSupabase(withdrawStudent.id, withdrawDate, withdrawReason);
      const updatedRecord = mapSupabaseToUi(updatedRow);

      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
      alert("طالب علم کا ریکارڈ کامیابی سے خارج کر دیا گیا ہے۔");
      setWithdrawSearchId('');
      setWithdrawStudent(null);
    } catch (err) {
      console.error('Withdrawal error:', err);
      alert(`⚠️ اخراج محفوظ نہیں ہو سکا!\n${err.message || 'سرور سے رابطہ قائم نہیں ہو سکا یا ڈیٹا میں خرابی ہے۔'}`);
    }
  };

  const renderTableRows = (list) => list.map((r, i) => (
    <tr key={i} className="adm-table-row">
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: '700', color: 'var(--accent)', fontSize: '0.82rem' }}>{r.admRegNo || '—'}</td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', fontWeight: '700', textAlign: 'right' }}>{r.name || '—'}</td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'right', color: 'var(--muted)' }}>{r.admFatherName || '—'}</td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem' }}>
        <div>{r.contactPhone1 || r.admPhone || r.fatherMobile || '—'}</div>
        <div style={{ color: 'var(--accent-2)', marginTop: '2px' }}>{r.contactWhatsapp1 || r.admWhatsapp || r.fatherWhatsapp || '—'}</div>
      </td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem' }}>{r.admDOB || r.admDobFull || '—'}</td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem' }}>{r.admDate || '—'}</td>
      <td style={{ padding: '9px 8px', border: '1px solid var(--border)', textAlign: 'center' }}>
        {r.isWithdrawn ? <span style={{ background: 'var(--danger)', color: '#fff', padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>خارج</span>
                       : <span style={{ background: '#2e7d32', color: '#fff', padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>فعال</span>}
      </td>
      <td style={{ padding: '7px 8px', border: '1px solid var(--border)', textAlign: 'center' }}>
        <button className="no-print" onClick={() => setProfileModal(r)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>پروفائل</button>
      </td>
    </tr>
  ));

  return (
    <div className="tab-content">
      <div className="adm-type-grid no-print">
        {['new', 'search', 'all', 'classes', 'withdraw', 'withdrawn_list', 'printform'].map((t, idx) => {
            const labels = ['نیا داخلہ', 'طالب علم تلاش', 'تمام طلباء', 'تمام کلاسز', 'اخراج / روانگی', 'خارج شدہ طلباء', 'پرنٹیبل داخلہ فارم'];
            return <button key={t} className={`adm-type-btn ${activeTab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>{labels[idx]}</button>;
        })}
      </div>

      {fetchError && (
        <div className="no-print" style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {fetchError}</span>
          <button onClick={() => setFetchError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#856404' }}>✕</button>
        </div>
      )}

      {activeTab === 'new' && (
        <div id="newAdmissionFormContainer" className="no-print">
          <div className="wizard-progress-wrap">
            <div className="wizard-steps">
              {[1, 2, 3, 4].map(step => (
                <React.Fragment key={step}>
                  <div className={`wizard-step ${wizardStep >= step ? 'active' : ''} ${wizardStep > step ? 'done' : ''}`}><div className="wizard-step-circle">{step}</div></div>
                  {step < 4 && <div className={`wizard-connector ${wizardStep > step ? 'done' : ''}`}></div>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {wizardStep === 1 && (
            <div className="wizard-panel active">
              <div className="form-section-card slide-down">
                <div className="form-section-header">
                  <div className="form-section-icon icon-blue"></div>
                  <div><div className="form-section-title">مرحلہ 1 — طالب علم کی معلومات</div><div className="form-section-subtitle">رجسٹریشن، کلاس اور ذاتی تفصیلات</div></div>
                </div>
                <div className="grid-row">
                  <div><label>رجسٹریشن نمبر</label><input type="text" id="admRegNo" readOnly value={formData.admRegNo} /></div>
                  <div><label>تاریخ داخلہ</label><input type="date" id="admDate" value={formData.admDate} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>نام</label><input type="text" id="admName" value={formData.admName} onChange={handleInputChange} /></div>
                  <div><label>والد کا نام</label><input type="text" id="admFatherName" value={formData.admFatherName} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">  
                  <div>
                    <label>کلاس</label>
                    <select id="admClass" value={formData.admClass} onChange={handleInputChange}>
                      <option value="">کلاس منتخب کریں...</option>
                      {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>صنف</label>
                    <div className="gender-toggle-wrap" style={{ display: 'flex', gap: '10px' }}>
                      <input type="radio" name="admGender" id="genderBoy" value="لڑکا" checked={formData.admGender === 'لڑکا'} onChange={(e) => setFormData(prev => ({...prev, admGender: e.target.value}))} style={{ display: 'none' }} />
                      <label htmlFor="genderBoy" style={{ flex: 1, textAlign: 'center', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', ...(formData.admGender === 'لڑکا' ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'white' } : { background: 'var(--surface)' }) }}>لڑکا</label>
                      <input type="radio" name="admGender" id="genderGirl" value="لڑکی" checked={formData.admGender === 'لڑکی'} onChange={(e) => setFormData(prev => ({...prev, admGender: e.target.value}))} style={{ display: 'none' }} />
                      <label htmlFor="genderGirl" style={{ flex: 1, textAlign: 'center', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', ...(formData.admGender === 'لڑکی' ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'white' } : { background: 'var(--surface)' }) }}>لڑکی</label>
                    </div>
                  </div>
                </div>
                <div className="grid-row">
                  <div>
                    <label>تاریخ پیدائش</label>
                    <div style={{ display: 'flex', gap: '5px', direction: 'ltr' }}>
                      <input type="number" id="admDobDay" placeholder="DD" value={formData.admDobDay} onChange={handleInputChange} style={{ width: '30%' }} />
                      <input type="number" id="admDobMonth" placeholder="MM" value={formData.admDobMonth} onChange={handleInputChange} style={{ width: '30%' }} />
                      <input type="number" id="admDobYear" placeholder="YYYY" value={formData.admDobYear} onChange={handleInputChange} style={{ width: '40%' }} />
                    </div>
                  </div>
                  <div><label>داخلے کے وقت عمر</label><input type="text" id="admAge" readOnly value={formData.admAge} /></div>
                </div>
                <div className="grid-row">
                  <div><label>ب فارم نمبر</label><input type="text" id="admBForm" placeholder="00000-0000000-0" value={formData.admBForm} onChange={handleInputChange} /></div>
                  <div><label>موجودہ رہائشی پتہ</label><input type="text" id="admAddress" value={formData.admAddress} onChange={handleInputChange} /></div>
                </div>
              </div>
              <div className="wizard-nav"><div></div><button className="wizard-btn-next" onClick={wizardNext}>اگلا: والد کی معلومات ←</button></div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="wizard-panel active">
              <div className="form-section-card slide-down">
                <div className="form-section-header">
                  <div className="form-section-icon icon-green"></div>
                  <div><div className="form-section-title">مرحلہ 2 — والد کی معلومات</div></div>
                </div>
                <div className="grid-row">
                  <div><label>نام</label><input type="text" id="fatherName" value={formData.fatherName} onChange={handleInputChange} /></div>
                  <div><label>شناختی کارڈ نمبر</label><input type="text" id="fatherCnic" value={formData.fatherCnic} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>تعلیمی قابلیت</label><input type="text" id="fatherEdu" value={formData.fatherEdu} onChange={handleInputChange} /></div>
                  <div><label>پیشہ</label><input type="text" id="fatherOcc" value={formData.fatherOcc} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>موبائل نمبر</label><input type="text" id="fatherMobile" value={formData.fatherMobile} onChange={handleInputChange} /></div>
                  <div><label>واٹس ایپ نمبر</label><input type="text" id="fatherWhatsapp" value={formData.fatherWhatsapp} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>ای میل</label><input type="text" id="fatherEmail" value={formData.fatherEmail} onChange={handleInputChange} /></div>
                  <div><label>ماہانہ آمدنی</label><input type="text" id="fatherIncome" value={formData.fatherIncome} onChange={handleInputChange} /></div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={{ color: 'var(--accent)', fontWeight: '700', display: 'block', marginBottom: '8px' }}>کیا والد ہی سرپرست ہیں؟</label>
                  <div className="radio-toggle-group">
                    <input type="radio" name="isFatherGuardian" id="guardianYes" value="yes" checked={formData.isFatherGuardian === 'yes'} onChange={handleInputChange} />
                    <label htmlFor="guardianYes">ہاں</label>
                    <input type="radio" name="isFatherGuardian" id="guardianNo" value="no" checked={formData.isFatherGuardian === 'no'} onChange={handleInputChange} />
                    <label htmlFor="guardianNo">نہیں</label>
                  </div>
                </div>
              </div>
              <div className="wizard-nav"><button className="wizard-btn-back" onClick={wizardBack}>→ واپس: طالب علم</button><button className="wizard-btn-next" onClick={wizardNext}>اگلا: والدہ کی معلومات ←</button></div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="wizard-panel active">
              <div className="form-section-card slide-down">
                <div className="form-section-header">
                  <div className="form-section-icon icon-pink"></div>
                  <div><div className="form-section-title">مرحلہ 3 — والدہ کی معلومات</div></div>
                </div>
                <div className="grid-row">
                  <div><label>نام</label><input type="text" id="motherName" value={formData.motherName} onChange={handleInputChange} /></div>
                  <div><label>شناختی کارڈ نمبر</label><input type="text" id="motherCnic" value={formData.motherCnic} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>تعلیمی قابلیت</label><input type="text" id="motherEdu" value={formData.motherEdu} onChange={handleInputChange} /></div>
                  <div><label>پیشہ</label><input type="text" id="motherOcc" value={formData.motherOcc} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row">
                  <div><label>موبائل نمبر</label><input type="text" id="motherMobile" value={formData.motherMobile} onChange={handleInputChange} /></div>
                  <div><label>واٹس ایپ نمبر</label><input type="text" id="motherWhatsapp" value={formData.motherWhatsapp} onChange={handleInputChange} /></div>
                </div>
                <div className="grid-row"><div><label>ماہانہ آمدنی</label><input type="text" id="motherIncome" value={formData.motherIncome} onChange={handleInputChange} /></div></div>
              </div>
              {formData.isFatherGuardian === 'no' && (
                <div className="form-section-card">
                  <div className="form-section-header">
                    <div className="form-section-icon icon-purple"></div>
                    <div><div className="form-section-title">سرپرست کی معلومات</div><div className="form-section-subtitle">والد کی عدم موجودگی میں</div></div>
                  </div>
                  <div className="grid-row">
                    <div><label>نام</label><input type="text" id="guardianName" value={formData.guardianName} onChange={handleInputChange} /></div>
                    <div><label>طالب علم سے رشتہ</label><input type="text" id="guardianRel" value={formData.guardianRel} onChange={handleInputChange} /></div>
                  </div>
                  <div className="grid-row">
                    <div><label>شناختی کارڈ نمبر</label><input type="text" id="guardianCnic" value={formData.guardianCnic} onChange={handleInputChange} /></div>
                    <div><label>تعلیمی قابلیت</label><input type="text" id="guardianEdu" value={formData.guardianEdu} onChange={handleInputChange} /></div>
                  </div>
                  <div className="grid-row">
                    <div><label>پیشہ</label><input type="text" id="guardianOcc" value={formData.guardianOcc} onChange={handleInputChange} /></div>
                    <div><label>ماہانہ آمدنی</label><input type="text" id="guardianIncome" value={formData.guardianIncome} onChange={handleInputChange} /></div>
                  </div>
                  <div className="grid-row">
                    <div><label>موبائل نمبر</label><input type="text" id="guardianMobile" value={formData.guardianMobile} onChange={handleInputChange} /></div>
                    <div><label>واٹس ایپ نمبر</label><input type="text" id="guardianWhatsapp" value={formData.guardianWhatsapp} onChange={handleInputChange} /></div>
                  </div>
                </div>
              )}
              <div className="wizard-nav"><button className="wizard-btn-back" onClick={wizardBack}>→ واپس: والد</button><button className="wizard-btn-next" onClick={wizardNext}>اگلا: جائزہ و تکمیل ←</button></div>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="wizard-panel active">
              <div className="form-section-card slide-down">
                <div className="form-section-header">
                  <div className="form-section-icon icon-green"></div>
                  <div><div className="form-section-title">مرحلہ 4 — جائزہ و تکمیل</div></div>
                </div>
                <div id="wizardReviewArea" style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: '2.2' }}>
                  <div className="review-section-title">طالب علم کی معلومات</div>
                  <div className="review-row"><span className="review-label">نام</span><span className="review-value">{formData.admName}</span></div>
                  <div className="review-row"><span className="review-label">والد کا نام</span><span className="review-value">{formData.admFatherName}</span></div>
                  <div className="review-row"><span className="review-label">کلاس</span><span className="review-value">{formData.admClass || '—'}</span></div>
                  <div className="review-row"><span className="review-label">صنف</span><span className="review-value">{formData.admGender}</span></div>
                  <div className="review-row"><span className="review-label">ب فارم</span><span className="review-value">{formData.admBForm || '—'}</span></div>
                </div>
              </div>
              <div className="wizard-nav"><button className="wizard-btn-back" onClick={wizardBack}>→ واپس: والدہ</button><button className="save-admission-btn" onClick={saveAdmission}>داخلہ محفوظ کریں</button></div>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'search' || activeTab === 'all') && (
        <div id="searchStudentsContainer" className="no-print">
          <h2>{activeTab === 'search' ? 'طالب علم تلاش کریں (Search Student)' : 'تمام طلباء (All Students)'}</h2>
          {activeTab === 'search' && (
            <div className="search-container">
              <input type="text" placeholder="رجسٹریشن نمبر (Unique ID) درج کریں..." style={{ flex: '1' }} value={searchId} onChange={e => setSearchId(e.target.value)} />
              <input type="text" placeholder="یا نام سے تلاش کریں..." style={{ flex: '2' }} value={searchName} onChange={e => setSearchName(e.target.value)} />
              <button onClick={() => { setSearchId(''); setSearchName(''); }} style={{ background: 'var(--muted)' }}>واضح کریں</button>
            </div>
          )}
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', color: 'var(--text)', textAlign: 'center' }}>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>رجسٹریشن نمبر</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>نام</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>ولدیت</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>فون / واٹس ایپ</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>تاریخ پیدائش</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>تاریخ داخلہ</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>حیثیت</th>
                  <th style={{ padding: '10px 8px', border: '1px solid var(--border)' }}>پروفائل</th>
                </tr>
              </thead>
              <tbody>{filteredRecords.length > 0 ? renderTableRows(filteredRecords) : <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>کوئی طالب علم نہیں ملا</td></tr>}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'withdrawn_list' && (
        <div className="no-print">
          <h2>خارج شدہ طلباء (Withdrawn Students)</h2>
          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--danger)', color: '#fff', textAlign: 'center' }}>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>رجسٹریشن نمبر</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>نام</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>ولدیت</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>فون / واٹس ایپ</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>تاریخ پیدائش</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>تاریخ داخلہ</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>تاریخ اخراج</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>وجہ اخراج</th>
                  <th style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.2)' }}>پروفائل</th>
                </tr>
              </thead>
              <tbody>
                {withdrawnRecords.length > 0 ? withdrawnRecords.map((r, i) => (
                  <tr key={i} className="adm-withdrawn-row">
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontWeight: '700', color: 'var(--danger)' }}>{r.admRegNo || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', fontWeight: '700', textAlign: 'right' }}>{r.name || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'right', color: 'var(--muted)' }}>{r.admFatherName || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.82rem' }}><div>{r.contactPhone1 || r.admPhone || r.fatherMobile || '—'}</div><div style={{ color: 'var(--accent-2)', marginTop: '2px' }}>{r.contactWhatsapp1 || r.admWhatsapp || r.fatherWhatsapp || '—'}</div></td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.83rem' }}>{r.admDOB || r.admDobFull || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.83rem' }}>{r.admDate || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--danger)', fontWeight: '700', fontSize: '0.83rem' }}>{r.withdrawDate || '—'}</td>
                    <td style={{ padding: '10px 12px', border: '1px solid var(--border)', textAlign: 'right', fontSize: '0.82rem', maxWidth: '200px' }}>{r.withdrawReason || '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <button onClick={() => setProfileModal(r)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700' }}>پروفائل</button>
                    </td>
                  </tr>
                )) : <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>کوئی خارج شدہ طالب علم نہیں ہے</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'withdraw' && (
        <div id="withdrawStudentContainer" className="no-print">
          <div className="withdrawal-warning-banner"><div className="withdrawal-warning-icon"></div><div className="withdrawal-warning-text"><strong>اخراج / روانگی — احتیاط کریں</strong><p>یہ عمل طالب علم کو فعال فہرست سے ہٹا دے گا۔ اخراج سے پہلے تمام معلومات درست یقینی بنائیں۔</p></div></div>
          <div className="form-section-card">
            <div className="form-section-header"><div className="form-section-icon icon-amber"></div><div><div className="form-section-title">طالب علم تلاش کریں</div><div className="form-section-subtitle">رجسٹریشن نمبر سے تلاش</div></div></div>
            <div className="search-container"><input type="text" placeholder="رجسٹریشن نمبر درج کریں..." value={withdrawSearchId} onChange={e => setWithdrawSearchId(e.target.value)} /><button onClick={loadStudentForWithdrawal}>تلاش کریں</button></div>
          </div>
          {withdrawStudent && (
            <div id="withdrawDetailsArea">
              <div className="form-section-card">
                <div className="form-section-header"><div className="form-section-icon icon-blue"></div><div><div className="form-section-title">طالب علم کی تفصیلات</div></div></div>
                <div className="grid-row">
                    <div><label>نام</label><input type="text" readOnly value={withdrawStudent.name} /></div>
                    <div><label>والد کا نام</label><input type="text" readOnly value={withdrawStudent.admFatherName} /></div>
                    <div><label>تاریخ داخلہ</label><input type="text" readOnly value={withdrawStudent.admDate} /></div>
                </div>
              </div>
              <div className="withdrawal-form-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}><strong style={{ color: 'var(--danger)', fontSize: '1.05rem' }}>تفصیلاتِ اخراج</strong></div>
                <div className="grid-row"><div><label>تاریخ اخراج</label><input type="date" value={withdrawDate} onChange={e => setWithdrawDate(e.target.value)} /></div></div>
                <div style={{ marginTop: '12px' }}><label>وجہ اخراج</label><textarea rows="4" placeholder="اخراج کی مکمل تفصیل یا وجہ یہاں درج کریں..." value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}></textarea></div>
                <div className="btn-container" style={{ marginTop: '20px' }}><button onClick={processWithdrawal} style={{ background: 'linear-gradient(135deg,#b71c1c,var(--danger))', padding: '13px 40px', borderRadius: '10px' }}>اخراج محفوظ کریں</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'printform' && (
        <div id="printFormContainer">
          <div className="form-section-card no-print">
            <div className="form-section-header">
              <div className="form-section-icon icon-blue"></div>
              <div>
                <div className="form-section-title">پرنٹیبل داخلہ فارم</div>
                <div className="form-section-subtitle">طالب علم کا انتخاب کر کے فارم پرنٹ کریں یا خالی فارم پرنٹ کریں</div>
              </div>
            </div>
            
            <div className="grid-row" style={{ marginTop: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: '700', marginBottom: '6px', display: 'block' }}>طالب علم منتخب کریں (ڈیٹا بھرنے کے لیے):</label>
                <select
                  value={printStudentId}
                  onChange={(e) => setPrintStudentId(e.target.value)}
                  className="adm-student-select"
                >
                  <option value="">-- خالی فارم (دستخطی اندراج کے لیے) --</option>
                  {records.filter(r => r.isAdmissionProfile && !r.isWithdrawn).map(s => (
                    <option key={s.admRegNo} value={s.admRegNo}>
                      {s.admRegNo} — {s.name} ({s.admFatherName || 'ولدیت نہیں'})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 36px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(13,59,102,0.25)',
                    width: '100%'
                  }}
                >
                  🖨️ فارم پرنٹ کریں
                </button>
              </div>
            </div>
          </div>

          {/* ===== REDESIGNED A4 ADMISSION FORM ===== */}
          <div id="printableAdmissionFormArea" className="a4-admission-form">
            <div className="a4-form-outer-border">
              <div className="a4-form-inner-border">
                
                {/* Header */}
                <div className="a4-header-grid">
                  <div className="a4-header-center">
                    <div className="a4-crescent-star">☪</div>
                    <div className="a4-title-box">
                      <h1 className="a4-title-text">داخلہ فارم</h1>
                    </div>
                    <div className="a4-subtitle-text">Admission Form — داخلہ فارم</div>
                  </div>
                  <div className="a4-photo-box">
                    <span>تصویر</span>
                  </div>
                </div>

                {/* Section 1: Student Information */}
                <div className="a4-table-container">
                  <table className="a4-table">
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '28%' }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="a4-label">رجسٹریشن نمبر</td>
                        <td className="a4-value">{selectedPrintStudent?.admRegNo || ''}</td>
                        <td className="a4-label">تاریخ داخلہ</td>
                        <td className="a4-value">{selectedPrintStudent?.admDate || (selectedPrintStudent ? '' : '____ / ____ / ______')}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">نام طالب علم</td>
                        <td colSpan="3" className="a4-value">{selectedPrintStudent?.name || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">ولدیت</td>
                        <td colSpan="3" className="a4-value">{selectedPrintStudent?.admFatherName || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">کلاس</td>
                        <td className="a4-value">{getClassName(selectedPrintStudent?.admClass)}</td>
                        <td className="a4-label">تاریخ پیدائش</td>
                        <td className="a4-value">{selectedPrintStudent?.admDOB || selectedPrintStudent?.admDobFull || (selectedPrintStudent ? '' : '____ / ____ / ______')}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">عمر</td>
                        <td colSpan="3" className="a4-value">
                          <div className="a4-age-container">
                            <div className="a4-age-item">
                              <span className="a4-age-label">دن:</span>
                              <span className="a4-blank-line">{printAgeParts.day}</span>
                            </div>
                            <div className="a4-age-item">
                              <span className="a4-age-label">ماہ:</span>
                              <span className="a4-blank-line">{printAgeParts.month}</span>
                            </div>
                            <div className="a4-age-item">
                              <span className="a4-age-label">سال:</span>
                              <span className="a4-blank-line">{printAgeParts.year}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="a4-label">رہائشی پتہ</td>
                        <td colSpan="3" className="a4-value">{selectedPrintStudent?.admAddress || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 2: Father's Information */}
                <div className="a4-section-divider">
                  <span>•━━━━━ والد کی معلومات ━━━━━•</span>
                </div>
                <div className="a4-table-container">
                  <table className="a4-table">
                    <colgroup>
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '75%' }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="a4-label">نام</td>
                        <td className="a4-value">{selectedPrintStudent?.fatherName || selectedPrintStudent?.admFatherName || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">ولدیت / CNIC</td>
                        <td className="a4-value">{selectedPrintStudent?.fatherCnic || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">موبائل نمبر</td>
                        <td className="a4-value">{selectedPrintStudent?.fatherMobile || selectedPrintStudent?.contactPhone1 || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">واٹس ایپ نمبر</td>
                        <td className="a4-value">{selectedPrintStudent?.fatherWhatsapp || selectedPrintStudent?.contactWhatsapp1 || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">پیشہ</td>
                        <td className="a4-value">{selectedPrintStudent?.fatherOcc || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 3: Mother's Information */}
                <div className="a4-section-divider">
                  <span>•━━━━━ والدہ کی معلومات ━━━━━•</span>
                </div>
                <div className="a4-table-container">
                  <table className="a4-table">
                    <colgroup>
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '75%' }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="a4-label">نام</td>
                        <td className="a4-value">{selectedPrintStudent?.motherName || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">ولدیت / CNIC</td>
                        <td className="a4-value">{selectedPrintStudent?.motherCnic || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">موبائل نمبر</td>
                        <td className="a4-value">{selectedPrintStudent?.motherMobile || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">واٹس ایپ نمبر</td>
                        <td className="a4-value">{selectedPrintStudent?.motherWhatsapp || ''}</td>
                      </tr>
                      <tr>
                        <td className="a4-label">پیشہ</td>
                        <td className="a4-value">{selectedPrintStudent?.motherOcc || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 4: Signatures */}
                <div className="a4-signatures-flex">
                  <div className="a4-sig-block">
                    <div className="a4-sig-line"></div>
                    <div className="a4-sig-title-ur">دستخط سرپرست</div>
                    <div className="a4-sig-title-en">Guardian Signature</div>
                  </div>
                  <div className="a4-sig-block">
                    <div className="a4-sig-line"></div>
                    <div className="a4-sig-title-ur">دستخط ادارہ</div>
                    <div className="a4-sig-title-en">Institute Signature</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
      
      {profileModal && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
               <h2 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '20px', color: 'var(--text)' }}>طالب علم کی پروفائل (ترمیم)</h2>
               
               <div className="grid-row">
                  <div><label>نام</label><input type="text" name="name" value={profileModal.name || ''} onChange={handleProfileChange} /></div>
                  <div><label>والد کا نام</label><input type="text" name="admFatherName" value={profileModal.admFatherName || ''} onChange={handleProfileChange} /></div>
               </div>
               <div className="grid-row">
                  <div>
                    <label>کلاس</label>
                    <select name="admClass" value={profileModal.admClass || ''} onChange={handleProfileChange}>
                        <option value="">کلاس چنیں...</option>
                        {classesList.map(c => <option key={c.id} value={c.id}>{c.name || c.className || c.id}</option>)}
                    </select>
                  </div>
                  <div><label>تاریخ پیدائش (مکمل)</label><input type="text" name="admDobFull" value={profileModal.admDobFull || ''} onChange={handleProfileChange} /></div>
               </div>
               <div className="grid-row">
                  <div><label>تاریخ داخلہ</label><input type="date" name="admDate" value={profileModal.admDate || ''} onChange={handleProfileChange} /></div>
                  <div><label>ب فارم نمبر</label><input type="text" name="admBForm" value={profileModal.admBForm || ''} onChange={handleProfileChange} /></div>
               </div>
               <div className="grid-row">
                  <div><label>رہائشی پتہ</label><input type="text" name="admAddress" value={profileModal.admAddress || ''} onChange={handleProfileChange} /></div>
                  <div><label>صنف</label><select name="admGender" value={profileModal.admGender || ''} onChange={handleProfileChange}><option value="لڑکا">لڑکا</option><option value="لڑکی">لڑکی</option></select></div>
               </div>

               <h3 style={{ marginTop: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>والد کی معلومات</h3>
               <div className="grid-row">
                  <div><label>شناختی کارڈ</label><input type="text" name="fatherCnic" value={profileModal.fatherCnic || ''} onChange={handleProfileChange} /></div>
                  <div><label>موبائل نمبر</label><input type="text" name="fatherMobile" value={profileModal.fatherMobile || ''} onChange={handleProfileChange} /></div>
               </div>
               <div className="grid-row">
                  <div><label>پیشہ</label><input type="text" name="fatherOcc" value={profileModal.fatherOcc || ''} onChange={handleProfileChange} /></div>
                  <div><label>واٹس ایپ</label><input type="text" name="fatherWhatsapp" value={profileModal.fatherWhatsapp || ''} onChange={handleProfileChange} /></div>
               </div>

               <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '30px' }}>
                  <button onClick={() => setProfileModal(null)} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '10px 25px', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer' }}>منسوخ کریں</button>
                  <button onClick={saveStudentProfile} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 30px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>محفوظ کریں</button>
               </div>
            </div>
        </div>
      )}

    </div>
  );
}
