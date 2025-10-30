/**
 * Next.js Middleware Example for TurKey SDK
 *
 * RECOMMENDED: Use @jimmyjames88/turkey-sdk-next for zero-configuration setup
 *
 * Installation:
 * npm install @jimmyjames88/turkey-sdk-next
 *
 * This example shows:
 * 1. Zero-config setup with sensible defaults
 * 2. Custom route configuration
 * 3. Custom redirect URLs
 * 4. Accessing user data in route handlers
 */

import { createTurKeyMiddleware } from '@jimmyjames88/turkey-sdk-next'

/**
 * Basic Zero-Configuration Setup
 *
 * This provides automatic protection for common routes:
 * - Protected routes: /dashboard, /profile, /settings
 * - Auth-only routes: /auth/login, /auth/register (redirects if authenticated)
 * - Protected APIs: /api/protected/* (returns 401 JSON)
 *
 * Environment variables required:
 * - TURKEY_BASE_URL: Turkey auth server URL (e.g., http://localhost:3000)
 * - TURKEY_APP_ID: App identifier for aud claim validation
 */
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,
})

/**
 * Custom Configuration Example
 *
 * Uncomment and customize this to override defaults:
 */
/*
export const middleware = createTurKeyMiddleware({
  baseUrl: process.env.TURKEY_BASE_URL!,
  appId: process.env.TURKEY_APP_ID!,

  // Add more protected routes (merged with defaults)
  routes: {
    protected: ['/admin', '/billing'],
    authOnly: ['/signup'],
    protectedApi: ['/api/admin/*'],
  },

  // Custom redirects
  redirects: {
    unauthenticated: '/signin',
    authenticated: '/home',
  },

  // Optional: Custom route type detection
  getRouteType: (path) => {
    if (path.startsWith('/public')) return 'public'
    if (path.startsWith('/admin')) return 'protected'
    // ... custom logic
    return 'public' // default
  },

  // Optional: Development logging (auto-enabled if NODE_ENV=development)
  debug: true,
})
*/

/**
 * Middleware matcher configuration
 * Defines which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

/**
 * Accessing user data in route handlers:
 *
 * The middleware automatically attaches user information to request headers:
 *
 * ```typescript
 * import { headers } from 'next/headers'
 *
 * export async function GET() {
 *   const headersList = headers()
 *   const userId = headersList.get('x-turkey-user-id')
 *   const userEmail = headersList.get('x-turkey-user-email')
 *   const userRole = headersList.get('x-turkey-user-role')
 *   const appId = headersList.get('x-turkey-app-id')
 *
 *   return Response.json({ userId, userEmail, userRole, appId })
 * }
 * ```
 *
 * Default Behavior:
 * - Protected routes require authentication, redirect to /auth/login if unauthenticated
 * - Auth-only routes redirect to /dashboard if already authenticated
 * - Protected APIs return 401 JSON instead of redirecting
 * - Public routes allow access without authentication
 *
 * See the full documentation at:
 * https://github.com/jimmyjames88/turkey-sdk/tree/master/packages/turkey-sdk-next#readme
 */
