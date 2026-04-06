# SpreadFast Development Guide

## Getting Started

This is a full-stack MVP for a crowd-powered marketing platform.

### Quick Start

1. **Start Backend**
   ```bash
   cd server
   npm install
   npm start
   ```
   Backend runs on: http://localhost:5000

2. **Start Frontend (in new terminal)**
   ```bash
   cd client
   npm install
   npm start
   ```
   Frontend runs on: http://localhost:3000

### Testing the App

1. **Create a Campaign**
   - Go to http://localhost:3000/company
   - Fill in campaign details
   - Submit

2. **Join as Promoter**
   - Go to http://localhost:3000/signup
   - Register with details

3. **View Campaigns**
   - Go to http://localhost:3000/campaigns
   - See all created campaigns

4. **Submit Proof**
   - Go to http://localhost:3000/submit
   - Submit post link and screenshot

5. **Admin Panel**
   - Go to http://localhost:3000/admin
   - View all submissions and approve/reject
   - See all campaigns

## Project Layout

```
spreadfast/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── components/        # Navbar, Footer
│   │   ├── pages/             # All page components
│   │   ├── utils/             # API calls
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── public/                # Static files
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                    # Node.js/Express Backend
│   ├── server.js              # Main server file
│   ├── data/                  # JSON data storage
│   │   ├── campaigns.json
│   │   ├── users.json
│   │   └── submissions.json
│   ├── models/                # Data models (optional)
│   ├── routes/                # Express routes (optional)
│   ├── controllers/           # Controller logic (optional)
│   └── package.json
│
└── README.md
```

## API Endpoints Reference

### Campaigns
```
GET    /api/campaigns              - Get all campaigns
POST   /api/campaigns              - Create campaign
```

### Users
```
GET    /api/users                  - Get all users
POST   /api/users                  - Register new user
```

### Submissions
```
GET    /api/submissions            - Get all submissions
POST   /api/submissions            - Create submission
PATCH  /api/submissions/:id        - Update submission status
```

## Common Development Tasks

### Add a New Page
1. Create new component in `client/src/pages/`
2. Add route in `client/src/App.jsx`
3. Link to it from Navbar

### Add an API Endpoint
1. Add route handler in `server/server.js`
2. Create helper functions to read/write JSON
3. Call from frontend using `src/utils/api.js`

### Update Navbar/Footer
- Edit `client/src/components/Navbar.jsx`
- Edit `client/src/components/Footer.jsx`

### Styling
- Use TailwindCSS classes
- Add custom CSS to `client/src/index.css`
- Color palette: Primary (#1B5E20), Dark (#000000), Light (#FFFFFF)

## Troubleshooting

### Backend won't start
- Check if port 5000 is available
- Run `npm install` in server folder
- Check Node.js version (need v14+)

### Frontend won't connect to backend
- Make sure backend is running on :5000
- Check CORS is enabled in server.js
- Check API_BASE_URL in `client/src/utils/api.js`

### Styles not loading
- Run `npm install` in client folder
- Check tailwind.config.js is present
- Clear browser cache and rebuild

## Next Steps (Post-MVP)

1. Add MongoDB for persistent database
2. Implement user authentication
3. Add payment processing
4. Create email notifications
5. Add performance analytics
6. Implement automated verification
7. Create mobile app version
