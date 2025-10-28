/**
 * Next.js Middleware Example for TurKey SDK
 *
 * IMPORTANT: Next.js middleware runs in the Edge Runtime, which has limitations:
 * - Cannot import React components or client-side code
 * - Must use edge-compatible libraries (jose works, some Node.js modules don't)
 * - Environment variables need to be available at build time or use NEXT_PUBLIC_ prefix
 *
 * This example shows:
 * 1. Inline JWT verification using jose (edge-compatible)
 * 2. Route-based protection with smart detection
 * 3. User data extraction and header forwarding
 * 4. Cookie and Authorization header token extraction
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Inline JWT verification for edge runtime
 * Note: We can't import from SDK's server modules due to edge runtime constraints
 */
async function verifyJwt(
  token: string,
  config: { baseUrl: string; appId?: string }
) {
  const { baseUrl, appId } = config
  const jwksUrl = `${baseUrl}/.well-known/jwks.json`

  // Dynamically import jose for edge runtime compatibility
  const { jwtVerify, createRemoteJWKSet } = await import('jose')
  const JWKS = createRemoteJWKSet(new URL(jwksUrl))

  // Verify JWT with JWKS and optional audience claim
  const { payload } = await jwtVerify(token, JWKS, {
    audience: appId,
  })

  return payload as {
    sub?: string
    email?: string
    role?: string
    aud?: string
  }
}

/**
 * Extract JWT token from request
 * Checks cookies first (browser apps), then Authorization header (API clients)
 */
function extractToken(request: NextRequest): string | null {
  // Try cookie (recommended for browser apps)
  const cookieToken = request.cookies.get('turkey_access_token')?.value
  if (cookieToken) return cookieToken

  // Try Authorization header (for API clients)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Next.js Middleware Example
 *
 * Environment variables required:
 * - TURKEY_BASE_URL: Turkey auth server URL (e.g., http://localhost:3000)
 * - TURKEY_APP_ID: Optional app identifier for aud claim validation
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Example: Skip middleware for static files and API routes
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/api/auth/') || // Public auth endpoints
    path === '/login' ||
    path === '/register'
  ) {
    return NextResponse.next()
  }

  // Example: Protect dashboard and other app routes
  if (path.startsWith('/dashboard') || path.startsWith('/api/')) {
    const token = extractToken(request)

    if (!token) {
      // No token - redirect to login or return 401 for API
      if (path.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }

    try {
      // Verify JWT with JWKS from turkey server
      const payload = await verifyJwt(token, {
        baseUrl: process.env.TURKEY_BASE_URL!,
        appId: process.env.TURKEY_APP_ID,
      })

      // Token valid - attach user data to headers for route handlers
      const response = NextResponse.next()
      response.headers.set('x-turkey-user-id', payload.sub || '')
      response.headers.set('x-turkey-user-email', payload.email || '')
      response.headers.set('x-turkey-user-role', payload.role || '')
      response.headers.set('x-turkey-app-id', payload.aud || '')

      return response
    } catch (error) {
      // Invalid token - redirect to login or return 401
      if (path.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({
            error: 'Invalid or expired token',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

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
 * ```typescript
 * import { headers } from 'next/headers'
 *
 * export async function GET() {
 *   const headersList = headers()
 *   const userId = headersList.get('x-turkey-user-id')
 *   const userEmail = headersList.get('x-turkey-user-email')
 *   const userRole = headersList.get('x-turkey-user-role')
 *
 *   return Response.json({ userId, userEmail, userRole })
 * }
 * ```
 */
