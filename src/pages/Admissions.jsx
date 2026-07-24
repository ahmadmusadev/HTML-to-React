import React, { useState, useEffect } from 'react';
import { db } from '../firebaseClient';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useMadrasa } from '../context/MadrasaContext';
import './Admissions.css';

export default function Admissions() {
  const { activeMadrasa, activeLogo, activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [activeTab, setActiveTab] = useState('new');
  const [records, setRecords] = useState([]);
  const [classesList, setClassesList] = useState([]);
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

  useEffect(() => {
    const defaultClasses = [
        { id: 'cls-1', name: 'حفظِ قرآن — ناظرہ', teacher: 'مولانا عبدالرحمن' },
        { id: 'cls-2', name: 'حفظِ قرآن — سال اول', teacher: 'مولانا محمد اسحاق' },
        { id: 'cls-3', name: 'حفظِ قرآن — سال دوم', teacher: 'مولانا یوسف' },
        { id: 'cls-4', name: 'حفظِ قرآن — سال سوم', teacher: 'مولانا ابراہیم' },
        { id: 'cls-5', name: 'حفظِ قرآن — سال چہارم', teacher: 'مولانا عبداللہ' }
    ];

    const storedData = loadMadrasaData('hf_records_v1') || {};
    setRecords(storedData.records || []);
    if (storedData.classes && storedData.classes.length > 0) {
        setClassesList(storedData.classes);
    } else {
        setClassesList(defaultClasses);
    }
  }, [activeTab, activeMadrasaId]);

  const saveToLocal = (newRecords) => {
    let storedData = loadMadrasaData('hf_records_v1') || { records: [], classes: classesList };
    storedData.records = newRecords;
    saveMadrasaData('hf_records_v1', storedData);
    setRecords(newRecords);
  };

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

  const calculateAge = (dVal, mVal, yVal, admVal) => {
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

  const generateNewAdmissionId = () => {
    let maxId = 0;
    records.forEach(r => {
        if (r.admRegNo && !isNaN(r.admRegNo)) maxId = Math.max(maxId, parseInt(r.admRegNo, 10));
    });
    setFormData(prev => ({ ...prev, admRegNo: (maxId + 1).toString().padStart(2, '0') }));
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'new') {
      setWizardStep(1);
      if (!editingStudentId) {
         generateNewAdmissionId();
         const today = new Date().toISOString().split('T')[0];
         setFormData(prev => ({ ...prev, admDate: prev.admDate || today }));
      }
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
    
    const profile = {
        isAdmissionProfile: true,
        admRegNo: formData.admRegNo, name: formData.admName.trim(), admClass: formData.admClass, admFatherName: formData.admFatherName.trim(),
        admDobFull: `${formData.admDobYear}-${formData.admDobMonth}-${formData.admDobDay}`, admAge: formData.admAge, admBForm: formData.admBForm, admGender: formData.admGender, admAddress: formData.admAddress, admDate: formData.admDate,
        fatherName: formData.fatherName, fatherCnic: formData.fatherCnic, fatherEdu: formData.fatherEdu, fatherOcc: formData.fatherOcc, fatherMobile: formData.fatherMobile, fatherWhatsapp: formData.fatherWhatsapp, fatherEmail: formData.fatherEmail, fatherIncome: formData.fatherIncome, isFatherGuardian: formData.isFatherGuardian,
        motherName: formData.motherName, motherCnic: formData.motherCnic, motherEdu: formData.motherEdu, motherOcc: formData.motherOcc, motherMobile: formData.motherMobile, motherWhatsapp: formData.motherWhatsapp, motherIncome: formData.motherIncome,
        guardianName: formData.guardianName, guardianRel: formData.guardianRel, guardianCnic: formData.guardianCnic, guardianEdu: formData.guardianEdu, guardianOcc: formData.guardianOcc, guardianIncome: formData.guardianIncome, guardianMobile: formData.guardianMobile, guardianWhatsapp: formData.guardianWhatsapp,
        ts: new Date().toISOString()
    };
    
    let newRecords = [...records];
    if (editingStudentId) {
      const idx = newRecords.findIndex(r => r.admRegNo === editingStudentId);
      if(idx !== -1) {
          newRecords[idx] = { ...newRecords[idx], ...profile };
          saveToLocal(newRecords);
          alert("ریکارڈ مقامی طور پر اپ ڈیٹ ہو گیا۔");
      }
      if (db) {
          try { await updateDoc(doc(db, "students", editingStudentId), profile); } catch(e) {}
      }
      setEditingStudentId(null);
      setFormData(initialFormData);
      handleTabChange('all');
    } else {
      newRecords.push(profile);
      saveToLocal(newRecords);
      if (db) {
         try { await addDoc(collection(db, "students"), profile); } catch(e) { }
      }
      alert("داخلہ محفوظ ہوچکا ہے۔");
      setFormData(initialFormData);
      handleTabChange('all');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    let val = value;
    if (['admBForm', 'fatherCnic', 'motherCnic', 'guardianCnic'].includes(name)) val = formatBForm(value);
    else if (['fatherMobile', 'fatherWhatsapp', 'motherMobile', 'motherWhatsapp', 'guardianMobile', 'guardianWhatsapp'].includes(name)) val = formatPhoneNumber(value);
    setProfileModal(prev => ({ ...prev, [name]: val }));
  };

  const saveStudentProfile = async () => {
    if(!profileModal) return;
    let newRecords = [...records];
    const idx = newRecords.findIndex(r => r.admRegNo === profileModal.admRegNo);
    if(idx !== -1) {
        newRecords[idx] = { ...newRecords[idx], ...profileModal };
        saveToLocal(newRecords);
        alert("پروفائل محفوظ ہو گیا");
    }
    setProfileModal(null);
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

  const processWithdrawal = () => {
    if (!withdrawStudent) return;
    if (!withdrawDate || !withdrawReason) { alert("براہ کرم تاریخ اخراج اور وجہ اخراج دونوں درج کریں۔"); return; }
    if (!window.confirm("کیا آپ واقعی اس طالب علم کا اخراج محفوظ کرنا چاہتے ہیں؟ یہ عمل ناقابل واپسی ہے۔")) return;
    const newRecords = records.map(r => r.admRegNo === withdrawStudent.admRegNo ? { ...r, isWithdrawn: true, withdrawDate, withdrawReason } : r);
    saveToLocal(newRecords);
    alert("طالب علم کا ریکارڈ کامیابی سے خارج کر دیا گیا ہے۔");
    setWithdrawSearchId('');
    setWithdrawStudent(null);
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

  const printStudentObj = {}; // Blank form per original specification

  return (
    <div className="tab-content">
      <div className="adm-type-grid no-print">
        {['new', 'search', 'all', 'classes', 'withdraw', 'withdrawn_list', 'printform'].map((t, idx) => {
            const labels = ['نیا داخلہ', 'طالب علم تلاش', 'تمام طلباء', 'تمام کلاسز', 'اخراج / روانگی', 'خارج شدہ طلباء', 'پرنٹیبل داخلہ فارم'];
            return <button key={t} className={`adm-type-btn ${activeTab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>{labels[idx]}</button>;
        })}
      </div>

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
              <div><div className="form-section-title">پرنٹیبل داخلہ فارم</div><div className="form-section-subtitle">طالب علم کا انتخاب کریں یا خالی فارم پرنٹ کریں</div></div>
            </div>
            <div style={{ marginTop: '15px', color: 'var(--muted)', fontSize: '0.9rem' }}>
                یہ خالی فارم پرنٹ کے لیے ہے۔ پرنٹ بٹن پر کلک کریں اور ہاتھ سے پر کریں۔
            </div>
            <div className="btn-container" style={{ marginTop: '15px' }}>
              <button onClick={() => window.print()} style={{ background: 'linear-gradient(135deg,var(--accent),var(--surface))', padding: '13px 40px', borderRadius: '10px' }}>فارم پرنٹ کریں</button>
            </div>
          </div>

          <div id="printableAdmissionFormArea" style={{ display: 'block', marginTop: '20px', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', background: '#fff', position: 'relative', overflow: 'hidden' }}>
            {activeLogo && (
              <div className="form-watermark-logo" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.05, pointerEvents: 'none', zIndex: 0 }}>
                <img src={activeLogo} alt="" style={{ width: '320px', height: '320px', objectFit: 'contain' }} />
              </div>
            )}
            <div className="printform-header" style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #ccc', paddingBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
                {activeLogo ? (
                  <img src={activeLogo} alt={activeMadrasa.name} style={{ maxHeight: '54px', maxWidth: '140px', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>☪</span>
                )}
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>{activeMadrasa.name}</h2>
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#475569', fontWeight: 600 }}>داخلہ فارم — Admission Form</h3>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <colgroup><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /></colgroup>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>رجسٹریشن نمبر</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admRegNo || ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>تاریخ داخلہ</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admDate || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>نام طالب علم</td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.name || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>والد کا نام</td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admFatherName || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>کلاس</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admClass || ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>صنف</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admGender || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>تاریخ پیدائش</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admDobFull || ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>عمر</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admAge || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>ب فارم نمبر</td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admBForm || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>موجودہ رہائشی پتہ</td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.admAddress || ''}</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ margin: '15px 0 5px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>والد کی معلومات</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <colgroup><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /><col style={{ width: '20%' }} /><col style={{ width: '30%' }} /></colgroup>
              <tbody>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>شناختی کارڈ نمبر</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.fatherCnic || ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>موبائل نمبر</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.fatherMobile || ''}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>پیشہ</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.fatherOcc || ''}</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>واٹس ایپ نمبر</td>
                  <td style={{ padding: '8px', border: '1px solid #ddd' }}>{printStudentObj.fatherWhatsapp || ''}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
              <div style={{ width: '200px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '5px' }}>دستخط سرپرست<br />Guardian Signature</div>
              <div style={{ width: '200px', borderTop: '1px solid #000', textAlign: 'center', paddingTop: '5px' }}>دستخط ادارہ<br />Institute Signature</div>
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
