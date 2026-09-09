# Real-Time Sidebar Notification Debugging Guide

## Problem
Database records are created and delivered, but frontend sidebar doesn't display notifications.

## Fixes Applied

### 1. Frontend Environment Configuration
- ✅ Added `.env.local` with `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`
- ✅ Updated `next.config.js` to expose socket URL
- ✅ Added fallback to localhost if env var not set

### 2. Enhanced Socket Initialization
- ✅ Added detailed logging for socket initialization
- ✅ Added validation for token and user presence
- ✅ Added fallback transports (websocket + polling)
- ✅ Added connection timeout configuration

### 3. Enhanced Notification Listener
- ✅ Added notification data validation
- ✅ Enhanced error handling for invalid notifications
- ✅ Improved duplicate detection logic
- ✅ Added target verification logging

### 4. API Fallback for Notifications
- ✅ Added API fallback to fetch existing notifications
- ✅ Fetches notifications when socket connects
- ✅ Calculates unread count from API data
- ✅ Prevents duplicate API calls

### 5. Enhanced Backend Gateway
- ✅ Added detailed room logging
- ✅ Added connection debugging endpoints
- ✅ Enhanced emit notification logging
- ✅ Added client connection tracking

### 6. TypeScript Fixes
- ✅ Fixed User interface to include 'doctor' role
- ✅ Fixed error.message TypeScript errors
- ✅ Added CSS background-clip compatibility

## Testing Steps

### 1. Verify Backend is Running
```bash
cd backend
npm run start:dev
```

### 2. Verify Frontend is Running
```bash
cd frontend
npm run dev
```

### 3. Check Socket Connection
Open browser console and look for:
- ✅ `🔍 Socket initialization check:` - Should show hasToken: true, hasUser: true
- ✅ `🌐 Connecting to socket:` - Should show the socket URL
- ✅ `✅ Socket connected` - Should show socket ID
- ✅ `📝 Registered user {id} with role {role}` - Should show registration
- ✅ `✅ Socket registration successful:` - Should show success message

### 4. Test Notification Creation
```bash
# Using the test endpoint
curl -X POST http://localhost:3001/notifications/test/patient-registration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "patientName": "Test Patient",
    "patientId": "PAT-2024-0001",
    "tokenNumber": "TK-2024-0001",
    "targetRole": "management"
  }'
```

### 5. Check Gateway Logs
Backend should show:
- ✅ `🔔 EMIT notification={id} targetUser={userId} targetRole={role}`
- ✅ `➡️ Sending to room: role:management`
- ✅ `✅ Sent to role room: role:management`

### 6. Check Frontend Reception
Browser console should show:
- ✅ `🔔 Socket notification received:` - Should show notification data
- ✅ `🎯 Target info:` - Should show target verification
- ✅ `✅ Adding new notification to state:` - Should show notification ID
- ✅ `📊 Unread count updated:` - Should show count increase

### 7. Check Sidebar Display
- ✅ Connection status indicator should be green (●)
- ✅ Unread count badge should appear
- ✅ Notifications should be visible in panel

## Debugging Endpoints

### Check Connected Clients
```bash
curl http://localhost:3001/notifications/debug/connected-clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check User Connection
```bash
curl http://localhost:3001/notifications/debug/user-connection/{userId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Queue Status
```bash
curl http://localhost:3001/notifications/queue/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Health Status
```bash
curl http://localhost:3001/notifications/monitoring/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Common Issues & Solutions

### Issue: Socket Not Connecting
**Symptoms**: Connection status shows red, no connection logs
**Solutions**:
1. Check backend is running on port 3001
2. Verify `NEXT_PUBLIC_SOCKET_URL` is set correctly
3. Check firewall/network settings
4. Verify JWT token is valid

### Issue: Registration Fails
**Symptoms**: Registration error in console
**Solutions**:
1. Verify user object has valid `id` and `role`
2. Check JWT token is not expired
3. Verify user role matches expected values (case-sensitive)

### Issue: Notifications Not Received
**Symptoms**: Socket connected but no notifications
**Solutions**:
1. Check user is in correct room (role:user combination)
2. Verify notification target matches user role/id
3. Check gateway logs for room membership
4. Test with debug endpoints

### Issue: Sidebar Not Updating
**Symptoms**: Notifications received but sidebar unchanged
**Solutions**:
1. Check React state updates
2. Verify `useSocket` hook is properly called
3. Check for console errors in sidebar component
4. Verify notification data structure

### Issue: Unread Count Not Updating
**Symptoms**: Notifications received but count stays 0
**Solutions**:
1. Check localStorage synchronization
2. Verify `markRead` function is called correctly
3. Check for duplicate prevention logic
4. Verify notification `isRead` status

## Manual Testing Flow

1. **Login as Management User**
   - Go to `/login`
   - Enter management credentials
   - Verify successful login

2. **Check Connection Status**
   - Look at sidebar notification indicator
   - Should be green (●) if connected
   - Check browser console for connection logs

3. **Register New Patient**
   - Go to receptionist registration
   - Register a new patient
   - Check backend logs for notification creation

4. **Verify Notification Reception**
   - Check browser console for notification logs
   - Verify unread count increases
   - Check sidebar notification panel

5. **Test Notification Display**
   - Click notification button in sidebar
   - Verify notifications appear in panel
   - Verify notification details are correct

## Advanced Debugging

### Enable Verbose Logging
In `useSocket.ts`, the following are already enabled:
- Socket initialization logs
- Connection status logs
- Registration logs
- Notification reception logs
- Target verification logs

### Monitor Network Traffic
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by WS (WebSocket)
4. Check socket connection and messages

### Check Room Membership
1. Use debug endpoint: `/notifications/debug/connected-clients`
2. Verify your user is in the correct room
3. Check room membership in gateway logs

### Test Notification Routing
1. Create test notification via API
2. Check gateway logs for routing
3. Verify room targeting
4. Check frontend reception

## Performance Considerations

### Socket Connection
- Uses WebSocket with polling fallback
- Reconnection attempts: 5 with 1s delay
- Connection timeout: 10s
- Automatic re-registration on reconnection

### Notification State
- Limited to 50 notifications in memory
- Uses localStorage for persistence
- Cross-tab synchronization enabled
- Idempotency to prevent duplicates

### API Fallback
- Fetches notifications when socket connects
- Prevents duplicate API calls
- Updates unread count from API data
- One-time fetch per session

## Security Considerations

- JWT token required for socket connection
- User authentication verified on registration
- Room-based access control
- Notification targeting validation
- Rate limiting on API endpoints

## Next Steps if Issues Persist

1. **Check Browser Console**: Look for error messages
2. **Check Backend Logs**: Look for gateway errors
3. **Verify Network**: Check CORS and firewall settings
4. **Test API Endpoints**: Verify backend is responding
5. **Test Socket Directly**: Use socket.io client tester
6. **Check Database**: Verify notifications are being created
7. **Restart Services**: Clear cache and restart

## Success Indicators

✅ Socket connects successfully
✅ User registers with correct role
✅ Room membership confirmed
✅ Notifications created in database
✅ Gateway emits to correct room
✅ Frontend receives notification
✅ State updates correctly
✅ Sidebar displays notifications
✅ Unread count updates
✅ Toast notifications appear
✅ Browser notifications work (if permitted)

## Monitoring Checklist

- [ ] Socket connection status: Connected
- [ ] User registration: Successful
- [ ] Room membership: Confirmed
- [ ] Notification creation: Working
- [ ] Gateway emission: Working
- [ ] Frontend reception: Working
- [ ] State updates: Working
- [ ] Sidebar display: Working
- [ ] Unread count: Working
- [ ] Toast notifications: Working
- [ ] Browser notifications: Working