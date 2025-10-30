import type { JWTPayload } from '../types'

/**
 * TurKey user object extracted from JWT payload
 */
export interface TurKeyUser {
  id: string
  email: string
  role: string
}

/**
 * Extended payload with TurKey-specific claims
 */
export interface TurKeyPayload extends JWTPayload {
  sub: string
  email: string
  role: string
}

/**
 * Core authenticated request interface - framework agnostic
 */
export interface TurKeyAuthenticatedRequest {
  user?: TurKeyUser
  turkey?: TurKeyPayload
  token?: string
}

/**
 * Express-specific authenticated request (optional convenience type)
 */
export interface ExpressAuthRequest extends TurKeyAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>
  cookies?: Record<string, string>
  body?: any
  query?: any
  params?: any
}

/**
 * Next.js API request type (optional convenience type)
 */
export interface NextAuthRequest extends TurKeyAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>
  cookies?: Record<string, string>
  body?: any
  query?: any
}

/**
 * Middleware configuration interface
 */
export interface TurKeyMiddlewareConfig {
  baseUrl?: string
  appId?: string
  requireAuth?: boolean
  cookieName?: string
  onError?: (error: Error, req: any, res: any) => void | Promise<void>
  development?: boolean
  checkRevocation?: boolean // Default: true - check if tokens have been revoked
}

/**
 * Environment-based configuration
 */
export interface TurKeyEnvironment {
  TURKEY_BASE_URL?: string
  TURKEY_APP_ID?: string
  NODE_ENV?: string
}
