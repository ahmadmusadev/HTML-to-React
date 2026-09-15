import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { MadrasaProvider, useMadrasa } from './context/MadrasaContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AiChatbot from './components/AiChatbot';
import './index.css'; // Global CSS
import './App.css';

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
import ProfileModal from './components/ProfileModal';

export function MainHeader({ theme, toggleTheme }) {
  const { activeMadrasa, activeLogo, uploadLogo, removeLogo } = useMadrasa();
  const { user, profile, role, signOut } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalSection, setProfileModalSection] = useState('password');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsDropdownRef = useRef(null);
  const logoUploadInputRef = useRef(null);
  const logoUpdateInputRef = useRef(null);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (e) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target)) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await uploadLogo(file);
      } catch (err) {
        alert(err.message || 'لوگو آپ لوڈ کرنے میں مسئلہ پیش آیا');
      }
    }
    // Clear input value so same file can be chosen again if needed
    e.target.value = '';
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

        {/* Controls Section: Theme Toggle, User Profile & Settings Dropdown */}
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

            {/* Authenticated User Profile & Settings Dropdown */}
            {user ? (
              <div className="user-profile-badge" ref={settingsDropdownRef}>
                {/* Profile Picture */}
                <div className="user-avatar-circle" title={profile?.full_name || user.email}>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile?.full_name || 'Avatar'}
                      className="user-avatar-img"
                    />
                  ) : (
                    (profile?.full_name || user.email || 'U')[0].toUpperCase()
                  )}
                </div>

                {/* User Identity: Super Admin / Name */}
                <div className="user-info-text">
                  <span className="user-name">{profile?.full_name || user.email.split('@')[0]}</span>
                  <span className="user-role-badge">{getRoleLabel(role)}</span>
                </div>

                {/* Settings Trigger Icon */}
                <button
                  type="button"
                  id="userSettingsMenuBtn"
                  className={`settings-icon-btn ${isSettingsOpen ? 'active' : ''}`}
                  onClick={() => setIsSettingsOpen(prev => !prev)}
                  aria-label="ترتیبات اور اختیارات"
                  aria-haspopup="true"
                  aria-expanded={isSettingsOpen}
                  title="ترتیبات"
                >
                  <svg className="settings-cog-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>

                {/* Settings Dropdown Menu */}
                {isSettingsOpen && (
                  <div className="settings-dropdown-menu" role="menu" aria-orientation="vertical">
                    <div className="settings-dropdown-header">
                      <div className="settings-user-preview">
                        <div className="settings-mini-avatar">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" />
                          ) : (
                            (profile?.full_name || user.email || 'U')[0].toUpperCase()
                          )}
                        </div>
                        <div className="settings-user-meta">
                          <span className="settings-user-title">{profile?.full_name || user.email.split('@')[0]}</span>
                          <span className="settings-user-sub">{getRoleLabel(role)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="settings-dropdown-body">
                      {/* Change Password */}
                      <button
                        type="button"
                        className="settings-dropdown-item"
                        id="menuItemChangePassword"
                        role="menuitem"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          setProfileModalSection('password');
                          setIsProfileModalOpen(true);
                        }}
                      >
                        <span className="settings-item-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                        </span>
                        <span className="settings-item-label">پاسورڈ تبدیل کریں</span>
                      </button>

                      {/* Upload/Update Profile Picture */}
                      <button
                        type="button"
                        className="settings-dropdown-item"
                        id="menuItemUploadAvatar"
                        role="menuitem"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          setProfileModalSection('avatar');
                          setIsProfileModalOpen(true);
                        }}
                      >
                        <span className="settings-item-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                        </span>
                        <span className="settings-item-label">پروفائل تصویر اپ لوڈ / اپ ڈیٹ کریں</span>
                      </button>

                      {/* Logo Actions (admin / super_admin) */}
                      {(role === 'admin' || role === 'super_admin') && (
                        <>
                          {/* Upload Logo */}
                          <button
                            type="button"
                            className="settings-dropdown-item"
                            id="menuItemUploadLogo"
                            role="menuitem"
                            onClick={() => {
                              setIsSettingsOpen(false);
                              logoUploadInputRef.current?.click();
                            }}
                          >
                            <span className="settings-item-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                              </svg>
                            </span>
                            <span className="settings-item-label">لوگو اپ لوڈ کریں</span>
                          </button>

                          {/* Update Logo */}
                          <button
                            type="button"
                            className="settings-dropdown-item"
                            id="menuItemUpdateLogo"
                            role="menuitem"
                            onClick={() => {
                              setIsSettingsOpen(false);
                              logoUpdateInputRef.current?.click();
                            }}
                          >
                            <span className="settings-item-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                              </svg>
                            </span>
                            <span className="settings-item-label">لوگو تبدیل / اپ ڈیٹ کریں</span>
                          </button>

                          {/* Delete Logo Option (if activeLogo is present) */}
                          {activeLogo && (
                            <button
                              type="button"
                              className="settings-dropdown-item warning"
                              id="menuItemRemoveLogo"
                              role="menuitem"
                              onClick={() => {
                                setIsSettingsOpen(false);
                                removeLogo();
                              }}
                            >
                              <span className="settings-item-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </span>
                              <span className="settings-item-label">لوگو حذف کریں</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Divider */}
                      <div className="settings-dropdown-divider" />

                      {/* Logout */}
                      <button
                        type="button"
                        className="settings-dropdown-item danger"
                        id="menuItemLogout"
                        role="menuitem"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          signOut();
                        }}
                      >
                        <span className="settings-item-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                        </span>
                        <span className="settings-item-label">لاگ آؤٹ</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Hidden Inputs for Logo Upload & Update */}
            {(role === 'admin' || role === 'super_admin') && (
              <>
                <input
                  type="file"
                  ref={logoUploadInputRef}
                  id="madrasaHeaderLogoUploadInput"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <input
                  type="file"
                  ref={logoUpdateInputRef}
                  id="madrasaHeaderLogoUpdateInput"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
              </>
            )}

          </div>
        </div>

        {isProfileModalOpen && (
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            initialSection={profileModalSection}
          />
        )}

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
            <Route path="/chatbot-preview" element={<div style={{ padding: '40px', textAlign: 'center' }}><h2>اے آئی رہنما (AI Rehnuma) — لائیو چیٹ بوٹ پری ویو</h2><p style={{ color: '#64748b', marginTop: '8px' }}>تیرتے ہوئے چیٹ بوٹ آئیکن اور پاپ اپ ڈائیلاگ کو اسکرین پر کہیں بھی ماؤس یا ٹچ سے کھینچ کر منتقل کریں۔</p></div>} />
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
