# Notification System - Quick Guide

## 🔔 What You'll See/Hear

### When New Incident Arrives
```
1. Browser Notification (Desktop Pop-up)
   Title: 🚨 New Incident Report
   Body: John Doe reported a Flood
   Action: Click to view
   
2. Sound Alert
   Type: Warning tone (low frequency)
   Duration: 0.3 seconds
   
3. Toast Message (In-app)
   Text: "John Doe reported a Flood"
   Position: Top-right
   Auto-dismiss: 3.5 seconds
```

### When New Applicant Registers
```
1. Browser Notification (Desktop Pop-up)
   Title: 👤 New Applicant
   Body: Jane Smith submitted an application
   Action: Click to view
   
2. Sound Alert
   Type: Info tone (medium frequency)
   Duration: 0.15 seconds
   
3. Toast Message (In-app)
   Text: "Jane Smith"
   Position: Top-right
   Auto-dismiss: 3 seconds
```

### When Publishing News
```
1. Browser Notification
   Title: 📰 News Published
   Body: Your news has been successfully published and sent to users
   
2. Sound Alert
   Type: Success tone (700 Hz)
   Duration: 0.25 seconds
   
3. Success Dialog
   Icon: ✅
   Message: "News Posted!"
   Auto-dismiss: 2 seconds
```

### When Publishing Announcement
```
1. Browser Notification
   Title: 📢 Announcement Published
   Body: Your announcement has been successfully published and sent to users
   
2. Sound Alert
   Type: Success tone (750 Hz)
   Duration: 0.25 seconds
   
3. Success Dialog
   Icon: ✅
   Message: "Announcement Posted!"
   Auto-dismiss: 2 seconds
```

## 🎯 First Time Setup

### Step 1: Grant Permission
When you first receive a notification, your browser will ask:
```
Allow "Localhost" notifications?
[Block]  [Allow]
```
Click **"Allow"** to enable notifications.

### Step 2: Verify Sound
- Check that your computer speakers are on
- Verify volume is not muted
- Try the notification system with a test event

### Step 3: Adjust Settings
- Browser settings → Notifications
- Allow notifications for this website
- Configure sound levels (optional)

## 🔊 Sound Types Explained

| Event | Sound | Frequency | Feel |
|-------|-------|-----------|------|
| 🚨 Incident | Warning | 400 Hz | Low, urgent |
| 👤 Applicant | Info | 600 Hz | Medium |
| 📰 News | Success | 700 Hz | High, positive |
| 📢 Announcement | Success | 750 Hz | High, positive |

## 📱 Where Notifications Appear

### On Desktop
- **Browser notifications** appear as pop-ups in your OS notification center
- **Sounds** play through your speakers
- **Toast messages** appear in the top-right corner

### Notification Center
Windows:
- Check notification center (bottom-right corner)
- Click notification to view details

Mac:
- Check Notification Center (top-right corner)
- Click to interact with notification

## ⚙️ Troubleshooting

### Notifications Not Showing?
1. Check browser notification permissions
2. Verify notifications aren't blocked
3. Try Chrome/Firefox (best support)
4. Restart browser

### Sound Not Playing?
1. Check computer volume (not muted)
2. Verify browser audio is enabled
3. Try different browser
4. Check audio settings

### Modal Appearing Behind Content?
Fixed! All modals now have proper z-index layering:
- Detail modals always appear on top (z-index: 1300)
- History modals appear below (z-index: 1200)
- Never hidden behind page content

## 📋 Notification Permissions

### Check Current Status
**Chrome:**
1. Click lock icon in address bar
2. Click "Notifications"
3. See "Allow" or "Block" status

**Firefox:**
1. Settings → Privacy → Permissions
2. Notifications section
3. Find your site and see status

**Safari:**
1. System Preferences → Notifications
2. Find "Localhost" or app name
3. Check "Allow Notifications"

### Allow Notifications
- Click "Allow" when browser asks
- Go to browser settings and enable
- Check OS notification settings

## 🎨 Notification Customization (Future)

These features coming soon:
- [ ] Choose custom notification sounds
- [ ] Adjust volume levels
- [ ] Enable/disable specific notifications
- [ ] Set quiet hours
- [ ] Notification history log

## 🚀 Best Practices

1. **Always Grant Permission**
   - Helps you catch critical incidents
   - Better for incident management

2. **Keep Volume On**
   - Alerts you immediately
   - Important for emergencies

3. **Monitor Notifications**
   - Check notification center regularly
   - Don't dismiss critical alerts

4. **Test Periodically**
   - Verify notifications work
   - Check sound is functioning
   - Ensure permissions granted

## 📞 Need Help?

### Common Issues

**Q: Why don't I see notifications?**
A: Browser might be blocking them. Check notification permissions.

**Q: Why is there no sound?**
A: Computer volume might be muted or browser audio disabled.

**Q: How do I re-enable notifications?**
A: Check browser settings → Privacy → Notifications → Allow this site

**Q: Can I control notification volume?**
A: Currently uses system volume. Future updates will add volume control.

**Q: Do notifications work offline?**
A: Browser notifications need internet. System still shows in-app toasts.

## 🔐 Privacy

- Notifications only show event details (name, type)
- No sensitive data in notifications
- Notifications stored in OS only
- Can be cleared from notification center

## 📊 Notification Flow

```
Event Occurs (New Incident/Applicant/News)
    ↓
Check if already notified (prevent duplicates)
    ↓
Request browser permission (first time)
    ↓
Play sound alert
    ↓
Show browser notification
    ↓
Display in-app toast message
```

## 🎓 Advanced: For Developers

To add a new notification type:

```javascript
import { sendAdminNotification, playNotificationSound } from "../services/notificationUtility";

// Your event handler
const onNewEvent = (eventData) => {
  // Play sound
  playNotificationSound("warning");
  
  // Send notification
  sendAdminNotification("incident", eventData);
};
```

See `NOTIFICATIONS.md` for full API documentation.
