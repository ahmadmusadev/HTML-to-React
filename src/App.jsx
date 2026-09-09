import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MadrasaProvider, useMadrasa } from './context/MadrasaContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AiChatbot from './components/AiChatbot';
import './index.css'; // Global CSS

import Dashboard from './pages/Dashboard';
import Admissions from './pages/Admissions';
import Entry from './pages/Entry';
import Records from './pages/Records';
import Staff from './pages/Staff';
import Exams from './pages/Exams';
import AiListen from './pages/AiListen';
import Fees from './pages/Fees';
import Attendance from './pages/Attendance';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function MainHeader({ theme, toggleTheme }) {
  const { activeMadrasa, activeLogo, uploadLogo, removeLogo } = useMadrasa();
  const { user, profile, role, signOut } = useAuth();

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await uploadLogo(file);
      } catch (err) {
        alert(err.message || 'لوگو آپ لوڈ کرنے میں مسئلہ پیش آیا');
      }
    }
  };

  const getRoleLabel = (r) => {
    switch (r) {
      case 'super_admin': return 'سپر ایڈمن';
      case 'admin': return 'مہتمم / ایڈمن';
      case 'teacher': return 'استاد / ٹیچر';
      default: return 'کاربر';
    }
  };

  const displayName = activeMadrasa?.name || (role === 'super_admin' ? 'جامعہ حفظ منیجر — پورٹل' : 'جامعہ حفظ منیجر');

  return (
    <div className="card-header-top">
      <div className="header-main-flex">
        
        {/* Right Section (in RTL): Active Madrasa Branding & Title */}
        <div className="header-branding">
          <div className="madrasa-logo-wrapper">
            {activeLogo ? (
              <img src={activeLogo} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                <line x1="12" y1="6" x2="12" y2="12"></line>
                <line x1="9" y1="9" x2="15" y2="9"></line>
              </svg>
            )}
          </div>

          <div>
            <h1 className="madrasa-title">{displayName}</h1>
            <div className="madrasa-subtitle">تعلیمی و حاضری ریکارڈ سسٹم</div>
          </div>
        </div>

        {/* Controls Section: Theme Toggle, User Profile/Logout & Logo Controls */}
        <div className="header-controls-container">
          <div className="header-actions-row">
            
            {/* Dark/Light Mode Toggle Button */}
            <button className="single-theme-toggle" id="singleThemeToggleBtn" onClick={toggleTheme} title={theme === 'dark' ? 'لائٹ موڈ' : 'ڈارک موڈ'} aria-label="Toggle Theme">
              <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.15"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" fillOpacity="0.15"></path>
              </svg>
            </button>

            {/* Authenticated User Badge & Logout Button */}
            {user ? (
              <div className="user-profile-badge">
                <div className="user-avatar-circle">
                  {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
                <div className="user-info-text">
                  <span className="user-name">{profile?.full_name || user.email.split('@')[0]}</span>
                  <span className="user-role-badge">{getRoleLabel(role)}</span>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="logout-header-btn"
                  title="سسٹم سے لاگ آؤٹ کریں"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>لاگ آؤٹ</span>
                </button>
              </div>
            ) : null}

            {/* Logo Actions (admin / super_admin) */}
            {(role === 'admin' || role === 'super_admin') && (
              <div className="header-btn-group">
                <label className="logo-upload-btn" htmlFor="madrasaHeaderLogoInput">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>لوگو اپ لوڈ</span>
                  <input type="file" id="madrasaHeaderLogoInput" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </label>

                {activeLogo && (
                  <button 
                    type="button" 
                    onClick={() => removeLogo()} 
                    className="delete-logo-btn"
                    title="لوگو حذف کریں"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

function MainLayout({ theme, toggleTheme }) {
  const location = useLocation();
  const isAuthPage = ['/login', '/forgot-password', '/reset-password'].includes(location.pathname);
  const { pendingSyncCount, madrasaError } = useMadrasa();
  const { role } = useAuth();

  return (
    <div className="wrap" dir="rtl">
      <div className="card">
        {!isAuthPage && <MainHeader theme={theme} toggleTheme={toggleTheme} />}

        {!isAuthPage && (
          <nav className="tabs">
            {role === 'super_admin' && (
              <NavLink to="/super-admin" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>سپر ایڈمن</NavLink>
            )}
            <NavLink to="/" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>ڈیش بورڈ</NavLink>
            <NavLink to="/admissions" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>داخلہ جات</NavLink>
            <NavLink to="/fees" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>فیس ریکارڈ</NavLink>
            <NavLink to="/entry" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>جائزہ جات</NavLink>
            <NavLink to="/attendance" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>حاضری</NavLink>
            <NavLink to="/exams" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>امتحانات</NavLink>
            <NavLink to="/records" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>تعلیمی ریکارڈز</NavLink>
            <NavLink to="/staff" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>اسٹاف</NavLink>
            <NavLink to="/ai-listen" className={({isActive}) => isActive ? "tab-button active" : "tab-button"}>اے آئی استاد</NavLink>
          </nav>
        )}

        {!isAuthPage && madrasaError && (
          <div
            className="madrasa-error-indicator"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              padding: '8px 14px',
              margin: '10px 20px 0 20px',
              fontSize: '13px',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            {madrasaError}
          </div>
        )}

        {!isAuthPage && pendingSyncCount > 0 && (
          <div
            className="pending-sync-indicator"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#b45309',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              padding: '6px 14px',
              margin: '10px 20px 0 20px',
              fontSize: '13px',
              fontWeight: 500,
              textAlign: 'center'
            }}
          >
            انٹرنیٹ رابطہ معطل ہے — {pendingSyncCount} اندراج خودکار ہم وقت سازی کی قطار میں ہیں
          </div>
        )}
        
        <div className="tab-content">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdmin /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admissions" element={<ProtectedRoute><Admissions /></ProtectedRoute>} />
            <Route path="/entry" element={<ProtectedRoute><Entry /></ProtectedRoute>} />
            <Route path="/records" element={<ProtectedRoute><Records /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
            <Route path="/exams" element={<ProtectedRoute><Exams /></ProtectedRoute>} />
            <Route path="/ai-listen" element={<ProtectedRoute><AiListen /></ProtectedRoute>} />
            <Route path="/fees" element={<ProtectedRoute><Fees /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {!isAuthPage && <AiChatbot />}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('hifz-theme');
    const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
    const prefersDark = hasMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    } else {
      setTheme('light');
    }

    if (!hasMatchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('hifz-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('hifz-theme', newTheme);
  };

  return (
    <AuthProvider>
      <MadrasaProvider>
        <ErrorBoundary>
          <Router basename={import.meta.env.BASE_URL}>
            <MainLayout theme={theme} toggleTheme={toggleTheme} />
          </Router>
        </ErrorBoundary>
      </MadrasaProvider>
    </AuthProvider>
  );
}

export default App;
