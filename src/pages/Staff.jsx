import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { mapSupabaseToUi, mapUiToSupabase } from '../utils/StaffMappers';
import { validateInvitePayload, extractEdgeFunctionError } from '../utils/accountInviteValidation';

export { mapSupabaseToUi, mapUiToSupabase };

export default function Staff() {
  const {
    activeMadrasaId,
    fetchStaffFromSupabase,
    addStaffToSupabase,
    updateStaffInSupabase,
    deleteStaffFromSupabase,
    fetchClassesFromSupabase
  } = useMadrasa();

  const { role } = useAuth();
  const isAuthorizedToInvite = role === 'admin' || role === 'super_admin';

  const [staffProfiles, setStaffProfiles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Teacher Invite State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteErrors, setInviteErrors] = useState({});
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [inviteErrorMsg, setInviteErrorMsg] = useState('');

  const [createdTeacherAccount, setCreatedTeacherAccount] = useState(null);
  const [copiedTeacherPassword, setCopiedTeacherPassword] = useState(false);

  const handleCopyTeacherPassword = (pwd) => {
    if (!pwd) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pwd).then(() => {
        setCopiedTeacherPassword(true);
        setTimeout(() => setCopiedTeacherPassword(false), 2500);
      }).catch(() => {});
    }
  };

  const handleSendTeacherInvite = async (e) => {
    e.preventDefault();
    setInviteErrors({});
    setInviteSuccessMsg('');
    setInviteErrorMsg('');
    setCreatedTeacherAccount(null);

    const payload = {
      email: inviteEmail,
      fullName: inviteName,
      role: 'teacher',
      madrasaId: activeMadrasaId,
      phone: invitePhone
    };

    const validation = validateInvitePayload(payload);
    if (!validation.isValid) {
      setInviteErrors(validation.errors);
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-account-invite', {
        body: payload
      });

      if (error) {
        const errorDetail = await extractEdgeFunctionError(error);
        throw new Error(errorDetail || error.message);
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      setCreatedTeacherAccount({
        email: inviteEmail,
        password: data?.password || '',
        fullName: inviteName
      });
      setInviteSuccessMsg(data?.message || 'اکاؤنٹ کامیابی سے بن گیا ہے۔ نیچے دیا گیا پاسورڈ صارف کو فراہم کریں۔');
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
    } catch (err) {
      console.error('Teacher account creation error:', err);
      setInviteErrorMsg(err.message || 'اکاؤنٹ بنانے میں مسئلہ پیش آیا۔');
    } finally {
      setIsInviting(false);
    }
  };
  const [editingCode, setEditingCode] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    name: '',
    fatherName: '',
    cnic: '',
    assignedClass: '',
    phone: '',
    whatsapp: '',
    residenceStatus: 'ذاتی مکان',
    address: '',
    qualification: '',
    joiningDate: '',
    shiftStart: '06:50',
    shiftEnd: '14:45',
    experience: '',
    reference: '',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // Load from Supabase on mount and madrasa change
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [staffData, classesData] = await Promise.all([
          fetchStaffFromSupabase(activeMadrasaId).catch(() => []),
          fetchClassesFromSupabase(activeMadrasaId).catch(() => [])
        ]);

        if (isMounted) {
          const loadedClasses = classesData || [];
          setClasses(loadedClasses);

          if (staffData && staffData.length > 0) {
            const mapped = staffData.map(s => mapSupabaseToUi(s, loadedClasses));
            setStaffProfiles(mapped);
          } else {
            setStaffProfiles([]);
          }
        }
      } catch (err) {
        console.warn('Error loading staff data:', err);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getAssignedClassName = (classId) => {
    if (!classId) return '';
    const classObj = classes.find(c => String(c.id) === String(classId));
    return classObj ? (classObj.name || classObj.className || classObj.class_name || classObj.id) : '';
  };

  const saveStaffProfile = async () => {
    const name = formData.name.trim();
    const fatherName = formData.fatherName.trim();
    const phone = formData.phone.trim();
    
    if (!name || !fatherName || !phone) {
      alert('براہ کرم نام، والد کا نام اور فون نمبر لازمی درج کریں۔');
      return;
    }

    try {
      if (editingId || editingCode) {
        const target = staffProfiles.find(s =>
          (editingId && s.id === editingId) ||
          (editingCode && String(s.staffCode) === String(editingCode))
        );
        const targetId = editingId || (target ? target.id : null);

        const payload = mapUiToSupabase({
          ...formData,
          id: targetId,
          staffCode: editingCode
        }, activeMadrasaId);

        const updatedRow = await updateStaffInSupabase(targetId, payload, activeMadrasaId);
        const updatedUi = mapSupabaseToUi(updatedRow, classes);

        setStaffProfiles(prev => prev.map(s =>
          (s.id === targetId || String(s.staffCode) === String(editingCode))
            ? { ...s, ...updatedUi, assignedClassName: getAssignedClassName(formData.assignedClass) }
            : s
        ));
        setEditingCode(null);
        setEditingId(null);
      } else {
        const payload = mapUiToSupabase(formData, activeMadrasaId);
        const newRow = await addStaffToSupabase(payload, activeMadrasaId);
        const newUi = mapSupabaseToUi(newRow, classes);
        setStaffProfiles(prev => [...prev, { ...newUi, assignedClassName: getAssignedClassName(formData.assignedClass) }]);
      }

      setFormData(initialFormState);
      setIsFormOpen(false);
      alert('اسٹاف پروفائل کامیابی سے محفوظ ہو گیا۔');
    } catch (err) {
      console.error('Error saving staff profile:', err);
      alert(err.message || 'پروفائل محفوظ کرنے میں خرابی پیش آگئی۔');
    }
  };

  const editStaffProfile = (code) => {
    const profile = staffProfiles.find(s => String(s.staffCode) === String(code) || String(s.id) === String(code));
    if (!profile) {
      alert('پروفائل نہیں ملا!');
      return;
    }

    setIsFormOpen(true);
    setEditingCode(profile.staffCode);
    setEditingId(profile.id);
    setFormData({
      name: profile.name || '',
      fatherName: profile.fatherName || '',
      cnic: profile.cnic || '',
      assignedClass: profile.assignedClass || '',
      phone: profile.phone || '',
      whatsapp: profile.whatsapp || '',
      residenceStatus: profile.residenceStatus || 'ذاتی مکان',
      address: profile.address || '',
      qualification: profile.qualification || '',
      joiningDate: profile.joiningDate || '',
      shiftStart: profile.shiftStart || '06:50',
      shiftEnd: profile.shiftEnd || '14:45',
      experience: profile.experience || '',
      reference: profile.reference || '',
      notes: profile.notes || ''
    });
    
    alert('ترمیم کریں اور "پروفائل محفوظ کریں" دبائیں۔');
  };

  const deleteStaffProfile = async (code) => {
    if (!window.confirm('کیا آپ یہ پروفائل حذف کرنا چاہتے ہیں؟')) return;
    const target = staffProfiles.find(s => String(s.staffCode) === String(code) || String(s.id) === String(code));
    const targetId = target ? target.id : code;

    try {
      await deleteStaffFromSupabase(targetId, activeMadrasaId);
      setStaffProfiles(prev => prev.filter(s => s.id !== targetId && String(s.staffCode) !== String(code)));
    } catch (err) {
      console.error('Error deleting staff profile:', err);
      alert(err.message || 'پروفائل حذف کرنے میں خرابی پیش آگئی۔');
    }
  };

  const clearStaffForm = () => {
    setFormData(initialFormState);
  };

  const getAvatarColor = (name) => {
    const avatarColors = [
      '#0d3b66','#185086','#1a6b3c','#7c3aed','#db2777',
      '#d97706','#0891b2','#dc2626','#059669','#9333ea'
    ];
    const code = (name || 'A').charCodeAt(0);
    return avatarColors[code % avatarColors.length];
  };

  const firstChar = (name) => {
    const n = (name || '؟').trim();
    return n.charAt(0).toUpperCase();
  };

  const filteredStaff = [...staffProfiles]
    .sort((a, b) => Number(a.staffCode || 0) - Number(b.staffCode || 0))
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.trim().toLowerCase();
      return `${s.name || ''} ${s.fatherName || ''} ${s.assignedClassName || ''}`.toLowerCase().includes(query);
    });

  return (
    <div className="tab-content" id="tab-staff">
      {/* Trigger Buttons Row */}
      <div className="staff-add-trigger" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          className="staff-add-open-btn" 
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            if (isFormOpen) {
              setFormData(initialFormState);
              setEditingCode(null);
              setEditingId(null);
            }
          }}
        >
          <span id="staffFormToggleIcon"></span>
          <span id="staffFormToggleText">{isFormOpen ? 'فارم بند کریں' : 'نیا استاد شامل کریں'}</span>
        </button>

        {isAuthorizedToInvite && (
          <button
            type="button"
            className="staff-add-open-btn"
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', color: '#ffffff' }}
            onClick={() => {
              setIsInviteModalOpen(true);
              setInviteSuccessMsg('');
              setInviteErrorMsg('');
              setInviteErrors({});
              setCreatedTeacherAccount(null);
            }}
          >
            <span>استاد کا لاگ ان اکاؤنٹ بنائیں</span>
          </button>
        )}
      </div>

      {/* Teacher Creation Modal */}
      {isInviteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--card, #ffffff)',
              color: 'var(--text, #1e293b)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              direction: 'rtl'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>استاد کا لاگ ان اکاؤنٹ بنائیں</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              استاد کے لیے براہ راست اکاؤنٹ بنا کر لاگ ان کی تفصیلات حاصل کریں۔
            </p>

            {/* Prominently displayed generated credentials */}
            {createdTeacherAccount && (
              <div
                style={{
                  backgroundColor: 'var(--card-inner, #f8fafc)',
                  border: '2px solid #10b981',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '16px'
                }}
                role="region"
                aria-label="استاد کے اکاؤنٹ کی تفصیلات"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ color: '#065f46', fontWeight: 700, fontSize: '0.95rem' }}>
                    <strong>استاد کا اکاؤنٹ کامیابی سے بن گیا ہے</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreatedTeacherAccount(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      color: 'var(--muted, #64748b)',
                      padding: '0 4px',
                      lineHeight: 1
                    }}
                    title="بند کریں"
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', padding: '8px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted, #64748b)', marginBottom: '2px' }}>صارف کا ای میل ایڈریس (Email)</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', direction: 'ltr', textAlign: 'right', wordBreak: 'break-all' }}>
                      {createdTeacherAccount.email}
                    </div>
                  </div>

                  <div style={{ background: 'var(--card, #ffffff)', border: '1px solid var(--border, #e2e8f0)', padding: '8px 12px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted, #64748b)', marginBottom: '2px' }}>پیدا شدہ پاسورڈ (Generated Password)</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          color: '#0284c7',
                          userSelect: 'all',
                          direction: 'ltr'
                        }}
                      >
                        {createdTeacherAccount.password}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTeacherPassword(createdTeacherAccount.password)}
                        style={{
                          backgroundColor: copiedTeacherPassword ? '#10b981' : '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {copiedTeacherPassword ? 'کاپی ہو گیا!' : 'کاپی کریں'}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    color: '#92400e',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  <span><strong>تنبیہ:</strong> یہ پاسورڈ دوبارہ نہیں دکھایا جائے گا — ابھی محفوظ کر لیں یا صارف کو بھیج دیں۔</span>
                </div>
              </div>
            )}

            {inviteSuccessMsg && !createdTeacherAccount && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                {inviteSuccessMsg}
              </div>
            )}

            {inviteErrorMsg && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                {inviteErrorMsg}
              </div>
            )}

            <form onSubmit={handleSendTeacherInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>استاد کا مکمل نام *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قاری بلال احمد"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem' }}
                />
                {inviteErrors.fullName && <span style={{ color: '#dc2626', fontSize: '0.78rem' }}>{inviteErrors.fullName}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>ای میل ایڈریس *</label>
                <input
                  type="email"
                  required
                  placeholder="مثال: teacher@madrasa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem' }}
                />
                {inviteErrors.email && <span style={{ color: '#dc2626', fontSize: '0.78rem' }}>{inviteErrors.email}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>فون نمبر (اختیاری)</label>
                <input
                  type="tel"
                  placeholder="مثال: 0300-1234567"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', fontSize: '0.9rem' }}
                />
                {inviteErrors.phone && <span style={{ color: '#dc2626', fontSize: '0.78rem' }}>{inviteErrors.phone}</span>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border, #cbd5e1)', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: 600, cursor: isInviting ? 'not-allowed' : 'pointer' }}
                >
                  {isInviting ? 'اکاؤنٹ بنایا جا رہا ہے...' : 'اکاؤنٹ بنائیں'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div id="staffFormCollapse" className="staff-collapse-panel slide-down" style={{ display: 'block' }}>
          <div className="staff-collapse-inner">
            <div className="form-section-header" style={{ marginBottom: '20px' }}>
              <div className="form-section-icon icon-blue"></div>
              <div>
                <div className="form-section-title">اسٹاف پروفائل فارم</div>
                <div className="form-section-subtitle">تمام ضروری معلومات درج کریں</div>
              </div>
            </div>

            <div className="grid-row">
              <div>
                <label>نام</label>
                <input type="text" id="staffName" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} />
              </div>
              <div>
                <label>والد کا نام</label>
                <input type="text" id="staffFatherName" value={formData.fatherName} onChange={e => handleInputChange('fatherName', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>شناختی کارڈ نمبر</label>
                <input type="text" id="staffCnic" placeholder="00000-0000000-0" maxLength="15" value={formData.cnic} onChange={e => handleInputChange('cnic', e.target.value)} />
              </div>
              <div>
                <label>تفویض کردہ کلاس</label>
                <select id="staffClass" value={formData.assignedClass} onChange={e => handleInputChange('assignedClass', e.target.value)}>
                  <option value="">کلاس منتخب کریں...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.className || c.class_name || c.id}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>فون نمبر</label>
                <input type="text" id="staffPhone" placeholder="0300-1234567" maxLength="12" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} />
              </div>
              <div>
                <label>واٹس ایپ نمبر</label>
                <input type="text" id="staffWhatsapp" placeholder="0300-1234567" maxLength="12" value={formData.whatsapp} onChange={e => handleInputChange('whatsapp', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>رہائشی حیثیت</label>
                <select id="staffResidenceStatus" value={formData.residenceStatus} onChange={e => handleInputChange('residenceStatus', e.target.value)}>
                  <option value="ذاتی مکان">ذاتی مکان</option>
                  <option value="کرایہ">کرایہ</option>
                  <option value="دیگر">دیگر</option>
                </select>
              </div>
              <div>
                <label>رہائشی پتہ</label>
                <input type="text" id="staffAddress" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>تعلیمی قابلیت</label>
                <input type="text" id="staffQualification" placeholder="مثلاً: حفظ + درس نظامی" value={formData.qualification} onChange={e => handleInputChange('qualification', e.target.value)} />
              </div>
              <div>
                <label>تقرری کی تاریخ</label>
                <input type="date" id="staffJoiningDate" value={formData.joiningDate} onChange={e => handleInputChange('joiningDate', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>متوقع آمد</label>
                <input type="time" id="staffShiftStart" value={formData.shiftStart} onChange={e => handleInputChange('shiftStart', e.target.value)} />
              </div>
              <div>
                <label>متوقع روانگی</label>
                <input type="time" id="staffShiftEnd" value={formData.shiftEnd} onChange={e => handleInputChange('shiftEnd', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <label>سابقہ تجربہ</label>
                <input type="text" id="staffExperience" placeholder="مثلاً: جامعہ نور، 3 سال" value={formData.experience} onChange={e => handleInputChange('experience', e.target.value)} />
              </div>
              <div>
                <label>پچھلا ادارہ / ریفرنس</label>
                <input type="text" id="staffReference" placeholder="مثلاً: قاری محمد عامر" value={formData.reference} onChange={e => handleInputChange('reference', e.target.value)} />
              </div>
            </div>
            <div className="grid-row">
              <div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label>مزید نوٹس</label>
                  <textarea id="staffNotes" rows="3" value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)}></textarea>
                </div>
              </div>
            </div>

            <div className="staff-form-btns">
              <button className="staff-save-btn" onClick={saveStaffProfile}>پروفائل محفوظ کریں</button>
              <button className="staff-reset-btn" onClick={clearStaffForm}>فارم صاف کریں</button>
              <button className="staff-cancel-btn" onClick={() => { setIsFormOpen(false); setEditingCode(null); setEditingId(null); }}>بند کریں</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== اساتذہ کی فہرست ===== */}
      <div className="staff-list-wrap">
        <div className="staff-list-header">
          <h3 style={{ margin: '0', color: 'var(--accent)' }}>تمام اساتذہ کی فہرست</h3>
          <input type="text" id="staffSearch" className="staff-search-input" placeholder="نام یا کلاس سے تلاش..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        
        <div id="staffListArea">
          {filteredStaff.length === 0 ? (
            <div className="empty-dashboard-state">ابھی تک کوئی اسٹاف پروفائل موجود نہیں۔</div>
          ) : (
            filteredStaff.map((s, idx) => {
              const color = getAvatarColor(s.name);
              const initial = firstChar(s.name);
              const code = s.staffCode || (1000 + idx + 1);

              return (
                <div key={s.id || code} className="staff-card-new">
                  <div className="staff-card-actions">
                    <button className="staff-action-btn staff-edit-btn" style={{ width: 'auto', padding: '0 8px' }} onClick={() => editStaffProfile(code)} title="ترمیم">ترمیم</button>
                    <button className="staff-action-btn staff-delete-btn" style={{ width: 'auto', padding: '0 8px' }} onClick={() => deleteStaffProfile(code)} title="حذف">حذف</button>
                  </div>

                  <div className="staff-card-top">
                    <div className="staff-avatar" style={{ background: color }}>{initial}</div>
                    <div>
                      <div className="staff-card-name">{s.name || '-'}</div>
                      <span className="staff-card-id">ID: {code}</span>
                      <div className="staff-card-father">والد: {s.fatherName || '-'}</div>
                    </div>
                  </div>

                  <div className="staff-details-grid">
                    <div className="staff-detail-item">
                      <span className="staff-detail-icon"></span>
                      <div>
                        <span className="staff-detail-label">تفویض کردہ کلاس</span>
                        <span className="staff-detail-val">{s.assignedClassName || 'تفویض نہیں'}</span>
                      </div>
                    </div>
                    <div className="staff-detail-item">
                      <span className="staff-detail-icon"></span>
                      <div>
                        <span className="staff-detail-label">فون نمبر</span>
                        <span className="staff-detail-val">{s.phone || '-'}</span>
                      </div>
                    </div>
                    <div className="staff-detail-item">
                      <span className="staff-detail-icon"></span>
                      <div>
                        <span className="staff-detail-label">واٹس ایپ</span>
                        <span className="staff-detail-val">{s.whatsapp || '-'}</span>
                      </div>
                    </div>
                    <div className="staff-detail-item">
                      <span className="staff-detail-icon"></span>
                      <div>
                        <span className="staff-detail-label">شناختی کارڈ</span>
                        <span className="staff-detail-val">{s.cnic || '-'}</span>
                      </div>
                    </div>
                    <div className="staff-detail-item">
                      <span className="staff-detail-icon"></span>
                      <div>
                        <span className="staff-detail-label">تعلیمی قابلیت</span>
                        <span className="staff-detail-val">{s.qualification || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
