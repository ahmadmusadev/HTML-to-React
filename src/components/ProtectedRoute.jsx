import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
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

  if (!user) {
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

  return children;
}
