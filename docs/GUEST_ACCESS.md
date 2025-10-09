# Guest Access Feature Documentation

## Overview

SommOS now supports guest access, allowing temporary, read-only access to the wine collection through event codes. This feature is perfect for yacht events, wine tastings, or allowing guests to browse the collection without full system access.

## For Guests

### How to Access as a Guest

1. **Navigate to the login screen**
2. **Click the "Guest Access" tab**
3. **Enter your event code** (provided by the yacht crew)
4. **Enter PIN if required** (check the box if your code needs a PIN)
5. **Click "Join as Guest"**

### Guest Limitations

As a guest user, you have **read-only access**:

✅ **You can:**

- Browse the complete wine collection
- View wine details, tasting notes, and regions
- Search and filter wines
- View wine pairing recommendations
- See inventory levels and locations

❌ **You cannot:**

- Add, edit, or delete wines
- Modify inventory quantities
- Access procurement features
- Create wine pairing feedback
- Change system settings
- Manage other users

### Session Duration

Guest sessions are designed for temporary access:

- **Access Token**: 10 minutes (automatically refreshed)
- **Refresh Token**: 4 hours maximum
- After 4 hours, you'll need to log in again with your event code

A banner at the top of the screen will show when your session expires.

---

## For Crew & Admins

### Creating Guest Invites

#### Via Backend API

Use the `/api/auth/invite` endpoint to create guest invites:

```bash
curl -X POST http://your-server.com/api/auth/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: sommos_access_token=YOUR_TOKEN" \
  -d '{
    "email": "guest@example.com",
    "role": "guest",
    "expires_in_hours": 24,
    "pin": "1234"
  }'
```

**Parameters:**

- `email` (required): Guest email (used for identification)
- `role` (required): Must be "guest"
- `expires_in_hours` (optional): Hours until code expires (default: 24)
- `pin` (optional): 4-6 digit PIN for additional security

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "abc123def456...",
    "email": "guest@example.com",
    "role": "guest",
    "expires_at": "2025-10-04T15:30:00Z",
    "requires_pin": true
  }
}
```

The `token` field is the **event code** that guests will use to log in.

### Managing Guest Invites

#### Listing Active Invites

```sql
-- View active guest invites
SELECT 
    email,
    role,
    expires_at,
    accepted_at,
    created_at
FROM Invites
WHERE role = 'guest' 
  AND datetime(expires_at) > datetime('now')
ORDER BY created_at DESC;
```

#### Revoking an Invite

```sql
-- Delete an invite to revoke access
DELETE FROM Invites 
WHERE email = 'guest@example.com' 
  AND role = 'guest';
```

### Best Practices

1. **Event-Specific Codes**
   - Create unique codes for each event
   - Use descriptive emails like `wine-tasting-2025@event.local`

2. **PIN Protection**
   - Use PINs for private events
   - Share PINs separately from event codes for security

3. **Expiration Times**
   - Match expiration to event duration
   - Add a buffer (e.g., 48 hours for a 24-hour event)

4. **Code Distribution**
   - Print QR codes with event information
   - Email codes to registered guests
   - Display codes at check-in areas

5. **Monitoring**
   - Check guest access logs regularly
   - Revoke codes after events conclude
   - Clean up expired invites periodically

### Security Considerations

- Guest sessions use shorter-lived tokens (10 min access vs 15 min for members)
- Guest refresh tokens expire after 4 hours (vs 7 days for members)
- All guest actions are logged with role='guest'
- Guests cannot escalate privileges or access admin functions
- Event codes are hashed in the database
- PINs are bcrypt-hashed with 12 rounds

---

## Technical Details

### Database Schema

```sql
CREATE TABLE Invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'crew', 'guest')),
    token_hash TEXT NOT NULL UNIQUE,
    pin_hash TEXT,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guest/session` | POST | Create guest session with event code |
| `/api/auth/invite` | POST | Create new guest invite (admin only) |
| `/api/auth/refresh` | POST | Refresh guest session tokens |
| `/api/auth/logout` | POST | End guest session |

### Frontend Components

- **Login Screen**: Tabbed interface for member/guest login
- **Guest Banner**: Persistent banner showing guest status and expiration
- **Role Visibility**: UI elements hidden/disabled based on role
- **Read-only Indicators**: Visual cues for restricted actions

---

## Troubleshooting

### "Event code not found or has expired"

- **Cause**: Code is invalid or past expiration time
- **Solution**: Request a new code from the crew

### "This event code requires a PIN"

- **Cause**: The invite was created with PIN protection
- **Solution**: Check the "This code requires a PIN" box and enter the PIN

### "Incorrect PIN"

- **Cause**: Wrong PIN entered
- **Solution**: Verify PIN with event organizer

### "Session has expired"

- **Cause**: 4-hour guest session limit reached
- **Solution**: Re-enter your event code to start a new session

### Guest cannot see certain features

- **Expected**: Guests have read-only access by design
- **Solution**: Contact crew to upgrade to full member access

---

## Future Enhancements

- [ ] UI for creating/managing invites in the admin panel
- [ ] QR code generation for event codes
- [ ] Usage analytics for guest invites
- [ ] Multi-use invite codes with usage limits
- [ ] Email notifications when codes are used
- [ ] Guest feedback collection
- [ ] Custom welcome messages per invite

---

## Support

For questions or issues with guest access:

1. Check this documentation
2. Contact your yacht crew or system administrator
3. Review logs in `/backend/logs/` for technical issues

---

**Version**: 1.0  
**Last Updated**: 2025-10-03  
**Compatible with**: SommOS v1.0+
