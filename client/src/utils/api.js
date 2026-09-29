

import { readResponse } from './readResponse';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Make an API request with proper error handling
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Response data
 */
export async function apiCall(endpoint, options = {}) {
  let timeoutId;
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Add timeout handling
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds for large file uploads

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

    return await readResponse(response);
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
  } finally { clearTimeout(timeoutId); }
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

// Compatibility helpers for older entry pages; use the same API/error handling.
export const getCampaigns = async () => {
  const data = await apiCall('/api/campaigns');
  return data.success ? data.campaigns : [];
};
export const registerUser = userData => apiCall('/api/auth/register', {
  method: 'POST', body: JSON.stringify(userData)
});
