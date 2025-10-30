/**
 * TurKey SDK Next.js Middleware
 * Edge Runtime compatible wrapper for Next.js middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

/**
 * Configuration for TurKey middleware
 */
export interface TurKeyMiddlewareConfig {
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

/**
 * Decoded JWT payload with TurKey user information
 */
export interface TurKeyJwtPayload extends JWTPayload {
  sub: string
  email: string
  role?: string
  appId?: string
  [key: string]: unknown
}

/**
 * Result from token extraction and verification
 */
export interface VerificationResult {
  success: boolean
  payload?: TurKeyJwtPayload
  error?: string
}

// Cache JWKS URLs per baseUrl to avoid recreating
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * Get or create JWKS client for a baseUrl
 */
function getJwksClient(baseUrl: string) {
  if (!jwksCache.has(baseUrl)) {
    const jwksUrl = new URL('/.well-known/jwks.json', baseUrl)
    jwksCache.set(baseUrl, createRemoteJWKSet(jwksUrl))
  }
  return jwksCache.get(baseUrl)!
}

/**
 * Extract JWT token from Next.js request
 * Checks Authorization header, cookies, and x-turkey-token header
 */
export function extractToken(request: NextRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check cookies (turkey_access_token)
  const cookieToken = request.cookies.get('turkey_access_token')?.value
  if (cookieToken) {
    return cookieToken
  }

  // Check custom header (x-turkey-token)
  const customHeader = request.headers.get('x-turkey-token')
  if (customHeader) {
    return customHeader
  }

  return null
}

/**
 * Verify JWT token using JWKS from TurKey server
 */
export async function verifyToken(
  token: string,
  baseUrl: string,
  appId: string
): Promise<VerificationResult> {
  try {
    const jwks = getJwksClient(baseUrl)
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['ES256'],
    })

    // Validate app ID if present in token
    const tokenAppId = payload.appId as string | undefined
    if (tokenAppId && tokenAppId !== appId) {
      return {
        success: false,
        error: `Token app ID mismatch: expected ${appId}, got ${tokenAppId}`,
      }
    }

    return {
      success: true,
      payload: payload as TurKeyJwtPayload,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Token verification failed',
    }
  }
}

/**
 * Check if a route matches any pattern in the list
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => {
    // Exact match
    if (route === pathname) return true

    // Wildcard match (e.g., /api/*)
    if (route.endsWith('/*')) {
      const prefix = route.slice(0, -2)
      return pathname.startsWith(prefix)
    }

    return false
  })
}

/**
 * Create TurKey middleware for Next.js
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { createTurKeyMiddleware } from '@jimmyjames88/turkey-sdk-next'
 *
 * export const middleware = createTurKeyMiddleware({
 *   baseUrl: process.env.TURKEY_BASE_URL!,
 *   appId: process.env.TURKEY_APP_ID!,
 *   publicRoutes: ['/auth/*', '/api/public/*'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * }
 * ```
 */
export function createTurKeyMiddleware(config: TurKeyMiddlewareConfig) {
  const {
    baseUrl,
    appId,
    protectedRoutes,
    publicRoutes = ['/auth/*', '/api/auth/*'],
    loginUrl = '/auth/login',
    debug = process.env.NODE_ENV === 'development',
  } = config

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (debug) {
      console.log('[TurKey Middleware]', pathname)
    }

    // Determine if route needs authentication
    const needsAuth = protectedRoutes
      ? matchesRoute(pathname, protectedRoutes)
      : !matchesRoute(pathname, publicRoutes)

    if (!needsAuth) {
      if (debug) {
        console.log('[TurKey Middleware] Public route, skipping auth')
      }
      return NextResponse.next()
    }

    // Extract and verify token
    const token = extractToken(request)
    if (!token) {
      if (debug) {
        console.log('[TurKey Middleware] No token found')
      }
      return redirectToLogin(request, loginUrl)
    }

    const verification = await verifyToken(token, baseUrl, appId)
    if (!verification.success) {
      if (debug) {
        console.log(
          '[TurKey Middleware] Verification failed:',
          verification.error
        )
      }
      return redirectToLogin(request, loginUrl)
    }

    // Add user info to request headers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-turkey-user', JSON.stringify(verification.payload))

    if (debug) {
      console.log(
        '[TurKey Middleware] Auth successful:',
        verification.payload?.email
      )
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

/**
 * Helper to redirect to login page
 */
function redirectToLogin(request: NextRequest, loginUrl: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = loginUrl
  url.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

/**
 * Helper to get TurKey user from request headers (use in API routes/server components)
 *
 * @example
 * ```typescript
 * // app/api/protected/route.ts
 * import { getTurKeyUser } from '@jimmyjames88/turkey-sdk-next'
 * import { NextRequest } from 'next/server'
 *
 * export async function GET(request: NextRequest) {
 *   const user = getTurKeyUser(request)
 *   if (!user) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *   return Response.json({ user })
 * }
 * ```
 */
export function getTurKeyUser(request: NextRequest): TurKeyJwtPayload | null {
  const userHeader = request.headers.get('x-turkey-user')
  if (!userHeader) return null

  try {
    return JSON.parse(userHeader) as TurKeyJwtPayload
  } catch {
    return null
  }
}

// Re-export types from core SDK for convenience
export type { TokenStorage } from '@jimmyjames88/turkey-sdk'
