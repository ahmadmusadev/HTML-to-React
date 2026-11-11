import React, { useMemo } from 'react';
import PrintPortal from './PrintPortal';
import { calculateSubjectAnalysis } from '../utils/mizanAnalysis';
import { formatAcademicYear } from '../utils/academicYear';
import './SubjectAnalysisModal.css';

export default function SubjectAnalysisModal({
  isOpen,
  onClose,
  subjectKey = 'manzil',
  students = [],
  className = '',
  month = '',
  year = '',
  madrasaName = 'جامعہ حفظ القرآن الکریم'
}) {
  const analysis = useMemo(() => {
    if (!isOpen) return null;
    return calculateSubjectAnalysis(students, subjectKey);
  }, [isOpen, students, subjectKey]);

  if (!isOpen || !analysis) return null;

  const formattedYear = formatAcademicYear(year);

  const handlePrint = () => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('printing-subject-analysis');
      const cleanup = () => {
        document.body.classList.remove('printing-subject-analysis');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 3000);
    }
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <>
      {/* 1. Interactive On-Screen Modal View */}
      <div
        className="subject-analysis-backdrop no-print"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subject-analysis-modal-title"
      >
        <div className="subject-analysis-modal">
          {/* Modal Header */}
          <div className="subject-analysis-header">
            <div className="subject-analysis-title-group">
              <h2 id="subject-analysis-modal-title" className="subject-analysis-title">
                تجزیاتی رپورٹ برائے ماہانہ جائزہ — {analysis.subjectName}
              </h2>
              <p className="subject-analysis-subtitle">
                طلبہ کے نمبرات سے چار کیٹگریز کا خودکار تعلیمی تجزیہ و فیصد تقسیم
              </p>
            </div>
            <div className="subject-analysis-header-actions">
              <button
                type="button"
                className="subject-analysis-btn subject-analysis-btn-primary"
                onClick={handlePrint}
              >
                پرنٹ / PDF
              </button>
              <button
                type="button"
                className="subject-analysis-btn subject-analysis-btn-secondary"
                onClick={onClose}
              >
                بند کریں
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="subject-analysis-body">
            {/* Meta Information Bar (Single Line with Vertical Dividers) */}
            <div className="subject-analysis-meta-scroll">
              <div className="subject-analysis-meta-bar">
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">ادارہ:</span>
                  <span className="subject-analysis-meta-val">{madrasaName || 'جامعہ حفظ القرآن الکریم'}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">کلاس:</span>
                  <span className="subject-analysis-meta-val">{className || '—'}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">ماہ و تعلیمی سال:</span>
                  <span className="subject-analysis-meta-val">{month} {formattedYear}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">مضمون:</span>
                  <span className="subject-analysis-meta-val">{analysis.fullName}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">کل اندراجات:</span>
                  <span className="subject-analysis-meta-val">{analysis.totalEntries}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">شریک طلبہ:</span>
                  <span className="subject-analysis-meta-val">{analysis.participating}</span>
                </div>
                <div className="subject-analysis-meta-divider" />
                <div className="subject-analysis-meta-item">
                  <span className="subject-analysis-meta-label">غیر حاضر / غیر درج:</span>
                  <span className="subject-analysis-meta-val">{analysis.absent}</span>
                </div>
              </div>
            </div>

            {/* Category Summary Matrix with Label Column and Internal Dividers */}
            <div className="subject-analysis-summary-scroll">
              <div className="subject-analysis-summary-grid">
                {/* Column 1: Labels at the beginning */}
                <div className="subject-analysis-summary-box box-labels">
                  <div className="summary-box-row row-cat">
                    <span className="summary-box-text">کیٹگری</span>
                  </div>
                  <div className="summary-box-divider" />
                  <div className="summary-box-row row-count">
                    <span className="summary-box-text">تعداد</span>
                  </div>
                  <div className="summary-box-divider" />
                  <div className="summary-box-row row-pct">
                    <span className="summary-box-text">فیصد</span>
                  </div>
                </div>

                {/* 4 Category Columns */}
                {analysis.categories.map((cat) => (
                  <div key={cat.id} className={`subject-analysis-summary-box box-${cat.id}`}>
                    <div className="summary-box-row row-cat">
                      <span className="summary-box-text">{cat.label}</span>
                    </div>
                    <div className="summary-box-divider" />
                    <div className="summary-box-row row-count">
                      <span className="summary-box-text count-val">{cat.count}</span>
                    </div>
                    <div className="summary-box-divider" />
                    <div className="summary-box-row row-pct">
                      <span className="summary-box-text pct-val">{cat.percentage}٪</span>
                    </div>
                  </div>
                ))}

                {/* Column 6: Total / کل میزان */}
                <div className="subject-analysis-summary-box box-total">
                  <div className="summary-box-row row-cat">
                    <span className="summary-box-text">کل میزان</span>
                  </div>
                  <div className="summary-box-divider" />
                  <div className="summary-box-row row-count">
                    <span className="summary-box-text count-val">{analysis.participating}</span>
                  </div>
                  <div className="summary-box-divider" />
                  <div className="summary-box-row row-pct">
                    <span className="summary-box-text pct-val">{analysis.totalPct}٪</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Validity & Total Strip */}
            <div className="subject-analysis-summary-footer">
              <span className="subject-analysis-validity-note">
                {analysis.participating > 0
                  ? 'فیصد کا مجموعہ 100٪ ہے۔'
                  : 'اس کلاس میں کوئی شریک طالب علم موجود نہیں ہے۔'}
              </span>
              <div className="subject-analysis-footer-chips">
                <span className="subject-analysis-footer-chip">
                  کل شریک طلبہ: <b>{analysis.participating}</b>
                </span>
                <span className="subject-analysis-footer-chip">
                  فیصد کا میزان: <b>{analysis.totalPct}٪</b>
                </span>
              </div>
            </div>

            {/* Detailed Student-by-Student Marks & Category Table */}
            <div className="subject-analysis-students-card">
              <h3 className="subject-analysis-section-title">طلبہ کی تفصیلی فہرست و انفرادی کیٹگری</h3>
              <div className="subject-analysis-table-wrap">
                <table className="subject-analysis-student-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>نمبر شمار</th>
                      <th style={{ width: '70px' }}>رجسٹریشن</th>
                      <th>نام طالب علم</th>
                      <th style={{ width: '120px' }}>حاصل کردہ نمبر</th>
                      <th style={{ width: '80px' }}>فیصد</th>
                      <th style={{ width: '150px' }}>کیٹگری</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.students.map((st) => (
                      <tr key={st.regNo || st.srNo}>
                        <td>{st.srNo}</td>
                        <td>{st.regNo}</td>
                        <td className="student-name-cell">{st.name}</td>
                        <td>
                          {st.isAbsent ? (
                            <span style={{ color: 'var(--muted)' }}>غیر حاضر / غیر درج</span>
                          ) : (
                            <b>{st.mark} / {analysis.maxMarks}</b>
                          )}
                        </td>
                        <td>
                          {st.isAbsent ? '—' : `${st.percentage.toFixed(1)}٪`}
                        </td>
                        <td>
                          {st.isAbsent ? (
                            <span className="mizan-badge badge-absent">غیر حاضر</span>
                          ) : (
                            <span className={`mizan-badge ${st.categoryDef?.badgeClass || 'badge-cat4'}`}>
                              {st.categoryDef?.fullLabel || st.categoryLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Print-Ready Sheet via PrintPortal */}
      <PrintPortal>
        <div className="subject-analysis-print-sheet" dir="rtl">
          {/* Printable Header */}
          <div className="subject-print-header">
            <h1 className="subject-print-inst-name">{madrasaName || 'جامعہ حفظ القرآن الکریم'}</h1>
            <h2 className="subject-print-doc-title">تجزیاتی رپورٹ برائے ماہانہ جائزہ — {analysis.subjectName}</h2>
            <div style={{ fontSize: '10pt', color: '#475569' }}>
              تعلیمی جائزہ تجزیہ و کیٹگری تقسیم (Mizan Analysis Report)
            </div>
          </div>

          {/* Printable Meta Information */}
          <div className="subject-print-meta-grid">
            <div className="subject-print-meta-item">
              کلاس: <b>{className || '—'}</b>
            </div>
            <div className="subject-print-meta-item">
              ماہ و سال: <b>{month} {formattedYear}</b>
            </div>
            <div className="subject-print-meta-item">
              مضمون: <b>{analysis.fullName}</b>
            </div>
            <div className="subject-print-meta-item">
              کل اندراجات: <b>{analysis.totalEntries}</b>
            </div>
            <div className="subject-print-meta-item">
              شریک طلبہ: <b>{analysis.participating}</b>
            </div>
            <div className="subject-print-meta-item">
              غیر حاضر: <b>{analysis.absent}</b>
            </div>
            <div className="subject-print-meta-item">
              تاریخِ پرنٹ: <b>{new Date().toLocaleDateString('ur-PK')}</b>
            </div>
            <div className="subject-print-meta-item">
              میزانِ فیصد: <b>{analysis.totalPct}٪</b>
            </div>
          </div>

          {/* Printable Mizan Category Analysis Table */}
          <table className="subject-print-mizan-table">
            <thead>
              <tr className="main-head">
                <th style={{ width: '90px' }}>کیٹگری</th>
                <th>90٪ یا زائد</th>
                <th>85٪ تا 89٪</th>
                <th>75٪ تا 84٪</th>
                <th>74٪ یا کم</th>
                <th style={{ width: '100px' }}>کل میزان</th>
              </tr>
            </thead>
            <tbody>
              <tr className="values-row">
                <td style={{ background: '#f8fafc', fontWeight: '800' }}>تعداد</td>
                <td><b>{analysis.counts[0]}</b></td>
                <td><b>{analysis.counts[1]}</b></td>
                <td><b>{analysis.counts[2]}</b></td>
                <td><b>{analysis.counts[3]}</b></td>
                <td><b>{analysis.participating}</b></td>
              </tr>
              <tr className="values-row">
                <td style={{ background: '#f8fafc', fontWeight: '800' }}>فیصد</td>
                <td><b>{analysis.pct[0]}٪</b></td>
                <td><b>{analysis.pct[1]}٪</b></td>
                <td><b>{analysis.pct[2]}٪</b></td>
                <td><b>{analysis.pct[3]}٪</b></td>
                <td><b>{analysis.totalPct}٪</b></td>
              </tr>
            </tbody>
          </table>

          {/* Printable Student List Table */}
          <table className="subject-print-student-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>شمار</th>
                <th style={{ width: '60px' }}>رجسٹریشن</th>
                <th>نام طالب علم</th>
                <th style={{ width: '100px' }}>حاصل کردہ نمبر</th>
                <th style={{ width: '70px' }}>فیصد</th>
                <th style={{ width: '140px' }}>کیٹگری</th>
              </tr>
            </thead>
            <tbody>
              {analysis.students.map((st) => (
                <tr key={st.regNo || st.srNo}>
                  <td>{st.srNo}</td>
                  <td>{st.regNo}</td>
                  <td className="print-student-name">{st.name}</td>
                  <td>
                    {st.isAbsent ? 'غیر حاضر' : `${st.mark} / ${analysis.maxMarks}`}
                  </td>
                  <td>
                    {st.isAbsent ? '—' : `${st.percentage.toFixed(1)}٪`}
                  </td>
                  <td>
                    {st.isAbsent ? 'غیر حاضر / غیر درج' : st.categoryDef?.fullLabel || st.categoryLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Printable Signatures */}
          <div className="subject-print-signatures">
            <div className="subject-print-sig-col">دستخط استاد / معلّم</div>
            <div className="subject-print-sig-col">دستخط ممتحن / ناظم تعلیمات</div>
            <div className="subject-print-sig-col">دستخط مہتمم / صدر مدرس</div>
          </div>
        </div>
      </PrintPortal>
    </>
  );
}
