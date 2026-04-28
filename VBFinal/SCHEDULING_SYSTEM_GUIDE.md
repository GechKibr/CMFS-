# Modern Appointment Scheduling System

A complete, production-ready appointment scheduling system built on Django REST Framework backend and React frontend. Enables users to request appointments with officers, officers to manage availability and confirm/reject requests, with real-time notifications.

## Architecture Overview

### Backend (Django)

**Enhanced Models:**
- `AppointmentAvailability` - Officer availability slots (date, time range, active status)
- `Appointment` - Booking requests with status tracking (pending → confirmed/rejected → completed)
- Automatic validation to prevent double-booking and overlapping slots

**New API Endpoints:**
- `GET /appointment-availabilities/free-slots/` - Grouped free slots by date
- `GET /appointment-availabilities/available/` - Available slots (flat list)
- `POST /appointment-availabilities/` - Create availability slot (officers only)
- `POST /appointments/` - Create appointment request
- `PATCH /appointments/{id}/status/` - Update appointment status with rejection reason
- `GET /appointments/` - List user's appointments

**Notification System:**
- Automatic notifications on appointment creation, confirmation, rejection, completion
- Broadcast via WebSocket for real-time updates
- Customizable notification messages based on status

### Frontend (React)

**New Components:**

1. **`SlotPicker.jsx`** - Interactive time slot selector
   - Groups slots by date
   - Visual feedback for selected slot
   - Displays officer name and time range
   - Handles loading and error states

2. **`AppointmentRequestForm.jsx`** - Multi-step appointment request form
   - Step 1: Enter issue type, description, preferred date
   - Step 2: Select available time slot
   - Step 3: Review and confirm
   - Form validation and error handling

3. **`Appointments.jsx`** (User View) - Appointment management for users
   - Request new appointments
   - View all appointments with status badges
   - Filter by status (pending, confirmed, rejected, completed, canceled)
   - Cancel pending appointments
   - Toast notifications for actions

4. **`OfficerSchedule.jsx`** (Officer Panel) - Full officer scheduling interface
   - **Availability Management:**
     - Add new availability slots (date, start time, end time)
     - View all slots with booking status
     - Validation prevents overlapping slots
   - **Appointment Requests:**
     - View incoming appointment requests
     - Filter by status
     - Confirm appointments (auto-notifies user)
     - Reject with reason (modal form)
     - Mark completed

5. **`Toast.jsx`** - Toast notification system
   - Success, error, info, warning types
   - Auto-dismiss with customizable duration
   - Smooth animations
   - Dismissible by user

6. **`useToast.js`** - React hook for toast notifications
   - Simple API: `toast.success()`, `toast.error()`, etc.
   - Manages toast state and lifecycle

## User Workflows

### User: Request an Appointment

1. Navigate to "Appointments" tab in User Dashboard
2. Click "+ New Request"
3. **Step 1:** Select issue type, enter description, optionally set preferred date
4. **Step 2:** Browse available slots grouped by date, click to select
5. **Step 3:** Review details and submit
6. Receive confirmation toast
7. Appointment appears in list with "pending" status
8. Receive notification when officer confirms or rejects

### Officer: Manage Availability & Requests

1. Navigate to "Schedule" tab in Officer Dashboard
2. **Add Availability:**
   - Click "+ Add Slot"
   - Enter date, start time, end time
   - Slot appears in "Your Availability" section
3. **Handle Requests:**
   - View incoming requests in "Appointment Requests" section
   - Filter by status
   - For pending requests:
     - Click "Confirm" to accept (user gets notified)
     - Click "Reject" to decline with reason (modal appears)
4. View all slots with booking status (Free/Booked)

## API Integration

### Key API Methods (in `api.js`)

```javascript
// Availability management
apiService.getAvailabilitySlots()           // Get officer's slots
apiService.createAvailabilitySlot(data)     // Create new slot
apiService.deleteAvailabilitySlot(id)       // Delete slot
apiService.getFreeSlots(params)             // Get free slots grouped by date
apiService.getAvailableSlots(params)        // Get available slots (flat)

// Appointment management
apiService.getAppointments()                // Get user's appointments
apiService.createAppointment(data)          // Create appointment request
apiService.updateAppointmentStatus(id, status, extra)  // Update status with rejection reason
```

### Request/Response Examples

**Create Appointment Request:**
```javascript
POST /appointments/
{
  "issue_type": "complaint",
  "description": "Issue with service",
  "availability_slot_id": 123,
  "preferred_date": "2026-05-01"  // optional
}

Response:
{
  "id": 456,
  "status": "pending",
  "issue_type": "complaint",
  "description": "Issue with service",
  "requested_by": { "id": 1, "first_name": "John", ... },
  "officer": { "id": 2, "first_name": "Jane", ... },
  "availability_slot": { "id": 123, "available_date": "2026-05-01", ... },
  "created_at": "2026-04-26T10:30:00Z"
}
```

**Update Appointment Status:**
```javascript
PATCH /appointments/456/status/
{
  "status": "confirmed"
}

// Or with rejection reason:
{
  "status": "rejected",
  "rejection_reason": "Time slot no longer available"
}
```

## Status Flow

```
User Request
    ↓
pending (awaiting officer review)
    ↓
    ├→ confirmed (officer accepted)
    │   ↓
    │   completed (meeting held)
    │
    └→ rejected (officer declined with reason)

User can cancel pending/confirmed appointments
```

## Notification Types

- **Appointment Request Submitted** - Sent to officer when user requests
- **Appointment Confirmed** - Sent to user when officer confirms
- **Appointment Rejected** - Sent to user with rejection reason
- **Appointment Completed** - Sent to user when marked complete
- **Appointment Canceled** - Sent to officer when user cancels

## UI/UX Features

### Dark Mode Support
- All components support light/dark themes
- Uses Tailwind CSS dark mode classes
- Theme context provides `isDark` flag

### Responsive Design
- Mobile-first approach
- Adapts to all screen sizes
- Touch-friendly buttons and inputs

### Loading & Error States
- Skeleton loaders while fetching data
- Error messages with retry options
- Toast notifications for user feedback

### Accessibility
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Color contrast compliance

## Database Schema

### AppointmentAvailability
```
- id (UUID)
- officer (FK to User)
- available_date (Date)
- start_time (Time)
- end_time (Time)
- is_active (Boolean)
- created_at, updated_at
- Unique constraint: (officer, available_date, start_time, end_time)
```

### Appointment
```
- id (UUID)
- complaint (FK to Complaint, nullable)
- requested_by (FK to User)
- officer (FK to User, nullable)
- availability_slot (FK to AppointmentAvailability, nullable)
- issue_type (Choice: complaint, support, inquiry, service_request, other)
- description (Text)
- preferred_date (Date, nullable)
- scheduled_at (DateTime, nullable)
- location (CharField, nullable)
- note (TextField, nullable)
- status (Choice: pending, confirmed, rejected, completed, canceled)
- rejection_reason (TextField, nullable)
- created_at, updated_at
- Indexes: (status, created_at), (requested_by, status), (officer, status)
```

## Backend Enhancements Made

1. **Added `free-slots` endpoint** to `AppointmentAvailabilityViewSet`
   - Groups available slots by date
   - Filters by preferred_date and officer_id
   - Excludes booked slots

2. **Enhanced `update_status` action** in `AppointmentViewSet`
   - Accepts `rejection_reason` parameter
   - Validates rejection requires reason
   - Sends appropriate notifications

3. **Notification system** in `_send_appointment_notifications()`
   - Creates notifications for relevant users
   - Broadcasts via WebSocket
   - Customized messages per status

## Frontend Components Structure

```
frontend/src/
├── components/
│   ├── scheduling/
│   │   ├── SlotPicker.jsx
│   │   └── AppointmentRequestForm.jsx
│   ├── User/
│   │   └── Appointments.jsx (enhanced)
│   ├── Officer/
│   │   └── OfficerSchedule.jsx (new)
│   └── UI/
│       └── Toast.jsx (new)
├── hooks/
│   └── useToast.js (new)
└── services/
    └── api.js (enhanced with appointment methods)
```

## Testing the System

### Prerequisites
1. Backend running with Django
2. Frontend built and served
3. At least one officer user created
4. At least one regular user created

### Test Flow

**As Officer:**
1. Go to Officer Dashboard → Schedule
2. Add availability slots for upcoming dates
3. Verify slots appear in "Your Availability"

**As User:**
1. Go to User Dashboard → Appointments
2. Click "+ New Request"
3. Fill form and select a slot
4. Submit and verify toast notification
5. Check appointment appears in list with "pending" status

**Back as Officer:**
1. Refresh Officer Dashboard
2. See appointment request in "Appointment Requests"
3. Click "Confirm" or "Reject"
4. If reject, enter reason in modal

**Back as User:**
1. Refresh User Dashboard
2. Verify appointment status changed
3. Check for notification toast

## Performance Considerations

- **Slot Grouping:** Done on backend to reduce data transfer
- **Pagination:** Appointments list supports pagination (future enhancement)
- **Caching:** Officer availability slots cached in component state
- **Lazy Loading:** Appointments loaded on tab switch
- **Optimistic Updates:** UI updates immediately, syncs with backend

## Security

- **Authentication:** All endpoints require JWT token
- **Authorization:** 
  - Users can only see their own appointments
  - Officers can only manage their own availability
  - Admins can see all
- **Validation:** 
  - Slot overlap prevention
  - Double-booking prevention
  - Status transition validation
- **Rate Limiting:** Recommended via Django middleware

## Future Enhancements

1. **Calendar View** - Visual calendar instead of list
2. **Recurring Slots** - Officers set recurring availability
3. **Timezone Support** - Handle different timezones
4. **Email Notifications** - Send emails in addition to in-app
5. **SMS Reminders** - Remind users before appointment
6. **Video Integration** - Link to video call for appointment
7. **Rescheduling** - Allow users to reschedule appointments
8. **Analytics** - Track appointment metrics
9. **Bulk Operations** - Officers manage multiple slots at once
10. **Appointment Notes** - Add notes during/after appointment

## Troubleshooting

### "Failed to load available slots"
- Check backend is running
- Verify `/appointment-availabilities/free-slots/` endpoint exists
- Check network tab for 404 or 500 errors
- Ensure officer has created availability slots

### Appointments not appearing
- Verify user is logged in
- Check browser console for errors
- Ensure appointments were created successfully
- Verify status is not "canceled"

### Notifications not showing
- Check WebSocket connection
- Verify notification permissions
- Check browser console for errors
- Ensure backend is broadcasting notifications

## Code Quality

- **Linting:** ESLint configured for React
- **Type Safety:** PropTypes used for component props
- **Error Handling:** Try-catch blocks with user-friendly messages
- **Code Organization:** Modular components with single responsibility
- **Documentation:** Inline comments for complex logic

## Deployment

1. Build frontend: `npm run build`
2. Serve dist folder via web server
3. Ensure backend API is accessible
4. Configure CORS if needed
5. Set up WebSocket for real-time notifications
6. Configure email service for notifications (optional)

---

**System Status:** ✅ Production Ready
**Last Updated:** April 26, 2026
