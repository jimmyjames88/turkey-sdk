# @jimmyjames88/turkey-sdk-next

Next.js middleware wrapper for TurKey SDK - Edge Runtime compatible.

## Installation

```bash
npm install @jimmyjames88/turkey-sdk-next
```

## Quick Start

Create a middleware file in your Next.js project:

```typescript
// middleware.ts
import { createTurKeyMiddleware } from '@jimmyjames88/turkey-sdk-next'

export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
  publicRoutes: ['/auth/*', '/api/public/*'],
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

## Configuration

```typescript
interface TurKeyMiddlewareConfig {
  /** Base URL of TurKey authentication server */
  baseUrl: string
  /** Application ID for token validation (required for security) */
  appId: string
  /** Routes that require authentication (default: all routes) */
  protectedRoutes?: string[]
  /** Routes that should be publicly accessible (ignored if protectedRoutes is set) */
  publicRoutes?: string[]
  /** Where to redirect unauthenticated users (default: '/auth/login') */
  loginUrl?: string
  /** Enable development mode logging */
  debug?: boolean
}
```

## Usage in API Routes

Access authenticated user information in API routes:

```typescript
// app/api/protected/route.ts
import { getTurKeyUser } from '@jimmyjames88/turkey-sdk-next'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const user = getTurKeyUser(request)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  return Response.json({
    email: user.email,
    role: user.role,
  })
}
```

## Usage in Server Components

```typescript
// app/dashboard/page.tsx
import { getTurKeyUser } from '@jimmyjames88/turkey-sdk-next'
import { headers } from 'next/headers'

export default async function DashboardPage() {
  const headersList = await headers()
  const userHeader = headersList.get('x-turkey-user')
  const user = userHeader ? JSON.parse(userHeader) : null

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
    </div>
  )
}
```

## Route Protection Patterns

### Protect specific routes

```typescript
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
  protectedRoutes: ['/dashboard/*', '/api/protected/*'],
})
```

### Public routes (everything else requires auth)

```typescript
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
  publicRoutes: ['/auth/*', '/api/public/*', '/'],
})
```

## Edge Runtime Compatibility

This package is specifically designed for Next.js Edge Runtime:

- ✅ No React dependencies
- ✅ Uses `jose` for JWT verification (Edge Runtime compatible)
- ✅ No Node.js-specific APIs
- ✅ Minimal dependencies
- ✅ Tree-shakeable

## Environment Variables

```env
TURKEY_BASE_URL=http://localhost:3000
TURKEY_APP_ID=your-app-id
```

## Features

- 🔒 **Automatic JWT verification** using JWKS from TurKey server
- 🚀 **Edge Runtime optimized** - fast cold starts
- 🎯 **Flexible route protection** - protect specific routes or make routes public
- 📦 **Zero configuration** - works out of the box with sensible defaults
- 🔍 **Development logging** - automatic debug mode in development
- 🌐 **Multi-app support** - validates app ID for security

## Token Sources

The middleware automatically checks for tokens in:

1. `Authorization: Bearer <token>` header
2. `turkey_access_token` cookie
3. `x-turkey-token` custom header

## Security

- Uses ES256 (Elliptic Curve) algorithm for JWT verification
- Validates token signature against TurKey's JWKS
- Validates app ID to prevent token reuse across apps
- JWKS caching for performance (prevents refetch on every request)

## License

MIT

## Related Packages

- [`@jimmyjames88/turkey-sdk`](../turkey-sdk) - Core SDK with React hooks and client utilities
