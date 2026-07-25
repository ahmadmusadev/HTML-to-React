import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

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
    } catch (e) {}
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

  // --- SUPABASE LIVE DATA FETCHERS WITH FALLBACK ---
  const fetchStudentsFromSupabase = async (madrasaId = activeMadrasaId) => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, classes(class_name)')
        .eq('madrasa_id', madrasaId);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase students fetch fallback to localStorage:', e.message);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return local?.records || [];
    }
  };

  const fetchHifzRecordsFromSupabase = async (madrasaId = activeMadrasaId) => {
    try {
      const { data, error } = await supabase
        .from('hifz_records')
        .select('*, students(name, roll_number)')
        .eq('madrasa_id', madrasaId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase Hifz records fetch fallback to localStorage:', e.message);
      const local = loadMadrasaData('hf_records_v1', madrasaId);
      return local?.monthlyExams || [];
    }
  };

  const fetchFeesFromSupabase = async (madrasaId = activeMadrasaId) => {
    try {
      const { data, error } = await supabase
        .from('fees')
        .select('*, students(name, roll_number)')
        .eq('madrasa_id', madrasaId);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Supabase fees fetch fallback to localStorage:', e.message);
      const local = loadMadrasaData('hf_fees_v1', madrasaId);
      return local?.fees || [];
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
      fetchFeesFromSupabase
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
