/* eslint-disable */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
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
 * @param {object} options - Fetch options
 * @returns {Promise} - Response data
 */
export async function apiCallAuth(endpoint, token, options = {}) {
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
