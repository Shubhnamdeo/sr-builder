import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

// The Sole Administrator account: Shubh Namdeo
const SHUBH_ADMIN_USER = {
  id: 'usr_shubh_admin',
  name: 'Shubh Namdeo',
  email: 'shubh namdeo',
  userId: 'shubh namdeo',
  avatar: 'SN',
  plan: 'pro',
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

  // Registered users database in localStorage for offline/local storage
  const getRegisteredUsers = () => {
    try {
      const users = localStorage.getItem('sr_registered_users');
      return users ? JSON.parse(users) : [];
    } catch {
      return [];
    }
  };

  // Sign Up with Name, ID/Email & Password (Instant access, NO admin approval needed)
  const signupWithCredentials = async (name, idOrEmail, password) => {
    const cleanId = idOrEmail.trim();
    const cleanName = name.trim();
    const cleanKey = cleanId.toLowerCase();

    // 1. Try Backend API first if reachable
    try {
      const res = await api.auth.register(cleanName, cleanKey, password);
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
      if (apiErr.status === 400 || apiErr.status === 403) {
        throw apiErr;
      }
      console.warn('Backend server offline, using local storage mode:', apiErr.message);
    }

    // 2. Local registration
    const users = getRegisteredUsers();
    if (users.some(u => (u.userId || u.email || '').toLowerCase() === cleanKey)) {
      throw new Error('An account with this User ID already exists. Please log in.');
    }

    const isSoleAdmin = (cleanKey === 'shubh namdeo' || cleanKey === 'shubhnamdeo') && password === '#9pqhn9G8S';

    const newUser = {
      id: 'usr_' + Date.now(),
      name: cleanName,
      userId: cleanId,
      email: cleanId,
      password: password,
      avatar: cleanName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U',
      role: isSoleAdmin ? 'admin' : 'user',
      plan: isSoleAdmin ? 'pro' : 'free',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem('sr_registered_users', JSON.stringify(users));

    const sessionUser = {
      id: newUser.id,
      name: newUser.name,
      userId: newUser.userId,
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

  // Log In with User ID / Email & Password
  const loginWithCredentials = async (idOrEmail, password) => {
    const cleanId = idOrEmail.trim();
    const cleanKey = cleanId.toLowerCase();
    const cleanPwd = password ? password.trim() : '';

    // A. Check Sole Administrator Account: "Shubh Namdeo" / "#9pqhn9G8S"
    const isAdminId =
      cleanKey === 'shubh namdeo' ||
      cleanKey === 'shubhnamdeo' ||
      cleanKey === 'shubhnamdeo@gmail.com';

    if (isAdminId && cleanPwd === '#9pqhn9G8S') {
      try {
        const res = await api.auth.login(cleanKey, password);
        if (res?.token && res?.user) {
          localStorage.setItem('sr_auth_token', res.token);
          localStorage.setItem('sr_auth_user', JSON.stringify(res.user));
          localStorage.setItem('sr_logged_in', 'true');
          setUser(res.user);
          setIsAuthenticated(true);
          return res.user;
        }
      } catch (e) {
        console.warn('Backend login fallback to local session:', e.message);
      }
      setUser(SHUBH_ADMIN_USER);
      setIsAuthenticated(true);
      localStorage.setItem('sr_auth_user', JSON.stringify(SHUBH_ADMIN_USER));
      localStorage.setItem('sr_logged_in', 'true');
      return SHUBH_ADMIN_USER;
    }

    // C. Try Backend API if online
    try {
      const res = await api.auth.login(cleanKey, password);
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
      console.warn('Backend offline, checking local storage accounts:', apiErr.message);
    }

    // D. Local storage registered accounts
    const users = getRegisteredUsers();
    const matchedUser = users.find(u =>
      (u.userId && u.userId.toLowerCase() === cleanKey) ||
      (u.email && u.email.toLowerCase() === cleanKey)
    );

    if (!matchedUser) {
      // If user doesn't exist yet, automatically create it and log them in!
      return signupWithCredentials(cleanId, cleanId, password);
    }

    if (matchedUser.password && matchedUser.password !== password) {
      throw new Error('Incorrect password. Please verify your credentials.');
    }

    const sessionUser = {
      id: matchedUser.id,
      name: matchedUser.name,
      userId: matchedUser.userId || matchedUser.email,
      email: matchedUser.email,
      avatar: matchedUser.avatar || 'U',
      role: matchedUser.role || 'user',
      plan: matchedUser.plan || 'free',
    };

    setUser(sessionUser);
    setIsAuthenticated(true);
    localStorage.setItem('sr_auth_user', JSON.stringify(sessionUser));
    localStorage.setItem('sr_logged_in', 'true');

    return sessionUser;
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
        isAdmin: user?.role === 'admin',
        isBackendConnected,
        loginWithCredentials,
        signupWithCredentials,
        // Backward-compatibility aliases
        loginWithEmail: loginWithCredentials,
        signupWithEmail: signupWithCredentials,
        logout,
        defaultEmail: 'user@example.com',
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
