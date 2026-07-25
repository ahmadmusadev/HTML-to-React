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
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 2. Listen to Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await fetchUserProfile(newUser.id);
      } else {
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.user) {
        await fetchUserProfile(data.user.id);
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Sign Out helper
  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('SignOut error:', error);
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
