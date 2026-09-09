import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setIsSubmitting(true);

    const cleanEmail = (email || '').trim().toLowerCase();
    const redirectToUrl = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(/([^:]\/)\/+/g, '$1');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectToUrl,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('پاسورڈ تبدیل کرنے کا لنک آپ کے ای میل ایڈریس پر بھیج دیا گیا ہے۔ برائے مہربانی اپنا ای میل ان باکس (اور اسپام فولڈر) چیک کریں۔');
      setEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      let msg = 'پاسورڈ ری سیٹ لنک بھیجنے میں مسئلہ پیش آیا۔';
      if (err?.message?.includes('rate limit')) {
        msg = 'بہت زیادہ کوششیں کی گئیں۔ براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔';
      } else if (err?.message) {
        msg = `خرابی: ${err.message}`;
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container" dir="rtl">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <div className="login-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h1 className="login-title">پاسورڈ بازیافت کریں</h1>
          <p className="login-subtitle">اپنا رجسٹرڈ ای میل درج کریں تاکہ ری سیٹ لنک ارسال کیا جا سکے</p>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '18px',
            lineHeight: 1.5
          }} role="status">
            {successMsg}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="login-error-alert" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field-group">
            <label className="login-label" htmlFor="forgotEmail">رجسٹرڈ ای میل ایڈریس:</label>
            <input
              id="forgotEmail"
              type="email"
              className="login-input"
              placeholder="مثال: admin@madrasa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="btn-loading-inline">
                <span className="mini-spinner"></span> ری سیٹ لنک بھیجا جا رہا ہے...
              </span>
            ) : (
              <span>پاسورڈ ری سیٹ لنک بھیجیں</span>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/login" className="login-forgot-password-link">
            لاگ ان صفحہ پر واپس جائیں
          </Link>
        </div>
      </div>
    </div>
  );
}
