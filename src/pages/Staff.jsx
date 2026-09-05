import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { mapSupabaseToUi, mapUiToSupabase } from '../utils/StaffMappers';

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

  const [staffProfiles, setStaffProfiles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
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
      {/* Collapsible Staff Add Trigger */}
      <div className="staff-add-trigger">
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
      </div>

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
