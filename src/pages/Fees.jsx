import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { mapSupabaseToUi as mapStudentToUi } from './Admissions';
import PrintPortal from '../components/PrintPortal';
import './Fees.css';

export const mapSupabaseToUi = (row, studentLookup = {}) => {
  if (!row) return null;
  if (row.isFeeRecord) {
    const amt = Number(row.feeAmount ?? row.amount) || 0;
    const arr = Number(row.feeArrears ?? row.arrears) || 0;
    const tot = Number(row.totalPaid) || (amt + arr);
    const ts = row.timestamp || row.paid_at || row.created_at || new Date().toISOString();
    return {
      ...row,
      isFeeRecord: true,
      invoiceId: row.invoiceId || row.invoice_id || '',
      studentId: row.studentId || row.student_id || '',
      studentUuid: row.studentUuid || row.student_id || '',
      studentName: row.studentName || row.student_name || '',
      studentFather: row.studentFather || row.student_father || '',
      feeMonth: row.feeMonth || row.month_year || '',
      feeAmount: amt,
      feeArrears: arr,
      totalPaid: tot,
      feeMethod: row.feeMethod || row.payment_method || 'Cash',
      status: row.status || 'paid',
      timestamp: ts,
      paid_at: ts
    };
  }

  const amount = Number(row.amount) || 0;
  const arrears = Number(row.arrears) || 0;
  const totalPaid = amount + arrears;
  const timestamp = row.paid_at || row.created_at || new Date().toISOString();

  // If row has joined student info or lookup from studentLookup map
  const student = row.students || (row.student_id ? studentLookup[row.student_id] : null) || {};
  const studentRollNo = student.roll_number || student.admRegNo || row.student_roll_number || '';
  const studentName = student.name_english || student.nameEnglish || student.admNameEnglish || student.name || row.student_name || '';
  const studentFather = student.father_name_english || student.fatherNameEnglish || student.admFatherNameEnglish || student.father_name || student.admFatherName || row.student_father || '';

  return {
    id: row.id,
    isFeeRecord: true,
    invoiceId: row.invoice_id || '',
    studentId: studentRollNo || row.student_id || '',
    studentUuid: row.student_id || '',
    studentName: studentName,
    studentFather: studentFather,
    feeMonth: row.month_year || '',
    feeAmount: amount,
    feeArrears: arrears,
    totalPaid: totalPaid,
    feeMethod: row.payment_method || 'Cash',
    status: row.status || 'paid',
    timestamp: timestamp,
    paid_at: timestamp
  };
};

export const mapUiToSupabase = (data, madrasaId) => {
  const amount = Number(data.feeAmount ?? data.amount) || 0;
  const arrears = Number(data.feeArrears ?? data.arrears) || 0;
  const paidAt = data.timestamp || data.paid_at || new Date().toISOString();

  return {
    student_id: data.studentUuid || data.student_id || null,
    madrasa_id: madrasaId || data.madrasa_id || null,
    invoice_id: data.invoiceId || data.invoice_id || null,
    amount: amount,
    arrears: arrears,
    payment_method: data.feeMethod || data.payment_method || 'Cash',
    month_year: data.feeMonth || data.month_year || '',
    status: data.status || 'paid',
    paid_at: paidAt
  };
};

export default function Fees() {
  const {
    activeMadrasa,
    activeLogo,
    activeMadrasaId,
    fetchStudentsFromSupabase,
    fetchFeesFromSupabase,
    addFeeToSupabase
  } = useMadrasa();

  const [students, setStudents] = useState([]);
  const [feeRecords, setFeeRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Tab Views
  const [activeView, setActiveView] = useState('record'); // record, receipt, analytics
  const [reportType, setReportType] = useState('all'); // all, daily, paid, unpaid, track

  // Load Data
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        let hasError = false;
        const [stdData, feesData] = await Promise.all([
          fetchStudentsFromSupabase(activeMadrasaId).catch(err => {
            console.error('Students fetch error in Fees:', err);
            hasError = true;
            return null;
          }),
          fetchFeesFromSupabase(activeMadrasaId).catch(err => {
            console.error('Fees fetch error in Fees:', err);
            hasError = true;
            return null;
          })
        ]);

        if (!isMounted) return;

        const studentMap = {};
        if (stdData) {
          const mappedStudents = stdData.map(mapStudentToUi).filter(Boolean);
          setStudents(mappedStudents);
          mappedStudents.forEach(s => {
            if (s.id) studentMap[s.id] = s;
          });
        }

        if (feesData) {
          const mappedFees = feesData
            .map(f => mapSupabaseToUi(f, studentMap))
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setFeeRecords(mappedFees);
        }

        if (hasError) {
          setFetchError('سرور سے ڈیٹا حاصل کرنے میں دشواری پیش آئی ہے۔ براہ کرم صفحہ ریفریش کریں یا اپنا انٹرنیٹ کنکشن چیک کریں۔');
        }
      } catch (err) {
        console.error('Fees data loading error:', err);
        if (isMounted) {
          setFetchError('سرور سے ڈیٹا حاصل کرنے میں دشواری پیش آئی ہے۔ براہ کرم صفحہ ریفریش کریں۔');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [activeMadrasaId]);

  // --- View 1: Fee Record Payment ---
  const [feeSearchId, setFeeSearchId] = useState('');
  const [currentFeeStudent, setCurrentFeeStudent] = useState(null);
  const [feeForm, setFeeForm] = useState({ month: '', amount: '', arrears: '0', method: 'Cash' });
  
  // Print State & Non-blocking Notifications
  const [printData, setPrintData] = useState(null);
  const [feeStatusMessage, setFeeStatusMessage] = useState(null);

  useEffect(() => {
    if (!feeStatusMessage) return;
    const timer = setTimeout(() => {
      setFeeStatusMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [feeStatusMessage]);

  useEffect(() => {
    if (!printData) return;

    const handleAfterPrint = () => {
      setPrintData(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printData]);

  const loadStudentForFee = () => {
    const id = feeSearchId.trim();
    if (!id) { alert("براہ کرم رجسٹریشن نمبر درج کریں۔"); return; }
    
    const student = students.find(r => r.isAdmissionProfile && (r.admRegNo === id || r.id === id));
    if (!student) {
      alert("اس رجسٹریشن نمبر سے کوئی طالب علم نہیں ملا۔");
      setCurrentFeeStudent(null);
      return;
    }

    if (student.isWithdrawn) {
      alert("نوٹ: یہ طالب علم خارج ہو چکا ہے۔");
    }
    
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    
    setCurrentFeeStudent(student);
    setFeeForm({ month: currentMonth, amount: '', arrears: '0', method: 'Cash' });
  };

  const processFeePayment = async () => {
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
    const regNo = currentFeeStudent.admRegNo || '00';
    const invoiceId = `${datePrefix}${regNo}-${randSuffix}`;

    const studentEngName = (currentFeeStudent.nameEnglish || currentFeeStudent.admNameEnglish || currentFeeStudent.name_english || currentFeeStudent.name || '').toUpperCase();
    const fatherEngName = (currentFeeStudent.fatherNameEnglish || currentFeeStudent.admFatherNameEnglish || currentFeeStudent.father_name_english || currentFeeStudent.admFatherName || currentFeeStudent.fatherName || '').toUpperCase();

    const feeUiData = {
      isFeeRecord: true,
      invoiceId: invoiceId,
      studentId: regNo,
      studentUuid: currentFeeStudent.id,
      studentName: studentEngName,
      studentFather: fatherEngName,
      feeMonth: month,
      feeAmount: feeAmt,
      feeArrears: feeArr,
      totalPaid: totalPaid,
      feeMethod: method,
      status: 'paid',
      timestamp: now.toISOString(),
      paid_at: now.toISOString()
    };

    try {
      const payload = mapUiToSupabase(feeUiData, activeMadrasaId);
      payload.students = {
        id: currentFeeStudent.id,
        name: studentEngName,
        name_english: studentEngName,
        roll_number: regNo,
        father_name: fatherEngName,
        father_name_english: fatherEngName
      };

      const insertedRow = await addFeeToSupabase(payload, activeMadrasaId);
      const studentLookup = {
        [currentFeeStudent.id]: {
          id: currentFeeStudent.id,
          name: studentEngName,
          name_english: studentEngName,
          roll_number: regNo,
          father_name: fatherEngName,
          father_name_english: fatherEngName
        }
      };
      const newUiFee = mapSupabaseToUi(insertedRow, studentLookup);

      setFeeRecords(prev => [newUiFee, ...prev]);
      setPrintData(newUiFee);
      
      if (insertedRow?.queued) {
        setFeeStatusMessage({
          type: 'warning',
          text: "انٹرنیٹ کنکشن دستیاب نہیں — یہ اندراج عارضی طور پر محفوظ کر لیا گیا ہے اور انٹرنیٹ بحال ہونے پر خود بخود سرور پر بھیج دیا جائے گا۔"
        });
      } else {
        setFeeStatusMessage({
          type: 'success',
          text: "فیس ریکارڈ محفوظ ہو گیا ہے۔ رسید پرنٹ ڈائیلاگ کھل رہا ہے..."
        });
      }

      setFeeSearchId('');
      setCurrentFeeStudent(null);

      triggerReceiptPrint(newUiFee);
    } catch (err) {
      console.error('Save fee error:', err);
      alert(`فیس ریکارڈ محفوظ نہیں ہو سکا!\n${err.message || 'سرور سے رابطہ قائم نہیں ہو سکا یا ڈیٹا میں خرابی ہے۔'}`);
    }
  };

  const triggerReceiptPrint = (feeObj) => {
    if (!feeObj) return;
    const matchedStd = students.find(s => s.id === feeObj.studentUuid || s.admRegNo === feeObj.studentId);
    const enrichedFee = {
      ...feeObj,
      studentName: (matchedStd?.nameEnglish || matchedStd?.admNameEnglish || matchedStd?.name_english || feeObj.studentName || '').toUpperCase(),
      studentFather: (matchedStd?.fatherNameEnglish || matchedStd?.admFatherNameEnglish || matchedStd?.father_name_english || feeObj.studentFather || '').toUpperCase()
    };
    setPrintData(enrichedFee);
    if (typeof document !== 'undefined') {
      document.body.classList.add('printing-fee-receipt');
      const cleanup = () => {
        document.body.classList.remove('printing-fee-receipt');
        setPrintData(null);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 2500);
    }

    setTimeout(() => {
      window.print();
    }, 150);
  };

  // --- View 2: Receipt ---
  const [receiptSearchId, setReceiptSearchId] = useState('');
  const [receiptStudent, setReceiptStudent] = useState(null);
  const [studentPastReceipts, setStudentPastReceipts] = useState([]);

  const loadStudentForReceipt = () => {
    const id = receiptSearchId.trim();
    if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }

    const student = students.find(r => r.isAdmissionProfile && (r.admRegNo === id || r.id === id));
    if (!student) { alert('کوئی طالب علم نہیں ملا'); return; }

    setReceiptStudent(student);

    const fees = feeRecords
      .filter(r => r.isFeeRecord && (r.studentId === student.admRegNo || r.studentUuid === student.id || r.studentId === id))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    setStudentPastReceipts(fees);
  };

  const reprintReceipt = (invoiceId) => {
    const fee = feeRecords.find(r => r.isFeeRecord && r.invoiceId === invoiceId);
    if (!fee) {
      setFeeStatusMessage({ type: 'error', text: 'رسید نہیں ملی' });
      return;
    }
    
    setFeeStatusMessage({
      type: 'success',
      text: "رسید پرنٹ ڈائیلاگ کھل رہا ہے..."
    });

    triggerReceiptPrint(fee);
  };

  // --- View 3: Analytics ---
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
    const student = students.find(r => r.isAdmissionProfile && (r.admRegNo === id || r.id === id));
    if (!student) {
      setTrackResult({ notFound: true });
      return;
    }
    const fees = feeRecords
      .filter(r => r.isFeeRecord && (r.studentId === student.admRegNo || r.studentUuid === student.id || r.studentId === id))
      .sort((a, b) => (a.feeMonth || '').localeCompare(b.feeMonth || ''));
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

    const matchedStudent = students.find(s =>
      (s.id && (s.id === printData.studentUuid || s.id === printData.studentId)) ||
      (s.admRegNo && s.admRegNo === printData.studentId) ||
      (s.roll_number && s.roll_number === printData.studentId)
    );
    const studentClass = matchedStudent?.admClass || matchedStudent?.className || matchedStudent?.class_id || '-';

    return (
      <PrintPortal>
        <div className="receipt-wrap" dir="ltr" style={{ color: '#000000', backgroundColor: '#ffffff' }}>
          <style>{`
            @page {
              size: auto;
              margin: 4mm;
            }
            body.printing-fee-receipt {
              display: block !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #FFFFFF !important;
            }
            body.printing-fee-receipt #print-portal-root {
              display: block !important;
              position: static !important;
              width: 100% !important;
              margin: 0 auto !important;
              padding: 4mm 0 !important;
            }
            .receipt-wrap {
              width: 100% !important;
              max-width: 540px !important;
              margin: 0 auto !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              border: 1.5px solid #0f172a !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
              page-break-before: avoid !important;
              break-before: avoid !important;
            }
            .receipt-info-table,
            .receipt-info-table tr,
            .receipt-info-table td,
            .receipt-table,
            .receipt-table tbody tr,
            .receipt-table tbody td,
            .receipt-footer,
            [data-theme="dark"] .receipt-wrap,
            [data-theme="dark"] .receipt-info-table,
            [data-theme="dark"] .receipt-info-table tr,
            [data-theme="dark"] .receipt-info-table td,
            [data-theme="dark"] .receipt-table,
            [data-theme="dark"] .receipt-table tbody tr,
            [data-theme="dark"] .receipt-table tbody td,
            [data-theme="dark"] .receipt-footer {
              background-color: #ffffff !important;
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
            }
            .receipt-info-table td *,
            .receipt-table tbody td *,
            .receipt-footer *,
            [data-theme="dark"] .receipt-info-table td *,
            [data-theme="dark"] .receipt-table tbody td *,
            [data-theme="dark"] .receipt-footer * {
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
            }
            .receipt-header,
            .receipt-header *,
            [data-theme="dark"] .receipt-header,
            [data-theme="dark"] .receipt-header * {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-text-fill-color: #ffffff !important;
            }
            .receipt-logo-backing,
            [data-theme="dark"] .receipt-logo-backing {
              background-color: #ffffff !important;
            }
            .receipt-badge,
            [data-theme="dark"] .receipt-badge {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-text-fill-color: #ffffff !important;
            }
            .receipt-table th,
            .receipt-table th *,
            [data-theme="dark"] .receipt-table th,
            [data-theme="dark"] .receipt-table th * {
              background-color: #f1f5f9 !important;
              color: #000000 !important;
              -webkit-text-fill-color: #000000 !important;
              border: 1px solid #0f172a !important;
            }
            .receipt-total-tr,
            .receipt-total-tr td,
            .receipt-total-tr td *,
            [data-theme="dark"] .receipt-total-tr,
            [data-theme="dark"] .receipt-total-tr td,
            [data-theme="dark"] .receipt-total-tr td * {
              background-color: #0f172a !important;
              color: #ffffff !important;
              -webkit-text-fill-color: #ffffff !important;
              border: 1.5px solid #0f172a !important;
            }
          `}</style>

          {/* Header */}
          <div className="receipt-header">
            <div className="receipt-header-top">
              {activeLogo ? (
                <div className="receipt-logo-backing">
                  <img src={activeLogo} alt={activeMadrasa.name} className="receipt-logo-img" />
                </div>
              ) : null}
              <div className="receipt-header-text">
                <h1 className="receipt-org">{activeMadrasa.name}</h1>
                <p className="receipt-branch">ACADEMIC & FINANCIAL FEE RECEIPT</p>
              </div>
            </div>
            <div className="receipt-header-badge-row">
              <span className="receipt-badge">STUDENT COPY</span>
              <span className="receipt-inv-badge">INVOICE: #{printData.invoiceId}</span>
            </div>
          </div>

          {/* Student & Payment Info Table (Compact 4-column key-value) */}
          <table className="receipt-info-table" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            <tbody>
              <tr>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Student:</td>
                <td className="info-val" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{(printData.studentName || '').toUpperCase()}</td>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Student ID:</td>
                <td className="info-val info-mono" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{printData.studentId || '-'}</td>
              </tr>
              <tr>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Father:</td>
                <td className="info-val" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{(printData.studentFather || '').toUpperCase()}</td>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Class:</td>
                <td className="info-val" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{studentClass || '-'}</td>
              </tr>
              <tr>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Fee Month:</td>
                <td className="info-val info-month" style={{ backgroundColor: '#ffffff', color: '#0369a1' }}>{readableFeeMonth.toUpperCase()}</td>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Date:</td>
                <td className="info-val" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{formattedDate}</td>
              </tr>
              <tr>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Method:</td>
                <td className="info-val" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{printData.feeMethod || 'Cash'}</td>
                <td className="info-lbl" style={{ backgroundColor: '#ffffff' }}>Time:</td>
                <td className="info-val info-mono" style={{ backgroundColor: '#ffffff', color: '#000000' }}>{timestampStr}</td>
              </tr>
            </tbody>
          </table>

          {/* Fee Table with integrated Total Row */}
          <table className="receipt-table" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ width: '65%', textAlign: 'left', backgroundColor: '#f1f5f9', color: '#000000' }}>Description</th>
                <th style={{ width: '35%', textAlign: 'right', backgroundColor: '#f1f5f9', color: '#000000' }}>Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ backgroundColor: '#ffffff', color: '#000000' }}>Monthly Tuition Fee ({readableFeeMonth.toUpperCase()})</td>
                <td className="receipt-amount-cell" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  Rs. {(printData.feeAmount || 0).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td style={{ backgroundColor: '#ffffff', color: '#000000' }}>Previous Arrears</td>
                <td className="receipt-amount-cell" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  Rs. {(printData.feeArrears || 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="receipt-total-tr" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <td style={{ textAlign: 'left', fontWeight: '800', backgroundColor: '#0f172a', color: '#ffffff' }}>TOTAL RECEIVED</td>
                <td className="receipt-total-amount-cell" style={{ textAlign: 'right', fontWeight: '900', backgroundColor: '#0f172a', color: '#ffffff' }}>
                  Rs. {(printData.totalPaid || 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer & Signatures */}
          <div className="receipt-footer">
            <div className="receipt-signatures-wrap">
              <div className="receipt-sig">
                <div className="receipt-sig-line"></div>
                <div className="receipt-sig-name">Authorized Cashier</div>
              </div>
              <div className="receipt-sig">
                <div className="receipt-sig-line"></div>
                <div className="receipt-sig-name">Parent / Payer Signature</div>
              </div>
            </div>
            <div className="receipt-note">
              Computerized official proof of payment. Please retain for school records.
            </div>
          </div>

          {/* Watermarks */}
          {activeLogo && (
            <div className="receipt-watermark-image">
              <img src={activeLogo} alt="" />
            </div>
          )}
          <div className="receipt-watermark">PAID</div>
        </div>
      </PrintPortal>
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

      {fetchError && (
        <div className="fee-alert-warning no-print">
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}>✕</button>
        </div>
      )}

      {feeStatusMessage && (
        <div className={`fee-status-banner ${feeStatusMessage.type === 'error' ? 'error' : 'success'} no-print`}>
          <span>{feeStatusMessage.text}</span>
          <button onClick={() => setFeeStatusMessage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}>✕</button>
        </div>
      )}

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
            <div className="fee-student-avatar">{(currentFeeStudent.name?.trim()?.charAt(0) || 'ط')}</div>
            <div>
              <div className="fee-student-name">{currentFeeStudent.name || '—'}</div>
              <div className="fee-student-father">والد: <span>{currentFeeStudent.admFatherName || currentFeeStudent.fatherName || '—'}</span></div>
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
            <div className="fee-student-avatar">{(receiptStudent.name?.trim()?.charAt(0) || 'ط')}</div>
            <div>
              <div className="fee-student-name">
                {receiptStudent.name || '—'}
                {(receiptStudent.nameEnglish || receiptStudent.admNameEnglish) && (
                  <span style={{ fontSize: '0.85em', opacity: 0.85, marginRight: '8px' }}>
                    ({receiptStudent.nameEnglish || receiptStudent.admNameEnglish})
                  </span>
                )}
              </div>
              <div className="fee-student-father">
                والد: <span>{receiptStudent.admFatherName || receiptStudent.fatherName || '—'}{(receiptStudent.fatherNameEnglish || receiptStudent.admFatherNameEnglish) ? ` (${receiptStudent.fatherNameEnglish || receiptStudent.admFatherNameEnglish})` : ''}</span>
              </div>
            </div>
          </div>

          <h3 className="past-receipts-heading">پچھلی رسیدیں</h3>
          <div id="studentPastReceiptsArea">
            {!studentPastReceipts.length ? (
                <div className="empty-dashboard-state">اس طالب علم کی کوئی فیس ریکارڈ موجود نہیں</div>
            ) : (
                studentPastReceipts.map(f => (
                    <div key={f.invoiceId} className="past-receipt-card">
                        <div className="past-receipt-info">
                            <div className="past-receipt-month">{f.feeMonth}</div>
                            <div className="past-receipt-id">رسید: {f.invoiceId}</div>
                        </div>
                        <div className="past-receipt-amount">Rs. {(f.totalPaid||0).toLocaleString()}</div>
                        <div className="past-receipt-method">{f.feeMethod}</div>
                        <button className="past-receipt-btn" onClick={() => reprintReceipt(f.invoiceId)}>پرنٹ</button>
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
                                            <span className="fee-method-badge" style={{ background: mc.bg, color: mc.color, border: `1px solid ${mc.border}` }}>{f.feeMethod || '—'}</span>
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
            const fees = feeRecords.filter(r => r.isFeeRecord && r.timestamp && r.timestamp.slice(0,10) === dailyStatDate);
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
                                <div className="fee-stat-highlight green">
                                    <div className="fee-stat-highlight-label">مجموعی وصولی — {dailyStatDate}</div>
                                    <div className="fee-stat-highlight-amount">Rs. {total.toLocaleString()}</div>
                                </div>
                                {fees.map(f => (
                                    <div key={f.invoiceId} className="past-receipt-card">
                                        <div className="past-receipt-info">
                                            <div className="past-receipt-month">{f.studentName||'—'}</div>
                                            <div className="past-receipt-id">{f.studentId} | {f.feeMonth}</div>
                                        </div>
                                        <div className="past-receipt-amount">Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                        <div className="past-receipt-method">{f.feeMethod}</div>
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
            const fees = feeRecords.filter(r => r.isFeeRecord && r.feeMonth === paidReportMonth);
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
                                <div className="fee-report-section-header">مہینہ {paidReportMonth} — {fees.length} دہندگان</div>
                                {fees.map(f => (
                                    <div key={f.invoiceId} className="past-receipt-card fee-paid-card">
                                        <div className="past-receipt-info">
                                            <div className="past-receipt-month">{f.studentName||'—'}</div>
                                            <div className="past-receipt-id">{f.studentId}</div>
                                        </div>
                                        <div className="past-receipt-amount">Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                        <div className="past-receipt-method">{f.feeMethod}</div>
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
            const allStudents = students.filter(r => r.isAdmissionProfile && !r.isWithdrawn);
            const paidIds = new Set(feeRecords.filter(r => r.isFeeRecord && r.feeMonth === unpaidReportMonth).map(r => r.studentId));
            const paidUuids = new Set(feeRecords.filter(r => r.isFeeRecord && r.feeMonth === unpaidReportMonth).map(r => r.studentUuid).filter(Boolean));
            const unpaid = allStudents.filter(s => !paidIds.has(s.admRegNo) && !paidUuids.has(s.id));
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
                                <div className="fee-report-section-header danger">مہینہ {unpaidReportMonth} — {unpaid.length} نادہندگان</div>
                                {unpaid.map(s => (
                                    <div key={s.admRegNo || s.id} className="past-receipt-card fee-unpaid-card">
                                        <div className="past-receipt-info">
                                            <div className="past-receipt-month">{s.name||'—'}</div>
                                            <div className="past-receipt-id">{s.admRegNo || s.id} | والد: {s.admFatherName || s.fatherName || '—'}</div>
                                        </div>
                                        <div className="fee-unpaid-badge">فیس باقی</div>
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
                        <div className="fee-student-avatar">{(student.name?.trim()?.charAt(0) || 'ط')}</div>
                        <div>
                            <div className="fee-student-name">{student.name||'—'}</div>
                            <div className="fee-student-father">والد: {student.admFatherName || student.fatherName || '—'} | ID: {id}</div>
                        </div>
                        </div>
                        <div className="fee-stat-highlight green">
                        <div className="fee-stat-highlight-label">کل جمع شدہ فیس (داخلے سے اب تک)</div>
                        <div className="fee-stat-highlight-amount">Rs. {total.toLocaleString()}</div>
                        </div>
                        {!fees.length ? (
                            <div className="empty-dashboard-state">ابھی تک کوئی فیس جمع نہیں ہوئی</div>
                        ) : (
                            fees.map(f => (
                                <div key={f.invoiceId} className="past-receipt-card">
                                    <div className="past-receipt-info">
                                        <div className="past-receipt-month">{f.feeMonth}</div>
                                        <div className="past-receipt-id">رسید: {f.invoiceId}</div>
                                    </div>
                                    <div className="past-receipt-amount">Rs. {(f.totalPaid||0).toLocaleString()}</div>
                                    <div className="past-receipt-method">{f.feeMethod}</div>
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
