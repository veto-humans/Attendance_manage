# Backend Architecture

This backend uses Node.js + Express and stores user accounts and class information in Google Sheets via a Google Apps Script (GAS) Web App, while attendance records are stored in Firebase Firestore.

## Features
- Email/password login
- JWT authentication
- User account storage in Google Sheet via GAS
- Attendance data storage in Firebase Firestore
- Attendance submission and query endpoints
- Manager grade supervision support

## Setup
1. Create a Google Sheet with `Users` sheet containing columns: `name`, `email`, `password`, `className`, `studentCount`, `role`, `managedGrade`
2. Deploy the GAS script from `gas-script.gs` as a Web App.
3. Copy the Web App URL into `.env` as `GAS_WEBAPP_URL`.
4. Add `GAS_API_KEY` to both the GAS script properties and `.env`.
5. Set up Firebase project:
   - Create a Firebase project at https://console.firebase.google.com
   - Download the service account key JSON file
   - Add to `.env`: `FIREBASE_SERVICE_ACCOUNT` (entire JSON as a string) and `FIREBASE_DATABASE_URL`
6. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
7. Run:
   ```bash
   npm run dev
   ```

## Environment Variables (.env)
```
PORT=4000
GAS_WEBAPP_URL=<your-gas-web-app-url>
GAS_API_KEY=<your-gas-api-key>
JWT_SECRET=<your-jwt-secret>
FIREBASE_SERVICE_ACCOUNT=<firebase-service-account-json>
FIREBASE_DATABASE_URL=<your-firestore-database-url>
```

## Database Schema

### Google Sheet: Users
Columns: `name` | `email` | `password` | `className` | `studentCount` | `role` | `managedGrade`

### Firestore: attendance collection
```
{
  email: string,
  className: string,
  attendanceCount: number,
  records: [
    {
      seat: string,
      studentNote: string,
      reason: string,
      remark: string
    }
  ],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login (returns user data with className, studentCount, role, managedGrade)
- `POST /api/auth/register` - User registration (accepts className, studentCount, role, managedGrade)
- `GET /api/auth/profile` - Get user profile (requires JWT token)

### Attendance
- `POST /api/attendance` - Submit attendance records (requires JWT token)
- `GET /api/attendance` - Get user's attendance history (requires JWT token)

### Manager
- `GET /api/manager/classes` - Get managed grade classes and submission status (requires JWT token, role: manager)

## Leave Reason Types
1. 病假 (Sick leave)
2. 事假 (Personal leave)
3. 曠課 (Absence/Truancy)
4. 遲到 (Late arrival)
5. 身心調適假 (Mental health adjustment leave)
6. 生理假 (Menstrual/Period leave)
7. 公假 (Official leave)
8. 其他 (Other)
