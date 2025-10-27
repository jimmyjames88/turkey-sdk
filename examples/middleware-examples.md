# TurKey SDK Middleware Examples

## Zero-Configuration Express Setup

```typescript
import express from 'express'
import { turkeyAuth, optionalAuth } from '@jimmyjames88/turkey-sdk/middleware'

// Set environment variables:
// TURKEY_BASE_URL=https://your-turkey-server.com
// TURKEY_AUDIENCE=my-app

const app = express()

// Protect all API routes with zero configuration
app.use('/api', turkeyAuth())

// Your routes automatically have req.user available
app.get('/api/profile', (req, res) => {
  res.json({
    user: req.user, // ✅ Fully typed user object
    message: `Hello ${req.user.email}!`,
    role: req.user.role,
    tenant: req.user.tenantId,
  })
})

// Optional authentication for public endpoints
app.use('/api/public', optionalAuth())

app.get('/api/public/stats', (req, res) => {
  if (req.user) {
    res.json({
      message: `Personalized stats for ${req.user.email}`,
      isAuthenticated: true,
    })
  } else {
    res.json({
      message: 'General stats for anonymous user',
      isAuthenticated: false,
    })
  }
})

app.listen(3000)
```

## Universal Framework Support

```typescript
import { createTurkeyMiddleware } from '@jimmyjames88/turkey-sdk/middleware'

const middleware = createTurkeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL,
  audience: 'my-app',
})

// Fastify
fastify.addHook('preHandler', middleware)

// Koa
app.use(async (ctx, next) => {
  await middleware(ctx.request, ctx.response, next)
})

// Hapi
server.ext('onRequest', middleware)

// Any Node.js framework that follows (req, res, next) pattern
```

## TypeScript Support

```typescript
import type { ExpressAuthRequest } from '@jimmyjames88/turkey-sdk/middleware'
import { turkeyAuth } from '@jimmyjames88/turkey-sdk/middleware'

// Fully typed request with automatic type inference
app.get('/api/profile', turkeyAuth(), (req: ExpressAuthRequest, res) => {
  // req.user is automatically typed as TurKeyUser
  const userId: string = req.user.id
  const userEmail: string = req.user.email
  const userRole: string = req.user.role
  const tenantId: string = req.user.tenantId

  res.json({ userId, userEmail, userRole, tenantId })
})
```

## Development Mode

```typescript
// Automatic development mode with NODE_ENV=development
// Provides enhanced logging and detailed error messages

// Manual development mode override
app.use(
  '/api',
  turkeyAuth({
    development: true,
    onError: (error, req, res) => {
      console.log('🔍 Auth Error Details:', {
        error: error.message,
        path: req.path,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      })

      return res.status(401).json({
        error: 'AUTHENTICATION_FAILED',
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    },
  })
)
```

## Architecture Benefits

### Before (Manual Implementation)

```typescript
// 40+ lines of boilerplate per app
app.use('/api', async (req, res, next) => {
  try {
    // Extract token from multiple sources
    const token =
      req.cookies?.turkey_access_token ||
      req.headers?.authorization?.replace('Bearer ', '') ||
      req.headers?.['x-access-token']

    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    // Verify against TurKey server
    const payload = await verifyJwt(token, {
      baseUrl: process.env.TURKEY_BASE_URL,
      audience: process.env.TURKEY_AUDIENCE,
    })

    // Attach user data
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    }

    next()
  } catch (error) {
    // Handle various error types
    if (error.message.includes('expired')) {
      return res.status(401).json({ error: 'TOKEN_EXPIRED' })
    }
    // ... more error handling
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
})
```

### After (Zero-Config Middleware)

```typescript
// 1 line of code
app.use('/api', turkeyAuth())
```

**Benefits:**

- ✅ 97% less code
- ✅ Zero configuration required
- ✅ Full TypeScript support
- ✅ Works with any Node.js framework
- ✅ Consistent error handling
- ✅ Development mode debugging
- ✅ Automatic token extraction
- ✅ Built-in security best practices
