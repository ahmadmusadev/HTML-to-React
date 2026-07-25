import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      let rawMsg = '';
      if (typeof err === 'string') {
        rawMsg = err;
      } else if (err && typeof err.message === 'string' && err.message !== '{}') {
        rawMsg = err.message;
      } else if (err && typeof err.error_description === 'string') {
        rawMsg = err.error_description;
      }

      let userFriendlyMsg = 'غلط ای میل یا پاس ورڈ! براہ کرم درست معلومات درج کریں۔';

      if (rawMsg.includes('Invalid login credentials') || rawMsg.includes('invalid_credentials')) {
        userFriendlyMsg = 'غلط ای میل یا پاس ورڈ! براہ کرم درست معلومات درج کریں۔';
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('AuthRetryableFetchError') || !navigator.onLine) {
        userFriendlyMsg = 'سرور یا نیٹ ورک سے رابطہ قائم نہیں ہو سکا۔ برائے مہربانی اپنا انٹرنیٹ کنیکشن یا لاگ ان معلومات چیک کریں۔';
      } else if (rawMsg && rawMsg !== '{}' && rawMsg !== '[object Object]') {
        userFriendlyMsg = rawMsg;
      }

      setErrorMsg(userFriendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCreds = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg('');
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Branding & Logo */}
        <div className="login-header">
          <div className="login-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              <line x1="12" y1="6" x2="12" y2="12"></line>
              <line x1="9" y1="9" x2="15" y2="9"></line>
            </svg>
          </div>
          <h1 className="login-title">جامعہ حفظ منیجر</h1>
          <p className="login-subtitle">تعلیمی و حاضری ریکارڈ سسٹم — پورٹل لاگ ان</p>
        </div>

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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field-group">
            <label className="login-label" htmlFor="loginEmail">ای میل ایڈریس (Email):</label>
            <input
              id="loginEmail"
              type="email"
              className="login-input"
              placeholder="مثال: admin@madrasa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="login-field-group">
            <label className="login-label" htmlFor="loginPassword">پاس ورڈ (Password):</label>
            <div className="login-password-wrapper">
              <input
                id="loginPassword"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-password-input"
                placeholder="پاس ورڈ درج کریں"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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

          <button type="submit" className="login-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="btn-loading-inline">
                <span className="mini-spinner"></span> لاگ ان ہو رہا ہے...
              </span>
            ) : (
              <span>سسٹم میں لاگ ان کریں</span>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Assistant */}
        <div className="login-demo-section">
          <p className="login-demo-title">ٹیسٹ ڈیفالٹ اکاؤنٹس (Quick Fill):</p>
          <div className="login-demo-btns">
            <button
              type="button"
              className="login-demo-btn"
              onClick={() => fillDemoCreds('admin@madrasa.com', 'AdminPass123!')}
            >
              مہتمم / ایڈمن لاگ ان
            </button>
            <button
              type="button"
              className="login-demo-btn"
              onClick={() => fillDemoCreds('teacher@madrasa.com', 'TeacherPass123!')}
            >
              استاد / ٹیچر لاگ ان
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
