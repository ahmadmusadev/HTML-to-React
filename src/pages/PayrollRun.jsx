import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, isValidUUID } from '../lib/supabaseClient';
import {
  fetchStaffSalaries,
  fetchPayrollSettings,
  fetchHolidays,
  fetchLeaveOpening
} from '../lib/payrollApi';
import {
  fetchRuns,
  fetchRunByMonth,
  createDraftRun,
  fetchRunItems,
  saveRunItems,
  deleteRunItemsForStaff,
  fetchMonthAttendance,
  fetchPriorPaidLeave,
  finalizeRun,
  reopenRun,
  deleteDraftRun,
  setItemPayment,
  updateItemNotes
} from '../lib/payrollRunsApi';
import {
  calculateMonthlyPayroll,
  PAYROLL_REASON_URDU
} from '../utils/PayrollCalc';
import {
  getFiscalYearStart
} from '../utils/PayrollMappers';
import {
  validateAllAdjustments,
  hasUnsavedChanges,
  isoMonthToRunDate,
  monthLabelUrdu,
  dateLabelUrdu,
  canCreateRunForMonth,
  findDrift,
  getFinalizeBlockers,
  totalsFromRows,
  toUrduRunError,
  formatRupees,
  localTodayIso
} from '../utils/PayrollRunLogic';
import './PayrollRun.css';

export default function PayrollRun({ staffList = [], activeMadrasaId, isMadrasaMismatch }) {
  const { role } = useAuth();
  const isAuthorized = role === 'admin' || role === 'super_admin';

  // Current local month YYYY-MM
  const todayMonth = useMemo(() => localTodayIso(new Date()).slice(0, 7), []);
  const todayDate = useMemo(() => localTodayIso(new Date()), []);

  // Selected Month State
  const [selectedMonth, setSelectedMonth] = useState(todayMonth);

  // References to keep current inputs across silent action reloads
  const adjustmentsRef = useRef({});
  const notesRef = useRef({});

  // Core Data States (All state local to component)
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Settings & Runs
  const [savedSettings, setSavedSettings] = useState(null);
  const [settingsMissing, setSettingsMissing] = useState(false);
  const [allRuns, setAllRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [runItems, setRunItems] = useState([]);

  // Adjustments & Notes state (per staff_id)
  const [adjustments, setAdjustments] = useState({});
  const [notesState, setNotesState] = useState({});
  const [paymentDates, setPaymentDates] = useState({});

  // Engine calculation results for draft validation
  const [engineResult, setEngineResult] = useState(null);

  // Modals state
  const [detailItem, setDetailItem] = useState(null);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);

  // Stable reference to staffList to avoid re-fetching on parent re-renders
  const staffListRef = useRef(staffList);
  useEffect(() => {
    staffListRef.current = staffList;
  }, [staffList]);

  // Map of staff by ID
  const staffMap = useMemo(() => {
    const map = new Map();
    for (const s of staffList || []) {
      if (s && s.id) map.set(String(s.id), s);
    }
    return map;
  }, [staffList]);

  /**
   * Loads all runs and payroll settings.
   */
  const loadInitialData = useCallback(async () => {
    if (!isAuthorized || !isValidUUID(activeMadrasaId)) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const [runsData, settingsData] = await Promise.all([
        fetchRuns(supabase, activeMadrasaId),
        fetchPayrollSettings(supabase, activeMadrasaId)
      ]);

      setAllRuns(runsData || []);

      if (!settingsData) {
        setSettingsMissing(true);
        setSavedSettings(null);
      } else {
        setSettingsMissing(false);
        setSavedSettings(settingsData);
      }
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, activeMadrasaId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /**
   * Fetches fresh dependencies and executes pure engine calculation.
   */
  const runEngineCalculation = useCallback(async (currentSettings, currentAdjs = {}) => {
    if (!currentSettings || !isValidUUID(activeMadrasaId)) return null;

    const [yearStr] = selectedMonth.split('-');
    const selectedYear = parseInt(yearStr, 10);
    const fiscalStartMonth = currentSettings.fiscal_year_start_month || 4;
    const currentRunDate = isoMonthToRunDate(selectedMonth);
    const currentFiscalStart = getFiscalYearStart(currentRunDate, fiscalStartMonth);

    // Fetch all fresh engine dependencies
    const [salariesRows, holidaysRows, openingRows, priorPaidMap, attendanceRows] = await Promise.all([
      fetchStaffSalaries(supabase, activeMadrasaId),
      fetchHolidays(supabase, activeMadrasaId, selectedYear),
      fetchLeaveOpening(supabase, activeMadrasaId, currentFiscalStart),
      fetchPriorPaidLeave(supabase, activeMadrasaId, currentFiscalStart, currentRunDate),
      fetchMonthAttendance(supabase, activeMadrasaId, selectedMonth)
    ]);

    const salaries_by_staff_id = {};
    for (const r of salariesRows || []) {
      salaries_by_staff_id[r.staff_id] = Number(r.base_salary);
    }

    const holidays = (holidaysRows || []).map((h) => h.holiday_date);

    const opening_by_staff_id = {};
    for (const r of openingRows || []) {
      opening_by_staff_id[r.staff_id] = Number(r.used_days ?? 0);
    }

    // Build numeric adjustments from current input state
    const cleanAdjs = {};
    for (const staffId of Object.keys(currentAdjs)) {
      const staffAdj = currentAdjs[staffId] || {};
      cleanAdjs[staffId] = {
        bonus: Number(staffAdj.bonus || 0),
        advance_deduction: Number(staffAdj.advance_deduction || 0),
        other_deduction: Number(staffAdj.other_deduction || 0)
      };
    }

    return calculateMonthlyPayroll({
      month: selectedMonth,
      settings: currentSettings,
      holidays,
      staff_list: staffListRef.current,
      salaries_by_staff_id,
      attendance: attendanceRows || [],
      opening_by_staff_id,
      prior_paid_by_staff_id: priorPaidMap || {},
      adjustments_by_staff_id: cleanAdjs
    });
  }, [activeMadrasaId, selectedMonth]);

  /**
   * Loads the run and its items for the currently selected month.
   */
  const loadMonthRun = useCallback(async (options = {}) => {
    const { keepMessages = false } = options;
    if (!isAuthorized || !isValidUUID(activeMadrasaId) || !savedSettings) return;

    if (!keepMessages) {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
    }

    try {
      const runDate = isoMonthToRunDate(selectedMonth);
      const run = await fetchRunByMonth(supabase, activeMadrasaId, runDate);
      setCurrentRun(run);

      if (run) {
        const items = await fetchRunItems(supabase, activeMadrasaId, run.id);
        setRunItems(items || []);

        // Populate inputs from saved rows
        const nextAdjs = {};
        const nextNotes = {};
        const nextPayDates = {};

        for (const item of items || []) {
          nextAdjs[item.staff_id] = {
            bonus: item.bonus !== null && item.bonus !== undefined ? String(item.bonus) : '0',
            advance_deduction: item.advance_deduction !== null && item.advance_deduction !== undefined ? String(item.advance_deduction) : '0',
            other_deduction: item.other_deduction !== null && item.other_deduction !== undefined ? String(item.other_deduction) : '0'
          };
          nextNotes[item.staff_id] = item.notes || '';
          nextPayDates[item.staff_id] = item.paid_on || todayDate;
        }

        if (keepMessages) {
          setAdjustments((prev) => {
            const merged = { ...nextAdjs, ...prev };
            adjustmentsRef.current = merged;
            return merged;
          });
          setNotesState((prev) => {
            const merged = { ...nextNotes, ...prev };
            notesRef.current = merged;
            return merged;
          });
          setPaymentDates((prev) => ({ ...nextPayDates, ...prev }));
        } else {
          setAdjustments(nextAdjs);
          adjustmentsRef.current = nextAdjs;
          setNotesState(nextNotes);
          notesRef.current = nextNotes;
          setPaymentDates(nextPayDates);
        }

        // If draft, run fresh calculation to assess attendance completeness & warnings
        if (run.status === 'draft') {
          const adjsToUse = keepMessages ? { ...nextAdjs, ...adjustmentsRef.current } : nextAdjs;
          const calc = await runEngineCalculation(savedSettings, adjsToUse);
          setEngineResult(calc);
        } else {
          setEngineResult(null);
        }
      } else {
        setRunItems([]);
        setAdjustments({});
        adjustmentsRef.current = {};
        setNotesState({});
        notesRef.current = {};
        setEngineResult(null);
      }
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      if (!keepMessages) {
        setLoading(false);
      }
    }
  }, [isAuthorized, activeMadrasaId, savedSettings, selectedMonth, todayDate, runEngineCalculation]);

  // Trigger loading when savedSettings or selectedMonth changes
  useEffect(() => {
    if (savedSettings) {
      loadMonthRun();
    }
  }, [savedSettings, selectedMonth, loadMonthRun]);

  /**
   * Handles creating a new draft run.
   */
  const handleCreateDraft = async () => {
    if (!savedSettings || !isAuthorized || !isValidUUID(activeMadrasaId)) return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const runDate = isoMonthToRunDate(selectedMonth);

      // 1. Calculate with engine from fresh data
      const calcResult = await runEngineCalculation(savedSettings, {});
      if (!calcResult || calcResult.items.length === 0) {
        setErrorMsg('پے رول کا حساب لگانے کے لیے کوئی فعال استاد یا تنخواہ دستیاب نہیں ہے۔');
        setActionLoading(false);
        return;
      }

      // 2. Create draft run in DB
      const newRun = await createDraftRun(supabase, activeMadrasaId, runDate);

      // 3. Save items to DB
      await saveRunItems(supabase, activeMadrasaId, newRun.id, calcResult.items);

      // 4. Refresh runs list and month data
      const refreshedRuns = await fetchRuns(supabase, activeMadrasaId);
      setAllRuns(refreshedRuns || []);
      setSuccessMsg('ماہانہ پے رول کا مسودہ کامیابی سے تیار ہو گیا ہے۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Handles adjustment input change.
   */
  const handleAdjustmentChange = (staffId, field, value) => {
    setAdjustments((prev) => {
      const next = {
        ...prev,
        [staffId]: {
          ...(prev[staffId] || { bonus: '0', advance_deduction: '0', other_deduction: '0' }),
          [field]: value
        }
      };
      adjustmentsRef.current = next;
      return next;
    });
  };

  /**
   * Handles note input change.
   */
  const handleNoteChange = (staffId, value) => {
    setNotesState((prev) => {
      const next = {
        ...prev,
        [staffId]: value
      };
      notesRef.current = next;
      return next;
    });
  };

  /**
   * Handles saving adjustments ("محفوظ کریں").
   */
  const handleSaveAdjustments = async () => {
    if (!currentRun || currentRun.status !== 'draft' || !savedSettings) return;

    // Validate inputs before calling the engine
    const v = validateAllAdjustments(adjustments, staffMap);
    if (!v.valid) {
      setErrorMsg(v.messageUrdu);
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Recompute with engine
      const calcResult = await runEngineCalculation(savedSettings, adjustments);
      setEngineResult(calcResult);

      // Attach typed notes to items
      const itemsToSave = (calcResult.items || []).map((it) => ({
        ...it,
        notes: notesState[it.staff_id] || ''
      }));

      // Upsert changed items
      await saveRunItems(supabase, activeMadrasaId, currentRun.id, itemsToSave);

      // Delete items for teachers who are no longer calculable
      const notCalculableStaffIds = (calcResult.not_calculable || []).map((nc) => nc.staff_id);
      if (notCalculableStaffIds.length > 0) {
        await deleteRunItemsForStaff(supabase, activeMadrasaId, currentRun.id, notCalculableStaffIds);
      }

      setSuccessMsg('تبدیلیاں کامیابی سے محفوظ ہو گئیں۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Handles re-calculating draft from fresh attendance & data while keeping typed adjustments.
   */
  const handleRecalculateDraft = async () => {
    if (!currentRun || currentRun.status !== 'draft' || !savedSettings) return;

    // Validate inputs before calling the engine
    const v = validateAllAdjustments(adjustments, staffMap);
    if (!v.valid) {
      setErrorMsg(v.messageUrdu);
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const calcResult = await runEngineCalculation(savedSettings, adjustments);
      setEngineResult(calcResult);

      const itemsToSave = (calcResult.items || []).map((it) => ({
        ...it,
        notes: notesState[it.staff_id] || ''
      }));

      await saveRunItems(supabase, activeMadrasaId, currentRun.id, itemsToSave);

      const notCalculableStaffIds = (calcResult.not_calculable || []).map((nc) => nc.staff_id);
      if (notCalculableStaffIds.length > 0) {
        await deleteRunItemsForStaff(supabase, activeMadrasaId, currentRun.id, notCalculableStaffIds);
      }

      setSuccessMsg('تازہ ڈیٹا کے مطابق تنخواہ کا دوبارہ حساب کامیابی سے ہو گیا۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Handles clicking "فائنل کریں": checks drift before opening confirmation modal.
   */
  const handleInitiateFinalize = async () => {
    if (!currentRun || currentRun.status !== 'draft' || !savedSettings) return;

    // 1. Validate inputs before calling the engine
    const v = validateAllAdjustments(adjustments, staffMap);
    if (!v.valid) {
      setErrorMsg(v.messageUrdu);
      return;
    }

    // 2. Unsaved changes guard: do NOT show drift message, do NOT finalize
    if (hasUnsavedChanges(runItems, adjustments, notesState)) {
      setErrorMsg('پہلے تبدیلیاں محفوظ کریں');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');

    try {
      // Re-fetch everything fresh and recompute
      const freshCalc = await runEngineCalculation(savedSettings, adjustments);
      setEngineResult(freshCalc);

      // Check blockers
      const blockers = getFinalizeBlockers({ engineResult: freshCalc, staffList });
      if (blockers.length > 0) {
        setErrorMsg(blockers[0].message);
        setActionLoading(false);
        return;
      }

      // Check drift against stored rows
      const drift = findDrift(runItems, freshCalc.items);
      if (drift.hasDrift) {
        setErrorMsg('ڈیٹا بدل چکا ہے، پہلے دوبارہ حساب کریں۔');
        setActionLoading(false);
        return;
      }

      // No drift & no blockers -> Open Confirm Modal
      setShowFinalizeModal(true);
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Confirms finalization.
   */
  const handleConfirmFinalize = async () => {
    if (!currentRun || currentRun.status !== 'draft') return;

    setActionLoading(true);
    setShowFinalizeModal(false);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await finalizeRun(supabase, activeMadrasaId, currentRun.id);
      const refreshedRuns = await fetchRuns(supabase, activeMadrasaId);
      setAllRuns(refreshedRuns || []);
      setSuccessMsg('ماہانہ پے رول کامیابی سے فائنل اور مقفل ہو گیا ہے۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Confirms deleting draft run.
   */
  const handleConfirmDeleteDraft = async () => {
    if (!currentRun || currentRun.status !== 'draft') return;

    setActionLoading(true);
    setShowDeleteModal(false);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await deleteDraftRun(supabase, activeMadrasaId, currentRun.id);
      const refreshedRuns = await fetchRuns(supabase, activeMadrasaId);
      setAllRuns(refreshedRuns || []);
      setSuccessMsg('پے رول کا مسودہ کامیابی سے حذف ہو گیا۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Confirms reopening finalized run.
   */
  const handleConfirmReopen = async () => {
    if (!currentRun || currentRun.status !== 'finalized') return;

    setActionLoading(true);
    setShowReopenModal(false);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await reopenRun(supabase, activeMadrasaId, currentRun.id);
      const refreshedRuns = await fetchRuns(supabase, activeMadrasaId);
      setAllRuns(refreshedRuns || []);
      setSuccessMsg('پے رول دوبارہ مسودہ بنا دیا گیا ہے۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Sets item payment status.
   */
  const handleSetPayment = async (itemId, paid, paidOnDate) => {
    if (!currentRun || currentRun.status !== 'finalized') return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await setItemPayment(supabase, activeMadrasaId, itemId, {
        paid,
        paid_on: paid ? (paidOnDate || todayDate) : null
      });
      setSuccessMsg(paid ? 'ادائیگی درج ہو گئی ہے۔' : 'ادائیگی منسوخ کر دی گئی ہے۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Saves individual item note in finalized view.
   */
  const handleSaveNote = async (itemId, staffId) => {
    if (!currentRun || currentRun.status !== 'finalized') return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const noteVal = notesState[staffId] || '';
      await updateItemNotes(supabase, activeMadrasaId, itemId, noteVal);
      setSuccessMsg('نوٹ محفوظ ہو گیا۔');
      await loadMonthRun({ keepMessages: true });
    } catch (err) {
      setErrorMsg(toUrduRunError(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Blockers computation for Draft Finalize button
  const finalizeBlockers = useMemo(() => {
    if (!engineResult) return [];
    return getFinalizeBlockers({ engineResult, staffList });
  }, [engineResult, staffList]);

  // Totals from stored items
  const totals = useMemo(() => totalsFromRows(runItems), [runItems]);

  // Can create run for selected month?
  const createCheck = useMemo(() => {
    if (!savedSettings) {
      return { allowed: false, reasonUrdu: 'پہلے ترتیبات ٹیب میں ترتیبات محفوظ کریں۔' };
    }
    return canCreateRunForMonth({
      month: selectedMonth,
      fiscalStartMonth: savedSettings.fiscal_year_start_month || 4,
      runs: allRuns,
      todayMonth
    });
  }, [savedSettings, selectedMonth, allRuns, todayMonth]);

  // Can reopen finalized run?
  const canReopenCheck = useMemo(() => {
    if (!currentRun || currentRun.status !== 'finalized') {
      return { allowed: false, reasonUrdu: '' };
    }
    if (totals.paid_count > 0) {
      return {
        allowed: false,
        reasonUrdu: 'جن اساتذہ کو ادائیگی ہو چکی ہو ان کا پے رول دوبارہ نہیں کھولا جا سکتا۔ پہلے تمام ادائیگیاں منسوخ کریں۔'
      };
    }
    // Is it the latest finalized run?
    const finalizedRuns = (allRuns || [])
      .filter((r) => r.status === 'finalized')
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));

    if (finalizedRuns.length > 0 && finalizedRuns[0].id !== currentRun.id) {
      return {
        allowed: false,
        reasonUrdu: 'صرف سب سے آخری فائنل شدہ مہینے کا پے رول ہی دوبارہ مسودہ بنایا جا سکتا ہے۔'
      };
    }
    return { allowed: true, reasonUrdu: '' };
  }, [currentRun, totals.paid_count, allRuns]);

  // Defense-in-depth Role check
  if (!isAuthorized) {
    return (
      <div className="payroll-run-container">
        <div className="payroll-run-banner payroll-run-banner-error">
          <div className="payroll-run-banner-title">رسائی غیر مجاز</div>
          <div>صرف مہتمم یا ایڈمن کو اس صفحے تک رسائی کی اجازت ہے۔</div>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-run-container" dir="rtl">
      {/* Mismatch Alert */}
      {isMadrasaMismatch && (
        <div className="payroll-run-banner payroll-run-banner-info">
          آپ کا اکاؤنٹ اس ادارے سے منسلک نہیں، اس لیے تنخواہ کا ڈیٹا نظر نہیں آئے گا۔
        </div>
      )}

      {/* Global Alerts */}
      {errorMsg && (
        <div className="payroll-run-banner payroll-run-banner-error" role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="payroll-run-banner payroll-run-banner-info" role="status">
          {successMsg}
        </div>
      )}

      {/* Missing Settings Warning Banner */}
      {settingsMissing && (
        <div className="payroll-run-banner payroll-run-banner-warning">
          <div className="payroll-run-banner-title">ترتیبات غیر موجود ہیں</div>
          <div>پہلے ترتیبات ٹیب میں ترتیبات محفوظ کریں۔</div>
        </div>
      )}

      {/* Top Header Card: Month Picker & Status */}
      <div className="payroll-run-header-card">
        <div className="payroll-run-month-selector">
          <label htmlFor="payroll-month-input" className="payroll-run-label">
            مہینہ منتخب کریں:
          </label>
          <input
            id="payroll-month-input"
            type="month"
            className="payroll-run-month-input"
            value={selectedMonth}
            max={todayMonth}
            onChange={(e) => {
            setSelectedMonth(e.target.value);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          />
          <span className="payroll-run-label">
            ({monthLabelUrdu(selectedMonth)})
          </span>
        </div>

        <div className="payroll-run-status-group">
          {currentRun ? (
            <span
              className={`payroll-status-chip ${
                currentRun.status === 'finalized'
                  ? 'payroll-status-finalized'
                  : 'payroll-status-draft'
              }`}
            >
              {currentRun.status === 'finalized' ? 'فائنل شدہ' : 'مسودہ'}
            </span>
          ) : (
            <span className="payroll-status-chip payroll-status-none">
              مسودہ موجود نہیں
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="payroll-run-empty-box">
          <p>ڈیٹا لوڈ ہو رہا ہے، براہ کرم انتظار فرمائیں...</p>
        </div>
      ) : !savedSettings ? (
        <div className="payroll-run-empty-box">
          <div className="payroll-run-empty-title">ترتیبات درکار ہیں</div>
          <div className="payroll-run-empty-desc">
            ماہانہ پے رول شروع کرنے سے پہلے ترتیبات کے ٹیب میں جا کر ہفتہ وار تعطیلات اور اوقات کی ترتیبات محفوظ فرمائیں۔
          </div>
        </div>
      ) : !currentRun ? (
        /* State: No run for selected month */
        <div className="payroll-run-empty-box">
          <div className="payroll-run-empty-title">
            {monthLabelUrdu(selectedMonth)} کا پے رول مسودہ موجود نہیں ہے
          </div>
          <div className="payroll-run-empty-desc">
            {createCheck.allowed
              ? 'اس مہینے کا نیا پے رول مسودہ بنانے کے لیے نیچے دیے گئے بٹن پر کلک کریں۔'
              : createCheck.reasonUrdu}
          </div>
          {createCheck.allowed && (
            <button
              type="button"
              className="payroll-run-btn-primary"
              disabled={actionLoading}
              onClick={handleCreateDraft}
            >
              {actionLoading ? 'مسودہ تیار کیا جا رہا ہے...' : 'مسودہ بنائیں'}
            </button>
          )}
        </div>
      ) : (
        /* State: Run exists (Draft or Finalized) */
        <>
          {/* Summary Cards */}
          <div className="payroll-run-summary-grid">
            <div className="payroll-run-summary-card">
              <div className="payroll-run-summary-title">کل اساتذہ</div>
              <div className="payroll-run-summary-value">{totals.teachers_count}</div>
            </div>
            <div className="payroll-run-summary-card">
              <div className="payroll-run-summary-title">کل خالص رقم</div>
              <div className="payroll-run-summary-value">{formatRupees(totals.net_total)}</div>
            </div>
            <div className="payroll-run-summary-card">
              <div className="payroll-run-summary-title">کل کٹوتیاں</div>
              <div className="payroll-run-summary-value">{formatRupees(totals.deductions_total)}</div>
            </div>
            {currentRun.status === 'finalized' && (
              <>
                <div className="payroll-run-summary-card">
                  <div className="payroll-run-summary-title">ادا شدہ رقم ({totals.paid_count})</div>
                  <div className="payroll-run-summary-value">{formatRupees(totals.paid_total)}</div>
                </div>
                <div className="payroll-run-summary-card">
                  <div className="payroll-run-summary-title">بقایا رقم ({totals.teachers_count - totals.paid_count})</div>
                  <div className="payroll-run-summary-value">{formatRupees(totals.unpaid_total)}</div>
                </div>
              </>
            )}
          </div>

          {/* Draft Banners: Blockers, Incomplete attendance, warnings */}
          {currentRun.status === 'draft' && (
            <>
              {finalizeBlockers.length > 0 && (
                <div className="payroll-run-banner payroll-run-banner-warning">
                  <div className="payroll-run-banner-title">
                    فائنل کرنے سے پہلے درج ذیل امور درست کریں:
                  </div>
                  <ul className="payroll-run-banner-list">
                    {finalizeBlockers.map((b, idx) => (
                      <li key={idx}>{b.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {engineResult && engineResult.warnings && engineResult.warnings.length > 0 && (
                <div className="payroll-run-banner payroll-run-banner-info">
                  <div className="payroll-run-banner-title">رہنمائی و انتباہات:</div>
                  <ul className="payroll-run-banner-list">
                    {engineResult.warnings.map((w, idx) => (
                      <li key={idx}>{PAYROLL_REASON_URDU[w] || w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Main Payroll Table */}
          <div className="payroll-run-table-wrapper">
            <table className="payroll-run-table">
              <thead>
                <tr>
                  <th>کوڈ</th>
                  <th>استاد کا نام</th>
                  <th>بنیادی تنخواہ</th>
                  <th>قابل ادائیگی دن</th>
                  <th>حاضر</th>
                  <th>غیر حاضر</th>
                  <th>بامعاوضہ رخصت</th>
                  <th>بغیر معاوضہ رخصت</th>
                  <th>کٹوتی منٹ</th>
                  <th>غیر حاضری کٹوتی</th>
                  <th>رخصت کٹوتی</th>
                  <th>منٹ کٹوتی</th>
                  <th>بونس</th>
                  <th>پیشگی کٹوتی</th>
                  <th>دیگر کٹوتی</th>
                  <th>خالص تنخواہ</th>
                  <th>تفصیل</th>
                  {currentRun.status === 'finalized' && <th>ادائیگی کی صورتحال</th>}
                  <th>نوٹس</th>
                </tr>
              </thead>
              <tbody>
                {runItems.length === 0 ? (
                  <tr>
                    <td colSpan={currentRun.status === 'finalized' ? 19 : 18} style={{ textAlign: 'center', padding: '24px' }}>
                      کوئی ریکارڈ موجود نہیں ہے۔
                    </td>
                  </tr>
                ) : (
                  runItems.map((item) => {
                    const staff = staffMap.get(item.staff_id) || {};
                    const staffCode = staff.staff_code || staff.code || item.staff_code || '-';
                    const staffName = staff.name || item.staff_name || 'نامعلوم استاد';

                    const adj = adjustments[item.staff_id] || {
                      bonus: String(item.bonus || 0),
                      advance_deduction: String(item.advance_deduction || 0),
                      other_deduction: String(item.other_deduction || 0)
                    };
                    const noteVal = notesState[item.staff_id] !== undefined ? notesState[item.staff_id] : (item.notes || '');
                    const isDraft = currentRun.status === 'draft';
                    const isPaid = item.payment_status === 'paid';
                    const payDateVal = paymentDates[item.staff_id] || todayDate;

                    return (
                      <tr key={item.id || item.staff_id}>
                        <td>{staffCode}</td>
                        <td>{staffName}</td>
                        <td>{Number(item.base_salary || 0).toLocaleString('en-US')}</td>
                        <td>{item.payable_working_days}</td>
                        <td>{item.present_days}</td>
                        <td>{item.absent_days}</td>
                        <td>{item.paid_leave_days}</td>
                        <td>{item.unpaid_leave_days}</td>
                        <td>
                          {Number(item.late_minutes_charged || 0) + Number(item.early_minutes_charged || 0)}
                        </td>
                        <td>{Number(item.absence_deduction || 0).toLocaleString('en-US')}</td>
                        <td>{Number(item.unpaid_leave_deduction || 0).toLocaleString('en-US')}</td>
                        <td>{Number(item.time_deduction || 0).toLocaleString('en-US')}</td>

                        {/* Bonus */}
                        <td>
                          {isDraft ? (
                            <input
                              type="text"
                              className="payroll-table-input"
                              value={adj.bonus}
                              onChange={(e) => handleAdjustmentChange(item.staff_id, 'bonus', e.target.value)}
                              aria-label={`بونس برائے ${staffName}`}
                            />
                          ) : (
                            Number(item.bonus || 0).toLocaleString('en-US')
                          )}
                        </td>

                        {/* Advance Deduction */}
                        <td>
                          {isDraft ? (
                            <input
                              type="text"
                              className="payroll-table-input"
                              value={adj.advance_deduction}
                              onChange={(e) => handleAdjustmentChange(item.staff_id, 'advance_deduction', e.target.value)}
                              aria-label={`پیشگی کٹوتی برائے ${staffName}`}
                            />
                          ) : (
                            Number(item.advance_deduction || 0).toLocaleString('en-US')
                          )}
                        </td>

                        {/* Other Deduction */}
                        <td>
                          {isDraft ? (
                            <input
                              type="text"
                              className="payroll-table-input"
                              value={adj.other_deduction}
                              onChange={(e) => handleAdjustmentChange(item.staff_id, 'other_deduction', e.target.value)}
                              aria-label={`دیگر کٹوتی برائے ${staffName}`}
                            />
                          ) : (
                            Number(item.other_deduction || 0).toLocaleString('en-US')
                          )}
                        </td>

                        {/* Net Salary */}
                        <td>
                          <strong>{Number(item.net_salary || 0).toLocaleString('en-US')}</strong>
                        </td>

                        {/* Detail Modal Opener */}
                        <td>
                          <button
                            type="button"
                            className="payroll-run-btn-secondary payroll-run-btn-sm"
                            onClick={() => setDetailItem({ ...item, staff_name: staffName, staff_code: staffCode })}
                          >
                            تفصیل
                          </button>
                        </td>

                        {/* Payment Status (Finalized only) */}
                        {currentRun.status === 'finalized' && (
                          <td>
                            {isPaid ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="payroll-status-chip payroll-status-finalized">
                                  ادا شدہ ({item.paid_on ? dateLabelUrdu(item.paid_on) : ''})
                                </span>
                                <button
                                  type="button"
                                  className="payroll-run-btn-secondary payroll-run-btn-sm"
                                  disabled={actionLoading}
                                  onClick={() => handleSetPayment(item.id, false)}
                                >
                                  منسوخ
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="date"
                                  className="payroll-date-input"
                                  value={payDateVal}
                                  onChange={(e) =>
                                    setPaymentDates((prev) => ({
                                      ...prev,
                                      [item.staff_id]: e.target.value
                                    }))
                                  }
                                  aria-label={`ادائیگی کی تاریخ برائے ${staffName}`}
                                />
                                <button
                                  type="button"
                                  className="payroll-run-btn-success payroll-run-btn-sm"
                                  disabled={actionLoading}
                                  onClick={() => handleSetPayment(item.id, true, payDateVal)}
                                >
                                  ادا شدہ
                                </button>
                              </div>
                            )}
                          </td>
                        )}

                        {/* Notes */}
                        <td>
                          {isDraft ? (
                            <input
                              type="text"
                              className="payroll-table-notes-input"
                              value={noteVal}
                              onChange={(e) => handleNoteChange(item.staff_id, e.target.value)}
                              placeholder="کوئی نوٹ لکھیں"
                              aria-label={`نوٹ برائے ${staffName}`}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                className="payroll-table-notes-input"
                                value={noteVal}
                                onChange={(e) => handleNoteChange(item.staff_id, e.target.value)}
                                placeholder="کوئی نوٹ لکھیں"
                                aria-label={`نوٹ برائے ${staffName}`}
                              />
                              <button
                                type="button"
                                className="payroll-run-btn-secondary payroll-run-btn-sm"
                                disabled={actionLoading}
                                onClick={() => handleSaveNote(item.id, item.staff_id)}
                              >
                                محفوظ
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>میزان (کل مجموعہ)</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td colSpan={6} style={{ textAlign: 'left' }}>
                    کل خالص رقم:
                  </td>
                  <td>{Number(totals.net_total || 0).toLocaleString('en-US')}</td>
                  <td colSpan={currentRun.status === 'finalized' ? 3 : 2}>-</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Bar Footer */}
          <div className="payroll-run-actions-bar">
            {currentRun.status === 'draft' ? (
              <>
                <div className="payroll-run-actions-left">
                  <button
                    type="button"
                    className="payroll-run-btn-primary"
                    disabled={actionLoading}
                    onClick={handleSaveAdjustments}
                  >
                    {actionLoading ? 'محفوظ کیا جا رہا ہے...' : 'تبدیلیاں محفوظ کریں'}
                  </button>
                  <button
                    type="button"
                    className="payroll-run-btn-secondary"
                    disabled={actionLoading}
                    onClick={handleRecalculateDraft}
                  >
                    دوبارہ حساب کریں
                  </button>
                  <button
                    type="button"
                    className="payroll-run-btn-danger"
                    disabled={actionLoading}
                    onClick={() => setShowDeleteModal(true)}
                  >
                    مسودہ حذف کریں
                  </button>
                </div>

                <div className="payroll-run-actions-right">
                  <button
                    type="button"
                    className="payroll-run-btn-success"
                    disabled={actionLoading || finalizeBlockers.length > 0}
                    onClick={handleInitiateFinalize}
                  >
                    فائنل کریں
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="payroll-run-actions-left">
                  <span className="payroll-run-label">
                    یہ پے رول فائنل اور مقفل ہے۔
                  </span>
                </div>
                <div className="payroll-run-actions-right">
                  <button
                    type="button"
                    className="payroll-run-btn-danger"
                    disabled={actionLoading || !canReopenCheck.allowed}
                    title={canReopenCheck.reasonUrdu}
                    onClick={() => setShowReopenModal(true)}
                  >
                    فائنل ختم کریں (دوبارہ کھولیں)
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* --- DETAILS MODAL --- */}
      {detailItem && (
        <div className="payroll-run-modal-backdrop" role="dialog" aria-modal="true">
          <div className="payroll-run-modal">
            <div className="payroll-run-modal-header">
              <h2 className="payroll-run-modal-title">
                تنخواہ کا تفصیلی حساب ({detailItem.staff_name})
              </h2>
              <button
                type="button"
                className="payroll-run-btn-secondary payroll-run-btn-sm"
                onClick={() => setDetailItem(null)}
              >
                بند کریں
              </button>
            </div>
            <div className="payroll-run-modal-body">
              <div className="payroll-detail-grid">
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">بنیادی ماہانہ تنخواہ</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.base_salary)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">مہینے کے کل کام کے دن</div>
                  <div className="payroll-detail-item-value">{detailItem.working_days_in_month} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">قابل ادائیگی کام کے دن</div>
                  <div className="payroll-detail-item-value">{detailItem.payable_working_days} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">یومیہ شرح تنخواہ</div>
                  <div className="payroll-detail-item-value">{detailItem.day_rate} روپے</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">روزانہ ڈیوٹی کا وقت</div>
                  <div className="payroll-detail-item-value">{detailItem.shift_minutes} منٹ</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">فی منٹ شرح تنخواہ</div>
                  <div className="payroll-detail-item-value">{detailItem.minute_rate} روپے</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">حاضر دن</div>
                  <div className="payroll-detail-item-value">{detailItem.present_days} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">غیر حاضر دن</div>
                  <div className="payroll-detail-item-value">{detailItem.absent_days} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">بامعاوضہ رخصت</div>
                  <div className="payroll-detail-item-value">{detailItem.paid_leave_days} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">بغیر معاوضہ رخصت</div>
                  <div className="payroll-detail-item-value">{detailItem.unpaid_leave_days} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">رخصت کا بقیہ بیلنس</div>
                  <div className="payroll-detail-item-value">{detailItem.leave_balance_after} دن</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">کٹوتی کے قابل منٹ (تأخیر + قبل از وقت)</div>
                  <div className="payroll-detail-item-value">
                    {Number(detailItem.late_minutes_charged || 0) + Number(detailItem.early_minutes_charged || 0)} منٹ
                  </div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">غیر حاضری کی کٹوتی</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.absence_deduction)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">بغیر معاوضہ رخصت کی کٹوتی</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.unpaid_leave_deduction)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">منٹوں کی کٹوتی</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.time_deduction)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">بونس</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.bonus)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">پیشگی رقم کی واپسی</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.advance_deduction)}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">دیگر کٹوتی</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.other_deduction)}</div>
                </div>
                {Number(detailItem.leave_encashment_amount || 0) > 0 && (
                  <div className="payroll-detail-item">
                    <div className="payroll-detail-item-label">بچی ہوئی رخصتوں کی رقم (انکیشمنٹ)</div>
                    <div className="payroll-detail-item-value">
                      {formatRupees(detailItem.leave_encashment_amount)} ({detailItem.leave_encashment_days} دن)
                    </div>
                  </div>
                )}
                <div className="payroll-detail-item payroll-run-detail-net" style={{ gridColumn: 'span 2' }}>
                  <div className="payroll-detail-item-label">خالص ادا شدہ تنخواہ</div>
                  <div className="payroll-detail-item-value">{formatRupees(detailItem.net_salary)}</div>
                </div>
              </div>
            </div>
            <div className="payroll-run-modal-footer">
              <button
                type="button"
                className="payroll-run-btn-secondary"
                onClick={() => setDetailItem(null)}
              >
                بند کریں
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FINALIZE CONFIRMATION MODAL --- */}
      {showFinalizeModal && (
        <div className="payroll-run-modal-backdrop" role="dialog" aria-modal="true">
          <div className="payroll-run-modal">
            <div className="payroll-run-modal-header">
              <h2 className="payroll-run-modal-title">پے رول فائنل کرنے کی تصدیق</h2>
            </div>
            <div className="payroll-run-modal-body">
              <p>
                کیا آپ واقعی <strong>{monthLabelUrdu(selectedMonth)}</strong> کا پے رول فائنل کرنا چاہتے ہیں؟
              </p>
              <div className="payroll-detail-grid">
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">کل شامل اساتذہ</div>
                  <div className="payroll-detail-item-value">{totals.teachers_count}</div>
                </div>
                <div className="payroll-detail-item">
                  <div className="payroll-detail-item-label">کل کٹوتیاں</div>
                  <div className="payroll-detail-item-value">{formatRupees(totals.deductions_total)}</div>
                </div>
                <div className="payroll-detail-item" style={{ gridColumn: 'span 2' }}>
                  <div className="payroll-detail-item-label">کل خالص واجب الادا رقم</div>
                  <div className="payroll-detail-item-value">{formatRupees(totals.net_total)}</div>
                </div>
              </div>
              <p className="payroll-run-warning-text">
                تنبیہ: فائنل کرنے کے بعد تمام اعداد و شمار مقفل ہو جائیں گے اور صرف ادائیگیاں درج کی جا سکیں گی۔
              </p>
            </div>
            <div className="payroll-run-modal-footer">
              <button
                type="button"
                className="payroll-run-btn-secondary"
                disabled={actionLoading}
                onClick={() => setShowFinalizeModal(false)}
              >
                منسوخ کریں
              </button>
              <button
                type="button"
                className="payroll-run-btn-success"
                disabled={actionLoading}
                onClick={handleConfirmFinalize}
              >
                {actionLoading ? 'فائنل کیا جا رہا ہے...' : 'ہاں، فائنل کریں'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE DRAFT CONFIRMATION MODAL --- */}
      {showDeleteModal && (
        <div className="payroll-run-modal-backdrop" role="dialog" aria-modal="true">
          <div className="payroll-run-modal">
            <div className="payroll-run-modal-header">
              <h2 className="payroll-run-modal-title">مسودہ حذف کرنے کی تصدیق</h2>
            </div>
            <div className="payroll-run-modal-body">
              <p>
                کیا آپ واقعی <strong>{monthLabelUrdu(selectedMonth)}</strong> کا پے رول مسودہ حذف کرنا چاہتے ہیں؟ اس سے تمام عارضی اندراجات ختم ہو جائیں گے۔
              </p>
            </div>
            <div className="payroll-run-modal-footer">
              <button
                type="button"
                className="payroll-run-btn-secondary"
                disabled={actionLoading}
                onClick={() => setShowDeleteModal(false)}
              >
                منسوخ کریں
              </button>
              <button
                type="button"
                className="payroll-run-btn-danger"
                disabled={actionLoading}
                onClick={handleConfirmDeleteDraft}
              >
                {actionLoading ? 'حذف کیا جا رہا ہے...' : 'ہاں، مسودہ حذف کریں'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REOPEN CONFIRMATION MODAL --- */}
      {showReopenModal && (
        <div className="payroll-run-modal-backdrop" role="dialog" aria-modal="true">
          <div className="payroll-run-modal">
            <div className="payroll-run-modal-header">
              <h2 className="payroll-run-modal-title">پے رول دوبارہ کھولنے کی تصدیق</h2>
            </div>
            <div className="payroll-run-modal-body">
              <p>
                کیا آپ واقعی <strong>{monthLabelUrdu(selectedMonth)}</strong> کے فائنل شدہ پے رول کا قفل کھول کر اسے دوبارہ مسودہ بنانا چاہتے ہیں؟
              </p>
            </div>
            <div className="payroll-run-modal-footer">
              <button
                type="button"
                className="payroll-run-btn-secondary"
                disabled={actionLoading}
                onClick={() => setShowReopenModal(false)}
              >
                منسوخ کریں
              </button>
              <button
                type="button"
                className="payroll-run-btn-danger"
                disabled={actionLoading}
                onClick={handleConfirmReopen}
              >
                {actionLoading ? 'کھولا جا رہا ہے...' : 'ہاں، دوبارہ کھولیں'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
