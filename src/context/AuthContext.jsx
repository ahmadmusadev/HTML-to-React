import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clean up any legacy demo auth keys
  const clearLegacyDemoStorage = () => {
    try {
      localStorage.removeItem('hf_auth_user_v1');
      localStorage.removeItem('hf_auth_profile_v1');
    } catch {}
  };

  // Fetch profile for a given user ID
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
        return null;
      }

      if (data) {
        setProfile(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      return null;
    }
  };

  useEffect(() => {
    // 1. Get initial session strictly from Supabase SDK
    const initAuth = async () => {
      clearLegacyDemoStorage();
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Auth getSession error:', error.message);
          setSession(null);
          setUser(null);
          setProfile(null);
        } else if (currentSession?.user) {
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

  // Sign In helper — strictly uses Supabase Auth with no mock fallback
  const signIn = async (email, password) => {
    setLoading(true);
    clearLegacyDemoStorage();
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchUserProfile(data.user.id);
        return data;
      }

      throw new Error('لاگ ان کی معلومات درست نہیں ہیں۔');
    } finally {
      setLoading(false);
    }
  };

  // Sign Out helper — clears Supabase session
  const signOut = async () => {
    setLoading(true);
    clearLegacyDemoStorage();
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

  const value = {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    role: profile?.role || 'guest',
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
