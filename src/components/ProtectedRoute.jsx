import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMadrasa } from '../context/MadrasaContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, loading, role, signOut } = useAuth();
  const { activeMadrasa, madrasaLoading } = useMadrasa();
  const location = useLocation();

  if (loading || (user && madrasaLoading && !activeMadrasa && role !== 'super_admin')) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: '16px',
        color: 'var(--text, #1e293b)'
      }}>
        <div className="loading-spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--border, #e2e8f0)',
          borderTopColor: '#0284c7',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>تصدیق ہو رہی ہے، براہ کرم انتظار فرمائیں...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const isAuthed = isAuthenticated !== undefined ? Boolean(isAuthenticated) : Boolean(user);

  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger, #ef4444)' }}>رسائی غیر مجاز (Unauthorized)</h2>
        <p style={{ marginTop: '10px' }}>آپ کا اکاؤنٹ اس صفحے کو دیکھنے کا مجاز نہیں ہے۔</p>
      </div>
    );
  }

  // Access Enforcement: If the madrasa is disabled and user is not super_admin,
  // display an executive Urdu suspension notice with sign out button.
  if (role !== 'super_admin' && activeMadrasa?.status === 'disabled') {
    return (
      <div className="suspended-screen-overlay" dir="rtl">
        <div className="suspended-screen-card">
          <div className="suspended-screen-pill">ادارہ عارضی طور پر معطل</div>
          <h2>ادارہ کا اکاؤنٹ معطل ہے</h2>
          {activeMadrasa?.name && (
            <div className="suspended-madrasa-name">{activeMadrasa.name}</div>
          )}
          <p>
            اس ادارے کی رسائی عارضی طور پر معطل کر دی گئی ہے۔ مزید معلومات اور بحالی کے لیے براہ کرم مرکزی منتظم (سپر ایڈمن) سے رابطہ فرمائیں۔
          </p>
          <button type="button" className="suspended-signout-btn" onClick={signOut}>
            سائن آؤٹ کریں
          </button>
        </div>
        <style>{`
          .suspended-screen-overlay {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 75vh;
            padding: 24px 16px;
            box-sizing: border-box;
          }
          .suspended-screen-card {
            max-width: 520px;
            width: 100%;
            background: var(--card, #ffffff);
            border: 1px solid var(--border, #e2e8f0);
            border-radius: 16px;
            padding: 36px 28px;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
            box-sizing: border-box;
          }
          .suspended-screen-pill {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 9999px;
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
            font-size: 0.82rem;
            font-weight: 700;
            margin-bottom: 16px;
          }
          .suspended-screen-card h2 {
            margin: 0 0 12px 0;
            font-size: 1.4rem;
            font-weight: 800;
            color: var(--text, #1e293b);
          }
          .suspended-madrasa-name {
            font-size: 1.05rem;
            font-weight: 700;
            color: #0284c7;
            margin-bottom: 14px;
          }
          .suspended-screen-card p {
            margin: 0 0 24px 0;
            font-size: 0.92rem;
            line-height: 1.7;
            color: var(--muted, #64748b);
          }
          .suspended-signout-btn {
            padding: 10px 26px;
            background: #0284c7;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 0.92rem;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
          }
          .suspended-signout-btn:hover {
            background: #0369a1;
          }
          [data-theme="dark"] .suspended-screen-card {
            background: #18181b !important;
            border-color: #27272a !important;
            color: #f4f4f5 !important;
          }
          [data-theme="dark"] .suspended-screen-pill {
            background: #450a0a !important;
            color: #f87171 !important;
            border-color: #991b1b !important;
          }
          [data-theme="dark"] .suspended-madrasa-name {
            color: #38bdf8 !important;
          }
          [data-theme="dark"] .suspended-screen-card p {
            color: #a1a1aa !important;
          }
        `}</style>
      </div>
    );
  }

  return children;
}
