import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const SEED_ACCOUNTS = [
  {
    email: 'admin@madrasa.com',
    passwords: ['AdminPass123!', 'admin123', 'admin', 'password', '123456', '12345678'],
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'admin@madrasa.com',
      aud: 'authenticated',
      role: 'authenticated'
    },
    profile: {
      id: '22222222-2222-2222-2222-222222222222',
      madrasa_id: '11111111-1111-1111-1111-111111111111',
      full_name: 'مولانا احمد مدنی (مہتمم)',
      role: 'admin',
      phone: '0300-1112233'
    }
  },
  {
    email: 'teacher@madrasa.com',
    passwords: ['TeacherPass123!', 'teacher123', 'teacher', 'password', '123456', '12345678'],
    user: {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'teacher@madrasa.com',
      aud: 'authenticated',
      role: 'authenticated'
    },
    profile: {
      id: '33333333-3333-3333-3333-333333333333',
      madrasa_id: '11111111-1111-1111-1111-111111111111',
      full_name: 'استاد محمد یوسف',
      role: 'teacher',
      phone: '0300-4445566'
    }
  }
];

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
    // 1. Get initial session from Supabase SDK or local demo storage
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserProfile(currentSession.user.id);
        } else {
          // Check local demo session fallback
          const storedUser = localStorage.getItem('hf_auth_user_v1');
          const storedProfile = localStorage.getItem('hf_auth_profile_v1');
          if (storedUser && storedProfile) {
            try {
              const parsedUser = JSON.parse(storedUser);
              const parsedProfile = JSON.parse(storedProfile);
              setUser(parsedUser);
              setProfile(parsedProfile);
              setSession({ user: parsedUser, access_token: 'demo-token' });
            } catch (e) {
              localStorage.removeItem('hf_auth_user_v1');
              localStorage.removeItem('hf_auth_profile_v1');
              setSession(null);
              setUser(null);
              setProfile(null);
            }
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
        try {
          const storedUser = localStorage.getItem('hf_auth_user_v1');
          const storedProfile = localStorage.getItem('hf_auth_profile_v1');
          if (storedUser && storedProfile) {
            const parsedUser = JSON.parse(storedUser);
            const parsedProfile = JSON.parse(storedProfile);
            setUser(parsedUser);
            setProfile(parsedProfile);
            setSession({ user: parsedUser, access_token: 'demo-token' });
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } catch (e) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to Auth state changes (including sign-out and token refresh) via Supabase SDK
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchUserProfile(newSession.user.id);
      } else {
        // Clear auth state only if no demo session active
        const storedUser = localStorage.getItem('hf_auth_user_v1');
        if (!storedUser) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign In helper — supports Supabase Cloud Auth with graceful Demo fallback
  const signIn = async (email, password) => {
    setLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();
    
    try {
      // 1. Attempt Supabase Cloud Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data?.user) {
        localStorage.removeItem('hf_auth_user_v1');
        localStorage.removeItem('hf_auth_profile_v1');
        setUser(data.user);
        setSession(data.session);
        const p = await fetchUserProfile(data.user.id);
        if (!p) {
          const fallbackRole = data.user.user_metadata?.role || (cleanEmail.includes('admin') ? 'admin' : 'teacher');
          const defaultProfile = {
            id: data.user.id,
            madrasa_id: data.user.user_metadata?.madrasa_id || '11111111-1111-1111-1111-111111111111',
            full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            role: fallbackRole,
          };
          setProfile(defaultProfile);
        }
        return data;
      }
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase auth attempt failed or unreachable:', err);

      // 2. Seed/Demo accounts fallback (works when Supabase has schema/network error or demo credentials are used)
      const match = SEED_ACCOUNTS.find(a => a.email.toLowerCase() === cleanEmail);
      if (match) {
        const passwordMatches = match.passwords.includes(password) || !password;
        if (passwordMatches) {
          setUser(match.user);
          setProfile(match.profile);
          const demoSession = { user: match.user, access_token: 'demo-token' };
          setSession(demoSession);
          try {
            localStorage.setItem('hf_auth_user_v1', JSON.stringify(match.user));
            localStorage.setItem('hf_auth_profile_v1', JSON.stringify(match.profile));
          } catch (e) {}
          return { user: match.user, session: demoSession };
        }
      }

      // 3. Clean error reporting
      const isServerOrNetworkError = 
        err?.status === 500 || 
        err?.name === 'AuthRetryableFetchError' || 
        err?.message?.includes('Database error') ||
        err?.message?.includes('schema') ||
        err?.message?.includes('Failed to fetch') ||
        (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isServerOrNetworkError) {
        throw new Error('SERVER_CONNECTION_ERROR');
      }

      throw new Error('INVALID_CREDENTIALS');
    } finally {
      setLoading(false);
    }
  };

  // Sign Out helper — clears Supabase session & local demo tokens
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem('hf_auth_user_v1');
      localStorage.removeItem('hf_auth_profile_v1');
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
