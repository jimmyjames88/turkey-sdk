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

// Zero-config: uses sensible defaults
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

That's it! The middleware will automatically:

- Protect `/dashboard`, `/profile`, `/settings` routes
- Allow public access to all other routes
- Redirect unauthenticated users to `/auth/login`
- Redirect authenticated users away from `/auth/login` and `/auth/register`
- Return 401 JSON for `/api/protected/*`, allow other APIs

## Configuration

```typescript
interface TurKeyMiddlewareConfig {
  /** Base URL of TurKey authentication server */
  baseUrl: string
  /** Application ID for token validation (required for security) */
  appId: string

  /** Optional redirect URLs (uses sensible defaults) */
  redirects?: {
    /** Where to redirect unauthenticated users (default: '/auth/login') */
    unauthenticated?: string
    /** Where to redirect authenticated users from auth-only pages (default: '/dashboard') */
    authenticated?: string
  }

  /** Optional route configuration (uses sensible defaults) */
  routes?: {
    /** Routes requiring authentication (default: ['/dashboard', '/profile', '/settings']) */
    protected?: string[]
    /** Auth-only routes that redirect if authenticated (default: ['/auth/login', '/auth/register']) */
    authOnly?: string[]
    /** Protected API routes (default: ['/api/protected']) */
    protectedApi?: string[]
  }

  /** Advanced: custom route type detection function */
  getRouteType?: (
    pathname: string
  ) => 'protected' | 'authOnly' | 'public' | 'protectedApi' | 'publicApi'

  /** Enable development mode logging (default: true in development) */
  debug?: boolean
}
```

## Default Behavior

### Protected Routes (Require Authentication)

By default, these routes redirect unauthenticated users to `/auth/login`:

- `/dashboard/*`
- `/profile/*`
- `/settings/*`

### Auth-Only Routes (Redirect if Authenticated)

These routes redirect authenticated users to `/dashboard`:

- `/auth/login`
- `/auth/register`

### Protected APIs

Return 401 JSON for unauthenticated requests:

- `/api/protected/*`

### Public Routes

All other routes are public by default, including:

- `/` (home page)
- `/about`, `/contact`, etc.
- All `/api/*` routes except `/api/protected/*`

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

## Customization Examples

### Adding More Protected Routes

```typescript
// Adds to default protected routes
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
  routes: {
    protected: ['/admin', '/billing', '/account'],
  },
})
// Now protects: /dashboard, /profile, /settings, /admin, /billing, /account
```

### Custom Redirects

```typescript
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
  redirects: {
    unauthenticated: '/signin', // Instead of /auth/login
    authenticated: '/home', // Instead of /dashboard
  },
})
```

### Full Custom Configuration

```typescript
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,

  redirects: {
    unauthenticated: '/login',
    authenticated: '/app',
  },

  routes: {
    protected: ['/admin', '/billing'], // Adds to defaults
    authOnly: ['/signup', '/forgot'], // Adds to defaults
    protectedApi: ['/api/admin/*'], // Adds to defaults
  },

  debug: true, // Enable logging even in production
})
```

### Advanced: Custom Route Detection

```typescript
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,

  // Fully custom logic
  getRouteType: (pathname) => {
    if (pathname.startsWith('/admin')) return 'protected'
    if (pathname.startsWith('/public-api')) return 'publicApi'
    if (pathname === '/login') return 'authOnly'
    return 'public'
  },
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
