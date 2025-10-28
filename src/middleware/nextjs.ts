/**
 * Next.js Middleware Integration for TurKey Authentication
 *
 * This file provides utilities for integrating TurKey JWT authentication
 * with Next.js middleware. Since the SDK doesn't depend on Next.js directly,
 * you'll use these helpers in your Next.js project's middleware.
 */

import { verifyJwt } from '../server/verify'
import type { TurKeyMiddlewareConfig, TurKeyUser } from './types'

/**
 * Extended user interface with app context
 */
export interface NextTurKeyUser extends TurKeyUser {
  appId: string
}

/**
 * Configuration options for Next.js TurKey middleware
 */
export interface NextTurKeyConfig extends Partial<TurKeyMiddlewareConfig> {
  /**
   * Cookie name for access token
   * @default 'turkey_access_token'
   */
  cookieName?: string
}

/**
 * Helper to extract TurKey user data from Next.js request headers
 * Use this in your route handlers to access authenticated user info
 *
 * @example
 * ```typescript
 * // app/api/protected/route.ts
 * import { getTurkeyUser } from '@jimmyjames88/turkey-sdk/middleware'
 *
 * export async function GET(request: Request) {
 *   const user = getTurkeyUser(request)
 *   if (!user) {
 *     return Response.json({ error: 'Unauthorized' }, { status: 401 })
 *   }
 *   return Response.json({ user })
 * }
 * ```
 */
export function getTurkeyUser(request: Request): NextTurKeyUser | null {
  const headers = request.headers

  const userId = headers.get('x-turkey-user-id')
  const email = headers.get('x-turkey-user-email')
  const role = headers.get('x-turkey-user-role')
  const appId = headers.get('x-turkey-app-id')

  if (!userId || !email || !role || !appId) {
    return null
  }

  return {
    id: userId,
    email,
    role,
    appId,
  }
}

/**
 * Core JWT verification logic for Next.js middleware
 * Returns verified payload and user data, or throws an error
 *
 * @internal
 */
export async function verifyNextJwt(
  token: string,
  config: NextTurKeyConfig
): Promise<NextTurKeyUser> {
  const baseUrl = config.baseUrl || process.env.TURKEY_BASE_URL
  const appId = config.appId || process.env.TURKEY_APP_ID

  if (!baseUrl) {
    throw new Error(
      'TURKEY_BASE_URL is required. Set it via environment variable or config.'
    )
  }

  const payload = await verifyJwt(token, { baseUrl, appId })

  return {
    id: payload.sub || '',
    email: payload.email || '',
    role: payload.role || 'user',
    appId: payload.aud || appId || '',
  }
}

/**
 * Extracts JWT token from Next.js request
 * Checks cookies first, then Authorization header
 *
 * @internal
 */
export function extractNextToken(
  request: {
    cookies: { get: (name: string) => { value: string } | undefined }
    headers: { get: (name: string) => string | null }
  },
  cookieName = 'turkey_access_token'
): string | null {
  // Try cookie first
  const cookieToken = request.cookies.get(cookieName)?.value

  if (cookieToken) {
    return cookieToken
  }

  // Try Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}
