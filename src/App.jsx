import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MadrasaProvider, useMadrasa } from './context/MadrasaContext';
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

function MainHeader({ theme, toggleTheme }) {
  const { madrasas, activeMadrasaId, activeMadrasa, activeLogo, uploadLogo, removeLogo, switchMadrasa, addMadrasa, renameMadrasa } = useMadrasa();

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState(activeMadrasaId);
  const [newBranchName, setNewBranchName] = useState('');

  const handleOpenRenameModal = () => {
    setTargetBranchId(activeMadrasaId);
    setNewBranchName(activeMadrasa?.name || '');
    setIsRenameModalOpen(true);
  };

  const handleSelectBranchToRename = (e) => {
    const selectedId = e.target.value;
    setTargetBranchId(selectedId);
    const targetMadrasa = madrasas.find(m => m.id === selectedId);
    setNewBranchName(targetMadrasa?.name || '');
  };

  const handleSaveBranchName = (e) => {
    e.preventDefault();
    if (newBranchName && newBranchName.trim()) {
      renameMadrasa(targetBranchId, newBranchName.trim());
      setIsRenameModalOpen(false);
    }
  };

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

  const handleAddBranch = () => {
    const name = prompt('نئی شاخ / مدرسہ کا نام درج کریں:');
    if (name && name.trim()) {
      addMadrasa(name.trim());
    }
  };

  return (
    <div className="card-header-top">
      <div className="header-main-flex">
        
        {/* Right Section (in RTL): Active Madrasa Branding & Title */}
        <div className="header-branding">
          <div className="madrasa-logo-wrapper">
            {activeLogo ? (
              <img src={activeLogo} alt={activeMadrasa.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
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
            <h1 className="madrasa-title">{activeMadrasa.name || 'حفظ منیجر'}</h1>
            <div className="madrasa-subtitle">تعلیمی و حاضری ریکارڈ سسٹم</div>
          </div>
        </div>

        {/* Controls Section: Branch Dropdown with Edit Button at top */}
        <div className="header-controls-container">
          {/* Row 1: Branch Select Dropdown & Small Edit Button */}
          <div className="madrasa-select-wrapper">
            <select 
              value={activeMadrasaId} 
              onChange={(e) => switchMadrasa(e.target.value)}
              className="madrasa-select-dropdown"
            >
              {madrasas.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <button 
              type="button" 
              className="edit-branch-name-btn"
              onClick={handleOpenRenameModal}
              title="شاخ کا نام تبدیل کریں"
              aria-label="شاخ کا نام تبدیل کریں"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
          </div>

          {/* Row 2: Directly below dropdown — Toggle Button on LEFT, Three Buttons aligned to RIGHT */}
          <div className="header-actions-row">
            
            {/* Dark/Light Mode Toggle Button on Left */}
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

            {/* Three Action Buttons aligned to Right */}
            <div className="header-btn-group">
              <button 
                type="button" 
                onClick={handleAddBranch}
                className="add-branch-header-btn"
                title="نئی شاخ شامل کریں"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>نئی شاخ</span>
              </button>

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

          </div>
        </div>

      </div>

      {/* Rename Branch Modal */}
      {isRenameModalOpen && (
        <div className="branch-rename-modal-overlay" onClick={() => setIsRenameModalOpen(false)}>
          <div className="branch-rename-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="branch-rename-modal-header">
              <h3>شاخ کا نام تبدیل کریں</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsRenameModalOpen(false)} aria-label="بند کریں">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveBranchName}>
              <div className="branch-rename-modal-body">
                <div className="modal-form-group">
                  <label className="modal-form-label">شاخ منتخب کریں:</label>
                  <select
                    value={targetBranchId}
                    onChange={handleSelectBranchToRename}
                    className="modal-select-input"
                  >
                    {madrasas.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-form-group">
                  <label className="modal-form-label">شاخ کا نیا نام:</label>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="modal-text-input"
                    placeholder="شاخ کا نیا نام درج کریں"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="branch-rename-modal-footer">
                <button type="button" className="modal-btn-cancel" onClick={() => setIsRenameModalOpen(false)}>
                  منسوخ کریں
                </button>
                <button type="submit" className="modal-btn-save" disabled={!newBranchName.trim()}>
                  محفوظ کریں
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('hifz-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    } else {
      setTheme('light');
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('hifz-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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
    <MadrasaProvider>
      <Router basename={import.meta.env.BASE_URL}>
        <div className="wrap" dir="rtl">
          <div className="card">
            <MainHeader theme={theme} toggleTheme={toggleTheme} />

            <nav className="tabs">
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
            
            <div className="tab-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/admissions" element={<Admissions />} />
                <Route path="/entry" element={<Entry />} />
                <Route path="/records" element={<Records />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/exams" element={<Exams />} />
                <Route path="/ai-listen" element={<AiListen />} />
                <Route path="/fees" element={<Fees />} />
                <Route path="/attendance" element={<Attendance />} />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </MadrasaProvider>
  );
}

export default App;
