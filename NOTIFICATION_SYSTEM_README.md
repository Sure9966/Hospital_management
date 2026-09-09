# Reliable Real-Time Notification System

A production-ready notification system built with Socket.IO and Chrome Notification API that ensures reliable delivery, prevents crashes, and provides comprehensive monitoring.

## Features

### ✅ Reliability Guarantees
- **Retry Queue**: Automatic retry with exponential backoff (1s, 5s, 15s)
- **Dead Letter Queue**: Failed notifications are preserved for manual inspection/retry
- **Circuit Breaker**: SMTP failures never block notification delivery
- **Idempotency**: Duplicate notifications are automatically prevented
- **Error Isolation**: Failures in one component never crash the entire system

### ✅ User/Role Targeting
- **User-specific**: Notifications targeted to specific users via `targetUserId`
- **Role-based**: Notifications sent to entire roles via `targetRole`
- **Broadcast**: System-wide notifications when no target is specified
- **Room Management**: Automatic Socket.IO room management for efficient delivery

### ✅ Browser Integration
- **Chrome Notification API**: Native desktop notifications
- **Permission Handling**: Smart permission request with fallback UI
- **Cross-tab Sync**: Unread counts synchronized across browser tabs
- **Graceful Degradation**: Works even when notifications are blocked

### ✅ Monitoring & Debugging
- **Delivery Tracking**: Real-time status of every notification
- **Health Reports**: System health with automatic recommendations
- **Metrics Dashboard**: Delivery rates, failure rates, performance metrics
- **Comprehensive Logging**: Detailed logs for troubleshooting

## Architecture

### Backend Components

#### 1. Notification Entity (`notification.entity.ts`)
Extended with delivery tracking:
- `deliveryStatus`: pending, delivered, failed, retrying
- `retryCount`: Number of retry attempts
- `lastError`: Last error message
- `metadata`: JSON field for custom data (idempotency keys, etc.)

#### 2. Notification Queue Service (`notification-queue.service.ts`)
- In-memory queue with retry logic
- Exponential backoff: 1s → 5s → 15s
- Max 3 retry attempts before dead letter queue
- Batch processing to prevent system overload
- Automatic cleanup of old notifications

#### 3. Circuit Breaker Service (`circuit-breaker.service.ts`)
- Protects SMTP from cascading failures
- States: CLOSED → OPEN → HALF_OPEN → CLOSED
- Configurable thresholds and timeouts
- Automatic recovery with fallback support

#### 4. Dead Letter Queue Service (`dead-letter-queue.service.ts`)
- Stores permanently failed notifications
- Bulk retry capabilities
- Statistics and reporting
- Automatic cleanup of old items

#### 5. Notification Monitoring Service (`notification-monitoring.service.ts`)
- Real-time metrics collection
- Health status monitoring
- User/role-specific statistics
- Historical data tracking

#### 6. Enhanced Gateway (`notifications.gateway.ts`)
- Comprehensive error handling
- Connection state tracking
- Registration acknowledgment
- User connection status queries

### Frontend Components

#### 1. Enhanced useSocket Hook (`useSocket.ts`)
- Connection status tracking
- Permission management
- Cross-tab synchronization
- Idempotency via localStorage
- Automatic reconnection

#### 2. Browser Notifications (`browserNotifications.ts`)
- Permission checking and requesting
- Graceful degradation
- Help text and status icons
- Fallback UI support

#### 3. Permission Banner (`NotificationPermissionBanner.tsx`)
- User-friendly permission request
- Smart dismissal handling
- Visual status indicators

## API Endpoints

### Notification Management
- `GET /notifications` - Get user's notifications
- `PATCH /notifications/:id/read` - Mark as read
- `PATCH /notifications/read-all` - Mark all as read

### Queue Management
- `GET /notifications/queue/status` - Get queue status
- `POST /notifications/queue/:id/retry` - Retry specific notification

### Circuit Breaker
- `GET /notifications/circuit-breaker/:name/status` - Get circuit status
- `POST /notifications/circuit-breaker/:name/reset` - Reset circuit

### Dead Letter Queue
- `GET /notifications/dead-letter-queue` - Get failed notifications
- `GET /notifications/dead-letter-queue/stats` - Get DLQ statistics
- `POST /notifications/dead-letter-queue/:id/retry` - Retry from DLQ
- `POST /notifications/dead-letter-queue/bulk-retry` - Bulk retry
- `DELETE /notifications/dead-letter-queue/purge` - Purge notifications

### Monitoring
- `GET /notifications/monitoring/metrics` - Current metrics
- `GET /notifications/monitoring/metrics/history` - Historical metrics
- `GET /notifications/monitoring/failed` - Failed notifications
- `GET /notifications/monitoring/health` - Health report
- `GET /notifications/monitoring/user/:userId` - User statistics
- `GET /notifications/monitoring/role/:role` - Role statistics

## Usage Examples

### Backend: Sending Notifications

```typescript
// Send to specific user
await this.notificationsService.sendToUser(
  'Appointment Reminder',
  'Your appointment is in 30 minutes',
  userId,
  'appointment',
  appointmentId,
  currentUserId,
  `appointment-${appointmentId}-${timestamp}` // Idempotency key
);

// Send to role
await this.notificationsService.sendToRole(
  'Emergency Alert',
  'Critical patient condition in Room 302',
  'nurse',
  'critical_vitals',
  patientId,
  currentUserId,
  `critical-${patientId}-${timestamp}` // Idempotency key
);

// Send with custom metadata
await this.notificationsService.create({
  title: 'Custom Notification',
  message: 'This is a custom notification',
  targetUserId: userId,
  type: 'custom',
  metadata: {
    idempotencyKey: 'unique-key',
    customField: 'value',
    priority: 'high'
  }
});
```

### Frontend: Using the Hook

```typescript
function Dashboard() {
  const {
    notifications,
    unreadCount,
    markRead,
    clearNotifications,
    connectionStatus,
    notificationPermission,
    requestPermission,
    canShowNotifications
  } = useSocket();

  return (
    <div>
      <NotificationPermissionBanner />
      
      <div className="flex items-center space-x-2">
        <span>Connection: {connectionStatus}</span>
        <span>Unread: {unreadCount}</span>
        {!canShowNotifications && (
          <button onClick={requestPermission}>
            Enable Notifications
          </button>
        )}
      </div>
      
      <div className="notifications">
        {notifications.map(notification => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}
      </div>
    </div>
  );
}
```

## Configuration

### Environment Variables

```env
# Socket.IO
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# SMTP (optional - failures won't block notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@example.com
```

### Circuit Breaker Configuration

```typescript
// In circuit-breaker.service.ts constructor
this.registerCircuit('smtp', {
  failureThreshold: 3,      // Open after 3 failures
  recoveryTimeout: 120000, // Try recovery after 2 minutes
  monitoringPeriod: 60000  // Monitoring window
});
```

### Retry Configuration

```typescript
// In notification-queue.service.ts
private readonly MAX_RETRIES = 3;
private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
```

## Monitoring & Troubleshooting

### Health Check

```bash
curl http://localhost:3001/notifications/monitoring/health
```

Response:
```json
{
  "status": "healthy",
  "metrics": {
    "totalCreated": 1523,
    "totalDelivered": 1498,
    "totalFailed": 12,
    "deliveryRate": 99.17,
    "failureRate": 0.83
  },
  "issues": [],
  "recommendations": []
}
```

### Check Failed Notifications

```bash
curl http://localhost:3001/notifications/monitoring/failed?limit=10
```

### Retry Dead Letter Queue

```bash
# Retry specific notification
curl -X POST http://localhost:3001/notifications/dead-letter-queue/{id}/retry

# Bulk retry
curl -X POST http://localhost:3001/notifications/dead-letter-queue/bulk-retry \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"]}'
```

### Circuit Breaker Status

```bash
curl http://localhost:3001/notifications/circuit-breaker/smtp/status
```

## Failure Scenarios & Solutions

### Scenario 1: SMTP Server Down
**Problem**: Email notifications fail
**Solution**: Circuit breaker opens, notifications continue via Socket.IO
**Monitoring**: Check circuit breaker status, retry when SMTP is back

### Scenario 2: Socket.IO Connection Lost
**Problem**: User doesn't receive real-time notifications
**Solution**: Automatic reconnection with exponential backoff
**Monitoring**: Check connection status in frontend hook

### Scenario 3: Browser Notifications Blocked
**Problem**: Desktop notifications don't show
**Solution**: Permission banner appears, graceful degradation to in-app toasts
**Monitoring**: Check permission status in frontend

### Scenario 4: High Load
**Problem**: Notification queue grows large
**Solution**: Batch processing, automatic retries, dead letter queue
**Monitoring**: Check queue status endpoint

## Best Practices

1. **Always use idempotency keys** for notifications that could be duplicated
2. **Monitor health reports** regularly to catch issues early
3. **Clean up dead letter queue** periodically to prevent bloat
4. **Use role-based targeting** for broadcast notifications
5. **Handle permission states** gracefully in the frontend
6. **Log metric events** for production monitoring
7. **Test failure scenarios** in development environment

## Security Considerations

- Notifications are authenticated via JWT tokens
- Users can only access their own notifications
- Role-based access control for admin endpoints
- SMTP credentials stored in environment variables
- No sensitive data in notification payloads

## Performance Optimization

- Batch processing in queue (10 items per batch)
- Automatic cleanup of old notifications (30 days)
- Dead letter queue cleanup (7 days)
- Connection pooling for database queries
- Efficient Socket.IO room management

## Future Enhancements

- [ ] Push notification support for mobile devices
- [ ] Notification templates and localization
- [ ] Scheduled/delayed notifications
- [ ] Notification preferences per user
- [ ] Rich notifications with images/actions
- [ ] Analytics dashboard UI
- [ ] Integration with external monitoring services

## License

This notification system is part of the Hospital Management System.