// Stricter per-IP limits for credential / OTP / invitation endpoints (5 requests / minute).
// Names must match a ThrottlerModule.forRoot() definition; we override 'medium'.
export const SENSITIVE_THROTTLE = { medium: { limit: 5, ttl: 60000 } };
