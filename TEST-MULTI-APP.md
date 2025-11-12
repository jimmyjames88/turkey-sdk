# Multi-App Isolation Test Suite

## Overview

This test suite validates that Turkey authentication server properly isolates users and tokens across different applications using the same authentication backend.

## Prerequisites

1. **Turkey server running** on `http://localhost:3000` (or set `TURKEY_BASE_URL`)
2. **PostgreSQL database** with latest migrations applied
3. **turkey-sdk** built (`npm run build` in `packages/turkey-sdk/`)

## Running the Tests

```bash
# From turkey-sdk root directory
npx tsx test-multi-app-isolation.ts

# Or with custom Turkey server URL
TURKEY_BASE_URL=http://localhost:3000 npx tsx test-multi-app-isolation.ts
```

## What It Tests

### Test 1: Same email registration across apps
✅ Verifies same email can register in different apps (different user records)

### Test 2: Independent login per app
✅ Verifies each app can login independently with different tokens

### Test 3: JWT audience claims
✅ Verifies JWT tokens have app-specific audience claims (`test-app-1`, `test-app-2`)

### Test 4: Cross-app token verification
✅ Verifies tokens from one app are rejected by another app's client

### Test 5: User ID isolation
✅ Verifies same email has different user IDs in different apps

### Test 6: Token revocation isolation
✅ Verifies revoking tokens in one app doesn't affect the other app

## Expected Output

```
🧪 Multi-App Isolation Test Suite

============================================================

📝 Test 1: Same email can register in different apps
✅ App1 registration successful - User ID: xxx
✅ App2 registration successful - User ID: yyy
✅ Different user IDs confirmed (proper isolation)

🔐 Test 2: Login to both apps independently
✅ App1 login successful
✅ App2 login successful
✅ Different access tokens confirmed

🎯 Test 3: JWT audience claims are app-specific
App1 JWT audience: test-app-1
App2 JWT audience: test-app-2
✅ Audience claims properly isolated

🛡️  Test 4: Cross-app token verification fails
✅ App1 token correctly rejected by App2 client (threw error)

👤 Test 5: Profile data is app-isolated
App1 user ID from token: xxx
App2 user ID from token: yyy
✅ Same email, different user IDs (proper isolation)

🚫 Test 6: Token revocation is app-isolated
✅ App1 token revoked
✅ App1 can still login (revocation only affects tokens, not account)
✅ App2 token still works (revocation is app-isolated)

============================================================

📊 Test Results:
   ✅ Passed: 6/6
   ❌ Failed: 0/6

🎉 All tests passed! Multi-app isolation is working correctly.
```

## Troubleshooting

### Server not running
```
❌ FAILED: fetch failed
```
**Solution**: Start Turkey server with `npm run dev` in turkey directory

### Migration issues
```
❌ FAILED: column "app_id" does not exist
```
**Solution**: Run migrations with `npm run gravy db migrate` in turkey directory

### User already exists
```
❌ FAILED: User already exists
```
**Solution**: Clean up test data:
```bash
cd turkey
PGPASSWORD='your-db-password' psql -U postgres -d turkey -c "DELETE FROM users WHERE email = 'isolation-test@example.com';"
```

## Cleanup

The test creates two users (`isolation-test@example.com` in `test-app-1` and `test-app-2`). To clean up:

```bash
cd turkey
PGPASSWORD='your-db-password' psql -U postgres -d turkey -c "DELETE FROM users WHERE email = 'isolation-test@example.com';"
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# Example GitHub Actions
- name: Run Multi-App Isolation Tests
  env:
    TURKEY_BASE_URL: http://localhost:3000
  run: |
    cd turkey-sdk
    npx tsx test-multi-app-isolation.ts
```

## Related Documentation

- [Turkey Server Production Setup](../turkey/PRODUCTION_DB_SETUP.md)
- [Turkey SDK Middleware Guide](./MIDDLEWARE-GUIDE.md)
- [Multi-App Architecture](../turkey/README.md#multi-app-support)
