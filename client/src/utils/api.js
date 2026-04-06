import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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
