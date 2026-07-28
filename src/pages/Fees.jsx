import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import './Fees.css';

export default function Fees() {
  const { activeMadrasa, activeLogo, activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [records, setRecords] = useState([]);
  
  // Tab Views
  const [activeView, setActiveView] = useState('record'); // record, receipt, analytics
  const [reportType, setReportType] = useState('all'); // all, daily, paid, unpaid, track

  // Load Data
  useEffect(() => {
    const storedData = loadMadrasaData('hf_records_v1') || {};
    setRecords(storedData.records || []);
  }, [activeMadrasaId]); // reload only on madrasa switch

  // --- View 1: Fee Record Payment ---
  const [feeSearchId, setFeeSearchId] = useState('');
  const [currentFeeStudent, setCurrentFeeStudent] = useState(null);
  const [feeForm, setFeeForm] = useState({ month: '', amount: '', arrears: '0', method: 'Cash' });
  
  // Print State
  const [printData, setPrintData] = useState(null);

  const loadStudentForFee = () => {
    const id = feeSearchId.trim();
    if (!id) { alert("براہ کرم رجسٹریشن نمبر درج کریں۔"); return; }
    
    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!student) {
      alert("اس رجسٹریشن نمبر سے کوئی طالب علم نہیں ملا۔");
      setCurrentFeeStudent(null);
      return;
    }
    
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    
    setCurrentFeeStudent(student);
    setFeeForm({ month: currentMonth, amount: '', arrears: '0', method: 'Cash' });
  };

  const processFeePayment = () => {
    if (!currentFeeStudent) return;
    const { month, amount, arrears, method } = feeForm;
    const feeAmt = parseInt(amount, 10);
    const feeArr = parseInt(arrears, 10) || 0;
    
    if (!month || isNaN(feeAmt) || feeAmt <= 0) {
        alert("براہ کرم ادائیگی کا مہینہ اور درست فیس کی رقم درج کریں۔");
        return;
    }

    const totalPaid = feeAmt + feeArr;
    const now = new Date();
    
    const datePrefix = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randSuffix = Math.floor(Math.random() * 900 + 100);
    const invoiceId = `${datePrefix}${currentFeeStudent.admRegNo}-${randSuffix}`;

    const feeRecord = {
        isFeeRecord: true,
        invoiceId: invoiceId,
        studentId: currentFeeStudent.admRegNo,
        studentName: currentFeeStudent.name,
        studentFather: currentFeeStudent.admFatherName,
        feeMonth: month,
        feeAmount: feeAmt,
        feeArrears: feeArr,
        totalPaid: totalPaid,
        feeMethod: method,
        timestamp: now.toISOString()
    };
    
    const newRecords = [...records, feeRecord];
    setRecords(newRecords);
    
    const stored = loadMadrasaData('hf_records_v1') || {};
    stored.records = newRecords;
    saveMadrasaData('hf_records_v1', stored);

    setPrintData(feeRecord);
    
    setTimeout(() => {
        alert("فیس ریکارڈ محفوظ ہو گیا۔ پرنٹ ڈائیلاگ کھل رہا ہے...");
        window.print();
        
        setTimeout(() => {
            setFeeSearchId('');
            setCurrentFeeStudent(null);
            setPrintData(null);
        }, 500);
    }, 100);
  };

  // --- View 2: Receipt ---
  const [receiptSearchId, setReceiptSearchId] = useState('');
  const [receiptStudent, setReceiptStudent] = useState(null);
  const [studentPastReceipts, setStudentPastReceipts] = useState([]);

  const loadStudentForReceipt = () => {
    const id = receiptSearchId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }

    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!student) { alert('کوئی طالب علم نہیں ملا'); return; }

    setReceiptStudent(student);

    const fees = records
      .filter(r => r.isFeeRecord && r.studentId === id)
      .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    setStudentPastReceipts(fees);
  };

  const reprintReceipt = (invoiceId) => {
    const fee = records.find(r => r.isFeeRecord && r.invoiceId === invoiceId);
    if (!fee) { alert('رسید نہیں ملی'); return; }
    
    setPrintData(fee);
    
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintData(null), 500);
    }, 100);
  };

  // --- View 3: Analytics ---
  const feeRecords = records.filter(r => r.isFeeRecord).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let totalCol = 0;
  let totalArr = 0;
  feeRecords.forEach(f => {
      totalCol += (f.totalPaid || 0);
      totalArr += (f.feeArrears || 0);
  });

  const methodColor = {
    'Cash':          { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
    'Bank Transfer': { bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
    'Online':        { bg:'#fdf4ff', color:'#9333ea', border:'#e9d5ff' },
  };

  // Reports
  const [dailyStatDate, setDailyStatDate] = useState(new Date().toISOString().slice(0,10));
  const [paidReportMonth, setPaidReportMonth] = useState(new Date().toISOString().slice(0,7));
  const [unpaidReportMonth, setUnpaidReportMonth] = useState(new Date().toISOString().slice(0,7));
  const [trackFeeId, setTrackFeeId] = useState('');
  const [trackResult, setTrackResult] = useState(null);

  const doTrackFee = () => {
    const id = trackFeeId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
    const student = records.find(r => r.isAdmissionProfile && r.admRegNo === id);
    if (!student) {
        setTrackResult({ notFound: true });
        return;
    }
    const fees = records.filter(r => r.isFeeRecord && r.studentId === id).sort((a,b) => a.feeMonth.localeCompare(b.feeMonth));
    setTrackResult({ student, fees, id });
  };

  // Switch View Helper
  const switchView = (view) => {
      setActiveView(view);
      if (view === 'record') {
          setFeeSearchId('');
          setCurrentFeeStudent(null);
      }
      if (view === 'analytics') {
          setReportType('all');
      }
  };

  // Render Print Template
  const renderPrintReceipt = () => {
      if (!printData) return null;
      const now = new Date(printData.timestamp);
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = now.toLocaleDateString('en-US', options);
      const monthDateObj = new Date(printData.feeMonth + "-01");
      const readableFeeMonth = monthDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const timestampStr = now.toLocaleString('en-PK', { hour12: true });

      return (
        <div id="printableReceiptArea" style={{ display: 'none' }}>
            <div className="receipt-wrap">
                <div className="receipt-header">
                <div className="receipt-logo" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  {activeLogo ? (
                    <img src={activeLogo} alt={activeMadrasa.name} style={{ maxHeight: '65px', maxWidth: '160px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>☪</span>
                  )}
                </div>
                <h1 className="receipt-org">{activeMadrasa.name}</h1>
                <p className="receipt-branch">تعلیمی و حاضری ریکارڈ سسٹم</p>
                <div className="receipt-badge">FEE RECEIPT — STUDENT COPY</div>
                </div>

                <div className="receipt-meta-bar">
                <div className="receipt-meta-item">
                    <span className="receipt-meta-label">Invoice #</span>
                    <span className="receipt-meta-val">{printData.invoiceId}</span>
                </div>
                <div className="receipt-meta-item">
                    <span className="receipt-meta-label">Date</span>
                    <span className="receipt-meta-val">{formattedDate}</span>
                </div>
                <div className="receipt-meta-item">
                    <span className="receipt-meta-label">Class</span>
                    {/* The original edit.html sets this to empty or omits it for receiptClass, see edit.html line 4618 */}
                    <span className="receipt-meta-val">-</span>
                </div>
                <div className="receipt-meta-item">
                    <span className="receipt-meta-label">Student ID</span>
                    <span className="receipt-meta-val">{printData.studentId}</span>
                </div>
                </div>

                <div className="receipt-student-box">
                <div className="receipt-section-title">Student Information</div>
                <div className="receipt-student-row">
                    <div>
                    <span className="receipt-field-label">Name</span>
                    <span className="receipt-field-val">{(printData.studentName || '').toUpperCase()}</span>
                    </div>
                    <div>
                    <span className="receipt-field-label">Father</span>
                    <span className="receipt-field-val">{(printData.studentFather || '').toUpperCase()}</span>
                    </div>
                </div>
                </div>

                <table className="receipt-table">
                <thead>
                    <tr>
                    <th style={{ textAlign: "left", width: "65%" }}>Payment Detail</th>
                    <th style={{ textAlign: "right", width: "35%" }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td>Monthly Fee — <span>{readableFeeMonth.toUpperCase()}</span></td>
                    <td className="receipt-amount-cell">
                        <span className="receipt-rs">Rs.</span>
                        <span>{(printData.feeAmount || 0).toLocaleString()}</span>
                    </td>
                    </tr>
                    <tr>
                    <td>Arrears (Previous Pending)</td>
                    <td className="receipt-amount-cell">
                        <span className="receipt-rs">Rs.</span>
                        <span>{(printData.feeArrears || 0).toLocaleString()}</span>
                    </td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr className="receipt-total-row">
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#14532d", letterSpacing: "0.3px" }}>
                        TOTAL RECEIVED
                    </td>
                    <td className="receipt-total-amount">
                        <span className="receipt-total-rs">Rs.</span>
                        <span className="receipt-total-num">{(printData.totalPaid || 0).toLocaleString()}</span>
                    </td>
                    </tr>
                </tfoot>
                </table>

                <div className="receipt-method-row">
                <div>
                    <span className="receipt-meta-label">Payment Method</span>
                    <span className="receipt-meta-val">{printData.feeMethod}</span>
                </div>
                <div>
                    <span className="receipt-meta-label">Received On</span>
                    <span className="receipt-meta-val">{timestampStr}</span>
                </div>
                </div>

                <div className="receipt-footer">
                <div className="receipt-note">
                    Please save this voucher for your records.
                </div>
                <div className="receipt-sig">
                    <div className="receipt-sig-line"></div>
                    <div className="receipt-sig-name">Authorized Administrator</div>
                    <div className="receipt-sig-org">{activeMadrasa.name}</div>
                </div>
                </div>

                {activeLogo && (
                  <div className="receipt-watermark-image" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08, pointerEvents: 'none', zIndex: 0 }}>
                    <img src={activeLogo} alt="" style={{ width: '220px', height: '220px', objectFit: 'contain' }} />
                  </div>
                )}
                <div className="receipt-watermark">PAID</div>
            </div>
        </div>
      );
  };

  return (
    <div className="tab-content">
      
      {/* ===== فیس بٹن گرڈ ===== */}
      <div className="adm-type-grid" style={{ marginBottom: "20px" }}>
        <button className={`adm-type-btn ${activeView === 'record' ? 'active' : ''}`} onClick={() => switchView('record')}>
          فیس وصول کریں
        </button>
        <button className={`adm-type-btn ${activeView === 'receipt' ? 'active' : ''}`} onClick={() => switchView('receipt')}>
          رسید بنائیں
        </button>
        <button className={`adm-type-btn ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => switchView('analytics')}>
          رپورٹس
        </button>
      </div>

      {/* ===== ۱: فیس وصول کریں ===== */}
      {activeView === 'record' && (
      <div id="feeRecordPaymentContainer">
        <h2>نئی فیس کی ادائیگی</h2>

        <div className="fee-search-card">
          <div className="form-section-header" style={{ marginBottom: "14px" }}>
            <div className="form-section-icon icon-blue"></div>
            <div>
              <div className="form-section-title">طالب علم تلاش کریں</div>
              <div className="form-section-subtitle">رجسٹریشن نمبر درج کریں</div>
            </div>
          </div>
          <div className="search-container">
            <input type="text" value={feeSearchId} onChange={e => setFeeSearchId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
            <button onClick={loadStudentForFee}>تلاش کریں</button>
          </div>
        </div>

        {currentFeeStudent && (
        <div id="feePaymentDetailsArea">
          <div className="fee-student-badge">
            <div className="fee-student-avatar"></div>
            <div>
              <div className="fee-student-name">{currentFeeStudent.name || '—'}</div>
              <div className="fee-student-father">والد: <span>{currentFeeStudent.admFatherName || '—'}</span></div>
            </div>
          </div>

          <div className="fee-payment-card">
            <div className="form-section-header" style={{ marginBottom: "20px" }}>
              <div className="form-section-icon icon-amber"></div>
              <div>
                <div className="form-section-title">ادائیگی کی تفصیلات</div>
                <div className="form-section-subtitle">Payment Details</div>
              </div>
            </div>

            <div className="grid-row">
              <div>
                <label>ادائیگی کا مہینہ</label>
                <div className="fee-month-input-wrapper">
                  <span className="fee-month-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </span>
                  <input 
                    type="month" 
                    value={feeForm.month} 
                    onChange={e => setFeeForm({...feeForm, month: e.target.value})} 
                    className="fee-month-input-field"
                  />
                </div>
              </div>
              <div>
                <label>طریقہ ادائیگی</label>
                <select value={feeForm.method} onChange={e => setFeeForm({...feeForm, method: e.target.value})}>
                  <option value="Cash">نقد</option>
                  <option value="Bank Transfer">بینک ٹرانسفر</option>
                  <option value="Online">آن لائن</option>
                </select>
              </div>
            </div>

            <div className="grid-row">
              <div>
                <label>ماہانہ فیس</label>
                <div className="fee-amount-wrap">
                  <span className="fee-rs-prefix">Rs.</span>
                  <input type="number" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: e.target.value})} placeholder="مثلاً: 3000" className="fee-amount-input" />
                </div>
              </div>
              <div>
                <label>بقایا جات</label>
                <div className="fee-amount-wrap">
                  <span className="fee-rs-prefix danger">Rs.</span>
                  <input type="number" value={feeForm.arrears} onChange={e => setFeeForm({...feeForm, arrears: e.target.value})} className="fee-amount-input" />
                </div>
              </div>
            </div>

            <div className="btn-container" style={{ marginTop: "24px" }}>
              <button className="fee-process-btn" onClick={processFeePayment}>
                فیس محفوظ کریں اور رسید پرنٹ کریں
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ===== ۲: رسید بنائیں ===== */}
      {activeView === 'receipt' && (
      <div id="feeReceiptContainer">
        <div className="form-section-card">
          <div className="form-section-header" style={{ marginBottom: "16px" }}>
            <div className="form-section-icon icon-blue"></div>
            <div>
              <div className="form-section-title">رسید بنائیں</div>
              <div className="form-section-subtitle">رجسٹریشن نمبر سے پرانی رسید تلاش کریں یا نئی بنائیں</div>
            </div>
          </div>
          <div className="search-container">
            <input type="text" value={receiptSearchId} onChange={e => setReceiptSearchId(e.target.value)} placeholder="رجسٹریشن نمبر درج کریں..." />
            <button onClick={loadStudentForReceipt}>تلاش کریں</button>
          </div>
        </div>

        {receiptStudent && (
        <div id="receiptStudentArea">
          <div className="fee-student-badge">
            <div className="fee-student-avatar"></div>
            <div>
              <div className="fee-student-name">{receiptStudent.name || '—'}</div>
              <div className="fee-student-father">والد: <span>{receiptStudent.admFatherName || '—'}</span></div>
            </div>
          </div>

          <h3 style={{ color: "var(--accent)", margin: "16px 0 10px 0" }}>پچھلی رسیدیں</h3>
          <div id="studentPastReceiptsArea">
            {!studentPastReceipts.length ? (
                <div className="empty-dashboard-state">اس طالب علم کی کوئی فیس ریکارڈ موجود نہیں</div>
            ) : (
                studentPastReceipts.map(f => (
                    <div key={f.invoiceId} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                        <div style={{ fontWeight: 700, color: "var(--accent)" }}>{f.feeMonth}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>رسید: {f.invoiceId}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: "var(--accent-2)" }}>Rs. {(f.totalPaid||0).toLocaleString()}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{f.feeMethod}</div>
                        <button onClick={() => reprintReceipt(f.invoiceId)} style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "0.85rem" }}>پرنٹ</button>
                    </div>
                ))
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {/* ===== ۳: رپورٹس ===== */}
      {activeView === 'analytics' && (
      <div id="feeAnalyticsContainer">

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px", justifyContent: "flex-start" }}>
          <button className={`fee-report-tab-btn ${reportType === 'all' ? 'active' : ''}`} onClick={() => setReportType('all')}>تمام ادائیگیاں</button>
          <button className={`fee-report-tab-btn ${reportType === 'daily' ? 'active' : ''}`} onClick={() => setReportType('daily')}>ڈیلی اسٹیٹمنٹ</button>
          <button className={`fee-report-tab-btn ${reportType === 'paid' ? 'active' : ''}`} onClick={() => setReportType('paid')}>ماہانہ</button>
          <button className={`fee-report-tab-btn ${reportType === 'unpaid' ? 'active' : ''}`} onClick={() => setReportType('unpaid')}>نا دہندہ</button>
          <button className={`fee-report-tab-btn ${reportType === 'track' ? 'active' : ''}`} onClick={() => setReportType('track')}>انفرادی ٹریکنگ</button>
        </div>

        <div className="fee-summary-cards">
          <div className="fee-summary-card green-card">
            <div className="fee-summary-icon"></div>
            <div className="fee-summary-label">کل وصولی</div>
            <span className="fee-summary-rs">Rs.</span>
            <div className="fee-summary-amount">{totalCol.toLocaleString()}</div>
            <div className="fee-summary-sub">Total Collection</div>
            <div className="fee-summary-badge">Collected</div>
          </div>
          <div className="fee-summary-card red-card">
            <div className="fee-summary-icon"></div>
            <div className="fee-summary-label">کل بقایا جات</div>
            <span className="fee-summary-rs">Rs.</span>
            <div className="fee-summary-amount">{totalArr.toLocaleString()}</div>
            <div className="fee-summary-sub">Total Arrears</div>
            <div className="fee-summary-badge">Pending</div>
          </div>
        </div>

        {/* تمام ادائیگیاں */}
        {reportType === 'all' && (
        <div id="feeReport_all">
          <div id="allFeesListArea">
            {!feeRecords.length ? (
                <div className="empty-dashboard-state">ابھی تک کوئی فیس ریکارڈ موجود نہیں۔</div>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                            <th>Invoice</th>
                            <th>تاریخ و وقت</th>
                            <th>طالب علم</th>
                            <th>مہینہ</th>
                            <th style={{ textAlign: "center" }}>مبلغ</th>
                            <th>طریقہ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {feeRecords.map(f => {
                                const dp = new Date(f.timestamp);
                                const dateStr = dp.toLocaleDateString('ur-PK');
                                const timeStr = dp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                                const mc = methodColor[f.feeMethod] || { bg:'#f8fafc', color:'#475569', border:'#e2e8f0' };
                                const paid   = (f.totalPaid   || 0).toLocaleString();
                                const arrears= (f.feeArrears  || 0);
                                return (
                                    <tr key={f.invoiceId}>
                                        <td><span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{f.invoiceId || '—'}</span></td>
                                        <td>
                                            <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{dateStr}</div>
                                            <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>{timeStr}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{f.studentName || '—'}</div>
                                            <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>ID: {f.studentId || '—'}</div>
                                        </td>
                                        <td>
                                            <span className="fee-month-badge" style={{ borderRadius: "6px", padding: "3px 10px", fontSize: "0.82rem", fontWeight: 600 }}>{f.feeMonth || '—'}</span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", justifyContent: "center" }}>
                                                <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>Rs.</span>
                                                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#15803d" }}>{paid}</span>
                                            </div>
                                            {arrears > 0 && (
                                                <div style={{ fontSize: "0.75rem", color: "var(--danger)", textAlign: "center", marginTop: "2px" }}>بقایا: Rs. {arrears.toLocaleString()}</div>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ background: mc.bg, color: mc.color, border: `1px solid ${mc.border}`, borderRadius: "999px", padding: "4px 12px", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" }}>{f.feeMethod || '—'}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
        </div>
        )}

        {/* ڈیلی اسٹیٹمنٹ */}
        {reportType === 'daily' && (() => {
            const fees = records.filter(r => r.isFeeRecord && r.timestamp && r.timestamp.slice(0,10) === dailyStatDate);
            const total = fees.reduce((s,f) => s + (f.totalPaid||0), 0);
            return (
                <div id="feeReport_daily">
                    <div className="form-section-card" style={{ marginBottom: "14px" }}>
                        <div className="grid-row">
                        <div>
                            <label>تاریخ منتخب کریں</label>
                            <input type="date" value={dailyStatDate} onChange={e => setDailyStatDate(e.target.value)} />
                        </div>
                        </div>
                    </div>
                    <div id="dailyStatArea">
                        {!fees.length ? (
                            <div className="empty-dashboard-state">{dailyStatDate} کو کوئی فیس وصول نہیں ہوئی</div>
                        ) : (
                            <>
                                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px", marginBottom: "14px", textAlign: "center" }}>
                                    <div style={{ fontSize: "0.9rem", color: "#15803d" }}>مجموعی وصولی — {dailyStatDate}</div>
                                    <div style={{ fontSize: "2rem", fontWeight: 800, color: "#15803d" }}>Rs. {total.toLocaleString()}</div>
                                </div>
                                {fees.map(f => (
                                    <div key={f.invoiceId} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{f.studentName||'—'}</div>
                                            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{f.studentId} | {f.feeMonth}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: "var(--accent-2)" }}>Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{f.feeMethod}</div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            );
        })()}

        {/* دہندہ رپورٹ */}
        {reportType === 'paid' && (() => {
            const fees = records.filter(r => r.isFeeRecord && r.feeMonth === paidReportMonth);
            return (
                <div id="feeReport_paid">
                    <div className="form-section-card" style={{ marginBottom: "14px" }}>
                        <div className="grid-row">
                        <div>
                            <label>مہینہ منتخب کریں</label>
                            <input type="month" value={paidReportMonth} onChange={e => setPaidReportMonth(e.target.value)} />
                        </div>
                        </div>
                    </div>
                    <div id="paidReportArea">
                        {!fees.length ? (
                            <div className="empty-dashboard-state">{paidReportMonth} میں کوئی ادائیگی نہیں</div>
                        ) : (
                            <>
                                <div style={{ fontWeight: 700, color: "var(--accent-2)", marginBottom: "10px" }}>مہینہ {paidReportMonth} — {fees.length} دہندگان</div>
                                {fees.map(f => (
                                    <div key={f.invoiceId} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{f.studentName||'—'}</div>
                                            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{f.studentId}</div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: "var(--accent-2)" }}>Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{f.feeMethod}</div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            );
        })()}

        {/* نادہندہ رپورٹ */}
        {reportType === 'unpaid' && (() => {
            const allStudents = records.filter(r => r.isAdmissionProfile && !r.isWithdrawn);
            const paidIds = new Set(records.filter(r => r.isFeeRecord && r.feeMonth === unpaidReportMonth).map(r => r.studentId));
            const unpaid = allStudents.filter(s => !paidIds.has(s.admRegNo));
            return (
                <div id="feeReport_unpaid">
                    <div className="form-section-card" style={{ marginBottom: "14px" }}>
                        <div className="grid-row">
                        <div>
                            <label>مہینہ منتخب کریں</label>
                            <input type="month" value={unpaidReportMonth} onChange={e => setUnpaidReportMonth(e.target.value)} />
                        </div>
                        </div>
                    </div>
                    <div id="unpaidReportArea">
                        {!unpaid.length ? (
                            <div className="empty-dashboard-state">ماشاءاللہ! {unpaidReportMonth} میں تمام طلباء کی فیس جمع ہے</div>
                        ) : (
                            <>
                                <div style={{ fontWeight: 700, color: "var(--danger)", marginBottom: "10px" }}>مہینہ {unpaidReportMonth} — {unpaid.length} نادہندگان</div>
                                {unpaid.map(s => (
                                    <div key={s.admRegNo} style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{s.name||'—'}</div>
                                            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{s.admRegNo} | والد: {s.admFatherName||'—'}</div>
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--danger)", fontWeight: 700 }}>فیس باقی</div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            );
        })()}

        {/* انفرادی ٹریکنگ */}
        {reportType === 'track' && (
        <div id="feeReport_track">
          <div className="form-section-card" style={{ marginBottom: "14px" }}>
            <div className="form-section-header" style={{ marginBottom: "12px" }}>
              <div className="form-section-icon icon-blue"></div>
              <div>
                <div className="form-section-title">انفرادی فیس ٹریکنگ</div>
                <div className="form-section-subtitle">رجسٹریشن نمبر سے پوری فیس تاریخ دیکھیں</div>
              </div>
            </div>
            <div className="search-container">
              <input type="text" value={trackFeeId} onChange={e => setTrackFeeId(e.target.value)} placeholder="رجسٹریشن نمبر..." />
              <button onClick={doTrackFee}>ٹریک کریں</button>
            </div>
          </div>
          <div id="feeTrackArea">
            {trackResult && trackResult.notFound && (
                <div className="empty-dashboard-state">کوئی طالب علم نہیں ملا</div>
            )}
            {trackResult && !trackResult.notFound && (() => {
                const { student, fees, id } = trackResult;
                const total = fees.reduce((s,f) => s+(f.totalPaid||0), 0);
                return (
                    <>
                        <div className="fee-student-badge" style={{ marginBottom: "16px" }}>
                        <div className="fee-student-avatar"></div>
                        <div>
                            <div className="fee-student-name">{student.name||'—'}</div>
                            <div className="fee-student-father">والد: {student.admFatherName||'—'} | ID: {id}</div>
                        </div>
                        </div>
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px", marginBottom: "14px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "#15803d" }}>کل جمع شدہ فیس (داخلے سے اب تک)</div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#15803d" }}>Rs. {total.toLocaleString()}</div>
                        </div>
                        {!fees.length ? (
                            <div className="empty-dashboard-state">ابھی تک کوئی فیس جمع نہیں ہوئی</div>
                        ) : (
                            fees.map(f => (
                                <div key={f.invoiceId} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                    <div style={{ fontWeight: 700, color: "var(--accent)" }}>{f.feeMonth}</div>
                                    <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>رسید: {f.invoiceId}</div>
                                    <div style={{ fontWeight: 700, color: "var(--accent-2)" }}>Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                    <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{f.feeMethod}</div>
                                </div>
                            ))
                        )}
                    </>
                );
            })()}
          </div>
        </div>
        )}

      </div>
      )}

      {renderPrintReceipt()}
    </div>
  );
}
