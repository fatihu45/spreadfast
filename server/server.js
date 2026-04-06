const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Data file paths
const campaignsFile = path.join(__dirname, 'data', 'campaigns.json');
const usersFile = path.join(__dirname, 'data', 'users.json');
const submissionsFile = path.join(__dirname, 'data', 'submissions.json');

// Initialize data files if they don't exist
const initializeDataFiles = () => {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(campaignsFile)) {
    fs.writeFileSync(campaignsFile, JSON.stringify([]));
  }
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([]));
  }
  if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, JSON.stringify([]));
  }
};

// Helper functions to read/write JSON files
const readFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Initialize data files
initializeDataFiles();

// ============ CAMPAIGNS ROUTES ============

// GET all campaigns
app.get('/api/campaigns', (req, res) => {
  const campaigns = readFile(campaignsFile);
  res.json(campaigns);
});

// POST new campaign
app.post('/api/campaigns', (req, res) => {
  const { name, description, image, caption, platform, budget, duration } = req.body;

  if (!name || !description || !caption || !platform || !budget || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const campaigns = readFile(campaignsFile);
  const newCampaign = {
    id: uuidv4(),
    name,
    description,
    image: image || 'https://via.placeholder.com/300x200?text=Campaign+Image',
    caption,
    platform,
    budget,
    duration,
    createdAt: new Date().toISOString(),
  };

  campaigns.push(newCampaign);
  writeFile(campaignsFile, campaigns);

  res.status(201).json({ message: 'Campaign created successfully', campaign: newCampaign });
});

// ============ USERS ROUTES ============

// POST new user (promoter signup)
app.post('/api/users', (req, res) => {
  const { name, email, phone, instagram, tiktok, twitter } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const users = readFile(usersFile);
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newUser = {
    id: uuidv4(),
    name,
    email,
    phone,
    instagram: instagram || '',
    tiktok: tiktok || '',
    twitter: twitter || '',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeFile(usersFile, users);

  res.status(201).json({ message: 'User registered successfully', user: newUser });
});

// GET all users
app.get('/api/users', (req, res) => {
  const users = readFile(usersFile);
  res.json(users);
});

// ============ SUBMISSIONS ROUTES ============

// GET all submissions
app.get('/api/submissions', (req, res) => {
  const submissions = readFile(submissionsFile);
  res.json(submissions);
});

// POST new submission
app.post('/api/submissions', (req, res) => {
  const { campaignId, userName, platform, screenshot, postLink } = req.body;

  if (!campaignId || !userName || !platform || !postLink) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const submissions = readFile(submissionsFile);
  const newSubmission = {
    id: uuidv4(),
    campaignId,
    userName,
    platform,
    screenshot: screenshot || '',
    postLink,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  submissions.push(newSubmission);
  writeFile(submissionsFile, submissions);

  res.status(201).json({ message: 'Submission created successfully', submission: newSubmission });
});

// PATCH submission status (approve/reject)
app.patch('/api/submissions/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const submissions = readFile(submissionsFile);
  const submission = submissions.find(s => s.id === id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  submission.status = status;
  writeFile(submissionsFile, submissions);

  res.json({ message: 'Submission updated successfully', submission });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
