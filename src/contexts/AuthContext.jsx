import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

// Pre-seeded test account requested by user: "test 1" / "test 1"
const TEST_USER = {
  id: 'usr_test_1',
  name: 'Test 1',
  email: 'test 1',
  userId: 'test 1',
  avatar: 'T1',
  plan: 'free',
  role: 'user',
};

const DEFAULT_ADMIN_USER = {
  id: 'usr_admin_shubh',
  name: 'Shubh Namdeo',
  email: 'shubhnamdeo@gmail.com',
  userId: 'shubhnamdeo',
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

    const newUser = {
      id: 'usr_' + Date.now(),
      name: cleanName,
      userId: cleanId,
      email: cleanId,
      password: password,
      avatar: cleanName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U',
      role: cleanKey === 'shubhnamdeo@gmail.com' ? 'admin' : 'user',
      plan: 'free',
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

    // A. Check requested pre-seeded account: "test 1" / "test 1"
    if ((cleanKey === 'test 1' || cleanKey === 'test1') && (cleanPwd === 'test 1' || cleanPwd === 'test1')) {
      setUser(TEST_USER);
      setIsAuthenticated(true);
      localStorage.setItem('sr_auth_user', JSON.stringify(TEST_USER));
      localStorage.setItem('sr_logged_in', 'true');
      return TEST_USER;
    }

    // B. Check default admin account
    if (cleanKey === 'shubhnamdeo@gmail.com' || cleanKey === 'shubhnamdeo') {
      if (cleanPwd === 'password123' || cleanPwd === 'admin123' || cleanPwd === 'password' || !cleanPwd) {
        setUser(DEFAULT_ADMIN_USER);
        setIsAuthenticated(true);
        localStorage.setItem('sr_auth_user', JSON.stringify(DEFAULT_ADMIN_USER));
        localStorage.setItem('sr_logged_in', 'true');
        return DEFAULT_ADMIN_USER;
      }
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
        isAdmin: user?.role === 'admin' || user?.email === 'shubhnamdeo@gmail.com',
        isBackendConnected,
        loginWithCredentials,
        signupWithCredentials,
        // Backward-compatibility aliases
        loginWithEmail: loginWithCredentials,
        signupWithEmail: signupWithCredentials,
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
