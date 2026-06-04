# New Admin Portal API Endpoints

## Overview
These are the new API endpoints required to support the enhanced admin portal with statistics, activity feeds, user management, finance tracking, and settings management.

---

## 1. EXTENDED STATISTICS ENDPOINT

### GET `/api/admin/stats/extended`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 150,
    "totalPromoters": 100,
    "totalCompanies": 50,
    "activeToday": 25,
    "totalCampaigns": 45,
    "activeCampaigns": 30,
    "totalSubmissions": 200,
    "pendingSubmissions": 15,
    "approvedSubmissions": 170,
    "rejectedSubmissions": 15,
    "totalWithdrawalAmount": 5000000,
    "pendingWithdrawalAmount": 500000,
    "pendingWithdrawalsCount": 5,
    "totalProcessed": 50000000,
    "totalPaidToPromoters": 10000000,
    "totalCampaignFees": 3750000,
    "totalWithdrawalFees": 750000
  }
}
```

**Implementation Notes:**
- `activeToday`: Count of users with `lastLogin` within last 24 hours
- `totalProcessed`: Sum of all campaign budgets where payment status = "completed"
- `totalPaidToPromoters`: Sum of all withdrawal amounts where status = "completed"
- Update existing `/api/admin/all-stats` to calculate these new fields or replace it with this extended version

---

## 2. ACTIVITY FEED ENDPOINT

### GET `/api/admin/activity-feed?limit=15&page=1`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `limit`: Number of activities to return (default: 15)
- `page`: Pagination page (default: 1)

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "activity_123",
      "type": "user_signup",
      "icon": "👤",
      "description": "New promoter joined: @username",
      "timestamp": "2 minutes ago",
      "createdAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "activity_124",
      "type": "campaign_created",
      "icon": "📢",
      "description": "New campaign created: Summer Sale by Nike Inc — ₦50,000",
      "timestamp": "5 minutes ago",
      "createdAt": "2025-01-15T10:25:00Z"
    },
    {
      "id": "activity_125",
      "type": "submission_approved",
      "icon": "📋",
      "description": "Submission approved: @promoter_name for Summer Sale",
      "timestamp": "10 minutes ago",
      "createdAt": "2025-01-15T10:20:00Z"
    },
    {
      "id": "activity_126",
      "type": "withdrawal_paid",
      "icon": "💰",
      "description": "Withdrawal paid: ₦5,000 to @promoter_name",
      "timestamp": "15 minutes ago",
      "createdAt": "2025-01-15T10:15:00Z"
    }
  ]
}
```

**Activity Types:**
- `user_signup` - New user registration
- `campaign_created` - New campaign created
- `submission_approved` - Submission approved with amount
- `submission_rejected` - Submission rejected
- `withdrawal_paid` - Withdrawal completed
- `withdrawal_pending` - New withdrawal request

**Implementation Notes:**
- Create `ActivityLog` model to store all platform activities
- Log activities automatically when key events occur (user signup, campaign created, submission approved, etc.)
- Sort by `createdAt` descending
- Humanize timestamps (e.g., "2 minutes ago")

---

## 3. USERS ENDPOINT

### GET `/api/admin/users?role=company|promoter&status=all|active|suspended&search=string&page=1`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `role`: Filter by `company` or `promoter` (optional)
- `status`: Filter by `all`, `active`, or `suspended` (default: all)
- `search`: Search by name or email (optional)
- `page`: Pagination page (default: 1)

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "user_123",
      "name": "Nike Inc",
      "email": "contact@nike.com",
      "role": "company",
      "dateJoined": "2025-01-01",
      "campaignsCreated": 5,
      "totalSpent": 250000,
      "status": "active"
    },
    {
      "id": "user_124",
      "name": "John Promoter",
      "email": "john@example.com",
      "role": "promoter",
      "dateJoined": "2025-01-05",
      "campaignsJoined": 3,
      "totalSubmissions": 10,
      "approvalRate": 85,
      "totalEarned": 50000,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150
  }
}
```

**Implementation Notes:**
- Paginate results: 20 per page
- For companies: Include `campaignsCreated` count and `totalSpent` (sum of budgets)
- For promoters: Include campaigns joined, total submissions, approval rate, and total earned

---

## 4. UPDATE USER STATUS ENDPOINT

### PATCH `/api/admin/users/:userId/status`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "status": "suspended" | "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User status updated to suspended"
}
```

**Implementation Notes:**
- Update `User.status` field
- Log action in `AdminLog` table: `{ admin_id, action: 'user_status_change', target: userId, status: newStatus, timestamp }`
- When suspended, user cannot create/join campaigns

---

## 5. DELETE USER ENDPOINT

### DELETE `/api/admin/users/:userId`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "confirmToken": "admin_confirmation_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User account deleted permanently"
}
```

**Implementation Notes:**
- Require confirmation token for security
- Permanently delete user and all associated data (campaigns, submissions, withdrawals)
- Log action in `AdminLog`

---

## 6. FINANCE SUMMARY ENDPOINT

### GET `/api/admin/finance`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "totalCollected": 50000000,
  "platformFees": 3750000,
  "withdrawalFees": 750000,
  "netRevenue": 4500000,
  "paymentStats": {
    "successfulPayments": 120,
    "failedPayments": 5,
    "averageTransactionValue": 416666.67
  }
}
```

**Implementation Notes:**
- `totalCollected`: Sum of all successful campaign payments (via Paystack)
- `platformFees`: 7.5% of totalCollected
- `withdrawalFees`: 7.5% of total withdrawn amounts
- `netRevenue`: Sum of all fees earned

---

## 7. TRANSACTIONS ENDPOINT

### GET `/api/admin/transactions?type=all|campaign|withdrawal&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&search=ref&page=1`

**Authentication:** Required (Admin only)

**Query Parameters:**
- `type`: `all`, `campaign`, or `withdrawal` (default: all)
- `startDate`: Filter by date range (optional)
- `endDate`: Filter by date range (optional)
- `search`: Search by Paystack reference ID (optional)
- `page`: Pagination page (default: 1)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "trans_123",
      "date": "2025-01-15",
      "type": "Campaign Payment",
      "businessName": "Nike Inc",
      "campaignName": "Summer Sale",
      "amount": 50000,
      "fee": 3750,
      "reference": "PAYSTACK_REF_123",
      "status": "completed"
    },
    {
      "id": "trans_124",
      "date": "2025-01-14",
      "type": "Promoter Withdrawal",
      "promoterName": "John Promoter",
      "amount": 10000,
      "fee": 750,
      "reference": "WITH_REF_124",
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 500
  }
}
```

**Implementation Notes:**
- Paginate: 20 rows per page
- Include metadata for CSV export

---

## 8. PLATFORM SETTINGS ENDPOINTS

### GET `/api/admin/settings`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "settings": {
    "minCampaignBudget": 10000,
    "platformFeePercent": 7.5,
    "minDurationDays": 3,
    "maxFilesPerCampaign": 10,
    "maxFileSizeMB": 20,
    "minWithdrawalAmount": 2000,
    "withdrawalProcessingDays": 3,
    "submissionReviewWindow": 72,
    "allowNewBusinessSignups": true,
    "allowNewPromoterSignups": true,
    "allowCampaignCreation": true,
    "allowWithdrawals": true,
    "maintenanceMode": false,
    "enabledPlatforms": ["tiktok", "instagram", "twitter", "facebook", "youtube"]
  }
}
```

---

### PATCH `/api/admin/settings`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "platformFeePercent": 7.5,
  "minWithdrawalAmount": 2000,
  "maintenanceMode": false,
  "enabledPlatforms": ["tiktok", "instagram", "twitter"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings saved successfully",
  "settings": { ... }
}
```

**Implementation Notes:**
- Create `PlatformSettings` table to store all settings
- Settings are dynamically retrieved (never hardcoded in frontend)
- Log all setting changes in `AdminLog`

---

## 9. ADMIN LOGS ENDPOINT (Optional)

### GET `/api/admin/logs?action=all&limit=50&page=1`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "log_123",
      "admin_id": "admin_user_id",
      "action": "user_status_change",
      "target": "user_123",
      "details": { "status": "suspended" },
      "timestamp": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

## Database Schema Updates Required

### ActivityLog Model
```javascript
{
  id: String (unique),
  type: String (user_signup, campaign_created, submission_approved, etc.),
  description: String,
  icon: String,
  createdAt: Date,
  metadata: {
    userId: String,
    campaignId: String,
    submissionId: String,
    amount: Number
  }
}
```

### PlatformSettings Model
```javascript
{
  id: String,
  key: String (unique),
  value: Any,
  dataType: String (number, string, boolean, array),
  updatedAt: Date,
  updatedBy: String (admin user ID)
}
```

### AdminLog Model
```javascript
{
  id: String,
  adminId: String,
  action: String,
  target: String,
  details: Object,
  createdAt: Date
}
```

---

## Implementation Checklist

- [ ] Add `ActivityLog` model and automatically log events
- [ ] Add `PlatformSettings` model and seed initial values
- [ ] Add `AdminLog` model for audit trail
- [ ] Implement GET `/api/admin/stats/extended` with new fields
- [ ] Implement GET `/api/admin/activity-feed`
- [ ] Implement GET `/api/admin/users` with filtering
- [ ] Implement PATCH `/api/admin/users/:userId/status`
- [ ] Implement DELETE `/api/admin/users/:userId`
- [ ] Implement GET `/api/admin/finance`
- [ ] Implement GET `/api/admin/transactions`
- [ ] Implement GET `/api/admin/settings`
- [ ] Implement PATCH `/api/admin/settings`
- [ ] Update all endpoints to verify admin role
- [ ] Add proper error handling and validation
- [ ] Test all endpoints

---

## Error Responses

All endpoints should return appropriate HTTP status codes:

```json
{
  "success": false,
  "message": "Error description"
}
```

- `401` - Unauthorized (no token)
- `403` - Forbidden (not admin)
- `404` - Not found
- `400` - Bad request
- `500` - Server error

