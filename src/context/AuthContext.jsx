import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clean up any legacy demo or fallback auth storage keys
  const clearLegacyStorage = () => {
    try {
      localStorage.removeItem('hf_auth_user_v1');
      localStorage.removeItem('hf_auth_profile_v1');
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('hf_auth_session_fallback_v1');
      }
    } catch {}
  };

  // Fetch profile for a given user ID strictly from database
  const fetchUserProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error or missing profile:', error.message);
        setProfile(null);
        return null;
      }

      if (data) {
        setProfile(data);
        return data;
      }
      setProfile(null);
      return null;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    // 1. Get initial session strictly from Supabase SDK
    const initAuth = async () => {
      clearLegacyStorage();
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Auth getSession error:', error.message);
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserProfile(currentSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to Auth state changes via Supabase SDK
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchUserProfile(newSession.user.id);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign In helper — strictly contacts Supabase; never creates local fallback sessions
  const signIn = async (email, password) => {
    setLoading(true);
    clearLegacyStorage();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error('INVALID_CREDENTIALS');
      }

      setUser(data.user);
      setSession(data.session);
      await fetchUserProfile(data.user.id);
      return data;
    } catch (err) {
      console.warn('Supabase auth attempt error:', err);

      const isServerError =
        err?.status >= 500 ||
        err?.name === 'AuthRetryableFetchError' ||
        err?.message === 'SERVER_CONNECTION_ERROR' ||
        err?.message?.includes('Database error') ||
        err?.message?.includes('schema') ||
        err?.message?.includes('Failed to fetch') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isServerError) {
        const serverErr = new Error('SERVER_CONNECTION_ERROR');
        serverErr.status = err?.status || 500;
        serverErr.name = err?.name || 'AuthRetryableFetchError';
        throw serverErr;
      }

      // Strictly re-throw authentication credential errors
      throw err || new Error('INVALID_CREDENTIALS');
    } finally {
      setLoading(false);
    }
  };

  // Sign Out helper — clears Supabase session and local state
  const signOut = async () => {
    setLoading(true);
    clearLegacyStorage();
    try {
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!user && !!session;
  // Role comes strictly from Supabase profile row. If no profile exists, defaults to 'guest'
  const calculatedRole = profile?.role || 'guest';

  const value = {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    role: calculatedRole,
    madrasaId: profile?.madrasa_id || null,
    signIn,
    signOut,
    fetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
