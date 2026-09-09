import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { validateInvitePayload } from '../utils/accountInviteValidation';
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

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setErrors({});

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

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-account-invite', {
        body: payload
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccessMsg(`نیا مدرسہ "${madrasaName}" شامل ہو گیا ہے اور منتظم (${adminEmail}) کو دعوتی ای میل بھیج دی گئی ہے۔`);
      setMadrasaName('');
      setAdminFullName('');
      setAdminEmail('');
      setAdminPhone('');
      await loadMadrasas();
    } catch (err) {
      console.error('Invite admin error:', err);
      const msg = err.message || 'دعوت نامہ ارسال نہیں ہو سکا۔ برائے مہربانی دوبارہ کوشش کریں۔';
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

        {successMsg && (
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
            {isSubmitting ? 'دعوت نامہ ارسال ہو رہا ہے...' : 'نیا مدرسہ و منتظم شامل کریں (دعوت نامہ بھیجیں)'}
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
                  <th>تاریخ اندراج</th>
                </tr>
              </thead>
              <tbody>
                {filteredMadrasas.map(m => {
                  const adminProfile = (m.profiles || []).find(p => p.role === 'admin');
                  const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('ur-PK') : '—';

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
                      <td>{dateStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
