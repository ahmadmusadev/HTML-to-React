import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMadrasa } from '../context/MadrasaContext';
import { supabase, isValidUUID } from '../lib/supabaseClient';
import {
  fetchStaffSalaries,
  upsertStaffSalaries,
  fetchPayrollSettings,
  upsertPayrollSettings,
  fetchHolidays,
  addHoliday,
  deleteHoliday,
  fetchLeaveOpening,
  upsertLeaveOpening
} from '../lib/payrollApi';
import {
  WEEKDAY_NAMES_URDU,
  MONTH_NAMES_URDU,
  toUrduPayrollError,
  validateBaseSalary,
  validateWeeklyOffDays,
  validateGraceMinutes,
  validateMonthlyLeaveAccrual,
  validateFiscalYearStartMonth,
  validateHoliday,
  validateLeaveOpeningUsedDays,
  getFiscalYearStart,
  getFiscalYearRangeUrdu,
  calculateShiftDurationMinutes,
  formatShiftDurationUrdu
} from '../utils/PayrollMappers';
import './Payroll.css';

export default function Payroll() {
  const { role, madrasaId: authMadrasaId } = useAuth();
  const { activeMadrasaId, fetchStaffFromSupabase } = useMadrasa();

  // Defense in depth: Check if current role is authorized
  const isAuthorized = role === 'admin' || role === 'super_admin';

  // Check if authenticated user's home madrasa differs from active madrasa (including when authMadrasaId is null/undefined)
  const isMadrasaMismatch = Boolean(activeMadrasaId && authMadrasaId !== activeMadrasaId);

  // Sub-tabs: 'salary', 'settings', 'holidays', 'leave_opening'
  const [activeSubTab, setActiveSubTab] = useState('salary');

  // Loading & Global Statuses
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Staff & Salaries State
  const [staffList, setStaffList] = useState([]);
  const [salariesMap, setSalariesMap] = useState({}); // { staffId: base_salary }
  const [salaryInputs, setSalaryInputs] = useState({}); // { staffId: stringValue }
  const [savingSalaries, setSavingSalaries] = useState(false);

  // 2. Settings State
  const [settings, setSettings] = useState({
    weekly_off_days: [5], // Default Friday
    late_grace_minutes: 0,
    early_leave_grace_minutes: 0,
    monthly_leave_accrual: 1.5,
    fiscal_year_start_month: 4
  });
  // Saved fiscal start month strictly from DB or successful save (default 4)
  const [savedFiscalStartMonth, setSavedFiscalStartMonth] = useState(4);
  const [savingSettings, setSavingSettings] = useState(false);

  // 3. Holidays State
  const [holidays, setHolidays] = useState([]);
  const [holidayYearFilter, setHolidayYearFilter] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayTitle, setNewHolidayTitle] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState(null);
  const [holidayToDelete, setHolidayToDelete] = useState(null);

  // 4. Leave Opening State
  const [leaveOpeningMap, setLeaveOpeningMap] = useState({}); // { staffId: used_days }
  const [leaveOpeningInputs, setLeaveOpeningInputs] = useState({}); // { staffId: stringValue }
  const [savingLeaveOpening, setSavingLeaveOpening] = useState(false);

  // Maintain stable reference to fetchStaffFromSupabase to prevent re-fetch on context re-render
  const fetchStaffRef = useRef(fetchStaffFromSupabase);
  useEffect(() => {
    fetchStaffRef.current = fetchStaffFromSupabase;
  });

  // Clear notices on sub-tab change
  const handleSwitchTab = (tab) => {
    setActiveSubTab(tab);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Dynamic Holiday Year Filter Options: previous year, current year, next 3 years + "تمام سال"
  const holidayYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
      currentYear + 3
    ];
  }, []);

  // Main initial loader: Loads Staff, Salaries, and Settings
  // Depends STRICTLY on [isAuthorized, activeMadrasaId]
  useEffect(() => {
    if (!isAuthorized || !isValidUUID(activeMadrasaId)) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    Promise.all([
      // 1. Staff
      fetchStaffRef.current(activeMadrasaId)
        .then((data) => {
          if (isMounted) setStaffList(data || []);
        })
        .catch((err) => {
          if (isMounted) setErrorMsg(toUrduPayrollError(err));
        }),

      // 2. Salaries
      fetchStaffSalaries(supabase, activeMadrasaId)
        .then((rows) => {
          if (isMounted) {
            const map = {};
            const inputs = {};
            (rows || []).forEach((r) => {
              const val = Number(r.base_salary);
              map[r.staff_id] = val;
              inputs[r.staff_id] = String(val);
            });
            setSalariesMap(map);
            setSalaryInputs(inputs);
          }
        })
        .catch((err) => {
          if (isMounted) setErrorMsg(toUrduPayrollError(err));
        }),

      // 3. Settings
      fetchPayrollSettings(supabase, activeMadrasaId)
        .then((row) => {
          if (isMounted) {
            if (row) {
              const loadedMonth = Number(row.fiscal_year_start_month ?? 4);
              setSavedFiscalStartMonth(loadedMonth);
              setSettings({
                weekly_off_days: Array.isArray(row.weekly_off_days) ? row.weekly_off_days : [5],
                late_grace_minutes: Number(row.late_grace_minutes ?? 0),
                early_leave_grace_minutes: Number(row.early_leave_grace_minutes ?? 0),
                monthly_leave_accrual: Number(row.monthly_leave_accrual ?? 1.5),
                fiscal_year_start_month: loadedMonth
              });
            } else {
              setSavedFiscalStartMonth(4);
              setSettings({
                weekly_off_days: [5],
                late_grace_minutes: 0,
                early_leave_grace_minutes: 0,
                monthly_leave_accrual: 1.5,
                fiscal_year_start_month: 4
              });
            }
          }
        })
        .catch((err) => {
          if (isMounted) setErrorMsg(toUrduPayrollError(err));
        })
    ]).finally(() => {
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, activeMadrasaId]);

  // Dedicated Holidays loader: Only depends on [isAuthorized, activeMadrasaId, holidayYearFilter]
  // Never replaces whole page with loading box, never touches salaries or settings
  useEffect(() => {
    if (!isAuthorized || !isValidUUID(activeMadrasaId)) {
      setHolidays([]);
      return;
    }

    let isMounted = true;
    setLoadingHolidays(true);

    fetchHolidays(supabase, activeMadrasaId, holidayYearFilter || undefined)
      .then((rows) => {
        if (isMounted) {
          setHolidays(rows || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(toUrduPayrollError(err, 'holiday'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingHolidays(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, activeMadrasaId, holidayYearFilter]);

  // Dedicated Leave Opening loader: Depends on [isAuthorized, activeMadrasaId, savedFiscalStartMonth]
  // Uses savedFiscalStartMonth (NOT the unsaved edited value)
  useEffect(() => {
    if (!isAuthorized || !isValidUUID(activeMadrasaId)) {
      return;
    }

    let isMounted = true;
    const currentFiscalStart = getFiscalYearStart(undefined, savedFiscalStartMonth);

    fetchLeaveOpening(supabase, activeMadrasaId, currentFiscalStart)
      .then((rows) => {
        if (isMounted) {
          const map = {};
          const inputs = {};
          (rows || []).forEach((r) => {
            const val = Number(r.used_days ?? 0);
            map[r.staff_id] = val;
            inputs[r.staff_id] = String(val);
          });
          setLeaveOpeningMap(map);
          setLeaveOpeningInputs(inputs);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(toUrduPayrollError(err));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, activeMadrasaId, savedFiscalStartMonth]);

  // Handle salary input changes
  const handleSalaryInputChange = (staffId, value) => {
    setSalaryInputs((prev) => ({
      ...prev,
      [staffId]: value
    }));
  };

  // Save Changed Salaries
  const handleSaveSalaries = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    // Determine changed rows
    const changedRows = [];
    for (const staff of staffList) {
      const inputVal = salaryInputs[staff.id];
      const originalVal = salariesMap[staff.id];

      if (inputVal === undefined && originalVal === undefined) {
        continue;
      }

      const cleanInput = inputVal !== undefined ? String(inputVal).trim() : '';

      if (originalVal !== undefined && cleanInput !== '' && Number(cleanInput) === originalVal) {
        continue;
      }

      if (cleanInput === '' && originalVal === undefined) {
        continue;
      }

      const validation = validateBaseSalary(cleanInput);
      if (!validation.isValid) {
        setErrorMsg(`${staff.name}: ${validation.error}`);
        return;
      }

      changedRows.push({
        staff_id: staff.id,
        base_salary: validation.value
      });
    }

    if (changedRows.length === 0) {
      setSuccessMsg('کوئی تبدیلی نہیں کی گئی ہے۔ تمام ریکارڈز پہلے سے محفوظ ہیں۔');
      return;
    }

    setSavingSalaries(true);
    try {
      const upserted = await upsertStaffSalaries(supabase, activeMadrasaId, changedRows);
      setSalariesMap((prev) => {
        const next = { ...prev };
        upserted.forEach((r) => {
          next[r.staff_id] = Number(r.base_salary);
        });
        return next;
      });
      setSuccessMsg(`${changedRows.length} اساتذہ کی تنخواہ کا ریکارڈ کامیابی سے محفوظ ہو گیا ہے۔`);
    } catch (err) {
      setErrorMsg(toUrduPayrollError(err));
    } finally {
      setSavingSalaries(false);
    }
  };

  // Salary calculations
  const totalMonthlySalaries = useMemo(() => {
    let sum = 0;
    staffList.forEach((s) => {
      const inputVal = salaryInputs[s.id];
      if (inputVal !== undefined && inputVal !== '') {
        const num = Number(inputVal);
        if (!Number.isNaN(num) && num > 0) {
          sum += num;
          return;
        }
      }
      const val = salariesMap[s.id];
      if (val !== undefined && val > 0) {
        sum += val;
      }
    });
    return sum;
  }, [staffList, salaryInputs, salariesMap]);

  const unassignedSalaryCount = useMemo(() => {
    return staffList.filter((s) => {
      const val = salariesMap[s.id];
      return val === undefined || val === null;
    }).length;
  }, [staffList, salariesMap]);

  // Handle Weekly Off Toggle (Computes next array first, then sets state and message separately)
  const handleToggleWeeklyOff = (dayInt) => {
    const current = settings.weekly_off_days || [];
    if (current.includes(dayInt)) {
      const next = current.filter((d) => d !== dayInt);
      setSettings((prev) => ({ ...prev, weekly_off_days: next }));
    } else {
      if (current.length >= 6) {
        setErrorMsg('کم از کم ایک دن کام کا ہونا لازمی ہے۔ زیادہ سے زیادہ 6 تعطیلات رکھی جا سکتی ہیں۔');
        return;
      }
      const next = [...current, dayInt].sort((a, b) => a - b);
      setSettings((prev) => ({ ...prev, weekly_off_days: next }));
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const offDaysVal = validateWeeklyOffDays(settings.weekly_off_days);
    if (!offDaysVal.isValid) {
      setErrorMsg(offDaysVal.error);
      return;
    }

    const lateGraceVal = validateGraceMinutes(settings.late_grace_minutes, 'تاخیر کی رعایتی مدت');
    if (!lateGraceVal.isValid) {
      setErrorMsg(lateGraceVal.error);
      return;
    }

    const earlyGraceVal = validateGraceMinutes(settings.early_leave_grace_minutes, 'قبل از وقت روانگی کی رعایتی مدت');
    if (!earlyGraceVal.isValid) {
      setErrorMsg(earlyGraceVal.error);
      return;
    }

    const accrualVal = validateMonthlyLeaveAccrual(settings.monthly_leave_accrual);
    if (!accrualVal.isValid) {
      setErrorMsg(accrualVal.error);
      return;
    }

    const fiscalMonthVal = validateFiscalYearStartMonth(settings.fiscal_year_start_month);
    if (!fiscalMonthVal.isValid) {
      setErrorMsg(fiscalMonthVal.error);
      return;
    }

    setSavingSettings(true);
    try {
      const updated = await upsertPayrollSettings(supabase, activeMadrasaId, {
        weekly_off_days: offDaysVal.value,
        late_grace_minutes: lateGraceVal.value,
        early_leave_grace_minutes: earlyGraceVal.value,
        monthly_leave_accrual: accrualVal.value,
        fiscal_year_start_month: fiscalMonthVal.value
      });

      const newSavedMonth = Number(updated.fiscal_year_start_month);
      setSavedFiscalStartMonth(newSavedMonth);
      setSettings({
        weekly_off_days: updated.weekly_off_days,
        late_grace_minutes: Number(updated.late_grace_minutes),
        early_leave_grace_minutes: Number(updated.early_leave_grace_minutes),
        monthly_leave_accrual: Number(updated.monthly_leave_accrual),
        fiscal_year_start_month: newSavedMonth
      });
      setSuccessMsg('ترتیبات کامیابی سے محفوظ ہو گئی ہیں۔');
    } catch (err) {
      setErrorMsg(toUrduPayrollError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  // Add Holiday
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validation = validateHoliday({
      holiday_date: newHolidayDate,
      title: newHolidayTitle
    });

    if (!validation.isValid) {
      setErrorMsg(validation.error);
      return;
    }

    setSavingHoliday(true);
    try {
      const added = await addHoliday(supabase, activeMadrasaId, validation.value);
      setHolidays((prev) => [...prev, added].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
      setNewHolidayDate('');
      setNewHolidayTitle('');
      setSuccessMsg('تعطیل کامیابی سے شامل کر دی گئی ہے۔');
    } catch (err) {
      setErrorMsg(toUrduPayrollError(err, 'holiday'));
    } finally {
      setSavingHoliday(false);
    }
  };

  // Delete Holiday
  const handleConfirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;

    setErrorMsg('');
    setSuccessMsg('');
    setDeletingHolidayId(holidayToDelete.id);

    try {
      await deleteHoliday(supabase, activeMadrasaId, holidayToDelete.id);
      setHolidays((prev) => prev.filter((h) => h.id !== holidayToDelete.id));
      setSuccessMsg('تعطیل کامیابی سے حذف کر دی گئی ہے۔');
      setHolidayToDelete(null);
    } catch (err) {
      setErrorMsg(toUrduPayrollError(err, 'holiday'));
    } finally {
      setDeletingHolidayId(null);
    }
  };

  // Save Leave Opening (Uses savedFiscalStartMonth)
  const handleSaveLeaveOpening = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    const currentFiscalStart = getFiscalYearStart(undefined, savedFiscalStartMonth);

    const changedRows = [];
    for (const staff of staffList) {
      const inputVal = leaveOpeningInputs[staff.id];
      const originalVal = leaveOpeningMap[staff.id];

      if (inputVal === undefined && originalVal === undefined) {
        continue;
      }

      const cleanInput = inputVal !== undefined ? String(inputVal).trim() : '0';

      if (originalVal !== undefined && Number(cleanInput) === originalVal) {
        continue;
      }

      const validation = validateLeaveOpeningUsedDays(cleanInput);
      if (!validation.isValid) {
        setErrorMsg(`${staff.name}: ${validation.error}`);
        return;
      }

      changedRows.push({
        staff_id: staff.id,
        fiscal_year_start: currentFiscalStart,
        used_days: validation.value
      });
    }

    if (changedRows.length === 0) {
      setSuccessMsg('کوئی تبدیلی نہیں کی گئی ہے۔ تمام ریکارڈز پہلے سے محفوظ ہیں۔');
      return;
    }

    setSavingLeaveOpening(true);
    try {
      const upserted = await upsertLeaveOpening(supabase, activeMadrasaId, changedRows);
      setLeaveOpeningMap((prev) => {
        const next = { ...prev };
        upserted.forEach((r) => {
          next[r.staff_id] = Number(r.used_days);
        });
        return next;
      });
      setSuccessMsg(`${changedRows.length} اساتذہ کی چھٹیوں کا ابتدائی حساب کامیابی سے محفوظ ہو گیا ہے۔`);
    } catch (err) {
      setErrorMsg(toUrduPayrollError(err));
    } finally {
      setSavingLeaveOpening(false);
    }
  };

  // Defense in depth view
  if (!isAuthorized) {
    return (
      <div className="payroll-container">
        <div className="payroll-alert payroll-alert-error" style={{ textAlign: 'center', margin: '40px auto', maxWidth: '600px' }}>
          <h2>رسائی غیر مجاز</h2>
          <p style={{ marginTop: '8px' }}>صرف مہتمم یا ایڈمن کو اس صفحے تک رسائی کی اجازت ہے۔</p>
        </div>
      </div>
    );
  }

  // Display strings for fiscal year
  const isFiscalEdited = settings.fiscal_year_start_month !== savedFiscalStartMonth;
  const leaveFiscalStartStr = getFiscalYearStart(undefined, savedFiscalStartMonth);
  const leaveFiscalRangeText = getFiscalYearRangeUrdu(undefined, savedFiscalStartMonth);

  return (
    <div className="payroll-container" dir="rtl">
      {/* Header Area */}
      <div className="payroll-header-area">
        <h1 className="payroll-page-title">تنخواہ و ترتیبات کا انتظام</h1>
        <p className="payroll-page-desc">اساتذہ کی بنیادی تنخواہ، ہفتہ وار تعطیلات، رعایتی اوقات، اور چھٹیوں کے حساب کا نظام</p>
      </div>

      {/* Madrasa ID Mismatch Info Banner */}
      {isMadrasaMismatch && (
        <div className="payroll-alert payroll-alert-info" role="status">
          آپ کا اکاؤنٹ اس ادارے سے منسلک نہیں، اس لیے تنخواہ کا ڈیٹا نظر نہیں آئے گا۔
        </div>
      )}

      {/* Global Status Notifications */}
      {errorMsg && (
        <div className="payroll-alert payroll-alert-error" role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="payroll-alert payroll-alert-success" role="status">
          {successMsg}
        </div>
      )}

      {/* Sub-tabs Navigation */}
      <div className="payroll-subtabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'salary'}
          className={`payroll-subtab-btn ${activeSubTab === 'salary' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('salary')}
        >
          تنخواہ کا اندراج
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'settings'}
          className={`payroll-subtab-btn ${activeSubTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('settings')}
        >
          ترتیبات
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'holidays'}
          className={`payroll-subtab-btn ${activeSubTab === 'holidays' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('holidays')}
        >
          تعطیلات
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'leave_opening'}
          className={`payroll-subtab-btn ${activeSubTab === 'leave_opening' ? 'active' : ''}`}
          onClick={() => handleSwitchTab('leave_opening')}
        >
          چھٹیوں کا ابتدائی حساب
        </button>
      </div>

      {loading ? (
        <div className="payroll-loading-box">
          <p>ڈیٹا لوڈ ہو رہا ہے، براہ کرم انتظار فرمائیں...</p>
        </div>
      ) : (
        <>
          {/* =========================================================
              SUB-TAB 1: تنخواہ کا اندراج
              ========================================================= */}
          {activeSubTab === 'salary' && (
            <div className="payroll-tab-panel">
              {/* Summary Cards */}
              <div className="payroll-summary-grid">
                <div className="payroll-summary-card">
                  <div className="payroll-summary-card-title">کل فعال اساتذہ</div>
                  <div className="payroll-summary-card-value">{staffList.length}</div>
                </div>
                <div className="payroll-summary-card">
                  <div className="payroll-summary-card-title">کل ماہانہ بنیادی تنخواہیں</div>
                  <div className="payroll-summary-card-value">
                    {totalMonthlySalaries.toLocaleString('ur-PK')} روپیہ
                  </div>
                </div>
                <div className="payroll-summary-card">
                  <div className="payroll-summary-card-title">غیر مقررہ تنخواہ والے اساتذہ</div>
                  <div className={`payroll-summary-card-value ${unassignedSalaryCount > 0 ? 'payroll-unassigned-alert' : ''}`}>
                    {unassignedSalaryCount}
                  </div>
                </div>
              </div>

              {/* Staff Salary Table */}
              <div className="payroll-table-wrapper table-responsive">
                <table className="payroll-table payroll-table-salary">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>ضابطہ نمبر</th>
                      <th style={{ width: '25%' }}>نام عملہ</th>
                      <th style={{ width: '25%' }}>ڈیوٹی دورانیہ</th>
                      <th style={{ width: '25%' }}>ماہانہ بنیادی تنخواہ (روپیہ)</th>
                      <th style={{ width: '15%' }}>کیفیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="payroll-empty-state">
                          کوئی فعال استاد موجود نہیں ہے۔
                        </td>
                      </tr>
                    ) : (
                      staffList.map((staff) => {
                        const originalVal = salariesMap[staff.id];
                        const isSet = originalVal !== undefined && originalVal !== null;
                        const durationMins = calculateShiftDurationMinutes(staff.shift_start, staff.shift_end);
                        const durationText = formatShiftDurationUrdu(durationMins);
                        const currentInput =
                          salaryInputs[staff.id] !== undefined
                            ? salaryInputs[staff.id]
                            : isSet
                            ? String(originalVal)
                            : '';

                        return (
                          <tr key={staff.id}>
                            <td style={{ fontWeight: 700 }}>{staff.staff_code || staff.staffCode || '—'}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{staff.name}</div>
                              {staff.father_name && (
                                <div className="payroll-staff-father">
                                  ولدیت: {staff.father_name}
                                </div>
                              )}
                            </td>
                            <td>{durationText}</td>
                            <td>
                              {isMadrasaMismatch ? (
                                <span className="payroll-muted-dash">—</span>
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="9999999.99"
                                  className="payroll-input payroll-input-table"
                                  placeholder="رقم درج کریں"
                                  value={currentInput}
                                  onChange={(e) => handleSalaryInputChange(staff.id, e.target.value)}
                                  aria-label={`ماہانہ تنخواہ برائے ${staff.name}`}
                                />
                              )}
                            </td>
                            <td>
                              {isSet ? (
                                <span className="payroll-badge payroll-badge-set">مقرر شدہ</span>
                              ) : (
                                <span className="payroll-badge payroll-badge-unset">مقرر نہیں</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Actions Bar */}
              {staffList.length > 0 && !isMadrasaMismatch && (
                <div className="payroll-actions-bar">
                  <button
                    type="button"
                    className="payroll-btn-primary"
                    disabled={savingSalaries}
                    onClick={handleSaveSalaries}
                  >
                    {savingSalaries ? 'محفوظ کیا جا رہا ہے...' : 'محفوظ کریں'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              SUB-TAB 2: ترتیبات
              ========================================================= */}
          {activeSubTab === 'settings' && (
            <div className="payroll-tab-panel">
              <form onSubmit={handleSaveSettings} className="payroll-settings-card">
                {/* Fiscal Year Range Helper Line */}
                <div className="payroll-alert payroll-alert-info">
                  <strong>مالی سال کی مدت:</strong> {getFiscalYearRangeUrdu(undefined, isFiscalEdited ? settings.fiscal_year_start_month : savedFiscalStartMonth)}{' '}
                  {isFiscalEdited && <span className="payroll-preview-badge">(پیش نظارہ)</span>}
                </div>

                <div className="payroll-form-grid">
                  {/* Fiscal Year Start Month */}
                  <div className="payroll-form-group">
                    <label className="payroll-form-label" htmlFor="fiscalYearStartMonthSelect">
                      مالی سال کا ابتدائی مہینہ
                    </label>
                    <select
                      id="fiscalYearStartMonthSelect"
                      className="payroll-select"
                      value={settings.fiscal_year_start_month}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, fiscal_year_start_month: Number(e.target.value) }))
                      }
                    >
                      {MONTH_NAMES_URDU.map((name, idx) => {
                        if (idx === 0) return null;
                        return (
                          <option key={idx} value={idx}>
                            {name} (مہینہ {idx})
                          </option>
                        );
                      })}
                    </select>
                    <span className="payroll-form-hint">
                      عموماً تعلیمی یا مالی سال اپریل یا جنوری سے شروع ہوتا ہے۔
                    </span>
                  </div>

                  {/* Monthly Leave Accrual */}
                  <div className="payroll-form-group">
                    <label className="payroll-form-label" htmlFor="monthlyLeaveAccrualInput">
                      ماہانہ رخصت استحقاق (چھٹیاں فی مہینہ)
                    </label>
                    <input
                      id="monthlyLeaveAccrualInput"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      className="payroll-input"
                      value={settings.monthly_leave_accrual}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, monthly_leave_accrual: e.target.value }))
                      }
                    />
                    <span className="payroll-form-hint">
                      ہر ماہ اساتذہ کے کھاتے میں خودکار طور پر جمع ہونے والی رخصتیں (پہلے سے طے شدہ: 1.5)
                    </span>
                  </div>

                  {/* Late Grace Minutes */}
                  <div className="payroll-form-group">
                    <label className="payroll-form-label" htmlFor="lateGraceMinutesInput">
                      تاخیر کی رعایتی مدت (منٹ)
                    </label>
                    <input
                      id="lateGraceMinutesInput"
                      type="number"
                      step="1"
                      min="0"
                      max="120"
                      className="payroll-input"
                      value={settings.late_grace_minutes}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, late_grace_minutes: e.target.value }))
                      }
                    />
                    <span className="payroll-form-hint">
                      ڈیوٹی کے وقت کے بعد اتنے منٹ تک تاخیر شمار نہیں ہوگی (0 تا 120 منٹ)
                    </span>
                  </div>

                  {/* Early Leave Grace Minutes */}
                  <div className="payroll-form-group">
                    <label className="payroll-form-label" htmlFor="earlyLeaveGraceMinutesInput">
                      قبل از وقت روانگی کی رعایتی مدت (منٹ)
                    </label>
                    <input
                      id="earlyLeaveGraceMinutesInput"
                      type="number"
                      step="1"
                      min="0"
                      max="120"
                      className="payroll-input"
                      value={settings.early_leave_grace_minutes}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, early_leave_grace_minutes: e.target.value }))
                      }
                    />
                    <span className="payroll-form-hint">
                      ڈیوٹی ختم ہونے سے اتنے منٹ قبل رخصت ہونے پر کٹوتی نہیں ہوگی (0 تا 120 منٹ)
                    </span>
                  </div>
                </div>

                {/* Weekly Off Days Checkboxes */}
                <div className="payroll-form-group" style={{ marginBottom: '24px' }}>
                  <label className="payroll-form-label">
                    ہفتہ وار تعطیلات
                  </label>
                  <span className="payroll-form-hint">
                    جن ایام میں ادارہ بند رہتا ہے انہیں منتخب فرمائیں (کم از کم 1 دن کام کا ہونا ضروری ہے):
                  </span>
                  <div className="weekly-off-grid">
                    {WEEKDAY_NAMES_URDU.map((dayName, dayIndex) => {
                      const isChecked = (settings.weekly_off_days || []).includes(dayIndex);
                      return (
                        <label
                          key={dayIndex}
                          className={`weekday-checkbox-label ${isChecked ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="weekday-checkbox-input"
                            checked={isChecked}
                            onChange={() => handleToggleWeeklyOff(dayIndex)}
                          />
                          <span>{dayName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="payroll-actions-bar">
                  <button
                    type="submit"
                    className="payroll-btn-primary"
                    disabled={savingSettings}
                  >
                    {savingSettings ? 'محفوظ کیا جا رہا ہے...' : 'ترتیبات محفوظ کریں'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================
              SUB-TAB 3: تعطیلات
              ========================================================= */}
          {activeSubTab === 'holidays' && (
            <div className="payroll-tab-panel">
              {/* Add Holiday Form Card */}
              <div className="holiday-form-card">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0' }}>نئی تعطیل شامل کریں</h2>
                <form onSubmit={handleAddHoliday}>
                  <div className="holiday-form-row">
                    <div className="payroll-form-group" style={{ flex: '1 1 200px' }}>
                      <label className="payroll-form-label" htmlFor="newHolidayDateInput">
                        تاریخ
                      </label>
                      <input
                        id="newHolidayDateInput"
                        type="date"
                        className="payroll-input"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="payroll-form-group" style={{ flex: '2 1 300px' }}>
                      <label className="payroll-form-label" htmlFor="newHolidayTitleInput">
                        تعطیل کا عنوان
                      </label>
                      <input
                        id="newHolidayTitleInput"
                        type="text"
                        maxLength="100"
                        placeholder="مثلاً: عید الفطر، یوم پاکستان، وغیرہ"
                        className="payroll-input"
                        value={newHolidayTitle}
                        onChange={(e) => setNewHolidayTitle(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="payroll-btn-primary"
                      disabled={savingHoliday}
                      style={{ height: '40px', alignSelf: 'flex-end' }}
                    >
                      {savingHoliday ? 'شامل کیا جا رہا ہے...' : 'تعطیل شامل کریں'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Year Filter */}
              <div className="holiday-filter-row">
                <label className="payroll-form-label" htmlFor="holidayYearFilterSelect">
                  سال کا فلٹر:
                </label>
                <select
                  id="holidayYearFilterSelect"
                  className="payroll-select"
                  style={{ width: '160px' }}
                  value={holidayYearFilter}
                  onChange={(e) => setHolidayYearFilter(e.target.value)}
                >
                  <option value="">تمام سال</option>
                  {holidayYearOptions.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
                <span className="payroll-form-hint">
                  کل تعطیلات: {holidays.length}
                </span>
              </div>

              {/* Holidays Table / Small Local Loading State */}
              {loadingHolidays ? (
                <div className="payroll-loading-box payroll-loading-box-sm">
                  <p>تعطیلات لوڈ ہو رہی ہیں...</p>
                </div>
              ) : (
                <div className="payroll-table-wrapper table-responsive">
                  <table className="payroll-table payroll-table-holidays">
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>تاریخ</th>
                        <th style={{ width: '20%' }}>دن</th>
                        <th style={{ width: '45%' }}>عنوان</th>
                        <th style={{ width: '15%' }}>کارروائی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="payroll-empty-state">
                            کوئی تعطیل درج نہیں ہے۔
                          </td>
                        </tr>
                      ) : (
                        holidays.map((h) => {
                          const [y, m, d] = h.holiday_date.split('-').map(Number);
                          const dayDate = new Date(y, m - 1, d);
                          const dayName = WEEKDAY_NAMES_URDU[dayDate.getDay()] || '—';

                          return (
                            <tr key={h.id}>
                              <td style={{ fontWeight: 700 }}>{h.holiday_date}</td>
                              <td>{dayName}</td>
                              <td>{h.title}</td>
                              <td>
                                <button
                                  type="button"
                                  className="payroll-btn-danger"
                                  onClick={() => setHolidayToDelete(h)}
                                  disabled={deletingHolidayId === h.id}
                                >
                                  حذف کریں
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {holidayToDelete && (
                <div className="payroll-modal-overlay" role="dialog" aria-modal="true">
                  <div className="payroll-modal-card">
                    <h2 className="payroll-modal-title">تعطیل حذف کرنے کی تصدیق</h2>
                    <p className="payroll-modal-text">
                      کیا آپ واقعی <strong>{holidayToDelete.title}</strong> مورخہ{' '}
                      <strong>{holidayToDelete.holiday_date}</strong> کو فہرست سے حذف کرنا چاہتے ہیں؟
                    </p>
                    <div className="payroll-modal-actions">
                      <button
                        type="button"
                        className="payroll-btn-secondary"
                        onClick={() => setHolidayToDelete(null)}
                      >
                        منسوخ کریں
                      </button>
                      <button
                        type="button"
                        className="payroll-btn-danger"
                        onClick={handleConfirmDeleteHoliday}
                        disabled={deletingHolidayId === holidayToDelete.id}
                      >
                        {deletingHolidayId === holidayToDelete.id ? 'حذف کیا جا رہا ہے...' : 'ہاں، حذف کریں'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              SUB-TAB 4: چھٹیوں کا ابتدائی حساب
              ========================================================= */}
          {activeSubTab === 'leave_opening' && (
            <div className="payroll-tab-panel">
              {/* Information Banner */}
              <div className="payroll-alert payroll-alert-info">
                <div>
                  <strong>مالی سال کی ابتدا:</strong> {leaveFiscalStartStr} ({leaveFiscalRangeText})
                </div>
                <div className="payroll-leave-info-desc">
                  یہاں سال کے آغاز پر یا سسٹم شروع کرتے وقت ہر استاد کی پہلے سے استعمال شدہ چھٹیاں درج کریں۔
                </div>
              </div>

              {/* Table */}
              <div className="payroll-table-wrapper table-responsive">
                <table className="payroll-table payroll-table-leave">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>ضابطہ نمبر</th>
                      <th style={{ width: '35%' }}>نام عملہ</th>
                      <th style={{ width: '50%' }}>اس مالی سال میں اب تک استعمال شدہ چھٹیاں</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="payroll-empty-state">
                          کوئی فعال استاد موجود نہیں ہے۔
                        </td>
                      </tr>
                    ) : (
                      staffList.map((staff) => {
                        const originalVal = leaveOpeningMap[staff.id];
                        const currentInput =
                          leaveOpeningInputs[staff.id] !== undefined
                            ? leaveOpeningInputs[staff.id]
                            : originalVal !== undefined
                            ? String(originalVal)
                            : '0';

                        return (
                          <tr key={staff.id}>
                            <td style={{ fontWeight: 700 }}>{staff.staff_code || staff.staffCode || '—'}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{staff.name}</div>
                              {staff.father_name && (
                                <div className="payroll-staff-father">
                                  ولدیت: {staff.father_name}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="99.5"
                                  className="payroll-input payroll-input-table"
                                  value={currentInput}
                                  onChange={(e) =>
                                    setLeaveOpeningInputs((prev) => ({
                                      ...prev,
                                      [staff.id]: e.target.value
                                    }))
                                  }
                                  aria-label={`استعمال شدہ چھٹیاں برائے ${staff.name}`}
                                />
                                <span className="payroll-unit-label">دن</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Actions Bar */}
              {staffList.length > 0 && (
                <div className="payroll-actions-bar">
                  <button
                    type="button"
                    className="payroll-btn-primary"
                    disabled={savingLeaveOpening}
                    onClick={handleSaveLeaveOpening}
                  >
                    {savingLeaveOpening ? 'محفوظ کیا جا رہا ہے...' : 'چھٹیوں کا ابتدائی حساب محفوظ کریں'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
