import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    } catch (e) {
      return sessionStorage.getItem('token');
    }
  });
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const addDebug = (message) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + message);
  };

  const fetchUser = async (retryCount = 0) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
      } else {
        clearAllTokens();
        setToken(null);
      }
    } catch (error) {
      console.error('Fetch user error:', error);
      if (error.name === 'AbortError' && retryCount < 3) {
        setTimeout(() => fetchUser(retryCount + 1), 15000);
        return;
      }
      clearAllTokens();
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, role, socialMedia = {}) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, socialMedia }),
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        saveToken(data.token);
        setToken(data.token);
        setUser(data.user);
      }
      return data;
    } catch (error) {
      console.error('Register error:', error);
      if (error.name === 'AbortError') {
        return { success: false, message: 'Registration timeout. Backend may be down.' };
      }
      return { success: false, message: error.message || 'Registration failed' };
    }
  };

  const login = async (email, password) => {
    try {
      addDebug('🔵 LOGIN START - ' + new Date().toLocaleTimeString());
      addDebug('API_URL: ' + API_URL);
      
      // Wake up Render first
      try {
        await fetch(`${API_URL}/api/health`, { 
          signal: AbortSignal.timeout(5000),
          credentials: 'include'
        });
        addDebug('✓ Health check passed');
      } catch (e) {
        addDebug('⚠️ Health check timeout (normal)');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      addDebug('📤 Sending login request...');
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      addDebug('✓ Response received: ' + response.status + ' ' + response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      addDebug('✓ Data parsed: ' + (data.success ? 'SUCCESS' : 'FAILED'));

      if (data.success) {
        addDebug('✓ Token received, saving...');
        saveToken(data.token);
        addDebug('✓ Token saved');
        setToken(data.token);
        setUser(data.user);
        addDebug('✓ State updated, login complete!');
      } else {
        addDebug('✗ Login failed: ' + (data.message || 'Unknown error'));
      }

      return data;
    } catch (error) {
      addDebug('❌ ERROR: ' + error.name + ' - ' + error.message);
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          message: 'Server is waking up, please try again in 30 seconds.' 
        };
      }
      return { success: false, message: error.message || 'Login failed' };
    }
  };

  const saveToken = (token) => {
    try {
      localStorage.setItem('token', token);
      addDebug('✓ Token saved to localStorage');
    } catch (e) {
      addDebug('⚠️ localStorage failed, trying sessionStorage...');
      try {
        sessionStorage.setItem('token', token);
        addDebug('✓ Token saved to sessionStorage');
      } catch (e2) {
        addDebug('❌ Both storage failed: ' + e2.message);
      }
    }
  };

  const clearAllTokens = () => {
    try {
      localStorage.removeItem('token');
    } catch (e) {}
    try {
      sessionStorage.removeItem('token');
    } catch (e) {}
  };

  const logout = () => {
    clearAllTokens();
    setToken(null);
    setUser(null);
    setDebugInfo('');
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  const contextValue = { 
    user, 
    token, 
    loading, 
    register, 
    login, 
    logout, 
    updateUser, 
    fetchUser,
    debugInfo,
    setDebugInfo
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
