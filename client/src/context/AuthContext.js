import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    localStorage.getItem('token') || sessionStorage.getItem('token')
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async (retryCount = 0) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (data.success) {
      setUser(data.user);
    } else {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      setToken(null);
    }
  } catch (error) {
    console.error('Fetch user error:', error);
    if (error.name === 'AbortError' && retryCount < 3) {
      console.log(`Server waking up - retry ${retryCount + 1}/3`);
      setTimeout(() => fetchUser(retryCount + 1), 15000);
      return;
    }
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
  } finally {
    setLoading(false);
  }
};

  const register = async (name, email, password, role, socialMedia = {}) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, socialMedia }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        try {
          localStorage.setItem('token', data.token);
        } catch (e) {
          sessionStorage.setItem('token', data.token);
        }
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
    // Wake up Render first
    try {
      await fetch(`${API_URL}/api/health`, { 
        signal: AbortSignal.timeout(5000) 
      });
    } catch (e) {
      // ignore - just waking up server
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      try {
        localStorage.setItem('token', data.token);
      } catch (e) {
        sessionStorage.setItem('token', data.token);
      }
      setToken(data.token);
      setUser(data.user);
    }

    return data;
  } catch (error) {
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

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout, updateUser, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}