# SpreadFast - Crowd-Powered Marketing MVP

A full-stack web application connecting businesses with promoters for authentic social media marketing.

## Project Structure

```
/spreadfast
  /client           # React frontend with TailwindCSS
  /server           # Node.js/Express backend
  /server/data      # JSON data storage
```

## Features

✅ **Landing Page** - Beautiful hero section with "How It Works" guide
✅ **Company Dashboard** - Create ad campaigns with all details
✅ **Promoter Signup** - Join as promoter with social media handles
✅ **Campaign Marketplace** - Browse and join campaigns
✅ **Submit Proof Page** - Upload proof of posting
✅ **Admin Dashboard** - Approve/Reject submissions and manage campaigns

## Tech Stack

- **Frontend**: React 18 + React Router + TailwindCSS
- **Backend**: Node.js + Express
- **Database**: JSON file storage (no external DB needed for MVP)
- **API**: RESTful endpoints

## Installation & Setup

### Backend Setup

```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:5000`

### Frontend Setup

```bash
cd client
npm install
npm start
```
Client runs on `http://localhost:3000`

## API Endpoints

### Campaigns
- `GET /api/campaigns` - Get all campaigns
- `POST /api/campaigns` - Create new campaign

### Users
- `POST /api/users` - Register new promoter
- `GET /api/users` - Get all users

### Submissions
- `GET /api/submissions` - Get all submissions
- `POST /api/submissions` - Submit proof of posting
- `PATCH /api/submissions/:id` - Approve/Reject submission

## Data Structure

### Campaign
```json
{
  "id": "uuid",
  "name": "Campaign Name",
  "description": "Description",
  "image": "Image URL",
  "caption": "Post caption",
  "platform": "Instagram|TikTok|X|WhatsApp",
  "budget": 1000,
  "duration": "7 days",
  "createdAt": "ISO timestamp"
}
```

### User
```json
{
  "id": "uuid",
  "name": "Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "instagram": "@username",
  "tiktok": "@username",
  "twitter": "@username",
  "createdAt": "ISO timestamp"
}
```

### Submission
```json
{
  "id": "uuid",
  "campaignId": "campaign uuid",
  "userName": "Name",
  "platform": "Instagram|TikTok|X|WhatsApp",
  "screenshot": "Image URL",
  "postLink": "Post URL",
  "status": "Pending|Approved|Rejected",
  "createdAt": "ISO timestamp"
}
```

## Pages & Routes

- `/` - Landing page
- `/company` - Create campaign
- `/signup` - Join as promoter
- `/campaigns` - Browse campaigns
- `/submit` - Submit proof of posting
- `/admin` - Admin dashboard (no auth needed for MVP)

## Color Scheme

- Primary: `#1B5E20` (Dark Green)
- Dark: `#000000`
- Light: `#FFFFFF`

## Notes

- MVP level - no authentication required
- Simple, manual approval process
- Data stored in JSON files
- No payment integration yet
- Mobile responsive design
- Clean, minimal UI

## Future Enhancements

- User authentication & accounts
- Payment integration
- Performance tracking
- Analytics dashboard
- Automated verification
- Multiple user roles
- Email notifications
