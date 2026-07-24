import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, saveSession, clearSession, apiRequest } from '../services/api';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  isLoading: boolean;
  token: string | null;
  userId: string | null;
  userName: string | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  updateUserName: (name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getSession();
        if (session.token && session.userId) {
          setToken(session.token);
          setUserId(session.userId);
          setUserName(session.name);
        }
        const savedTheme = await SecureStore.getItemAsync('app_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      } catch (e) {
        console.error('Failed to load auth session', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data && data.token && data.userId) {
        await saveSession(data.token, data.userId.toString(), data.name);
        setToken(data.token);
        setUserId(data.userId.toString());
        setUserName(data.name);
      } else {
        throw new Error('Invalid login response from server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await clearSession();
      setToken(null);
      setUserId(null);
      setUserName(null);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    await SecureStore.setItemAsync('app_theme', nextTheme);
  };

  const updateUserName = async (newName: string) => {
    await SecureStore.setItemAsync('user_name', newName);
    setUserName(newName);
  };

  return (
    <AuthContext.Provider value={{ isLoading, token, userId, userName, theme, toggleTheme, updateUserName, login, register, logout }}>
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
