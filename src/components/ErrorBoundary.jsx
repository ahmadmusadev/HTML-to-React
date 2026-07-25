import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error Boundary Catch:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = import.meta.env.BASE_URL || '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text, #1e293b)'
        }}>
          <div style={{
            background: 'var(--card, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '16px',
            padding: '32px 24px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.35rem', fontWeight: 800 }}>کچھ غلط ہو گیا (Unexpected Error)</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--muted, #64748b)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              ایپلیکیشن کی کارکردگی کے دوران غیر متوقع خرابی پیش آئی ہے۔ براہ کرم صفحہ ریفریش کریں یا ہوم ڈیش بورڈ پر واپس جائیں۔
            </p>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 0.9 + 'rem',
                cursor: 'pointer',
                boxShadow: '0 3px 8px rgba(2, 132, 199, 0.3)'
              }}
            >
              ہوم ڈیش بورڈ پر واپس جائیں
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
