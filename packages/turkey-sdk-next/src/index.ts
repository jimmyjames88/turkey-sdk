/**
 * TurKey SDK Next.js Middleware
 * Edge Runtime compatible wrapper for Next.js middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

/**
 * Route type classification
 */
export type RouteType = 'protected' | 'authOnly' | 'public' | 'protectedApi' | 'publicApi'

/**
 * Configuration for TurKey middleware
 */
export interface TurKeyMiddlewareConfig {
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
  getRouteType?: (pathname: string) => RouteType

  /** Enable development mode logging (default: true in development) */
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
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  redirects: {
    unauthenticated: '/auth/login',
    authenticated: '/dashboard',
  },
  routes: {
    protected: ['/dashboard', '/profile', '/settings'],
    authOnly: ['/auth/login', '/auth/register'],
    protectedApi: ['/api/protected'],
  },
}

/**
 * Default route type detection logic
 */
function defaultGetRouteType(
  pathname: string,
  routes: typeof DEFAULT_CONFIG.routes
): RouteType {
  // Check protected API routes
  if (routes.protectedApi.some((route) => pathname.startsWith(route))) {
    return 'protectedApi'
  }

  // Check public API routes (any /api/* not in protectedApi)
  if (pathname.startsWith('/api/')) {
    return 'publicApi'
  }

  // Check protected page routes
  if (routes.protected.some((route) => pathname.startsWith(route))) {
    return 'protected'
  }

  // Check auth-only routes
  if (routes.authOnly.some((route) => pathname.startsWith(route))) {
    return 'authOnly'
  }

  // Default: public
  return 'public'
}

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
 * Create TurKey middleware for Next.js
 *
 * @example
 * ```typescript
 * // Zero-config - uses sensible defaults
 * export const middleware = createTurKeyMiddleware({
 *   baseUrl: process.env.TURKEY_BASE_URL!,
 *   appId: process.env.TURKEY_APP_ID!,
 * })
 *
 * // Custom configuration
 * export const middleware = createTurKeyMiddleware({
 *   baseUrl: process.env.TURKEY_BASE_URL!,
 *   appId: process.env.TURKEY_APP_ID!,
 *   redirects: {
 *     unauthenticated: '/signin',
 *     authenticated: '/home',
 *   },
 *   routes: {
 *     protected: ['/dashboard', '/admin'],
 *     authOnly: ['/signin', '/signup'],
 *   },
 * })
 * ```
 */
export function createTurKeyMiddleware(userConfig: TurKeyMiddlewareConfig) {
  // Merge user config with defaults
  const config = {
    baseUrl: userConfig.baseUrl,
    appId: userConfig.appId,
    redirects: {
      ...DEFAULT_CONFIG.redirects,
      ...userConfig.redirects,
    },
    routes: {
      protected: [
        ...DEFAULT_CONFIG.routes.protected,
        ...(userConfig.routes?.protected || []),
      ],
      authOnly: [
        ...DEFAULT_CONFIG.routes.authOnly,
        ...(userConfig.routes?.authOnly || []),
      ],
      protectedApi: [
        ...DEFAULT_CONFIG.routes.protectedApi,
        ...(userConfig.routes?.protectedApi || []),
      ],
    },
    debug: userConfig.debug ?? process.env.NODE_ENV === 'development',
  }

  // Use custom or default route type detection
  const getRouteType =
    userConfig.getRouteType ||
    ((pathname: string) => defaultGetRouteType(pathname, config.routes))

  return async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const routeType = getRouteType(pathname)

    if (config.debug) {
      console.log('[TurKey Middleware]', { pathname, routeType })
    }

    // Public routes - allow access
    if (routeType === 'public' || routeType === 'publicApi') {
      return NextResponse.next()
    }

    // Extract token
    const token = extractToken(request)

    // Auth-only routes (login/register) - redirect if already authenticated
    if (routeType === 'authOnly') {
      if (!token) {
        // No token, allow access to auth pages
        return NextResponse.next()
      }

      // Verify token is valid
      const verification = await verifyToken(
        token,
        config.baseUrl,
        config.appId
      )
      if (verification.success) {
        // Valid token, redirect to authenticated page
        if (config.debug) {
          console.log('[TurKey Middleware] Already authenticated, redirecting')
        }
        const url = request.nextUrl.clone()
        url.pathname = config.redirects.authenticated
        return NextResponse.redirect(url)
      }

      // Invalid token, allow access to auth page
      return NextResponse.next()
    }

    // Protected routes - require authentication
    if (routeType === 'protected' || routeType === 'protectedApi') {
      if (!token) {
        if (config.debug) {
          console.log('[TurKey Middleware] No token found')
        }
        return handleUnauthenticated(
          request,
          routeType === 'protectedApi',
          config.redirects.unauthenticated
        )
      }

      // Verify token
      const verification = await verifyToken(
        token,
        config.baseUrl,
        config.appId
      )
      if (!verification.success) {
        if (config.debug) {
          console.log(
            '[TurKey Middleware] Verification failed:',
            verification.error
          )
        }
        return handleUnauthenticated(
          request,
          routeType === 'protectedApi',
          config.redirects.unauthenticated
        )
      }

      // Add user info to request headers
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-turkey-user', JSON.stringify(verification.payload))

      if (config.debug) {
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

    // Default: allow access
    return NextResponse.next()
  }
}

/**
 * Helper to handle unauthenticated requests
 */
function handleUnauthenticated(
  request: NextRequest,
  isApiRoute: boolean,
  loginUrl: string
): NextResponse {
  if (isApiRoute) {
    // Return 401 for API routes
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }
    )
  }

  // Redirect to login for page routes
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
