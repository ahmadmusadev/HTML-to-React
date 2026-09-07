import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isValidUUID } from '../lib/supabaseClient';
import { DEFAULT_CLASSES } from '../constants/defaults';
import {
  enqueueWrite,
  getQueue,
  isNetworkError,
  flushQueue,
  subscribeSyncQueue,
  SYNC_QUEUE_STORAGE_KEY
} from '../utils/syncQueue';

const MadrasaContext = createContext();

const DEFAULT_MADRASAS = [
  { id: 'madrasa_1', name: 'جامعہ حفظ منیجر — مرکزی شاخ' },
  { id: 'madrasa_2', name: 'جامعہ حفظ منیجر — فرعی شاخ 2' },
  { id: 'madrasa_3', name: 'جامعہ حفظ منیجر — فرعی شاخ 3' }
];

export function MadrasaProvider({ children }) {
  const [madrasas, setMadrasas] = useState(() => {
    try {
      const stored = localStorage.getItem('hf_madrasas_v1');
      return stored ? JSON.parse(stored) : DEFAULT_MADRASAS;
    } catch (e) {
      return DEFAULT_MADRASAS;
    }
  });

  const [activeMadrasaId, setActiveMadrasaId] = useState(() => {
    return localStorage.getItem('hf_active_madrasa_id') || 'madrasa_1';
  });

  const [logos, setLogos] = useState(() => {
    try {
      const stored = localStorage.getItem('hf_madrasa_logos_v1');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const [pendingSyncCount, setPendingSyncCount] = useState(() => getQueue().length);

  // Auto-flush effect: on mount if online, on 'online' event, and subscribe to queue changes
  useEffect(() => {
    const unsubscribe = subscribeSyncQueue((count) => {
      setPendingSyncCount(count);
    });

    const triggerFlush = async () => {
      if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          await flushQueue(supabase);
          setPendingSyncCount(getQueue().length);
        } catch (flushErr) {
          console.warn('[MadrasaContext] Auto-flush encountered error:', flushErr);
        }
      }
    };

    const handleOnline = () => {
      triggerFlush();
    };

    const handleStorage = (e) => {
      if (e.key === SYNC_QUEUE_STORAGE_KEY) {
        setPendingSyncCount(getQueue().length);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('storage', handleStorage);
    }

    // Flush once on mount if online
    triggerFlush();

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('storage', handleStorage);
      }
    };
  }, []);

  // Auto-migrate legacy 'hf_records_v1' to 'hf_records_v1_madrasa_1'
  useEffect(() => {
    try {
      const legacy = localStorage.getItem('hf_records_v1');
      const primaryKey = 'hf_records_v1_madrasa_1';
      if (legacy && !localStorage.getItem(primaryKey)) {
        localStorage.setItem(primaryKey, legacy);
      }
    } catch (e) {
      console.error('Migration error', e);
    }
  }, []);

  // Helper to resolve storage key scoped to a madrasa
  const getStorageKey = (baseKey = 'hf_records_v1', madrasaId = activeMadrasaId) => {
    const key = `${baseKey}_${madrasaId}`;
    if (madrasaId === 'madrasa_1') {
      try {
        if (!localStorage.getItem(key) && localStorage.getItem(baseKey)) {
          localStorage.setItem(key, localStorage.getItem(baseKey));
        }
      } catch (e) {}
    }
    return key;
  };

  // Helper to load scoped data
  const loadMadrasaData = (baseKey = 'hf_records_v1', madrasaId = activeMadrasaId) => {
    try {
      const key = getStorageKey(baseKey, madrasaId);
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
      if (madrasaId === 'madrasa_1') {
        const legacy = localStorage.getItem(baseKey);
        if (legacy) return JSON.parse(legacy);
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper to save scoped data
  const saveMadrasaData = (baseKey = 'hf_records_v1', data = {}, madrasaId = activeMadrasaId) => {
    try {
      const key = getStorageKey(baseKey, madrasaId);
      localStorage.setItem(key, JSON.stringify(data));
      if (madrasaId === 'madrasa_1') {
        localStorage.setItem(baseKey, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Failed to save data to localStorage (possible quota exceeded):', e);
      alert('⚠️ ڈیٹا محفوظ نہیں ہو سکا — براؤزر اسٹوریج بھر چکا ہے یا پرائیویٹ موڈ میں ہے۔');
    }
  };

  // Save madrasa list to local storage
  useEffect(() => {
    try {
      localStorage.setItem('hf_madrasas_v1', JSON.stringify(madrasas));
    } catch (e) {}
  }, [madrasas]);

  // Save active madrasa ID to local storage
  useEffect(() => {
    try {
      localStorage.setItem('hf_active_madrasa_id', activeMadrasaId);
    } catch (e) {}
  }, [activeMadrasaId]);

  // Save logos to local storage
  useEffect(() => {
    try {
      localStorage.setItem('hf_madrasa_logos_v1', JSON.stringify(logos));
    } catch (e) {}
  }, [logos]);

  const activeMadrasa = madrasas.find(m => m.id === activeMadrasaId) || madrasas[0] || DEFAULT_MADRASAS[0];
  const activeLogo = logos[activeMadrasaId] || null;

  const uploadLogo = (file, madrasaId = activeMadrasaId) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target.result;
        setLogos(prev => {
          const next = { ...prev, [madrasaId]: base64Url };
          try {
            localStorage.setItem('hf_madrasa_logos_v1', JSON.stringify(next));
          } catch (err) {}
          return next;
        });
        resolve(base64Url);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const removeLogo = (madrasaId = activeMadrasaId) => {
    setLogos(prev => {
      const next = { ...prev };
      delete next[madrasaId];
      try {
        localStorage.setItem('hf_madrasa_logos_v1', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  const switchMadrasa = (id) => {
    setActiveMadrasaId(id);
  };

  const addMadrasa = (name) => {
    if (!name.trim()) return;
    const newId = `madrasa_${Date.now()}`;
    const newMadrasa = { id: newId, name: name.trim() };
    setMadrasas(prev => [...prev, newMadrasa]);
    setActiveMadrasaId(newId);
  };

  const deleteMadrasa = (id) => {
    if (madrasas.length <= 1) return;
    setMadrasas(prev => {
      const remaining = prev.filter(m => m.id !== id);
      if (activeMadrasaId === id) {
        setActiveMadrasaId(remaining[0]?.id || 'madrasa_1');
      }
      return remaining;
    });
  };

  const renameMadrasa = (id, newName) => {
    if (!id || !newName || !newName.trim()) return;
    setMadrasas(prev => prev.map(m => m.id === id ? { ...m, name: newName.trim() } : m));
  };

  // --- SUPABASE LIVE DATA FETCHERS WITH RESILIENT LOCAL FALLBACK ---
  const FETCH_ERROR_URDU = 'سرور سے رابطہ نہ ہو سکا۔ برائے مہربانی اپنا انٹرنیٹ کنکشن چیک کریں یا دوبارہ کوشش کریں۔';

  const fetchStudentsFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return local?.records || [];
    }

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('madrasa_id', madrasaId);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase students fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      if (local?.records) return local.records;
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const fetchHifzRecordsFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return local?.monthlyExams || [];
    }

    try {
      const { data, error } = await supabase
        .from('hifz_records')
        .select('*, students(name, roll_number)')
        .eq('madrasa_id', madrasaId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase Hifz records fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      if (local?.monthlyExams) return local.monthlyExams;
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const fetchFeesFromSupabase = async (madrasaId = activeMadrasaId, filters = {}) => {
    let mId = madrasaId;
    let flt = filters;
    if (typeof madrasaId === 'object' && madrasaId !== null) {
      flt = madrasaId;
      mId = activeMadrasaId;
    }
    if (!mId) mId = activeMadrasaId;

    if (!isValidUUID(mId)) {
      const local = loadMadrasaData('hf_fees_v1', mId);
      if (local?.fees) return local.fees;
      const legacy = loadMadrasaData('hf_records_v1', mId);
      return (legacy?.records || []).filter(r => r.isFeeRecord);
    }

    try {
      let query = supabase
        .from('fees')
        .select('*, students(id, name, roll_number, father_name)')
        .eq('madrasa_id', mId);

      if (flt?.month_year) {
        query = query.eq('month_year', flt.month_year);
      }

      query = query.order('paid_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fees fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_fees_v1', mId);
      if (local?.fees) return local.fees;
      const legacy = loadMadrasaData('hf_records_v1', mId);
      if (legacy?.records) return legacy.records.filter(r => r.isFeeRecord);
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const addFeeToSupabase = async (feeData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId);

    if (isRemote) {
      const payload = {
        student_id: feeData.student_id,
        madrasa_id: madrasaId,
        invoice_id: feeData.invoice_id,
        amount: Number(feeData.amount) || 0,
        arrears: Number(feeData.arrears) || 0,
        payment_method: feeData.payment_method || 'Cash',
        month_year: feeData.month_year,
        status: feeData.status || 'paid',
        paid_at: feeData.paid_at || new Date().toISOString()
      };

      // If explicitly offline before call, queue directly without attempting fetch
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueueWrite({
          table: 'fees',
          operation: 'insert',
          payload,
          madrasaId
        });

        const queuedRecord = {
          id: `fee_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...payload,
          created_at: new Date().toISOString(),
          students: feeData.students || null,
          queued: true
        };

        try {
          const localData = loadMadrasaData('hf_fees_v1', madrasaId) || { fees: [] };
          localData.fees = [queuedRecord, ...(localData.fees || [])];
          saveMadrasaData('hf_fees_v1', localData, madrasaId);
        } catch (syncErr) {
          console.warn('Failed to sync offline fee to local cache:', syncErr);
        }

        return queuedRecord;
      }

      try {
        const { data, error } = await supabase
          .from('fees')
          .insert([payload])
          .select('*, students(id, name, roll_number, father_name)')
          .single();

        if (error) throw error;

        // Also sync to local storage cache
        try {
          const localData = loadMadrasaData('hf_fees_v1', madrasaId) || { fees: [] };
          localData.fees = [data, ...(localData.fees || [])];
          saveMadrasaData('hf_fees_v1', localData, madrasaId);
        } catch (syncErr) {
          console.warn('Failed to sync fee to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        // Only queue on genuine network errors; database/app errors throw immediately as today
        if (isNetworkError(e)) {
          console.warn('Network error detected in addFeeToSupabase, enqueueing write for sync:', e);
          enqueueWrite({
            table: 'fees',
            operation: 'insert',
            payload,
            madrasaId
          });

          const queuedRecord = {
            id: `fee_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...payload,
            created_at: new Date().toISOString(),
            students: feeData.students || null,
            queued: true
          };

          try {
            const localData = loadMadrasaData('hf_fees_v1', madrasaId) || { fees: [] };
            localData.fees = [queuedRecord, ...(localData.fees || [])];
            saveMadrasaData('hf_fees_v1', localData, madrasaId);
          } catch (syncErr) {
            console.warn('Failed to sync offline fee to local cache:', syncErr);
          }

          return queuedRecord;
        }

        console.error('Supabase add fee error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local storage fallback for offline / mock madrasa
      const localId = `fee_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const localRecord = {
        id: localId,
        student_id: feeData.student_id,
        madrasa_id: madrasaId,
        invoice_id: feeData.invoice_id,
        amount: Number(feeData.amount) || 0,
        arrears: Number(feeData.arrears) || 0,
        payment_method: feeData.payment_method || 'Cash',
        month_year: feeData.month_year,
        status: feeData.status || 'paid',
        paid_at: feeData.paid_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
        students: feeData.students || null
      };
      const localData = loadMadrasaData('hf_fees_v1', madrasaId) || { fees: [] };
      localData.fees = [localRecord, ...(localData.fees || [])];
      saveMadrasaData('hf_fees_v1', localData, madrasaId);
      return localRecord;
    }
  };

  const fetchClassesFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      return (DEFAULT_CLASSES || []).map(c => ({
        id: c.id,
        name: c.name || '',
        class_name: c.name || ''
      }));
    }

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('madrasa_id', madrasaId);

      if (error) throw error;
      if (data && data.length > 0) {
        return data.map(c => ({
          id: c.id,
          name: c.class_name || c.name || '',
          class_name: c.class_name || c.name || ''
        }));
      }
      return DEFAULT_CLASSES;
    } catch (e) {
      console.warn('Supabase classes fetch failed, falling back to defaults:', e.message || e);
      return DEFAULT_CLASSES;
    }
  };

  const addStudentToSupabase = async (studentData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId);

    if (isRemote) {
      try {
        const payload = {
          ...studentData,
          madrasa_id: madrasaId,
          class_id: isValidUUID(studentData.class_id) ? studentData.class_id : null
        };
        const { data, error } = await supabase
          .from('students')
          .insert([payload])
          .select('*, classes(class_name)')
          .single();

        if (error) throw error;

        // Also sync to local storage cache
        try {
          const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
          localData.records = [...(localData.records || []), data];
          saveMadrasaData('hf_records_v1', localData, madrasaId);
        } catch (syncErr) {
          console.warn('Failed to sync to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase add student error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local storage fallback for offline / mock madrasa
      const localId = `std_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const localRecord = {
        id: localId,
        ...studentData,
        madrasa_id: madrasaId,
        created_at: new Date().toISOString()
      };
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
      localData.records = [...(localData.records || []), localRecord];
      saveMadrasaData('hf_records_v1', localData, madrasaId);
      return localRecord;
    }
  };

  const updateStudentInSupabase = async (id, studentData) => {
    const isRemote = isValidUUID(id);

    if (isRemote) {
      try {
        const payload = {
          ...studentData,
          class_id: isValidUUID(studentData.class_id) ? studentData.class_id : null
        };
        const { data, error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', id)
          .select('*, classes(class_name)')
          .single();

        if (error) throw error;
        return data;
      } catch (e) {
        console.error('Supabase update student error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Update in local storage
      const localData = loadMadrasaData('hf_records_v1', activeMadrasaId) || { records: [] };
      localData.records = (localData.records || []).map(r => r.id === id ? { ...r, ...studentData } : r);
      saveMadrasaData('hf_records_v1', localData, activeMadrasaId);
      return { id, ...studentData };
    }
  };

  const withdrawStudentInSupabase = async (id, withdrawalDate, withdrawalReason) => {
    const isRemote = isValidUUID(id);

    if (isRemote) {
      try {
        const payload = {
          status: 'left',
          withdrawal_date: withdrawalDate || null,
          withdrawal_reason: withdrawalReason || null
        };
        const { data, error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', id)
          .select('*, classes(class_name)')
          .single();

        if (error) throw error;
        return data;
      } catch (e) {
        console.error('Supabase withdraw student error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      const localData = loadMadrasaData('hf_records_v1', activeMadrasaId) || { records: [] };
      localData.records = (localData.records || []).map(r =>
        r.id === id ? { ...r, status: 'left', withdrawal_date: withdrawalDate, withdrawal_reason: withdrawalReason } : r
      );
      saveMadrasaData('hf_records_v1', localData, activeMadrasaId);
      return { id, status: 'left', withdrawal_date: withdrawalDate, withdrawal_reason: withdrawalReason };
    }
  };

  const fetchHifzHalfYearRecordsFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return (local?.records || []).filter(r => r && r.name && !r.isAdmissionProfile && !r.isFeeRecord);
    }

    try {
      const { data, error } = await supabase
        .from('hifz_half_year_records')
        .select('*, students(id, name, roll_number, father_name, hifz_start_date)')
        .eq('madrasa_id', madrasaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase hifz half-year records fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      if (local?.records) {
        return local.records.filter(r => r && r.name && !r.isAdmissionProfile && !r.isFeeRecord);
      }
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const saveHifzHalfYearRecordToSupabase = async (recordData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId) && isValidUUID(recordData.student_id);

    if (isRemote) {
      try {
        const payload = {
          madrasa_id: madrasaId,
          student_id: recordData.student_id,
          hifz_year: Number(recordData.hifz_year),
          half_year: Number(recordData.half_year),
          total_pages: Number(recordData.total_pages) || 0,
          pao: Number(recordData.pao) || 0,
          juz: Number(recordData.juz) || 0,
          pct: Number(recordData.pct) || 0,
          score: Number(recordData.score) || 0,
          total_working: Number(recordData.total_working) || 0,
          total_present: Number(recordData.total_present) || 0,
          total_absent: Number(recordData.total_absent) || 0,
          total_leave: Number(recordData.total_leave) || 0,
          attendance_pct: Number(recordData.attendance_pct) || 0,
          monthly_academic_details: recordData.monthly_academic_details || {},
          monthly_attendance_details: recordData.monthly_attendance_details || {},
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('hifz_half_year_records')
          .upsert(payload, { onConflict: 'student_id,hifz_year,half_year' })
          .select('*, students(id, name, roll_number, father_name, hifz_start_date)')
          .single();

        if (error) throw error;

        // Also sync to local cache
        try {
          const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
          const recs = localData.records || [];
          const idx = recs.findIndex(r =>
            r.isAdmissionProfile !== true &&
            (r.student_id === recordData.student_id || r.id === data.id) &&
            Number(r.year || r.hifz_year) === Number(recordData.hifz_year) &&
            Number(r.halfYear || r.half_year) === Number(recordData.half_year)
          );
          const cachedRec = {
            id: data.id,
            student_id: data.student_id,
            name: data.students?.name || recordData.student_name,
            year: data.hifz_year,
            hifz_year: data.hifz_year,
            halfYear: data.half_year,
            half_year: data.half_year,
            pages: data.total_pages,
            total_pages: data.total_pages,
            pao: data.pao,
            juz: data.juz,
            pct: data.pct,
            score: data.score,
            attendance: {
              working: data.total_working,
              present: data.total_present,
              absent: data.total_absent,
              leave: data.total_leave,
              pct: data.attendance_pct,
              monthlyDetails: data.monthly_attendance_details
            },
            monthlyAcademicDetails: data.monthly_academic_details,
            ts: data.updated_at || data.created_at || new Date().toISOString()
          };
          if (idx > -1) recs[idx] = cachedRec;
          else recs.unshift(cachedRec);
          localData.records = recs;
          saveMadrasaData('hf_records_v1', localData, madrasaId);
        } catch (syncErr) {
          console.warn('Local cache sync warning:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase save Hifz half-year record error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local storage fallback
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
      const records = localData.records || [];
      const studentName = recordData.student_name || recordData.name || '';
      const existingIdx = records.findIndex(r =>
        !r.isAdmissionProfile &&
        Number(r.year || r.hifz_year) === Number(recordData.hifz_year) &&
        Number(r.halfYear || r.half_year) === Number(recordData.half_year) &&
        ((recordData.student_id && (r.student_id === recordData.student_id || r.id === recordData.student_id)) ||
         (studentName && r.name === studentName))
      );

      const localRec = {
        id: recordData.id || `rec_${Date.now()}`,
        student_id: recordData.student_id,
        name: studentName,
        year: Number(recordData.hifz_year),
        hifz_year: Number(recordData.hifz_year),
        halfYear: Number(recordData.half_year),
        half_year: Number(recordData.half_year),
        pages: Number(recordData.total_pages) || 0,
        total_pages: Number(recordData.total_pages) || 0,
        pao: Number(recordData.pao) || 0,
        juz: Number(recordData.juz) || 0,
        pct: Number(recordData.pct) || 0,
        score: Number(recordData.score) || 0,
        attendance: {
          working: Number(recordData.total_working) || 0,
          present: Number(recordData.total_present) || 0,
          absent: Number(recordData.total_absent) || 0,
          leave: Number(recordData.total_leave) || 0,
          pct: Number(recordData.attendance_pct) || 0,
          monthlyDetails: recordData.monthly_attendance_details || {}
        },
        monthlyAcademicDetails: recordData.monthly_academic_details || {},
        ts: new Date().toISOString()
      };

      if (existingIdx > -1) {
        records[existingIdx] = { ...records[existingIdx], ...localRec };
      } else {
        records.unshift(localRec);
      }
      localData.records = records;
      saveMadrasaData('hf_records_v1', localData, madrasaId);
      return localRec;
    }
  };

  const deleteHifzHalfYearRecordFromSupabase = async (id, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(id);

    if (isRemote) {
      try {
        const { error } = await supabase
          .from('hifz_half_year_records')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (e) {
        console.error('Supabase delete Hifz half-year record error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    }

    // Also update local cache
    const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
    localData.records = (localData.records || []).filter(r => r.id !== id && r.ts !== id);
    saveMadrasaData('hf_records_v1', localData, madrasaId);
  };

  const updateStudentHifzStartDate = async (studentId, hifzStartDate, madrasaId = activeMadrasaId) => {
    if (!studentId) return;
    const isRemote = isValidUUID(studentId);

    if (isRemote) {
      try {
        const { data, error } = await supabase
          .from('students')
          .update({ hifz_start_date: hifzStartDate || null })
          .eq('id', studentId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (e) {
        console.warn('Supabase update student hifz_start_date warning:', e.message || e);
      }
    } else {
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || { records: [] };
      localData.records = (localData.records || []).map(r =>
        (r.id === studentId || r.admRegNo === studentId) ? { ...r, hifz_start_date: hifzStartDate, startDate: hifzStartDate } : r
      );
      saveMadrasaData('hf_records_v1', localData, madrasaId);
    }
  };

  const fetchStudentAttendanceFromSupabase = async (filters = {}, madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const localCustom = loadMadrasaData('hf_student_attendance_v1', madrasaId) || [];
      return localCustom;
    }

    try {
      let query = supabase
        .from('student_attendance')
        .select('*, students(id, name, roll_number, father_name, class_id)')
        .eq('madrasa_id', madrasaId);

      if (filters.date) {
        query = query.eq('date', filters.date);
      }
      if (filters.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      if (filters.startDate && filters.endDate) {
        query = query.gte('date', filters.startDate).lte('date', filters.endDate);
      } else if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      } else if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.month) {
        const start = `${filters.month}-01`;
        const [y, m] = filters.month.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${filters.month}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', start).lte('date', end);
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase student attendance fetch failed, falling back to local:', e.message || e);
      const localCustom = loadMadrasaData('hf_student_attendance_v1', madrasaId) || [];
      return localCustom;
    }
  };

  const saveStudentAttendanceToSupabase = async (recordsArray, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId);
    const records = Array.isArray(recordsArray) ? recordsArray : [recordsArray];
    if (!records.length) return [];

    if (isRemote) {
      try {
        const payload = records.map(r => ({
          madrasa_id: madrasaId,
          student_id: r.student_id || r.studentUuid,
          date: r.date,
          status: r.status,
          remarks: r.remarks || null,
          updated_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
          .from('student_attendance')
          .upsert(payload, { onConflict: 'student_id,date' })
          .select('*, students(id, name, roll_number, father_name, class_id)');

        if (error) throw error;

        // Sync to local cache
        try {
          const cached = loadMadrasaData('hf_student_attendance_v1', madrasaId) || [];
          const updatedMap = new Map();
          cached.forEach(c => updatedMap.set(`${c.student_id}_${c.date}`, c));
          (data || []).forEach(d => updatedMap.set(`${d.student_id}_${d.date}`, d));
          saveMadrasaData('hf_student_attendance_v1', Array.from(updatedMap.values()), madrasaId);
        } catch (syncErr) {
          console.warn('Failed to sync attendance to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase save student attendance error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const cached = loadMadrasaData('hf_student_attendance_v1', madrasaId) || [];
      const updatedMap = new Map();
      cached.forEach(c => updatedMap.set(`${c.student_id}_${c.date}`, c));

      const newRows = records.map(r => ({
        id: r.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        madrasa_id: madrasaId,
        student_id: r.student_id || r.studentUuid,
        date: r.date,
        status: r.status,
        remarks: r.remarks || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        students: r.students || null
      }));

      newRows.forEach(row => updatedMap.set(`${row.student_id}_${row.date}`, row));
      const finalArr = Array.from(updatedMap.values());
      saveMadrasaData('hf_student_attendance_v1', finalArr, madrasaId);
      return newRows;
    }
  };

  const fetchStaffFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return local?.staffProfiles || [];
    }

    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*, classes(id, class_name)')
        .eq('madrasa_id', madrasaId)
        .order('staff_code', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase staff fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      if (local?.staffProfiles) return local.staffProfiles;
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const addStaffToSupabase = async (staffData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId);

    if (isRemote) {
      const getNextCode = async () => {
        const { data: maxRows, error: maxError } = await supabase
          .from('staff')
          .select('staff_code')
          .eq('madrasa_id', madrasaId)
          .order('staff_code', { ascending: false })
          .limit(1);

        if (maxError) throw maxError;
        const highest = maxRows && maxRows.length > 0 && maxRows[0].staff_code ? Number(maxRows[0].staff_code) : 1000;
        return highest + 1;
      };

      const insertWithRetry = async (attempt = 1) => {
        try {
          let code = staffData.staff_code || (staffData.staffCode ? Number(staffData.staffCode) : null);
          if (!code) {
            code = await getNextCode();
          }

          const payload = {
            madrasa_id: madrasaId,
            staff_code: code,
            name: (staffData.name || '').trim(),
            father_name: (staffData.father_name || staffData.fatherName || '').trim(),
            cnic: staffData.cnic ? String(staffData.cnic).trim() : null,
            assigned_class_id: isValidUUID(staffData.assigned_class_id || staffData.assignedClass)
              ? (staffData.assigned_class_id || staffData.assignedClass)
              : null,
            phone: (staffData.phone || '').trim(),
            whatsapp: staffData.whatsapp ? String(staffData.whatsapp).trim() : null,
            residence_status: staffData.residence_status || staffData.residenceStatus || 'ذاتی مکان',
            address: staffData.address ? String(staffData.address).trim() : null,
            qualification: staffData.qualification ? String(staffData.qualification).trim() : null,
            joining_date: staffData.joining_date || staffData.joiningDate || null,
            shift_start: staffData.shift_start || staffData.shiftStart || '06:50',
            shift_end: staffData.shift_end || staffData.shiftEnd || '14:45',
            experience: staffData.experience ? String(staffData.experience).trim() : null,
            reference: staffData.reference ? String(staffData.reference).trim() : null,
            notes: staffData.notes ? String(staffData.notes).trim() : null,
            ...(isValidUUID(staffData.profile_id || staffData.profileId)
              ? { profile_id: staffData.profile_id || staffData.profileId }
              : {})
          };

          const { data, error } = await supabase
            .from('staff')
            .insert([payload])
            .select('*, classes(id, class_name)')
            .single();

          if (error) {
            if ((error.code === '23505' || String(error.message).includes('unique') || String(error.message).includes('staff_code')) && attempt <= 2) {
              staffData.staff_code = null;
              staffData.staffCode = null;
              return await insertWithRetry(attempt + 1);
            }
            throw error;
          }

          // Sync to local cache
          try {
            const localData = loadMadrasaData('hf_records_v1', madrasaId) || {};
            const profiles = localData.staffProfiles || [];
            localData.staffProfiles = [...profiles, data];
            localData.staffIdCounter = Math.max(Number(localData.staffIdCounter || 1000), Number(data.staff_code || 1000) + 1);
            saveMadrasaData('hf_records_v1', localData, madrasaId);
          } catch (syncErr) {
            console.warn('Local cache sync warning:', syncErr);
          }

          return data;
        } catch (e) {
          if (attempt <= 1 && (e.code === '23505' || String(e.message).includes('unique') || String(e.message).includes('staff_code'))) {
            staffData.staff_code = null;
            staffData.staffCode = null;
            return await insertWithRetry(attempt + 1);
          }
          console.error('Supabase add staff error:', e.message || e);
          throw new Error(e.message || FETCH_ERROR_URDU);
        }
      };

      return await insertWithRetry();
    } else {
      // Local fallback
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || {};
      const profiles = localData.staffProfiles || [];
      const maxCode = profiles.reduce((max, s) => Math.max(max, Number(s.staffCode || s.staff_code || 0)), 1000);
      const newCode = maxCode + 1;
      const localRecord = {
        id: `staff-${Date.now()}`,
        staff_code: newCode,
        staffCode: newCode,
        name: (staffData.name || '').trim(),
        father_name: (staffData.father_name || staffData.fatherName || '').trim(),
        fatherName: (staffData.father_name || staffData.fatherName || '').trim(),
        cnic: staffData.cnic || '',
        assigned_class_id: staffData.assigned_class_id || staffData.assignedClass || '',
        assignedClass: staffData.assigned_class_id || staffData.assignedClass || '',
        phone: (staffData.phone || '').trim(),
        whatsapp: staffData.whatsapp || '',
        residence_status: staffData.residence_status || staffData.residenceStatus || 'ذاتی مکان',
        residenceStatus: staffData.residence_status || staffData.residenceStatus || 'ذاتی مکان',
        address: staffData.address || '',
        qualification: staffData.qualification || '',
        joining_date: staffData.joining_date || staffData.joiningDate || '',
        joiningDate: staffData.joining_date || staffData.joiningDate || '',
        shift_start: staffData.shift_start || staffData.shiftStart || '06:50',
        shiftStart: staffData.shift_start || staffData.shiftStart || '06:50',
        shift_end: staffData.shift_end || staffData.shiftEnd || '14:45',
        shiftEnd: staffData.shift_end || staffData.shiftEnd || '14:45',
        experience: staffData.experience || '',
        reference: staffData.reference || '',
        notes: staffData.notes || '',
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      localData.staffProfiles = [...profiles, localRecord];
      localData.staffIdCounter = newCode + 1;
      saveMadrasaData('hf_records_v1', localData, madrasaId);
      return localRecord;
    }
  };

  const updateStaffInSupabase = async (staffId, staffData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(staffId);

    if (isRemote) {
      try {
        const payload = {
          name: (staffData.name || '').trim(),
          father_name: (staffData.father_name || staffData.fatherName || '').trim(),
          cnic: staffData.cnic ? String(staffData.cnic).trim() : null,
          assigned_class_id: isValidUUID(staffData.assigned_class_id || staffData.assignedClass)
            ? (staffData.assigned_class_id || staffData.assignedClass)
            : null,
          phone: (staffData.phone || '').trim(),
          whatsapp: staffData.whatsapp ? String(staffData.whatsapp).trim() : null,
          residence_status: staffData.residence_status || staffData.residenceStatus || 'ذاتی مکان',
          address: staffData.address ? String(staffData.address).trim() : null,
          qualification: staffData.qualification ? String(staffData.qualification).trim() : null,
          joining_date: staffData.joining_date || staffData.joiningDate || null,
          shift_start: staffData.shift_start || staffData.shiftStart || '06:50',
          shift_end: staffData.shift_end || staffData.shiftEnd || '14:45',
          experience: staffData.experience ? String(staffData.experience).trim() : null,
          reference: staffData.reference ? String(staffData.reference).trim() : null,
          notes: staffData.notes ? String(staffData.notes).trim() : null,
          updated_at: new Date().toISOString()
        };

        if (staffData.staff_code || staffData.staffCode) {
          payload.staff_code = Number(staffData.staff_code || staffData.staffCode);
        }
        if (isValidUUID(staffData.profile_id || staffData.profileId)) {
          payload.profile_id = staffData.profile_id || staffData.profileId;
        }

        const { data, error } = await supabase
          .from('staff')
          .update(payload)
          .eq('id', staffId)
          .select('*, classes(id, class_name)')
          .single();

        if (error) throw error;

        // Sync to local cache
        try {
          const localData = loadMadrasaData('hf_records_v1', madrasaId) || {};
          const profiles = localData.staffProfiles || [];
          localData.staffProfiles = profiles.map(p => (p.id === staffId ? data : p));
          saveMadrasaData('hf_records_v1', localData, madrasaId);
        } catch (syncErr) {
          console.warn('Local cache sync warning:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase update staff error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || {};
      const profiles = localData.staffProfiles || [];
      const updatedProfiles = profiles.map(p => {
        if (String(p.id) === String(staffId) || String(p.staffCode) === String(staffId) || String(p.staff_code) === String(staffId)) {
          return {
            ...p,
            ...staffData,
            name: (staffData.name || p.name).trim(),
            fatherName: (staffData.fatherName || staffData.father_name || p.fatherName || p.father_name).trim(),
            father_name: (staffData.fatherName || staffData.father_name || p.fatherName || p.father_name).trim()
          };
        }
        return p;
      });
      localData.staffProfiles = updatedProfiles;
      saveMadrasaData('hf_records_v1', localData, madrasaId);
      return { id: staffId, ...staffData };
    }
  };

  const deleteStaffFromSupabase = async (staffId, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(staffId);

    if (isRemote) {
      try {
        const { error } = await supabase
          .from('staff')
          .delete()
          .eq('id', staffId);

        if (error) throw error;
      } catch (e) {
        console.error('Supabase delete staff error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    }

    // Also update local cache
    try {
      const localData = loadMadrasaData('hf_records_v1', madrasaId) || {};
      const profiles = localData.staffProfiles || [];
      localData.staffProfiles = profiles.filter(p => p.id !== staffId && String(p.staffCode) !== String(staffId) && String(p.staff_code) !== String(staffId));
      saveMadrasaData('hf_records_v1', localData, madrasaId);
    } catch (syncErr) {
      console.warn('Local cache sync warning:', syncErr);
    }
  };

  const fetchStaffAttendanceFromSupabase = async (madrasaId = activeMadrasaId, date) => {
    let mId = madrasaId;
    let d = date;
    if (typeof mId === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(mId) || mId.length === 7) && !d) {
      d = mId;
      mId = activeMadrasaId;
    } else if (typeof mId === 'object' && mId !== null && !d) {
      d = mId;
      mId = activeMadrasaId;
    }
    if (!mId) mId = activeMadrasaId;

    if (!isValidUUID(mId)) {
      const local = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      if (!d) return local;
      if (typeof d === 'string') {
        return local.filter(r => r.date === d || r.date?.startsWith(d));
      }
      if (typeof d === 'object') {
        return local.filter(r => {
          if (d.date && r.date !== d.date) return false;
          if (d.startDate && r.date < d.startDate) return false;
          if (d.endDate && r.date > d.endDate) return false;
          if (d.month && !r.date.startsWith(d.month)) return false;
          return true;
        });
      }
      return local;
    }

    try {
      let query = supabase
        .from('staff_attendance')
        .select('*, staff(id, name, staff_code, shift_start, shift_end)')
        .eq('madrasa_id', mId);

      if (typeof d === 'string' && d) {
        if (d.length === 7) {
          const start = `${d}-01`;
          const [y, m] = d.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          const end = `${d}-${String(lastDay).padStart(2, '0')}`;
          query = query.gte('date', start).lte('date', end);
        } else {
          query = query.eq('date', d);
        }
      } else if (d && typeof d === 'object') {
        if (d.date) query = query.eq('date', d.date);
        if (d.startDate && d.endDate) {
          query = query.gte('date', d.startDate).lte('date', d.endDate);
        } else if (d.startDate) {
          query = query.gte('date', d.startDate);
        } else if (d.endDate) {
          query = query.lte('date', d.endDate);
        }
        if (d.month) {
          const start = `${d.month}-01`;
          const [y, m] = d.month.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          const end = `${d.month}-${String(lastDay).padStart(2, '0')}`;
          query = query.gte('date', start).lte('date', end);
        }
      }

      query = query.order('date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase staff attendance fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      return local;
    }
  };

  const upsertStaffAttendanceCheckIn = async (madrasaId = activeMadrasaId, date, records) => {
    let mId = madrasaId;
    let d = date;
    let recs = records;
    if (typeof mId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(mId) && Array.isArray(d)) {
      recs = d;
      d = mId;
      mId = activeMadrasaId;
    }
    if (!mId) mId = activeMadrasaId;

    const isRemote = isValidUUID(mId);
    const recordsArray = Array.isArray(recs) ? recs : (recs ? [recs] : []);
    if (!recordsArray.length) return [];

    const payload = recordsArray.map(r => ({
      madrasa_id: mId,
      staff_id: r.staff_id || r.staffId || r.id,
      date: r.date || d,
      status: r.status || 'present',
      check_in: (r.status === 'present' && (r.check_in || r.checkIn)) ? (r.check_in || r.checkIn) : null,
      check_out: (r.status === 'present' && (r.check_out || r.checkOut)) ? (r.check_out || r.checkOut) : null,
      late_minutes: Number(r.late_minutes ?? r.lateMinutes ?? 0),
      early_leave_minutes: Number(r.early_leave_minutes ?? r.earlyLeaveMinutes ?? 0),
      remarks: r.remarks || null,
      updated_at: new Date().toISOString()
    }));

    if (isRemote) {
      try {
        const { data, error } = await supabase
          .from('staff_attendance')
          .upsert(payload, { onConflict: 'staff_id,date' })
          .select('*, staff(id, name, staff_code, shift_start, shift_end)');

        if (error) throw error;

        // Sync to local cache
        try {
          const cached = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
          const updatedMap = new Map();
          cached.forEach(c => updatedMap.set(`${c.staff_id}_${c.date}`, c));
          (data || []).forEach(row => updatedMap.set(`${row.staff_id}_${row.date}`, row));
          saveMadrasaData('hf_staff_attendance_v1', Array.from(updatedMap.values()), mId);
        } catch (syncErr) {
          console.warn('Failed to sync staff attendance to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase upsert staff check-in error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const cached = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      const updatedMap = new Map();
      cached.forEach(c => updatedMap.set(`${c.staff_id}_${c.date}`, c));

      const newRows = payload.map(r => ({
        id: r.id || `staff_att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...r,
        created_at: new Date().toISOString()
      }));

      newRows.forEach(row => updatedMap.set(`${row.staff_id}_${row.date}`, row));
      const finalArr = Array.from(updatedMap.values());
      saveMadrasaData('hf_staff_attendance_v1', finalArr, mId);
      return newRows;
    }
  };

  const upsertStaffAttendanceCheckOut = async (madrasaId = activeMadrasaId, date, records) => {
    let mId = madrasaId;
    let d = date;
    let recs = records;
    if (typeof mId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(mId) && Array.isArray(d)) {
      recs = d;
      d = mId;
      mId = activeMadrasaId;
    }
    if (!mId) mId = activeMadrasaId;

    const isRemote = isValidUUID(mId);
    const recordsArray = Array.isArray(recs) ? recs : (recs ? [recs] : []);
    if (!recordsArray.length) return [];

    const payload = recordsArray.map(r => ({
      madrasa_id: mId,
      staff_id: r.staff_id || r.staffId || r.id,
      date: r.date || d,
      status: r.status || 'present',
      check_in: (r.status === 'present' && (r.check_in || r.checkIn)) ? (r.check_in || r.checkIn) : null,
      check_out: (r.status === 'present' && (r.check_out || r.checkOut)) ? (r.check_out || r.checkOut) : null,
      late_minutes: Number(r.late_minutes ?? r.lateMinutes ?? 0),
      early_leave_minutes: Number(r.early_leave_minutes ?? r.earlyLeaveMinutes ?? 0),
      remarks: r.remarks || null,
      updated_at: new Date().toISOString()
    }));

    if (isRemote) {
      try {
        const { data, error } = await supabase
          .from('staff_attendance')
          .upsert(payload, { onConflict: 'staff_id,date' })
          .select('*, staff(id, name, staff_code, shift_start, shift_end)');

        if (error) throw error;

        // Sync to local cache
        try {
          const cached = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
          const updatedMap = new Map();
          cached.forEach(c => updatedMap.set(`${c.staff_id}_${c.date}`, c));
          (data || []).forEach(row => updatedMap.set(`${row.staff_id}_${row.date}`, row));
          saveMadrasaData('hf_staff_attendance_v1', Array.from(updatedMap.values()), mId);
        } catch (syncErr) {
          console.warn('Failed to sync staff attendance to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase upsert staff check-out error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const cached = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      const updatedMap = new Map();
      cached.forEach(c => updatedMap.set(`${c.staff_id}_${c.date}`, c));

      const newRows = payload.map(r => ({
        id: r.id || `staff_att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        ...r,
        created_at: new Date().toISOString()
      }));

      newRows.forEach(row => updatedMap.set(`${row.staff_id}_${row.date}`, row));
      const finalArr = Array.from(updatedMap.values());
      saveMadrasaData('hf_staff_attendance_v1', finalArr, mId);
      return newRows;
    }
  };

  const fetchStaffAttendancePendingDate = async (madrasaId = activeMadrasaId) => {
    const mId = madrasaId || activeMadrasaId;
    if (!isValidUUID(mId)) {
      const local = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      const pendingRows = local.filter(r => r.status === 'present' && (r.check_in || r.checkIn) && !(r.check_out || r.checkOut));
      if (pendingRows.length > 0) {
        pendingRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return pendingRows[0].date;
      }
      const legacy = loadMadrasaData('hf_records_v1', mId) || {};
      if (legacy.staffAttendanceFlow?.checkInSaved && !legacy.staffAttendanceFlow?.checkOutSaved && legacy.staffAttendanceFlow?.pendingDate) {
        return legacy.staffAttendanceFlow.pendingDate;
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('date')
        .eq('madrasa_id', mId)
        .eq('status', 'present')
        .not('check_in', 'is', null)
        .is('check_out', null)
        .order('date', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0 && data[0].date) {
        return data[0].date;
      }
      return null;
    } catch (e) {
      console.warn('Supabase fetchStaffAttendancePendingDate failed, checking local fallback:', e.message || e);
      const local = loadMadrasaData('hf_staff_attendance_v1', mId) || [];
      const pendingRows = local.filter(r => r.status === 'present' && (r.check_in || r.checkIn) && !(r.check_out || r.checkOut));
      if (pendingRows.length > 0) {
        pendingRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return pendingRows[0].date;
      }
      const legacy = loadMadrasaData('hf_records_v1', mId) || {};
      if (legacy.staffAttendanceFlow?.checkInSaved && !legacy.staffAttendanceFlow?.checkOutSaved && legacy.staffAttendanceFlow?.pendingDate) {
        return legacy.staffAttendanceFlow.pendingDate;
      }
      return null;
    }
  };

  const fetchExamMiqdarFromSupabase = async (filters = {}, madrasaId = activeMadrasaId) => {
    const mId = madrasaId || activeMadrasaId;
    if (!isValidUUID(mId)) {
      const local = loadMadrasaData('hf_records_v1', mId) || {};
      let miqdar = local.examMiqdar || [];
      if (filters.class_id || filters.classId) {
        const cid = filters.class_id || filters.classId;
        miqdar = miqdar.filter(m => m.classId === cid || m.class_id === cid);
      }
      if (filters.term) {
        miqdar = miqdar.filter(m => m.term === filters.term);
      }
      if (filters.year) {
        miqdar = miqdar.filter(m => String(m.year) === String(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        const sid = filters.student_id || filters.studentId;
        miqdar = miqdar.filter(m => m.student_id === sid || m.studentId === sid || m.regNo === sid);
      }
      return miqdar;
    }

    try {
      let query = supabase
        .from('exam_miqdar')
        .select('*, students(id, name, roll_number, father_name, class_id), classes(id, class_name)')
        .eq('madrasa_id', mId);

      if (filters.class_id || filters.classId) {
        query = query.eq('class_id', filters.class_id || filters.classId);
      }
      if (filters.term) {
        query = query.eq('term', filters.term);
      }
      if (filters.year) {
        query = query.eq('year', parseInt(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        query = query.eq('student_id', filters.student_id || filters.studentId);
      }

      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetchExamMiqdar failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', mId) || {};
      let miqdar = local.examMiqdar || [];
      if (filters.class_id || filters.classId) {
        const cid = filters.class_id || filters.classId;
        miqdar = miqdar.filter(m => m.classId === cid || m.class_id === cid);
      }
      if (filters.term) {
        miqdar = miqdar.filter(m => m.term === filters.term);
      }
      if (filters.year) {
        miqdar = miqdar.filter(m => String(m.year) === String(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        const sid = filters.student_id || filters.studentId;
        miqdar = miqdar.filter(m => m.student_id === sid || m.studentId === sid || m.regNo === sid);
      }
      return miqdar;
    }
  };

  const upsertExamMiqdarToSupabase = async (recordsArray, madrasaId = activeMadrasaId) => {
    const mId = madrasaId || activeMadrasaId;
    const records = Array.isArray(recordsArray) ? recordsArray : [recordsArray];
    if (!records.length) return [];

    const isRemote = isValidUUID(mId);

    const payload = records.map(r => {
      const sp = parseInt(r.start_para ?? r.startPara) || 0;
      const sr = parseInt(r.start_ruku ?? r.startRuku) || 0;
      const ep = parseInt(r.end_para ?? r.endPara) || 0;
      const er = parseInt(r.end_ruku ?? r.endRuku) || 0;
      const targetRuku = r.target_ruku !== undefined ? (parseInt(r.target_ruku) || 0) :
                         (r.targetRuku !== undefined ? (parseInt(r.targetRuku) || 0) :
                         Math.max(0, (ep - sp) * 8 + (er - sr)));

      const classId = r.class_id || r.classId;

      return {
        madrasa_id: mId,
        student_id: r.student_id || r.studentId,
        class_id: isValidUUID(classId) ? classId : null,
        term: r.term || 'first',
        year: parseInt(r.year) || 2025,
        start_para: sp,
        start_ruku: sr,
        end_para: ep,
        end_ruku: er,
        target_ruku: targetRuku,
        updated_at: new Date().toISOString()
      };
    });

    if (isRemote) {
      try {
        const { data, error } = await supabase
          .from('exam_miqdar')
          .upsert(payload, { onConflict: 'student_id,term,year' })
          .select('*, students(id, name, roll_number, father_name, class_id), classes(id, class_name)');

        if (error) throw error;

        // Sync to local cache
        try {
          const stored = loadMadrasaData('hf_records_v1', mId) || {};
          let localMiqdar = [...(stored.examMiqdar || [])];
          (data || payload).forEach(d => {
            const studentId = d.student_id;
            const regNo = d.students?.roll_number;
            const idx = localMiqdar.findIndex(m =>
              (studentId && (m.student_id === studentId || m.studentId === studentId)) ||
              (regNo && m.regNo === regNo) &&
              m.term === d.term &&
              String(m.year) === String(d.year)
            );
            const cachedItem = {
              student_id: d.student_id,
              studentId: d.student_id,
              regNo: d.students?.roll_number || d.regNo || '',
              classId: d.class_id,
              term: d.term,
              year: d.year,
              startPara: d.start_para,
              startRuku: d.start_ruku,
              endPara: d.end_para,
              endRuku: d.end_ruku,
              targetRuku: d.target_ruku
            };
            if (idx >= 0) localMiqdar[idx] = cachedItem;
            else localMiqdar.push(cachedItem);
          });
          stored.examMiqdar = localMiqdar;
          saveMadrasaData('hf_records_v1', stored, mId);
        } catch (syncErr) {
          console.warn('Failed to sync exam_miqdar to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase upsertExamMiqdar error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const stored = loadMadrasaData('hf_records_v1', mId) || {};
      let localMiqdar = [...(stored.examMiqdar || [])];
      payload.forEach(d => {
        const studentId = d.student_id;
        const regNo = d.regNo;
        const idx = localMiqdar.findIndex(m =>
          (studentId && (m.student_id === studentId || m.studentId === studentId)) ||
          (regNo && m.regNo === regNo) &&
          m.term === d.term &&
          String(m.year) === String(d.year)
        );
        const cachedItem = {
          student_id: d.student_id,
          studentId: d.student_id,
          regNo: d.regNo || '',
          classId: d.class_id,
          term: d.term,
          year: d.year,
          startPara: d.start_para,
          startRuku: d.start_ruku,
          endPara: d.end_para,
          endRuku: d.end_ruku,
          targetRuku: d.target_ruku
        };
        if (idx >= 0) localMiqdar[idx] = cachedItem;
        else localMiqdar.push(cachedItem);
      });
      stored.examMiqdar = localMiqdar;
      saveMadrasaData('hf_records_v1', stored, mId);
      return payload;
    }
  };

  const upsertExamMiqdarSingle = async (recordData, madrasaId = activeMadrasaId) => {
    const res = await upsertExamMiqdarToSupabase([recordData], madrasaId);
    return Array.isArray(res) ? res[0] : res;
  };

  const fetchExamResultsFromSupabase = async (filters = {}, madrasaId = activeMadrasaId) => {
    const mId = madrasaId || activeMadrasaId;
    if (!isValidUUID(mId)) {
      const local = loadMadrasaData('hf_records_v1', mId) || {};
      let results = local.examResults || [];
      if (filters.class_id || filters.classId) {
        const cid = filters.class_id || filters.classId;
        results = results.filter(r => r.classId === cid || r.class_id === cid);
      }
      if (filters.term) {
        results = results.filter(r => r.term === filters.term);
      }
      if (filters.year) {
        results = results.filter(r => String(r.year) === String(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        const sid = filters.student_id || filters.studentId;
        results = results.filter(r => r.student_id === sid || r.studentId === sid || r.regNo === sid);
      }
      return results;
    }

    try {
      let query = supabase
        .from('exam_results')
        .select('*, students(id, name, roll_number, father_name, class_id), classes(id, class_name)')
        .eq('madrasa_id', mId);

      if (filters.class_id || filters.classId) {
        query = query.eq('class_id', filters.class_id || filters.classId);
      }
      if (filters.term) {
        query = query.eq('term', filters.term);
      }
      if (filters.year) {
        query = query.eq('year', parseInt(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        query = query.eq('student_id', filters.student_id || filters.studentId);
      }

      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fetchExamResults failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_records_v1', mId) || {};
      let results = local.examResults || [];
      if (filters.class_id || filters.classId) {
        const cid = filters.class_id || filters.classId;
        results = results.filter(r => r.classId === cid || r.class_id === cid);
      }
      if (filters.term) {
        results = results.filter(r => r.term === filters.term);
      }
      if (filters.year) {
        results = results.filter(r => String(r.year) === String(filters.year));
      }
      if (filters.student_id || filters.studentId) {
        const sid = filters.student_id || filters.studentId;
        results = results.filter(r => r.student_id === sid || r.studentId === sid || r.regNo === sid);
      }
      return results;
    }
  };

  const upsertExamResultsToSupabase = async (recordsArray, madrasaId = activeMadrasaId) => {
    const mId = madrasaId || activeMadrasaId;
    const records = Array.isArray(recordsArray) ? recordsArray : [recordsArray];
    if (!records.length) return [];

    const isRemote = isValidUUID(mId);

    const payload = records.map(r => {
      const target = parseInt(r.target_ruku ?? r.targetRuku) || 0;
      const achieved = parseInt(r.achieved_ruku ?? r.achievedRuku) || 0;
      const pct = (r.pct !== null && r.pct !== undefined) ? Number(r.pct) :
                  (target > 0 ? Math.round((achieved / target) * 100) : 0);

      const classId = r.class_id || r.classId;

      return {
        madrasa_id: mId,
        student_id: r.student_id || r.studentId,
        class_id: isValidUUID(classId) ? classId : null,
        term: r.term || 'first',
        year: parseInt(r.year) || 2025,
        target_ruku: target,
        achieved_ruku: achieved,
        pct: pct,
        updated_at: new Date().toISOString()
      };
    });

    if (isRemote) {
      try {
        const { data, error } = await supabase
          .from('exam_results')
          .upsert(payload, { onConflict: 'student_id,term,year' })
          .select('*, students(id, name, roll_number, father_name, class_id), classes(id, class_name)');

        if (error) throw error;

        // Sync to local cache
        try {
          const stored = loadMadrasaData('hf_records_v1', mId) || {};
          let localResults = [...(stored.examResults || [])];
          (data || payload).forEach(d => {
            const studentId = d.student_id;
            const regNo = d.students?.roll_number;
            const idx = localResults.findIndex(e =>
              (studentId && (e.student_id === studentId || e.studentId === studentId)) ||
              (regNo && e.regNo === regNo) &&
              e.term === d.term &&
              String(e.year) === String(d.year)
            );
            const cachedItem = {
              student_id: d.student_id,
              studentId: d.student_id,
              regNo: d.students?.roll_number || d.regNo || '',
              studentName: d.students?.name || d.studentName || '',
              classId: d.class_id,
              classNm: d.classes?.class_name || d.classNm || '',
              term: d.term,
              year: d.year,
              targetRuku: d.target_ruku,
              achievedRuku: d.achieved_ruku,
              pct: d.pct
            };
            if (idx >= 0) localResults[idx] = cachedItem;
            else localResults.push(cachedItem);
          });
          stored.examResults = localResults;
          saveMadrasaData('hf_records_v1', stored, mId);
        } catch (syncErr) {
          console.warn('Failed to sync exam_results to local cache:', syncErr);
        }

        return data;
      } catch (e) {
        console.error('Supabase upsertExamResults error:', e.message || e);
        throw new Error(e.message || FETCH_ERROR_URDU);
      }
    } else {
      // Local fallback
      const stored = loadMadrasaData('hf_records_v1', mId) || {};
      let localResults = [...(stored.examResults || [])];
      payload.forEach(d => {
        const studentId = d.student_id;
        const regNo = d.regNo;
        const idx = localResults.findIndex(e =>
          (studentId && (e.student_id === studentId || e.studentId === studentId)) ||
          (regNo && e.regNo === regNo) &&
          e.term === d.term &&
          String(e.year) === String(d.year)
        );
        const cachedItem = {
          student_id: d.student_id,
          studentId: d.student_id,
          regNo: d.regNo || '',
          studentName: d.studentName || '',
          classId: d.class_id,
          classNm: d.classNm || '',
          term: d.term,
          year: d.year,
          targetRuku: d.target_ruku,
          achievedRuku: d.achieved_ruku,
          pct: d.pct
        };
        if (idx >= 0) localResults[idx] = cachedItem;
        else localResults.push(cachedItem);
      });
      stored.examResults = localResults;
      saveMadrasaData('hf_records_v1', stored, mId);
      return payload;
    }
  };

  return (
    <MadrasaContext.Provider value={{
      madrasas,
      activeMadrasaId,
      activeMadrasa,
      activeLogo,
      logos,
      uploadLogo,
      removeLogo,
      switchMadrasa,
      addMadrasa,
      deleteMadrasa,
      renameMadrasa,
      getStorageKey,
      loadMadrasaData,
      saveMadrasaData,
      fetchStudentsFromSupabase,
      fetchHifzRecordsFromSupabase,
      fetchFeesFromSupabase,
      addFeeToSupabase,
      pendingSyncCount,
      flushOfflineQueue: () => flushQueue(supabase),
      fetchClassesFromSupabase,
      addStudentToSupabase,
      updateStudentInSupabase,
      withdrawStudentInSupabase,
      fetchHifzHalfYearRecordsFromSupabase,
      saveHifzHalfYearRecordToSupabase,
      deleteHifzHalfYearRecordFromSupabase,
      updateStudentHifzStartDate,
      fetchStudentAttendanceFromSupabase,
      saveStudentAttendanceToSupabase,
      fetchStaffFromSupabase,
      addStaffToSupabase,
      updateStaffInSupabase,
      deleteStaffFromSupabase,
      fetchStaffAttendanceFromSupabase,
      upsertStaffAttendanceCheckIn,
      upsertStaffAttendanceCheckOut,
      fetchStaffAttendancePendingDate,
      fetchExamMiqdarFromSupabase,
      upsertExamMiqdarToSupabase,
      upsertExamMiqdarSingle,
      fetchExamResultsFromSupabase,
      upsertExamResultsToSupabase
    }}>
      {children}
    </MadrasaContext.Provider>
  );
}

export function useMadrasa() {
  const context = useContext(MadrasaContext);
  if (!context) {
    throw new Error('useMadrasa must be used within a MadrasaProvider');
  }
  return context;
}
