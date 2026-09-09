import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import './Login.css';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasRecoverySession, setHasRecoverySession] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have an active recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // If no session and no hash token in URL, warn user
      const hasHash = window.location.hash && window.location.hash.includes('access_token');
      if (!session && !hasHash) {
        setHasRecoverySession(false);
        setErrorMsg('پاسورڈ ری سیٹ کی میعاد ختم ہو چکی ہے یا لنک غلط ہے۔ براہ کرم دوبارہ کوشش کریں۔');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(true);
        setErrorMsg('');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password || password.length < 6) {
      setErrorMsg('نیا پاس ورڈ کم از کم 6 حروف پر مشتمل ہونا چاہیے۔');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('دونوں پاس ورڈ آپس میں مماثلت نہیں رکھتے۔');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setSuccessMsg('آپ کا پاس ورڈ کامیابی سے تبدیل ہو چکا ہے! لاگ ان صفحہ پر بھیجا جا رہا ہے...');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      console.error('Update password error:', err);
      setErrorMsg(err.message || 'پاس ورڈ تبدیل کرنے میں مسئلہ پیش آیا۔ برائے مہربانی دوبارہ کوشش کریں۔');
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h1 className="login-title">نیا پاس ورڈ متعین کریں</h1>
          <p className="login-subtitle">اپنے اکاؤنٹ کا نیا اور محفوظ پاس ورڈ درج کریں</p>
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

        {hasRecoverySession && !successMsg && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field-group">
              <label className="login-label" htmlFor="resetNewPassword">نیا پاس ورڈ (New Password):</label>
              <div className="login-password-wrapper">
                <input
                  id="resetNewPassword"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-password-input"
                  placeholder="نیا پاس ورڈ درج کریں"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(prev => !prev)}
                  title={showPassword ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label" htmlFor="resetConfirmPassword">پاس ورڈ کی تصدیق کریں (Confirm Password):</label>
              <input
                id="resetConfirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="نیا پاس ورڈ دوبارہ درج کریں"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="btn-loading-inline">
                  <span className="mini-spinner"></span> محفوظ ہو رہا ہے...
                </span>
              ) : (
                <span>نیا پاس ورڈ محفوظ کریں</span>
              )}
            </button>
          </form>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/login" className="login-forgot-password-link">
            لاگ ان صفحہ پر واپس جائیں
          </Link>
        </div>
      </div>
    </div>
  );
}
