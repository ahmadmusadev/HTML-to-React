import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { validateInvitePayload, extractEdgeFunctionError } from '../utils/accountInviteValidation';
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
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const handleOpenEdit = (m) => {
    const adminProfile = (m.profiles || []).find(p => p.role === 'admin');
    setEditingMadrasa(m);
    setEditMadrasaName(m.name || '');
    setEditAdminName(adminProfile?.full_name || '');
    setEditAdminPhone(adminProfile?.phone || m.phone || '');
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

      // 2. Also update madrasa name and phone if modified
      const madrasaUpdates = {};
      if (editMadrasaName.trim() && editMadrasaName.trim() !== editingMadrasa.name) {
        madrasaUpdates.name = editMadrasaName.trim();
      }
      if (editAdminPhone.trim() !== (editingMadrasa.phone || '')) {
        madrasaUpdates.phone = editAdminPhone.trim() || null;
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

  // Fetch all madrasas and their associated admins
  const loadMadrasas = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('madrasas')
        .select('*, profiles(id, full_name, role, phone)')
        .order('created_at', { ascending: false });

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

    const payload = {
      madrasaName,
      fullName: adminFullName,
      email: adminEmail,
      role: 'admin',
      phone: adminPhone
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
        if (!session || !session.access_token || session.access_token === 'emergency-session-token') {
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
      await loadMadrasas();
    } catch (err) {
      console.error('Create admin error:', err);
      const msg = err.message || 'اکاؤنٹ بنانے میں مسئلہ پیش آیا۔ برائے مہربانی دوبارہ کوشش کریں۔';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMadrasas = madrasas.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const mName = (m.name || '').toLowerCase();
    const admin = (m.profiles || []).find(p => p.role === 'admin');
    const aName = (admin?.full_name || '').toLowerCase();
    return mName.includes(q) || aName.includes(q);
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
          <h2>سپر ایڈمن کنٹرول پینل</h2>
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

        <div className="super-admin-search-box">
          <input
            type="text"
            className="form-field-input"
            placeholder="مدرسہ یا منتظم کے نام سے تلاش کریں..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
                  <th>فون نمبر</th>
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

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>{m.name}</td>
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
                      <td>{adminProfile?.phone || m.phone || '—'}</td>
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

                <div className="form-field-item" style={{ marginBottom: '8px' }}>
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
