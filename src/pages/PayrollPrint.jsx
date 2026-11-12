import React, { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import PrintPortal from '../components/PrintPortal';
import {
  formatDays,
  buildSlipData,
  buildReportData
} from '../utils/PayrollSlipLogic';
import { formatRupees, dateLabelUrdu, monthLabelUrdu } from '../utils/PayrollRunLogic';
import { roundHalfUp } from '../utils/PayrollCalc';
import './PayrollPrint.css';

/**
 * Printable Salary Slip & Monthly Payroll Report Component.
 * Restricts rendering to admin / super_admin only.
 * Renders print output strictly via <PrintPortal>.
 *
 * @param {object} props
 * @param {object} props.run - Current finalized payroll run
 * @param {Array} props.rows - Stored payroll_items rows
 * @param {Array} props.staffList - Madrasa staff list
 * @param {string} props.madrasaName - Name of active madrasa
 * @param {object|null} props.target - { type: 'slip', staffId } | { type: 'report' }
 * @param {Function} props.onClose - Unmount callback
 */
export default function PayrollPrint({
  run,
  rows = [],
  staffList = [],
  madrasaName = '',
  target = null,
  onClose
}) {
  const { role } = useAuth();
  const isAuthorized = role === 'admin' || role === 'super_admin';

  // Keep latest onClose callback in a ref to avoid re-triggering effects
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const hasPrintedRef = useRef(false);

  // Extract target information safely
  const targetType = target?.type || null;
  const targetStaffId = target?.staffId || null;

  // Single Slip Resolution
  const singleSlipData = useMemo(() => {
    if (!isAuthorized || targetType !== 'slip' || !targetStaffId) return null;
    const row = rows.find((r) => r.staff_id === targetStaffId);
    if (!row) return null;
    const staff = staffList.find((s) => s.id === targetStaffId) || {};
    return buildSlipData(row, staff, run, madrasaName);
  }, [isAuthorized, targetType, targetStaffId, rows, staffList, run, madrasaName]);

  // Report Resolution
  const reportData = useMemo(() => {
    if (!isAuthorized || targetType !== 'report') return null;
    return buildReportData(rows, staffList, run);
  }, [isAuthorized, targetType, rows, staffList, run]);

  // Consistency & Precondition Checks
  const isConsistent = useMemo(() => {
    if (!isAuthorized || !target) return false;
    if (targetType === 'slip') {
      return singleSlipData ? singleSlipData.consistent : false;
    }
    if (targetType === 'report') {
      return reportData ? reportData.consistent : false;
    }
    return false;
  }, [isAuthorized, target, targetType, singleSlipData, reportData]);

  const affectedStaffNames = useMemo(() => {
    if (targetType === 'slip' && singleSlipData && !singleSlipData.consistent) {
      return [singleSlipData.staff_name || singleSlipData.staff_code || 'استاذ'];
    }
    if (targetType === 'report' && reportData && !reportData.consistent) {
      return reportData.inconsistent_staff_names || [];
    }
    return [];
  }, [targetType, singleSlipData, reportData]);

  // Trigger browser print dialog safely (at most once per mounted target)
  useEffect(() => {
    if (!isAuthorized || !target || !isConsistent) {
      return;
    }
    if (typeof window === 'undefined') return;
    if (hasPrintedRef.current) return;
    hasPrintedRef.current = true;

    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      if (typeof onCloseRef.current === 'function') {
        onCloseRef.current();
      }
    };

    window.addEventListener('afterprint', cleanup);

    const frameId = requestAnimationFrame(() => {
      window.print();
    });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [isAuthorized, target, isConsistent]);

  // 1. Role-based guard: refuse render for non-admin
  if (!isAuthorized || !target) {
    return null;
  }

  // 2. Banner: Inconsistent figures detected
  if (!isConsistent) {
    return (
      <div className="payroll-print-screen-overlay" role="alert">
        <div className="payroll-print-banner payroll-print-banner-error">
          <div className="payroll-print-banner-title">
            اعداد و شمار میں فرق ہے، پرنٹ روک دیا گیا
          </div>
          {affectedStaffNames.length > 0 && (
            <div className="payroll-print-banner-desc">
              متاثرہ استاذ: {affectedStaffNames.join('، ')}
            </div>
          )}
          <div className="payroll-print-banner-actions">
            <button
              type="button"
              className="payroll-run-btn-secondary payroll-run-btn-sm"
              onClick={onClose}
            >
              بند کریں
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Non-blocking on-screen toast */}
      <div className="payroll-print-toast" aria-live="polite">
        پرنٹ تیار ہو رہا ہے...
      </div>

      {/* Printable Output via Portal */}
      <PrintPortal>
        <div className="payroll-print-document" dir="rtl">
          {/* View: Single Salary Slip */}
          {targetType === 'slip' && singleSlipData && (
            <div className="payroll-slip-container">
              {/* Header */}
              <div className="payroll-slip-header">
                {singleSlipData.madrasa_name && (
                  <div className="payroll-slip-madrasa">{singleSlipData.madrasa_name}</div>
                )}
                <div className="payroll-slip-title">{singleSlipData.title_urdu}</div>
                <div className="payroll-slip-subtitle">
                  <span>{singleSlipData.month_label}</span>
                </div>
              </div>

              {/* Staff Meta Bar */}
              <div className="payroll-slip-meta-grid">
                <div className="payroll-slip-meta-item">
                  <span className="payroll-slip-meta-label">استاذ کا نام:</span>
                  <span className="payroll-slip-meta-val">{singleSlipData.staff_name}</span>
                </div>
                <div className="payroll-slip-meta-item">
                  <span className="payroll-slip-meta-label">کوڈ:</span>
                  <span className="payroll-slip-meta-val">{singleSlipData.staff_code}</span>
                </div>
              </div>

              {/* Attendance & Time Grid */}
              <div className="payroll-slip-columns-grid">
                <div className="payroll-slip-box">
                  <div className="payroll-slip-box-title">
                    {singleSlipData.attendance_section_title}
                  </div>
                  <table className="payroll-slip-mini-table">
                    <tbody>
                      <tr>
                        <td>کل ایام کار</td>
                        <td>{singleSlipData.working_days}</td>
                        <td>قابل ادائیگی ایام</td>
                        <td>{singleSlipData.payable_days}</td>
                      </tr>
                      <tr>
                        <td>حاضر ایام</td>
                        <td>{singleSlipData.present_days}</td>
                        <td>غیر حاضر ایام</td>
                        <td>{singleSlipData.absent_days}</td>
                      </tr>
                      <tr>
                        <td>کل رخصت</td>
                        <td>{singleSlipData.leave_days_taken}</td>
                        <td>باقی رخصت</td>
                        <td>{singleSlipData.leave_balance_after}</td>
                      </tr>
                      <tr>
                        <td>بامعاوضہ رخصت</td>
                        <td>{singleSlipData.paid_leave_days}</td>
                        <td>بلا معاوضہ رخصت</td>
                        <td>{singleSlipData.unpaid_leave_days}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="payroll-slip-box">
                  <div className="payroll-slip-box-title">
                    {singleSlipData.time_section_title}
                  </div>
                  <table className="payroll-slip-mini-table">
                    <tbody>
                      <tr>
                        <td>یومیہ ڈیوٹی</td>
                        <td>{singleSlipData.shift_minutes} منٹ</td>
                      </tr>
                      <tr>
                        <td>{singleSlipData.late_minutes_label_urdu}</td>
                        <td>{singleSlipData.late_minutes_charged} منٹ</td>
                      </tr>
                      <tr>
                        <td>{singleSlipData.early_minutes_label_urdu}</td>
                        <td>{singleSlipData.early_minutes_charged} منٹ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="payroll-slip-box">
                <div className="payroll-slip-box-title">آمدنی و کٹوتیاں</div>
                <div className="payroll-slip-columns-grid">
                  {/* Earnings */}
                  <table className="payroll-slip-table">
                    <thead>
                      <tr>
                        <th colSpan="2">{singleSlipData.earnings_section_title}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>بنیادی تنخواہ</td>
                        <td>{formatRupees(singleSlipData.base_salary)}</td>
                      </tr>
                      <tr>
                        <td>{singleSlipData.base_pay_title_urdu}</td>
                        <td>{formatRupees(singleSlipData.base_pay_display)}</td>
                      </tr>
                      {singleSlipData.has_encashment && (
                        <tr>
                          <td>رخصت کے پیسے ({singleSlipData.leave_encashment_days} دن)</td>
                          <td>{formatRupees(singleSlipData.leave_encashment_amount)}</td>
                        </tr>
                      )}
                      {singleSlipData.has_bonus && (
                        <tr>
                          <td>اضافی رقم / بونس</td>
                          <td>{formatRupees(singleSlipData.bonus)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Deductions */}
                  <table className="payroll-slip-table">
                    <thead>
                      <tr>
                        <th colSpan="2">{singleSlipData.deductions_section_title}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>غیر حاضری کٹوتی</td>
                        <td>{formatRupees(singleSlipData.absence_deduction)}</td>
                      </tr>
                      <tr>
                        <td>بلا معاوضہ رخصت کٹوتی</td>
                        <td>{formatRupees(singleSlipData.unpaid_leave_deduction)}</td>
                      </tr>
                      <tr>
                        <td>تاخیر و قبل از وقت کٹوتی</td>
                        <td>{formatRupees(singleSlipData.time_deduction)}</td>
                      </tr>
                      {singleSlipData.has_advance && (
                        <tr>
                          <td>پیشگی کٹوتی</td>
                          <td>{formatRupees(singleSlipData.advance_deduction)}</td>
                        </tr>
                      )}
                      {singleSlipData.has_other && (
                        <tr>
                          <td>دیگر کٹوتی</td>
                          <td>{formatRupees(singleSlipData.other_deduction)}</td>
                        </tr>
                      )}
                      {singleSlipData.show_rounding && (
                        <tr>
                          <td>{singleSlipData.rounding_label_urdu}</td>
                          <td>
                            <span dir="ltr">
                              {singleSlipData.rounding_display > 0
                                ? `+${singleSlipData.rounding_display}`
                                : singleSlipData.rounding_display}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="payroll-slip-row-total">
                        <td>کل کٹوتیاں</td>
                        <td>{formatRupees(singleSlipData.total_deductions)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clamped Notice if deductions exceeded payable earnings */}
              {singleSlipData.was_clamped && (
                <div className="payroll-slip-clamped-notice">
                  {singleSlipData.clamped_message_urdu}
                </div>
              )}

              {/* Net Salary Prominent Card */}
              <div className="payroll-slip-net-card">
                <span className="payroll-slip-net-label">خالص قابل ادائیگی تنخواہ:</span>
                <span className="payroll-slip-net-value">
                  {formatRupees(singleSlipData.net_salary)}
                </span>
              </div>

              {/* Payment & Notes */}
              <div className="payroll-slip-footer-info">
                <div className="payroll-slip-payment-line">
                  <span>ادائیگی کی صورتحال: {singleSlipData.payment_status_urdu}</span>
                  {singleSlipData.is_paid && singleSlipData.paid_on && (
                    <span> (تاریخ ادائیگی: {dateLabelUrdu(singleSlipData.paid_on)})</span>
                  )}
                </div>
                {singleSlipData.has_notes && (
                  <div className="payroll-slip-notes">
                    <span>نوٹس: </span>
                    <span>{singleSlipData.notes}</span>
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="payroll-slip-signatures">
                <div className="payroll-slip-sig-block">
                  <div className="payroll-slip-sig-line"></div>
                  <div className="payroll-slip-sig-label">دستخط استاذ</div>
                </div>
                <div className="payroll-slip-sig-block">
                  <div className="payroll-slip-sig-line"></div>
                  <div className="payroll-slip-sig-label">دستخط انتظامیہ</div>
                </div>
              </div>
            </div>
          )}

          {/* View: Monthly Payroll Report */}
          {targetType === 'report' && reportData && (
            <div className="payroll-report-container">
              {/* Header */}
              <div className="payroll-report-header">
                {madrasaName && <div className="payroll-report-madrasa">{madrasaName}</div>}
                <div className="payroll-report-title">ماہانہ پے رول رپورٹ</div>
                <div className="payroll-report-month">
                  {monthLabelUrdu(run?.month_date || run?.month || '')}
                </div>
              </div>

              {/* Table */}
              <table className="payroll-report-table">
                <thead>
                  <tr>
                    <th>کوڈ</th>
                    <th>استاذ کا نام</th>
                    <th>بنیادی تنخواہ</th>
                    <th>حاضر</th>
                    <th>غیر حاضر</th>
                    <th>رخصت</th>
                    <th>غیر حاضری و رخصت کٹوتی</th>
                    <th>اوقات کٹوتی</th>
                    <th>بونس</th>
                    <th>پیشگی و دیگر کٹوتی</th>
                    <th>خالص تنخواہ</th>
                    <th>ادائیگی</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row) => {
                    const absenceAndUnpaidDeduction = roundHalfUp(
                      Number(row.absence_deduction || 0) + Number(row.unpaid_leave_deduction || 0),
                      2
                    );
                    const advanceAndOtherDeduction = roundHalfUp(
                      Number(row.advance_deduction || 0) + Number(row.other_deduction || 0),
                      2
                    );
                    const isPaid = row.payment_status === 'paid';
                    return (
                      <tr key={row.id || row.staff_id}>
                        <td>{row.staff_code}</td>
                        <td>{row.staff_name}</td>
                        <td>{formatRupees(row.base_salary)}</td>
                        <td>{formatDays(row.present_days)}</td>
                        <td>{formatDays(row.absent_days)}</td>
                        <td>
                          {formatDays(row.paid_leave_days)} / {formatDays(row.unpaid_leave_days)}
                        </td>
                        <td>{formatRupees(absenceAndUnpaidDeduction)}</td>
                        <td>{formatRupees(row.time_deduction)}</td>
                        <td>{formatRupees(row.bonus)}</td>
                        <td>{formatRupees(advanceAndOtherDeduction)}</td>
                        <td className="payroll-report-net-cell">
                          {formatRupees(row.net_salary)}
                        </td>
                        <td>{isPaid ? 'ادا شدہ' : 'غیر ادا شدہ'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="payroll-report-totals-row">
                    <td colSpan="2">کل اساتذہ: {reportData.totals.teachers_count}</td>
                    <td>{formatRupees(reportData.totals.base_salary_total)}</td>
                    <td colSpan="3">-</td>
                    <td>
                      {formatRupees(
                        roundHalfUp(
                          reportData.totals.absence_total + reportData.totals.unpaid_leave_total,
                          2
                        )
                      )}
                    </td>
                    <td>{formatRupees(reportData.totals.time_total)}</td>
                    <td>{formatRupees(reportData.totals.bonus_total)}</td>
                    <td>
                      {formatRupees(
                        roundHalfUp(
                          reportData.totals.advance_total + reportData.totals.other_total,
                          2
                        )
                      )}
                    </td>
                    <td className="payroll-report-net-cell">
                      {formatRupees(reportData.totals.net_total)}
                    </td>
                    <td>{reportData.totals.paid_count} ادا شدہ</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="payroll-report-signatures">
                <div className="payroll-report-sig-block">
                  <div className="payroll-report-sig-line"></div>
                  <div className="payroll-report-sig-label">تیار کنندہ</div>
                </div>
                <div className="payroll-report-sig-block">
                  <div className="payroll-report-sig-line"></div>
                  <div className="payroll-report-sig-label">دستخط مہتمم / ناظم</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PrintPortal>
    </>
  );
}
