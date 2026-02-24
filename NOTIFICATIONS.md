# Notification System Documentation

## Overview
The Agapay Admin panel now includes a comprehensive notification system with the following features:

1. **Browser Notifications** - Desktop notifications for all events
2. **Sound Notifications** - Audio alerts when events occur
3. **Toast Messages** - In-app notification messages
4. **Admin Alerts** - Special notifications for incident/applicant events

## Features

### 1. Incident Notifications
When a new incident is received:
- 🔔 Browser notification appears
- 🔊 Warning sound plays
- 💬 Toast message displays in-app
- Notification includes: Sender name, Disaster type

### 2. Applicant Notifications
When a new applicant registers:
- 🔔 Browser notification appears
- 🔊 Info sound plays
- 💬 Toast message displays in-app
- Notification includes: Full name, Status (pending)

### 3. News Publishing Notifications
When you publish a news article:
- 🔊 Success sound plays (admin notification)
- 🔔 Browser notification confirms publishing
- ✅ Toast message shows success

### 4. Announcement Publishing Notifications
When you publish an announcement:
- 🔊 Success sound plays (admin notification)
- 🔔 Browser notification confirms publishing
- ✅ Toast message shows success

## Sound Types

The system uses Web Audio API to generate different notification sounds:

| Event | Sound Type | Frequency | Duration | Use Case |
|-------|-----------|-----------|----------|----------|
| Incident | Warning | 400 Hz | 0.3s | Critical alerts |
| Applicant | Info | 600 Hz | 0.15s | New registrations |
| News | Success | 700 Hz | 0.25s | News published |
| Announcement | Success | 750 Hz | 0.25s | Announcement published |

## Browser Notification Permissions

### First Time Setup
When you first use the application:
1. Browser will ask for notification permission
2. Click **"Allow"** to enable notifications
3. Notifications will then appear for all events

### Managing Permissions
**Chrome/Chromium:**
- Click the lock icon in the URL bar
- Select "Notifications"
- Change to "Allow"

**Firefox:**
- Preferences → Privacy → Notifications
- Allow notifications for your domain

**Safari:**
- System Preferences → Notifications
- Find Agapay Admin and enable

## API Reference

### Import Notification Utilities
```javascript
import {
  sendBrowserNotification,
  playNotificationSound,
  sendAdminNotification,
  sendNewsPublishedNotification,
  sendAnnouncementPublishedNotification,
  requestNotificationPermission,
} from "../services/notificationUtility";
```

### Play Sound
```javascript
playNotificationSound("success");  // success, info, warning, news, announcement
```

### Send Browser Notification
```javascript
sendBrowserNotification("Title", {
  body: "Message text",
  tag: "unique-id",  // Prevents duplicate notifications
  requireInteraction: true,  // User must dismiss
});
```

### Request Permission
```javascript
const hasPermission = await requestNotificationPermission();
if (hasPermission) {
  console.log("Notifications enabled");
}
```

### Admin Notifications
```javascript
// For new incident
sendAdminNotification("incident", {
  id: "123",
  senderName: "John Doe",
  disasterType: "Flood",
});

// For new applicant
sendAdminNotification("applicant", {
  id: "456",
  firstName: "Jane",
  lastName: "Smith",
});
```

## Implementation Details

### Notification Utility Service
File: `src/services/notificationUtility.js`

Functions:
- `playNotificationSound(soundType)` - Generates and plays notification sounds
- `sendBrowserNotification(title, options)` - Shows browser notification
- `requestNotificationPermission()` - Asks user for permission
- `sendAdminNotification(type, data)` - Comprehensive admin alert
- `sendNewsPublishedNotification()` - News publishing alert
- `sendAnnouncementPublishedNotification()` - Announcement publishing alert

### Service Integrations

#### Incidents Service
- `subscribeToIncidents()` - Enhanced with sound + browser notifications
- Plays warning sound for critical incident reports
- Shows notification with incident details

#### Applicants Service
- `subscribeToUsers()` - Enhanced with notifications
- Plays info sound for new applicants
- Shows notification with applicant details

#### News Page
- Plays "news" sound when publishing
- Shows success browser notification
- Integrates with existing toast system

#### Announcement Page
- Plays "announcement" sound when publishing
- Shows success browser notification
- Integrates with existing toast system

## Z-Index Hierarchy

Modal dialog z-index values (highest to lowest):
```
Detail Modal (.detail-overlay)        → z-index: 1300
History Modal (.history-overlay)      → z-index: 1200
Modal Overlay                         → z-index: 1000
Default content                       → z-index: 0
```

This ensures dialogs appear above all content correctly.

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Chromium 76+
- ✅ Firefox 67+
- ✅ Safari 13+
- ✅ Edge 79+

### Fallback Behavior
If browser doesn't support notifications:
- System logs warnings to console
- Application continues to function normally
- Only toast messages display in-app

### Fallback Sound
If Web Audio API fails:
- System logs warning to console
- Toast notifications still work
- Application continues normally

## Testing

### Test Notifications
1. Go to Incidents page
2. Simulate new incident (via Firestore)
3. Verify sound plays and browser notification appears

### Test Sound
- Check browser console for any errors
- Verify speaker/volume is not muted
- Test different event types

### Test Permissions
- Clear site data (Settings → Privacy → Clear browsing data)
- Revisit application
- Check permission prompt appears

### Verify Z-Index
- Open History modal
- Click "View" to open detail modal
- Detail modal should appear in front

## Troubleshooting

### Notifications Not Appearing
**Issue:** Browser notifications not showing
**Solutions:**
1. Check browser notification permissions
2. Verify notifications are enabled in browser settings
3. Check system notification settings (OS level)
4. Look for "muted" notifications in browser

### Sound Not Playing
**Issue:** Notification sounds don't play
**Solutions:**
1. Check browser audio settings
2. Verify system volume is not muted
3. Check browser console for errors
4. Try different browser

### Dialog Appearing Behind Content
**Issue:** Modal appears below other elements
**Solutions:**
1. Check z-index values in CSS
2. Verify `.detail-overlay` has `z-index: 1300`
3. Check for CSS conflicts
4. Use browser DevTools to inspect z-index

## Future Enhancements

1. **Custom Sound Upload** - Allow admins to choose custom notification sounds
2. **Notification Preferences** - Let users disable specific notification types
3. **Sound Volume Control** - Adjustable notification volume
4. **Vibration API** - Haptic feedback on mobile
5. **Notification Queue** - Batch multiple notifications
6. **Notification History** - Log all notifications sent
7. **Email Alerts** - Send critical incidents via email
8. **SMS Alerts** - Send SMS for critical incidents

## Support

For issues or feature requests related to notifications, please:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify all required permissions are granted
4. Check notification utility service implementation
