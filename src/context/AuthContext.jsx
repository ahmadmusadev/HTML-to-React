import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        setProfile(null);
        return null;
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    // 1. Get initial session — Supabase is the sole source of truth
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserProfile(currentSession.user.id);
        }
        // No localStorage fallback — if no valid Supabase session, user must log in
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to Auth state changes (including sign-out and token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchUserProfile(newSession.user.id);
      } else {
        // Session expired or user signed out — clear all auth state
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

  // Sign In helper
  const signIn = async (email, password) => {
    setLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();
    
    try {
      // Attempt Supabase Cloud Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data?.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchUserProfile(data.user.id);
        return data;
      }
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase auth attempt failed or unreachable:', err);

      // DEV-ONLY: Seed account fallback for local development when Supabase is unreachable
      if (import.meta.env.DEV) {
        const seedAccounts = [
          {
            email: 'admin@madrasa.com', password: 'AdminPass123!',
            user: { id: '22222222-2222-2222-2222-222222222222', email: 'admin@madrasa.com' },
            profile: { id: '22222222-2222-2222-2222-222222222222', madrasa_id: 'madrasa_1', full_name: 'مولانا احمد مدنی (مہتمم)', role: 'admin' }
          },
          {
            email: 'teacher@madrasa.com', password: 'TeacherPass123!',
            user: { id: '33333333-3333-3333-3333-333333333333', email: 'teacher@madrasa.com' },
            profile: { id: '33333333-3333-3333-3333-333333333333', madrasa_id: 'madrasa_1', full_name: 'استاد محمد یوسف', role: 'teacher' }
          }
        ];

        const match = seedAccounts.find(a => a.email === cleanEmail && a.password === password);
        if (match) {
          console.warn('[DEV MODE] Using seed account fallback — this is disabled in production builds.');
          setUser(match.user);
          setProfile(match.profile);
          setSession({ user: match.user });
          return { user: match.user, session: { user: match.user } };
        }
      }

      // Re-throw with a clean error message
      if (err?.message && err.message !== '{}') {
        throw err;
      } else {
        throw new Error('Invalid login credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign Out helper
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
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
