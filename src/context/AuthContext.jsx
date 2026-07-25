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
    // 1. Get initial session
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchUserProfile(currentSession.user.id);
        } else {
          // Check local stored session fallback
          const storedUser = localStorage.getItem('hf_auth_user_v1');
          const storedProfile = localStorage.getItem('hf_auth_profile_v1');
          if (storedUser && storedProfile) {
            const parsedUser = JSON.parse(storedUser);
            const parsedProfile = JSON.parse(storedProfile);
            setUser(parsedUser);
            setProfile(parsedProfile);
            setSession({ user: parsedUser });
          }
        }
      } catch (err) {
        console.warn('Auth initialization error, checking local storage session:', err);
        const storedUser = localStorage.getItem('hf_auth_user_v1');
        const storedProfile = localStorage.getItem('hf_auth_profile_v1');
        if (storedUser && storedProfile) {
          try {
            const parsedUser = JSON.parse(storedUser);
            const parsedProfile = JSON.parse(storedProfile);
            setUser(parsedUser);
            setProfile(parsedProfile);
            setSession({ user: parsedUser });
          } catch (e) {}
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchUserProfile(newSession.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign In helper with seed credential fallback
  const signIn = async (email, password) => {
    setLoading(true);
    const cleanEmail = (email || '').trim().toLowerCase();
    
    try {
      // First attempt Supabase Cloud Auth
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

      // Seed account verification fallback
      if (cleanEmail === 'admin@madrasa.com' && password === 'AdminPass123!') {
        const adminUser = { id: '22222222-2222-2222-2222-222222222222', email: 'admin@madrasa.com' };
        const adminProfile = {
          id: '22222222-2222-2222-2222-222222222222',
          madrasa_id: 'madrasa_1',
          full_name: 'مولانا احمد مدنی (مہتمم)',
          role: 'admin'
        };
        setUser(adminUser);
        setProfile(adminProfile);
        setSession({ user: adminUser });
        localStorage.setItem('hf_auth_user_v1', JSON.stringify(adminUser));
        localStorage.setItem('hf_auth_profile_v1', JSON.stringify(adminProfile));
        return { user: adminUser, session: { user: adminUser } };
      }

      if (cleanEmail === 'teacher@madrasa.com' && password === 'TeacherPass123!') {
        const teacherUser = { id: '33333333-3333-3333-3333-333333333333', email: 'teacher@madrasa.com' };
        const teacherProfile = {
          id: '33333333-3333-3333-3333-333333333333',
          madrasa_id: 'madrasa_1',
          full_name: 'استاد محمد یوسف',
          role: 'teacher'
        };
        setUser(teacherUser);
        setProfile(teacherProfile);
        setSession({ user: teacherUser });
        localStorage.setItem('hf_auth_user_v1', JSON.stringify(teacherUser));
        localStorage.setItem('hf_auth_profile_v1', JSON.stringify(teacherProfile));
        return { user: teacherUser, session: { user: teacherUser } };
      }

      // If credentials do not match seed accounts, rethrow or throw clean invalid credentials error
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
      localStorage.removeItem('hf_auth_user_v1');
      localStorage.removeItem('hf_auth_profile_v1');
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
