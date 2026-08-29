import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isValidUUID } from '../lib/supabaseClient';
import { DEFAULT_CLASSES } from '../constants/defaults';

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

  const fetchFeesFromSupabase = async (madrasaId = activeMadrasaId) => {
    if (!isValidUUID(madrasaId)) {
      const local = loadMadrasaData('hf_fees_v1', madrasaId);
      if (local?.fees) return local.fees;
      const legacy = loadMadrasaData('hf_records_v1', madrasaId);
      return (legacy?.records || []).filter(r => r.isFeeRecord);
    }

    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*, students(id, name, roll_number, father_name)')
        .eq('madrasa_id', madrasaId)
        .order('paid_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fees fetch failed, falling back to local:', e.message || e);
      const local = loadMadrasaData('hf_fees_v1', madrasaId);
      if (local?.fees) return local.fees;
      const legacy = loadMadrasaData('hf_records_v1', madrasaId);
      if (legacy?.records) return legacy.records.filter(r => r.isFeeRecord);
      throw new Error(FETCH_ERROR_URDU);
    }
  };

  const addFeeToSupabase = async (feeData, madrasaId = activeMadrasaId) => {
    const isRemote = isValidUUID(madrasaId);

    if (isRemote) {
      try {
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
      fetchClassesFromSupabase,
      addStudentToSupabase,
      updateStudentInSupabase,
      withdrawStudentInSupabase,
      fetchHifzHalfYearRecordsFromSupabase,
      saveHifzHalfYearRecordToSupabase,
      deleteHifzHalfYearRecordFromSupabase,
      updateStudentHifzStartDate,
      fetchStudentAttendanceFromSupabase,
      saveStudentAttendanceToSupabase
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
