import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { validateInvitePayload, extractEdgeFunctionError } from '../utils/accountInviteValidation';
import { MADRASA_PLANS, getPlanDetails } from '../constants/defaults';
import './SuperAdmin.css';

export default function SuperAdmin() {
  const [madrasas, setMadrasas] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [madrasaName, setMadrasaName] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [madrasaDistrict, setMadrasaDistrict] = useState('');
  const [madrasaAddress, setMadrasaAddress] = useState('');
  const [planName, setPlanName] = useState('free_maktab');
  const [customMaxStudents, setCustomMaxStudents] = useState(50);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  const [createdAccount, setCreatedAccount] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Status & Delete Actions State
  const [madrasaToDelete, setMadrasaToDelete] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState({ type: '', message: '' });

  // Edit Mohtamim State
  const [editingMadrasa, setEditingMadrasa] = useState(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [editMadrasaName, setEditMadrasaName] = useState('');
  const [editMadrasaDistrict, setEditMadrasaDistrict] = useState('');
  const [editMadrasaAddress, setEditMadrasaAddress] = useState('');
  const [editPlanName, setEditPlanName] = useState('free_maktab');
  const [editMaxStudents, setEditMaxStudents] = useState(50);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // District Filter & Sort State
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [sortByDistrict, setSortByDistrict] = useState(false);

  // Inline Quick Plan Change State
  const [inlineCustomPlanRowId, setInlineCustomPlanRowId] = useState(null);
  const [inlineCustomLimit, setInlineCustomLimit] = useState(500);

  const getDefaultMaxForPlan = (planId) => {
    const matched = MADRASA_PLANS.find((p) => p.id === planId);
    return matched ? matched.maxStudents : 50;
  };

  const handleOpenEdit = (m) => {
    const adminProfile = (m.profiles || []).find(p => p.role === 'admin');
    setEditingMadrasa(m);
    setEditMadrasaName(m.name || '');
    setEditAdminName(adminProfile?.full_name || '');
    setEditAdminPhone(adminProfile?.phone || m.phone || '');
    setEditMadrasaDistrict(m.district || '');
    setEditMadrasaAddress(m.address || '');
    setEditPlanName(m.plan_name || 'free_maktab');
    setEditMaxStudents(m.max_students || 50);
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMadrasa) return;

    if (!editAdminName.trim()) {
      setEditError('مہتمم / منتظم کا نام درج کرنا لازمی ہے۔');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    setActionFeedback({ type: '', message: '' });

    try {
      const adminProfile = (editingMadrasa.profiles || []).find(p => p.role === 'admin');

      // 1. Update Mohtamim profile name and phone if profile exists
      if (adminProfile?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: editAdminName.trim(),
            phone: editAdminPhone.trim() || null
          })
          .eq('id', adminProfile.id);

        if (profileError) throw profileError;
      }

      // 2. Also update madrasa name, phone, district, address if modified
      const madrasaUpdates = {};
      if (editMadrasaName.trim() && editMadrasaName.trim() !== editingMadrasa.name) {
        madrasaUpdates.name = editMadrasaName.trim();
      }
      if (editAdminPhone.trim() !== (editingMadrasa.phone || '')) {
        madrasaUpdates.phone = editAdminPhone.trim() || null;
      }
      if (editMadrasaDistrict.trim() !== (editingMadrasa.district || '')) {
        madrasaUpdates.district = editMadrasaDistrict.trim() || null;
      }
      if (editMadrasaAddress.trim() !== (editingMadrasa.address || '')) {
        madrasaUpdates.address = editMadrasaAddress.trim() || null;
      }
      if (editPlanName && editPlanName !== editingMadrasa.plan_name) {
        madrasaUpdates.plan_name = editPlanName;
      }
      const parsedEditMax = Number(editMaxStudents);
      if (!isNaN(parsedEditMax) && parsedEditMax > 0 && parsedEditMax !== editingMadrasa.max_students) {
        madrasaUpdates.max_students = parsedEditMax;
      }

      if (Object.keys(madrasaUpdates).length > 0) {
        const { error: madrasaError } = await supabase
          .from('madrasas')
          .update(madrasaUpdates)
          .eq('id', editingMadrasa.id);

        if (madrasaError) throw madrasaError;
      }

      setActionFeedback({
        type: 'success',
        message: `مہتمم "${editAdminName.trim()}" کی تفصیلات کامیابی سے تبدیل ہو گئیں۔`
      });

      setEditingMadrasa(null);
      await loadMadrasas();
    } catch (err) {
      console.error('Error updating mohtamim:', err);
      setEditError(err.message || 'معلومات تبدیل کرنے میں خرابی پیش آئی۔');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopyPassword = (pwd) => {
    if (!pwd) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pwd).then(() => {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2500);
      }).catch(() => {});
    }
  };

  const handleToggleStatus = async (m) => {
    const newStatus = m.status === 'disabled' ? 'active' : 'disabled';
    const actionName = newStatus === 'disabled' ? 'معطل' : 'بحال';
    setActionInProgress(m.id);
    setActionFeedback({ type: '', message: '' });
    try {
      const { error } = await supabase
        .from('madrasas')
        .update({ status: newStatus })
        .eq('id', m.id);

      if (error) throw error;

      setActionFeedback({
        type: 'success',
        message: `مدرسہ "${m.name}" کامیابی سے ${actionName} کر دیا گیا ہے۔`
      });
      await loadMadrasas();
    } catch (err) {
      console.error('Toggle status error:', err);
      setActionFeedback({
        type: 'error',
        message: `حالت تبدیل کرنے میں خرابی پیش آئی: ${err.message || 'نامعلوم خرابی'}`
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!madrasaToDelete) return;
    setIsDeleting(true);
    setActionFeedback({ type: '', message: '' });
    try {
      const { error } = await supabase.rpc('delete_madrasa_completely', {
        p_madrasa_id: madrasaToDelete.id
      });

      if (error) throw error;

      setActionFeedback({
        type: 'success',
        message: `مدرسہ "${madrasaToDelete.name}" اور اس کا تمام ریکارڈ کامیابی سے حذف کر دیا گیا ہے۔`
      });
      setMadrasaToDelete(null);
      await loadMadrasas();
    } catch (err) {
      console.error('Delete madrasa error:', err);
      setActionFeedback({
        type: 'error',
        message: `مدرسہ حذف کرنے میں خرابی پیش آئی: ${err.message || 'نامعلوم خرابی'}`
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Inline Quick Plan Update Handler
  const updateMadrasaPlan = async (madrasa, newPlanName, newMaxStudents) => {
    const numericLimit = Number(newMaxStudents);
    if (!numericLimit || numericLimit <= 0) {
      setActionFeedback({
        type: 'error',
        message: 'براہِ کرم طلباء کی درست تعداد (1 یا اس سے زیادہ) درج کریں۔'
      });
      return;
    }

    setActionInProgress(madrasa.id);
    setActionFeedback({ type: '', message: '' });
    try {
      const { error } = await supabase
        .from('madrasas')
        .update({
          plan_name: newPlanName,
          max_students: numericLimit
        })
        .eq('id', madrasa.id);

      if (error) throw error;

      const updatedPlanInfo = getPlanDetails(newPlanName, numericLimit);
      setMadrasas((prev) =>
        prev.map((item) =>
          item.id === madrasa.id
            ? { ...item, plan_name: newPlanName, max_students: numericLimit }
            : item
        )
      );
      setInlineCustomPlanRowId(null);
      setActionFeedback({
        type: 'success',
        message: `مدرسہ "${madrasa.name}" کا پلان کامیابی سے "${updatedPlanInfo.name}" (حد: ${numericLimit} طلباء) میں تبدیل کر دیا گیا ہے۔`
      });
    } catch (err) {
      console.error('Quick plan update error:', err);
      setActionFeedback({
        type: 'error',
        message: `پلان تبدیل کرنے میں خرابی پیش آئی: ${err.message || 'نامعلوم خرابی'}`
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleInlinePlanSelectChange = (madrasa, selectedPlanId) => {
    if (selectedPlanId === 'custom_unlimited') {
      setInlineCustomPlanRowId(madrasa.id);
      setInlineCustomLimit(
        madrasa.plan_name === 'custom_unlimited' && Number(madrasa.max_students) > 0
          ? Number(madrasa.max_students)
          : 500
      );
      return;
    }
    setInlineCustomPlanRowId(null);
    const nextMax = getDefaultMaxForPlan(selectedPlanId);
    updateMadrasaPlan(madrasa, selectedPlanId, nextMax);
  };

  // Fetch all madrasas and their associated admins and students
  const loadMadrasas = async () => {
    setLoadingList(true);
    try {
      let { data, error } = await supabase
        .from('madrasas')
        .select('*, profiles(id, full_name, role, phone), students(id, status)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Primary madrasas query failed, retrying fallback:', error.message);
        const fallback = await supabase
          .from('madrasas')
          .select('*, profiles(id, full_name, role, phone)')
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        setMadrasas(data);
      } else if (error) {
        console.warn('Error loading madrasas:', error.message);
      }
    } catch (err) {
      console.error('Exception loading madrasas:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadMadrasas();
    if (supabase.auth?.getSession) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user?.email) {
          setCurrentUserEmail(data.session.user.email);
        }
      }).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setErrors({});
    setCreatedAccount(null);

    const finalMax = planName === 'custom_unlimited'
      ? (Number(customMaxStudents) > 0 ? Number(customMaxStudents) : 500)
      : (planName === 'standard_madrasa' ? 150 : (planName === 'large_jamia' ? 300 : 50));

    const payload = {
      madrasaName,
      fullName: adminFullName,
      email: adminEmail,
      role: 'admin',
      phone: adminPhone,
      district: madrasaDistrict,
      address: madrasaAddress,
      planName,
      maxStudents: finalMax
    };

    const validation = validateInvitePayload(payload);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // Check if entered email matches current logged-in Super Admin email
    let activeEmail = currentUserEmail;
    if (!activeEmail && supabase.auth?.getSession) {
      try {
        const { data } = await supabase.auth.getSession();
        activeEmail = data?.session?.user?.email || '';
      } catch {
        // ignore
      }
    }

    if (activeEmail && adminEmail.trim().toLowerCase() === activeEmail.trim().toLowerCase()) {
      const selfEmailErr = 'یہ ای میل ایڈریس آپ کے سپر ایڈمن اکاؤنٹ کے لیے استعمال ہو رہا ہے۔ نئے مہتمم کے لیے الگ ای میل ایڈریس درج کریں۔';
      setErrors({ email: selfEmailErr });
      setErrorMsg(selfEmailErr);
      return;
    }

    if (supabase.auth?.getSession) {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session || !session.access_token) {
          setErrorMsg('آپ کا لاگ ان سیشن ختم ہو چکا ہے۔ برائے مہربانی صفحہ ریفریش کریں یا دوبارہ لاگ ان کریں۔');
          return;
        }
      } catch {
        // ignore
      }
    }

    setIsSubmitting(true);
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

      // Ensure madrasa has the plan and max_students persisted in database
      if (data?.madrasaId) {
        try {
          await supabase
            .from('madrasas')
            .update({ plan_name: planName, max_students: finalMax })
            .eq('id', data.madrasaId);
        } catch (mUpdateErr) {
          console.warn('Could not post-update madrasa plan:', mUpdateErr);
        }
      }

      setCreatedAccount({
        email: adminEmail,
        password: data?.password || '',
        fullName: adminFullName,
        madrasaName: madrasaName
      });
      setSuccessMsg(data?.message || 'اکاؤنٹ کامیابی سے بن گیا ہے۔ نیچے دیا گیا پاسورڈ صارف کو فراہم کریں۔');
      setMadrasaName('');
      setAdminFullName('');
      setAdminEmail('');
      setAdminPhone('');
      setMadrasaDistrict('');
      setMadrasaAddress('');
      setPlanName('free_maktab');
      setCustomMaxStudents(50);
      await loadMadrasas();
    } catch (err) {
      console.error('Create admin error:', err);
      const msg = err.message || 'اکاؤنٹ بنانے میں مسئلہ پیش آیا۔ برائے مہربانی دوبارہ کوشش کریں۔';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueDistricts = Array.from(
    new Set(
      madrasas
        .map(m => (m.district || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ur'));

  const filteredMadrasas = madrasas
    .filter(m => {
      // 1. District filter
      if (selectedDistrict !== 'all') {
        const mDist = (m.district || '').trim();
        if (mDist !== selectedDistrict) return false;
      }

      // 2. Search query filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const mName = (m.name || '').toLowerCase();
      const admin = (m.profiles || []).find(p => p.role === 'admin');
      const aName = (admin?.full_name || '').toLowerCase();
      const mDist = (m.district || '').toLowerCase();
      const mAddr = (m.address || '').toLowerCase();
      return (
        mName.includes(q) ||
        aName.includes(q) ||
        mDist.includes(q) ||
        mAddr.includes(q)
      );
    })
    .sort((a, b) => {
      if (sortByDistrict) {
        const distA = (a.district || '').trim();
        const distB = (b.district || '').trim();
        if (distA && !distB) return -1;
        if (!distA && distB) return 1;
        const comp = distA.localeCompare(distB, 'ur');
        if (comp !== 0) return comp;
      }
      return 0;
    });

  const totalAdminsCount = madrasas.reduce((acc, m) => {
    const admins = (m.profiles || []).filter(p => p.role === 'admin');
    return acc + admins.length;
  }, 0);

  return (
    <div className="super-admin-container" dir="rtl">
      {/* Header & Stats */}
      <div className="super-admin-header-card">
        <div className="super-admin-title-area">
          <h2>سپر ایڈمن کنٹرول ڈیش بورڈ</h2>
          <p>تمام رجسٹرڈ مدارس اور منتظمین کی مرکزی نگرانی و نیا اندراج</p>
        </div>
        <div className="super-admin-stats-row">
          <div className="super-admin-stat-badge">
            <span className="super-admin-stat-val">{madrasas.length}</span>
            <span className="super-admin-stat-label">کل مدارس</span>
          </div>
          <div className="super-admin-stat-badge">
            <span className="super-admin-stat-val">{totalAdminsCount}</span>
            <span className="super-admin-stat-label">کل منتظمین</span>
          </div>
        </div>
      </div>

      {/* Action Form */}
      <div className="super-admin-card">
        <div className="super-admin-card-header">
          <h3>نیا مدرسہ اور منتظم (مہتمم) شامل کریں</h3>
        </div>

        {/* Prominently displayed generated credentials */}
        {createdAccount && (
          <div className="super-admin-credentials-box" role="region" aria-label="اکاؤنٹ کی تفصیلات">
            <div className="credentials-box-header">
              <div className="credentials-box-title">
                <strong>نیا منتظم اکاؤنٹ کامیابی سے بن گیا ہے</strong>
              </div>
              <button
                type="button"
                className="credentials-close-btn"
                onClick={() => setCreatedAccount(null)}
                title="بند کریں"
                aria-label="بند کریں"
              >
                ×
              </button>
            </div>

            <div className="credentials-grid">
              <div className="credentials-item">
                <span className="credentials-item-label">صارف کا ای میل ایڈریس (Email)</span>
                <span className="credentials-item-val credentials-email-val">{createdAccount.email}</span>
              </div>

              <div className="credentials-item">
                <span className="credentials-item-label">پیدا شدہ پاسورڈ (Generated Password)</span>
                <div className="credentials-pwd-row">
                  <span className="credentials-pwd-val">{createdAccount.password}</span>
                  <button
                    type="button"
                    className="credentials-copy-btn"
                    onClick={() => handleCopyPassword(createdAccount.password)}
                  >
                    {copiedPassword ? 'کاپی ہو گیا!' : 'کاپی کریں'}
                  </button>
                </div>
              </div>
            </div>

            <div className="credentials-warning-alert">
              <span><strong>تنبیہ:</strong> یہ پاسورڈ دوبارہ نہیں دکھایا جائے گا — ابھی محفوظ کر لیں یا صارف کو بھیج دیں۔</span>
            </div>
          </div>
        )}

        {successMsg && !createdAccount && (
          <div className="super-admin-alert-success" role="status">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="super-admin-alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="super-admin-form-grid">
            <div className="form-field-item">
              <label htmlFor="inputMadrasaName">مدرسے کا نام *</label>
              <input
                id="inputMadrasaName"
                type="text"
                className="form-field-input"
                placeholder="مثال: جامعہ دارالعلوم کراچی"
                value={madrasaName}
                onChange={(e) => setMadrasaName(e.target.value)}
                required
              />
              {errors.madrasaName && <span className="form-field-error">{errors.madrasaName}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="inputAdminFullName">منتظم / مہتمم کا نام *</label>
              <input
                id="inputAdminFullName"
                type="text"
                className="form-field-input"
                placeholder="مثال: مولانا مفتی احمد صاحب"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                required
              />
              {errors.fullName && <span className="form-field-error">{errors.fullName}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="inputAdminEmail">منتظم کا ای میل ایڈریس *</label>
              <input
                id="inputAdminEmail"
                type="email"
                className="form-field-input"
                placeholder="مثال: admin@darululoom.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
              {errors.email && <span className="form-field-error">{errors.email}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="inputAdminPhone">رابطہ نمبر / فون (اختیاری)</label>
              <input
                id="inputAdminPhone"
                type="tel"
                className="form-field-input"
                placeholder="مثال: 0300-1234567"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
              />
              {errors.phone && <span className="form-field-error">{errors.phone}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="inputMadrasaDistrict">ضلع</label>
              <input
                id="inputMadrasaDistrict"
                type="text"
                className="form-field-input"
                placeholder="مثال: لاہور، کراچی، راولپنڈی"
                value={madrasaDistrict}
                onChange={(e) => setMadrasaDistrict(e.target.value)}
              />
              {errors.district && <span className="form-field-error">{errors.district}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="inputMadrasaAddress">تفصیلی ایڈریس</label>
              <input
                id="inputMadrasaAddress"
                type="text"
                className="form-field-input"
                placeholder="مثال: محلہ مدینہ کالونی، نزد جامع مسجد"
                value={madrasaAddress}
                onChange={(e) => setMadrasaAddress(e.target.value)}
              />
              {errors.address && <span className="form-field-error">{errors.address}</span>}
            </div>

            <div className="form-field-item">
              <label htmlFor="selectMadrasaPlan">منظور شدہ پلان اور طلباء کوٹہ *</label>
              <select
                id="selectMadrasaPlan"
                className="form-field-input"
                value={planName}
                onChange={(e) => {
                  const val = e.target.value;
                  setPlanName(val);
                  if (val === 'free_maktab') setCustomMaxStudents(50);
                  else if (val === 'standard_madrasa') setCustomMaxStudents(150);
                  else if (val === 'large_jamia') setCustomMaxStudents(300);
                  else if (val === 'custom_unlimited') setCustomMaxStudents(500);
                }}
              >
                <option value="free_maktab">ابتدائی / مکتب پلان (مفت) — زیادہ سے زیادہ 50 طلباء</option>
                <option value="standard_madrasa">معیاری مدرسہ پلان — زیادہ سے زیادہ 150 طلباء</option>
                <option value="large_jamia">بڑا جامعہ پلان — زیادہ سے زیادہ 300 طلباء</option>
                <option value="custom_unlimited">ملٹی برانچ یا حسبِ ضرورت کوٹہ</option>
              </select>
            </div>

            {planName === 'custom_unlimited' && (
              <div className="form-field-item">
                <label htmlFor="inputCustomMaxStudents">طلباء کی مخصوص حد (زیادہ سے زیادہ تعداد) *</label>
                <input
                  id="inputCustomMaxStudents"
                  type="number"
                  min="1"
                  className="form-field-input"
                  placeholder="مثال: 500"
                  value={customMaxStudents}
                  onChange={(e) => setCustomMaxStudents(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="super-admin-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'اکاؤنٹ بنایا جا رہا ہے...' : 'نیا مدرسہ و منتظم شامل کریں'}
          </button>
        </form>
      </div>

      {/* Registered Madrasas List */}
      <div className="super-admin-card">
        <div className="super-admin-card-header">
          <h3>رجسٹرڈ مدارس کی فہرست</h3>
          <button
            type="button"
            className="super-admin-btn-primary"
            onClick={loadMadrasas}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            فہرست تازہ کریں
          </button>
        </div>

        <div className="super-admin-search-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              className="form-field-input"
              placeholder="مدرسہ، منتظم، ضلع یا ایڈریس سے تلاش کریں..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="مدرسہ یا منتظم کے نام سے تلاش کریں"
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-field-input"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              aria-label="ضلع کے لحاظ سے فلٹر"
            >
              <option value="all">تمام اضلاع {uniqueDistricts.length > 0 ? `(${uniqueDistricts.length})` : ''}</option>
              {uniqueDistricts.map(dist => (
                <option key={dist} value={dist}>ضلع {dist}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              className="super-admin-btn-primary"
              onClick={() => setSortByDistrict(!sortByDistrict)}
              style={{
                padding: '9px 16px',
                fontSize: '0.84rem',
                backgroundColor: sortByDistrict ? '#0284c7' : 'transparent',
                color: sortByDistrict ? '#ffffff' : 'var(--text, #1e293b)',
                border: '1px solid var(--border, #cbd5e1)',
                cursor: 'pointer'
              }}
              title="اضلاع کی حروف تہجی کے مطابق ترتیب دیں"
            >
              {sortByDistrict ? 'ضلعی ترتیب: فعال' : 'ضلعی ترتیب'}
            </button>
          </div>
        </div>

        {actionFeedback.message && (
          <div
            className={actionFeedback.type === 'error' ? 'super-admin-alert-error' : 'super-admin-alert-success'}
            role={actionFeedback.type === 'error' ? 'alert' : 'status'}
            style={{ marginBottom: '16px' }}
          >
            {actionFeedback.message}
          </div>
        )}

        {loadingList ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
            مدارس کا ریکارڈ لوڈ ہو رہا ہے...
          </div>
        ) : filteredMadrasas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
            کوئی مدرسہ نہیں ملا۔
          </div>
        ) : (
          <div className="super-admin-table-wrapper">
            <table className="super-admin-table">
              <thead>
                <tr>
                  <th>مدرسے کا نام</th>
                  <th>مہتمم / منتظم</th>
                  <th>ضلع</th>
                  <th>فون نمبر</th>
                  <th>پلان و کوٹہ</th>
                  <th>حالت</th>
                  <th className="actions-col-header">اقدامات</th>
                  <th>تاریخ اندراج</th>
                </tr>
              </thead>
              <tbody>
                {filteredMadrasas.map(m => {
                  const adminProfile = (m.profiles || []).find(p => p.role === 'admin');
                  const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('ur-PK') : '—';
                  const isSuspended = m.status === 'disabled';
                  const activeCount = (m.students || []).filter(s => s.status !== 'left' && s.status !== 'withdrawn').length;
                  const maxLimit = Number(m.max_students || 50);
                  const planInfo = getPlanDetails(m.plan_name, maxLimit);
                  const isFull = activeCount >= maxLimit;
                  const isNearLimit = !isFull && activeCount >= (maxLimit * 0.85);

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>
                        <div>{m.name}</div>
                        {m.address && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px', fontWeight: 'normal' }}>
                            {m.address}
                          </div>
                        )}
                      </td>
                      <td>
                        {adminProfile ? (
                          <div>
                            <div>{adminProfile.full_name}</div>
                            <span className="admin-badge">ایڈمن</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>کوئی منتظم نہیں</span>
                        )}
                      </td>
                      <td>{m.district || '—'}</td>
                      <td>{adminProfile?.phone || m.phone || '—'}</td>
                      <td>
                        <div className="inline-plan-cell">
                          <div className="inline-plan-header">
                            <span className="inline-plan-name">{planInfo.name}</span>
                            <span className={`quota-pill ${isFull ? 'quota-full' : (isNearLimit ? 'quota-warning' : 'quota-ok')}`}>
                              طلباء: {activeCount} / {maxLimit}
                            </span>
                          </div>

                          <div className="inline-plan-controls">
                            <select
                              aria-label={`پلان تبدیل کریں برائے ${m.name}`}
                              className="inline-plan-select"
                              value={inlineCustomPlanRowId === m.id ? 'custom_unlimited' : (m.plan_name || 'free_maktab')}
                              onChange={(e) => handleInlinePlanSelectChange(m, e.target.value)}
                              disabled={actionInProgress === m.id || isDeleting}
                            >
                              {MADRASA_PLANS.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.id === 'custom_unlimited' ? p.name : `${p.name} (${p.maxStudents})`}
                                </option>
                              ))}
                            </select>

                            {m.plan_name === 'custom_unlimited' && inlineCustomPlanRowId !== m.id && (
                              <button
                                type="button"
                                className="inline-custom-edit-btn"
                                onClick={() => {
                                  setInlineCustomPlanRowId(m.id);
                                  setInlineCustomLimit(maxLimit);
                                }}
                                disabled={actionInProgress === m.id || isDeleting}
                              >
                                حد بدلیں
                              </button>
                            )}
                          </div>

                          {inlineCustomPlanRowId === m.id && (
                            <div className="inline-custom-quota-box">
                              <input
                                type="number"
                                min="1"
                                aria-label={`طلباء کی مخصوص حد برائے ${m.name}`}
                                className="inline-custom-limit-input"
                                value={inlineCustomLimit}
                                onChange={(e) => setInlineCustomLimit(e.target.value)}
                                disabled={actionInProgress === m.id}
                                placeholder="تعداد"
                              />
                              <button
                                type="button"
                                className="inline-custom-save-btn"
                                onClick={() => updateMadrasaPlan(m, 'custom_unlimited', inlineCustomLimit)}
                                disabled={actionInProgress === m.id}
                              >
                                {actionInProgress === m.id ? '...' : 'محفوظ'}
                              </button>
                              <button
                                type="button"
                                className="inline-custom-cancel-btn"
                                onClick={() => setInlineCustomPlanRowId(null)}
                                disabled={actionInProgress === m.id}
                              >
                                منسوخ
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`madrasa-status-pill ${isSuspended ? 'status-disabled' : 'status-active'}`}>
                          {isSuspended ? 'معطل' : 'فعال'}
                        </span>
                      </td>
                      <td className="actions-col-cell">
                        <div className="madrasa-actions-cell">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => handleOpenEdit(m)}
                            disabled={actionInProgress === m.id || isDeleting}
                            title="مہتمم کی تفصیلات میں ترمیم کریں"
                          >
                            ترمیم کریں
                          </button>
                          <button
                            type="button"
                            className={`btn-action-toggle ${isSuspended ? 'action-enable' : 'action-disable'}`}
                            onClick={() => handleToggleStatus(m)}
                            disabled={actionInProgress === m.id || isDeleting}
                            title={isSuspended ? 'مدرسہ بحال کریں' : 'مدرسہ عارضی طور پر معطل کریں'}
                          >
                            {actionInProgress === m.id
                              ? '...'
                              : isSuspended
                              ? 'بحال کریں'
                              : 'معطل کریں'}
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => setMadrasaToDelete(m)}
                            disabled={actionInProgress === m.id || isDeleting}
                            title="مدرسہ مستقل طور پر حذف کریں"
                          >
                            حذف کریں
                          </button>
                        </div>
                      </td>
                      <td>{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Mohtamim Modal */}
      {editingMadrasa && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-edit-title">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3 id="modal-edit-title" style={{ color: 'var(--text, #1e293b)' }}>
                مہتمم کی تفصیلات میں ترمیم
              </h3>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ marginBottom: '16px' }}>
                {editError && (
                  <div className="super-admin-alert-error" role="alert" style={{ marginBottom: '14px' }}>
                    {editError}
                  </div>
                )}

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editMadrasaNameInput">مدرسے کا نام</label>
                  <input
                    id="editMadrasaNameInput"
                    type="text"
                    className="form-field-input"
                    value={editMadrasaName}
                    onChange={(e) => setEditMadrasaName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editAdminNameInput">مہتمم / منتظم کا نام *</label>
                  <input
                    id="editAdminNameInput"
                    type="text"
                    className="form-field-input"
                    placeholder="مثال: مولانا مفتی احمد صاحب"
                    value={editAdminName}
                    onChange={(e) => setEditAdminName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editAdminPhoneInput">رابطہ نمبر / فون</label>
                  <input
                    id="editAdminPhoneInput"
                    type="tel"
                    className="form-field-input"
                    placeholder="مثال: 0300-1234567"
                    value={editAdminPhone}
                    onChange={(e) => setEditAdminPhone(e.target.value)}
                  />
                </div>

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editMadrasaDistrictInput">ضلع</label>
                  <input
                    id="editMadrasaDistrictInput"
                    type="text"
                    className="form-field-input"
                    placeholder="مثال: لاہور، کراچی، راولپنڈی"
                    value={editMadrasaDistrict}
                    onChange={(e) => setEditMadrasaDistrict(e.target.value)}
                  />
                </div>

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editMadrasaAddressInput">تفصیلی ایڈریس</label>
                  <input
                    id="editMadrasaAddressInput"
                    type="text"
                    className="form-field-input"
                    placeholder="مثال: محلہ مدینہ کالونی، نزد جامع مسجد"
                    value={editMadrasaAddress}
                    onChange={(e) => setEditMadrasaAddress(e.target.value)}
                  />
                </div>

                <div className="form-field-item" style={{ marginBottom: '14px' }}>
                  <label htmlFor="editMadrasaPlanSelect">منظور شدہ پلان اور طلباء کوٹہ *</label>
                  <select
                    id="editMadrasaPlanSelect"
                    className="form-field-input"
                    value={editPlanName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditPlanName(val);
                      if (val === 'free_maktab') setEditMaxStudents(50);
                      else if (val === 'standard_madrasa') setEditMaxStudents(150);
                      else if (val === 'large_jamia') setEditMaxStudents(300);
                      else if (val === 'custom_unlimited') setEditMaxStudents(500);
                    }}
                  >
                    <option value="free_maktab">ابتدائی / مکتب پلان (مفت) — زیادہ سے زیادہ 50 طلباء</option>
                    <option value="standard_madrasa">معیاری مدرسہ پلان — زیادہ سے زیادہ 150 طلباء</option>
                    <option value="large_jamia">بڑا جامعہ پلان — زیادہ سے زیادہ 300 طلباء</option>
                    <option value="custom_unlimited">ملٹی برانچ یا حسبِ ضرورت کوٹہ</option>
                  </select>
                </div>

                {editPlanName === 'custom_unlimited' && (
                  <div className="form-field-item" style={{ marginBottom: '8px' }}>
                    <label htmlFor="editCustomMaxStudentsInput">طلباء کی مخصوص حد (زیادہ سے زیادہ تعداد) *</label>
                    <input
                      id="editCustomMaxStudentsInput"
                      type="number"
                      min="1"
                      className="form-field-input"
                      value={editMaxStudents}
                      onChange={(e) => setEditMaxStudents(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setEditingMadrasa(null)}
                  disabled={isSavingEdit}
                >
                  منسوخ کریں
                </button>
                <button
                  type="submit"
                  className="super-admin-btn-primary"
                  style={{ padding: '9px 20px', fontSize: '0.88rem' }}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'محفوظ ہو رہا ہے...' : 'تبدیلیاں محفوظ کریں'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Deletion Confirmation Modal */}
      {madrasaToDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3 id="modal-delete-title">مدرسہ مستقل طور پر حذف کریں</h3>
            </div>
            <div className="modal-body">
              <p>
                کیا آپ واقعی اس مدرسے کو حذف کرنا چاہتے ہیں؟
              </p>
              <div className="modal-target-box">
                <span className="modal-target-label">منتخب مدرسہ:</span>
                <div className="modal-target-name">{madrasaToDelete.name}</div>
              </div>
              <div className="modal-warning-text">
                <strong>اہم تنبیہ:</strong> اس مدرسے سے وابستہ تمام ڈیٹا بشمول طلباء، اساتذہ، درجات، حاضری، امتحانات اور فیس کا ریکارڈ سپابیس (Supabase) سے مکمل اور مستقل طور پر مٹا دیا جائے گا۔ یہ عمل ناقابل واپسی ہے۔
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={() => setMadrasaToDelete(null)}
                disabled={isDeleting}
              >
                منسوخ کریں
              </button>
              <button
                type="button"
                className="modal-btn-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'حذف ہو رہا ہے...' : 'ہاں، مستقل حذف کریں'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
