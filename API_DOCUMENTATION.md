# Citizen Connect API Documentation

## Base URL
All API endpoints are available at:
```
https://qtbjmpllnswyhbmamrxr.supabase.co/functions/v1/
```

## Authentication
Most endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## AUTH ENDPOINTS

### POST /api-auth/register
Register a new user (default role: citizen)
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe",
  "phone": "+1234567890"
}
```

### POST /api-auth/login
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```
Returns: `access_token`, `refresh_token`, `user`

### GET /api-auth/me
Returns current user profile with role (requires auth)

---

## USER ENDPOINTS

### GET /api-users/me
Get current user profile

### PATCH /api-users/me
Update profile: `full_name`, `phone`

### GET /api-users (Admin only)
List all users with pagination. Query params: `page`, `limit`, `search`, `role`

### GET /api-users/:id (Admin only)
Get user by ID

### PATCH /api-users/:id/role (Admin only)
```json
{ "role": "official" }
```

---

## REPORT ENDPOINTS

### POST /api-reports
Create report (anonymous allowed)
```json
{
  "type": "infrastructure",
  "category": "roads",
  "title": "Pothole on Main Street",
  "description": "Large pothole causing accidents",
  "severity": "high",
  "location_lat": 28.6139,
  "location_lng": 77.2090,
  "location_address": "Main Street, Delhi",
  "is_anonymous": false
}
```

### GET /api-reports/my
Get authenticated user's reports

### GET /api-reports (Admin/Official)
List all reports. Filters: `status`, `type`, `severity`, `date_from`, `date_to`

### GET /api-reports/:id
Get report details

### PATCH /api-reports/:id (Admin/Official)
Update: `status`, `severity`, `assigned_official_id`

### DELETE /api-reports/:id (Admin only)

---

## REPORT DETAILS

### POST /api-report-details/:reportId/evidence
Upload evidence (multipart/form-data): `file`, `file_type`

### GET /api-report-details/:reportId/evidence
List evidence

### GET /api-report-details/evidence/:evidenceId
Get signed URL

### POST /api-report-details/:reportId/comments
```json
{ "content": "Comment text", "is_public": true }
```

### GET /api-report-details/:reportId/comments
### GET /api-report-details/:reportId/timeline

---

## PROJECT ENDPOINTS (Transparency)

### GET /api-projects
List projects. Filters: `status`, `department`, `location`, `date_from`, `date_to`

### GET /api-projects/:id
Project with financial summary

### POST /api-projects (Admin)
### PATCH /api-projects/:id (Admin)
### GET/POST /api-projects/:id/transactions
### GET/POST /api-projects/:id/updates
### GET/POST /api-projects/:id/comments

---

## TRANSPARENCY REPORTS

### GET /api-transparency/reports/summary
Aggregate stats

### GET /api-transparency/reports/custom
Custom filtered report

---

## AI ENDPOINTS

### POST /api-ai/reports/related
```json
{ "description": "Broken road near school", "type": "infrastructure", "limit": 5 }
```

### POST /api-ai/transparency/query
```json
{ "query": "Show road projects with budget over 10 crore" }
```

---

## NOTIFICATIONS

### GET /api-notifications
Query params: `unread_only`

### PATCH /api-notifications/:id/read
### PATCH /api-notifications/read-all

---

## ADMIN

### GET /api-admin/dashboard
System overview stats

### GET /api-admin/audit-logs
Filters: `entity_type`, `action`, `date_from`, `date_to`

---

## Database Schema
- **profiles**: User profiles linked to auth
- **user_roles**: Role assignments (citizen/official/admin)
- **reports**: Issue reports with AI analysis
- **report_evidence**: Uploaded files
- **report_comments**: Discussion threads
- **report_timeline_events**: Status history
- **projects**: Government projects
- **financial_transactions**: Budget tracking
- **project_updates**: Progress updates
- **transparency_comments**: Public comments on projects
- **notifications**: User notifications
- **audit_logs**: System audit trail

## Storage Buckets
- `evidence-media`: Report evidence files
- `project-media`: Project images/documents
- `profile-images`: User avatars
