/* eslint-disable */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ── ADMIN API ──────────────────────────────────────────────────
export const getAdminStats       = () => API.get('/admin/stats/extended');
export const getActivityFeed     = (page = 1) => API.get(`/admin/activity-feed?limit=15&page=${page}`);
export const getAdminUsers       = (params) => API.get(`/admin/users?${new URLSearchParams(params)}`);
export const updateUserStatus    = (id, status) => API.patch(`/admin/users/${id}/status`, { status });
export const deleteUser          = (id) => API.delete(`/admin/users/${id}`);
export const getFinanceSummary   = () => API.get('/admin/finance');
export const getTransactions     = (params) => API.get(`/admin/transactions?${new URLSearchParams(params)}`);
export const getAdminSettings    = () => API.get('/admin/settings');
export const updateAdminSettings = (data) => API.patch('/admin/settings', data);

/**
 * Make an API request with proper error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Response data
 */
export async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds for large file uploads

    // Don't set Content-Type if body is FormData (browser will set it automatically)
    const isFormData = options.body instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call error:', error);
    
    if (error.name === 'AbortError') {
      return { 
        success: false, 
        message: 'Request timeout. Backend may be down.' 
      };
    }
    
    return { 
      success: false, 
      message: error.message || 'API request failed' 
    };
  }
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint
 * @param {string} token - JWT token
 * @param {string} method - HTTP method (GET, POST, DELETE, etc.) - default GET
 * @param {any} data - Request body (for FormData or JSON)
 * @returns {Promise} - Response data
 */
export async function apiCallAuth(endpoint, token, method = 'GET', data = null) {
  // Handle old signature: apiCallAuth(endpoint, token, options)
  let options = {};
  
  if (typeof method === 'object' && method !== null) {
    // Old signature: apiCallAuth(endpoint, token, options)
    options = method;
  } else {
    // New signature: apiCallAuth(endpoint, token, method, data)
    options.method = method;
    
    if (data) {
      if (data instanceof FormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }
  }

  return apiCall(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
}

// Campaign API calls
export const getCampaigns = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/campaigns`);
    return response.data;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
};

export const createCampaign = async (campaignData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/campaigns`, campaignData);
    return response.data;
  } catch (error) {
    console.error('Error creating campaign:', error);
    throw error;
  }
};

// User API calls
export const registerUser = async (userData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/users`, userData);
    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

export const getUsers = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users`);
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

// Submission API calls
export const createSubmission = async (submissionData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/submissions`, submissionData);
    return response.data;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw error;
  }
};

export const getSubmissions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/submissions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
};

export const updateSubmission = async (submissionId, status) => {
  try {
    const response = await axios.patch(`${API_BASE_URL}/submissions/${submissionId}`, { status });
    return response.data;
  } catch (error) {
    console.error('Error updating submission:', error);
    throw error;
  }
};
