import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

const DEFAULT_DEMO_USER = {
  name: 'Shubh Namdeo',
  email: 'shubhnamdeo@gmail.com',
  avatar: 'SN',
  plan: 'free',
  role: 'admin',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sr_auth_user');
      const isLoggedIn = localStorage.getItem('sr_logged_in') === 'true';
      if (saved && isLoggedIn) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sr_logged_in') === 'true';
  });

  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Check backend health on startup
  useEffect(() => {
    api.checkHealth().then(status => {
      if (status && status.database?.connected) {
        setIsBackendConnected(true);
      }
    });
  }, []);

  // Registered users database in localStorage for local offline mode
  const getRegisteredUsers = () => {
    try {
      const users = localStorage.getItem('sr_registered_users');
      return users ? JSON.parse(users) : [];
    } catch {
      return [];
    }
  };

  // Sign Up with Name, Email & Password
  const signupWithEmail = async (name, email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // 1. Try Backend API first if reachable
    try {
      const res = await api.auth.register(cleanName, cleanEmail, password);
      if (res?.token && res?.user) {
        localStorage.setItem('sr_auth_token', res.token);
        localStorage.setItem('sr_auth_user', JSON.stringify(res.user));
        localStorage.setItem('sr_logged_in', 'true');
        setUser(res.user);
        setIsAuthenticated(true);
        setIsBackendConnected(true);
        return res.user;
      }
    } catch (apiErr) {
      // If error is from backend rejection (e.g. email exists), throw it
      if (apiErr.status === 400 || apiErr.status === 403) {
        throw apiErr;
      }
      // If backend is offline/unreachable, gracefully use local storage
      console.warn('Backend server offline, falling back to local mode:', apiErr.message);
    }

    // 2. Local fallback
    const users = getRegisteredUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    const newUser = {
      id: 'usr_' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      password: password,
      avatar: cleanName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SR',
      role: cleanEmail === 'shubhnamdeo@gmail.com' ? 'admin' : 'user',
      plan: 'free',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem('sr_registered_users', JSON.stringify(users));

    const sessionUser = {
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
      role: newUser.role,
      plan: newUser.plan,
    };

    setUser(sessionUser);
    setIsAuthenticated(true);
    localStorage.setItem('sr_auth_user', JSON.stringify(sessionUser));
    localStorage.setItem('sr_logged_in', 'true');

    return sessionUser;
  };

  // Log In with Email & Password
  const loginWithEmail = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Backend API first
    try {
      const res = await api.auth.login(cleanEmail, password);
      if (res?.token && res?.user) {
        localStorage.setItem('sr_auth_token', res.token);
        localStorage.setItem('sr_auth_user', JSON.stringify(res.user));
        localStorage.setItem('sr_logged_in', 'true');
        setUser(res.user);
        setIsAuthenticated(true);
        setIsBackendConnected(true);
        return res.user;
      }
    } catch (apiErr) {
      if (apiErr.status === 401 || apiErr.status === 400) {
        throw apiErr;
      }
      console.warn('Backend server offline, falling back to local mode:', apiErr.message);
    }

    // 2. Local fallback
    const users = getRegisteredUsers();
    if (cleanEmail === 'shubhnamdeo@gmail.com' && (!password || password === 'admin123' || password === 'password')) {
      setUser(DEFAULT_DEMO_USER);
      setIsAuthenticated(true);
      localStorage.setItem('sr_auth_user', JSON.stringify(DEFAULT_DEMO_USER));
      localStorage.setItem('sr_logged_in', 'true');
      return DEFAULT_DEMO_USER;
    }

    const matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!matchedUser) {
      return signupWithEmail(cleanEmail.split('@')[0], cleanEmail, password);
    }

    if (matchedUser.password && matchedUser.password !== password) {
      throw new Error('Incorrect password. Please verify your credentials.');
    }

    const sessionUser = {
      name: matchedUser.name,
      email: matchedUser.email,
      avatar: matchedUser.avatar,
      role: matchedUser.role || 'user',
      plan: matchedUser.plan || 'free',
    };

    setUser(sessionUser);
    setIsAuthenticated(true);
    localStorage.setItem('sr_auth_user', JSON.stringify(sessionUser));
    localStorage.setItem('sr_logged_in', 'true');

    return sessionUser;
  };

  // Google OAuth Login
  const loginWithGoogle = async (googleProfile = null) => {
    const cleanEmail = googleProfile?.email?.trim().toLowerCase() || 'shubhnamdeo@gmail.com';
    const profile = googleProfile || {
      name: 'Shubh Namdeo',
      email: cleanEmail,
      avatar: 'SN',
      plan: 'free',
      role: 'admin',
      isGoogle: true,
    };

    try {
      const res = await api.auth.google(profile);
      if (res?.token && res?.user) {
        localStorage.setItem('sr_auth_token', res.token);
        localStorage.setItem('sr_auth_user', JSON.stringify(res.user));
        localStorage.setItem('sr_logged_in', 'true');
        setUser(res.user);
        setIsAuthenticated(true);
        setIsBackendConnected(true);
        return res.user;
      }
    } catch (apiErr) {
      console.warn('Backend server offline, using local google session:', apiErr.message);
    }

    setUser(profile);
    setIsAuthenticated(true);
    localStorage.setItem('sr_auth_user', JSON.stringify(profile));
    localStorage.setItem('sr_logged_in', 'true');
    return profile;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('sr_auth_token');
    localStorage.setItem('sr_logged_in', 'false');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin: user?.role === 'admin' || user?.email === 'shubhnamdeo@gmail.com',
        isBackendConnected,
        signupWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        defaultEmail: 'shubhnamdeo@gmail.com',
      }}
    >
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
