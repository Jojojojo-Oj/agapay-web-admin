# Clean Architecture Implementation for Agapay Admin

## Overview
Refactored the Incidents and Applicants components to follow clean architecture principles, with added filtering capabilities and ascending order sorting.

## Changes Made

### 1. **New Service Files** (Business Logic Layer)

#### [src/services/incidentsService.js](src/services/incidentsService.js)
- **`subscribeToIncidents(callback)`** - Fetches real-time SOS reports and sorts them in ascending order by timestamp
- **`updateIncidentStatus(reportId, newStatus)`** - Updates incident status with error handling
- **`getDisasterTypes(incidents)`** - Extracts unique disaster types from incidents
- **`filterIncidents(incidents, search, disasterTypeFilter, statusFilter)`** - Unified filtering logic

#### [src/services/applicantsService.js](src/services/applicantsService.js)
- **`subscribeToUsers(callback)`** - Fetches real-time users and sorts them in ascending order by createdAt
- **`updateUserStatus(userId, newStatus)`** - Updates user status with error handling
- **`filterUsers(users, search, statusFilter)`** - Unified filtering logic

### 2. **Refactored Components**

#### [src/pages/Incidents.js](src/pages/Incidents.js)
**Improvements:**
- ✅ Removed direct Firestore imports (separation of concerns)
- ✅ Moved business logic to `incidentsService.js`
- ✅ Added filter state: `disasterTypeFilter`, `statusFilter`
- ✅ Implemented dynamic disaster type dropdown
- ✅ Added status dropdown (Pending, Published, Rejected)
- ✅ Automatic ascending order sorting via service
- ✅ Used CSS classes instead of inline styles
- ✅ Improved component readability with `useMemo` for filtered data

**New Filters:**
- Search: sender name, details, location
- Disaster Type: dynamically populated from data
- Status: Pending, Published (active), Rejected

#### [src/pages/Applicant.js](src/pages/Applicant.js)
**Improvements:**
- ✅ Refactored to use `applicantsService.js`
- ✅ Removed Firestore imports from component
- ✅ Automatic ascending order sorting via service
- ✅ Unified filtering through service function
- ✅ Better error handling in status updates

### 3. **New Styling File**

#### [src/styles/incidents.css](src/styles/incidents.css)
- Professional styling consistent with [applicant.css](src/styles/applicant.css)
- Status badges with color coding:
  - Pending: Yellow/Orange
  - Active/Published: Green
  - Rejected: Red
- Responsive modal design
- Hover effects and transitions
- Mobile-friendly layout

## Architecture Benefits

```
┌─────────────────────────────────────┐
│     React Components                 │
│  (Incidents.js, Applicant.js)       │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│     Service Layer                    │
│  (incidentsService.js,              │
│   applicantsService.js)             │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│     Firestore SDK                    │
│  (firebase.js)                       │
└─────────────────────────────────────┘
```

**Benefits:**
- ✅ **Separation of Concerns**: UI logic separated from business logic
- ✅ **Reusability**: Services can be used by multiple components
- ✅ **Testability**: Service functions can be unit tested independently
- ✅ **Maintainability**: Changes to data fetching logic don't affect components
- ✅ **Scalability**: Easy to add new features or modify existing ones

## Features

### Incidents Page
- Real-time SOS report monitoring
- Filter by disaster type (auto-populated)
- Filter by status
- Search across sender, details, location
- Ascending order by timestamp
- Modal preview with image
- Publish/Reject actions with confirmation

### Applicants Page
- Real-time user monitoring
- Filter by status
- Search across name, email, address, phone
- Ascending order by creation date
- Modal preview with verification images
- Approve/Reject actions with confirmation

## Data Sorting
Both components now sort data in ascending chronological order:
- **Incidents**: By `timestamp` field (oldest first)
- **Applicants**: By `createdAt` field (oldest first)

This ensures new entries appear in logical order in the table.
