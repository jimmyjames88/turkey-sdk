import { verifyJwt } from '../server/verify'
import type {
  TurKeyMiddlewareConfig,
  TurKeyEnvironment,
  TurKeyUser,
  TurKeyPayload,
  TurKeyAuthenticatedRequest,
} from './types'

/**
 * Validates and returns environment-based configuration
 */
function getEnvironmentConfig(): Required<
  Pick<TurKeyMiddlewareConfig, 'baseUrl'>
> &
  Pick<TurKeyMiddlewareConfig, 'audience' | 'tenantId' | 'development'> {
  const env = process.env as TurKeyEnvironment

  // Validate required environment variables
  if (!env.TURKEY_BASE_URL) {
    throw new Error(
      'TURKEY_BASE_URL environment variable is required. ' +
        'Set it to your TurKey server URL (e.g., https://auth.yourcompany.com)'
    )
  }

  const isDevelopment = env.NODE_ENV === 'development'

  if (isDevelopment) {
    console.log('🦃 TurKey Middleware: Development mode enabled')
    if (!env.TURKEY_AUDIENCE) {
      console.warn(
        '⚠️  TURKEY_AUDIENCE not set - using default audience validation'
      )
    }
  }

  return {
    baseUrl: env.TURKEY_BASE_URL,
    audience: env.TURKEY_AUDIENCE,
    tenantId: env.TURKEY_TENANT_ID,
    development: isDevelopment,
  }
}

/**
 * Smart token extraction from multiple sources with fallbacks
 */
function extractToken(req: any): string | null {
  // Priority order: header > cookie > custom header
  const authHeader = req.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Cookie extraction (supports both middleware and direct access)
  const cookies = req.cookies || {}
  if (cookies.turkey_access_token) {
    return cookies.turkey_access_token
  }

  // Custom header fallback
  const customToken = req.headers?.['x-access-token']
  if (customToken) {
    return Array.isArray(customToken) ? customToken[0] : customToken
  }

  return null
}

/**
 * Convert JWT payload to user object
 */
function extractUser(payload: TurKeyPayload): TurKeyUser {
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    tenantId: payload.tenantId,
  }
}

/**
 * Create default error handler
 */
function createDefaultErrorHandler(development = false) {
  return (error: Error, req: any, res: any) => {
    if (development) {
      console.error('🦃 TurKey Auth Error:', error.message)
    }

    // Determine appropriate status code
    let statusCode = 401
    let errorCode = 'INVALID_TOKEN'

    if (error.message.includes('expired')) {
      errorCode = 'TOKEN_EXPIRED'
    } else if (error.message.includes('audience')) {
      errorCode = 'INVALID_AUDIENCE'
      statusCode = 403
    } else if (error.message.includes('issuer')) {
      errorCode = 'INVALID_ISSUER'
      statusCode = 403
    }

    const errorResponse = {
      error: errorCode,
      message: development ? error.message : 'Authentication failed',
    }

    // Handle different response patterns
    if (typeof res.status === 'function') {
      // Express-like response
      return res.status(statusCode).json(errorResponse)
    } else if (res.writeHead && res.end) {
      // Node.js http.ServerResponse
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(errorResponse))
    } else {
      // Fallback - try to set response properties
      res.statusCode = statusCode
      if (res.setHeader) {
        res.setHeader('Content-Type', 'application/json')
      }
      return res.end(JSON.stringify(errorResponse))
    }
  }
}

/**
 * Core middleware engine - framework agnostic
 */
export function createTurkeyMiddleware(
  userConfig: TurKeyMiddlewareConfig = {}
) {
  // Merge environment config with user config
  const envConfig = getEnvironmentConfig()
  const config = {
    baseUrl: userConfig.baseUrl || envConfig.baseUrl,
    audience: userConfig.audience || envConfig.audience,
    tenantId: userConfig.tenantId || envConfig.tenantId,
    requireAuth: userConfig.requireAuth !== false, // Default to true
    cookieName: userConfig.cookieName || 'turkey_access_token',
    development: userConfig.development ?? envConfig.development ?? false,
    onError:
      userConfig.onError || createDefaultErrorHandler(envConfig.development),
  }

  // Validate configuration at startup
  if (!config.baseUrl) {
    throw new Error(
      'TurKey baseUrl is required either via config or TURKEY_BASE_URL environment variable'
    )
  }

  if (config.development) {
    console.log('🦃 TurKey Middleware initialized:', {
      baseUrl: config.baseUrl,
      audience: config.audience || 'default',
      requireAuth: config.requireAuth,
      cookieName: config.cookieName,
    })
  }

  // Return the actual middleware function
  return async function turkeyMiddleware(req: any, res: any, next: any) {
    try {
      const token = extractToken(req)

      // Handle missing token
      if (!token) {
        if (!config.requireAuth) {
          // Optional auth - continue without user
          return next()
        }

        // Required auth - return 401
        const error = new Error('Authentication required - no token provided')
        return config.onError(error, req, res)
      }

      // Verify token server-side
      const payload = (await verifyJwt(token, {
        baseUrl: config.baseUrl,
        audience: config.audience,
        tenantId: config.tenantId,
      })) as TurKeyPayload

      // Attach user data to request
      const user = extractUser(payload)
      const authReq = req as TurKeyAuthenticatedRequest

      authReq.user = user
      authReq.turkey = payload
      authReq.token = token

      if (config.development) {
        console.log('🦃 TurKey Auth Success:', {
          userId: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        })
      }

      next()
    } catch (error) {
      return config.onError(error as Error, req, res)
    }
  }
}

/**
 * Quick setup helpers
 */
export const turkeyAuth = (config?: TurKeyMiddlewareConfig) =>
  createTurkeyMiddleware(config)

export const requireAuth = (
  config?: Omit<TurKeyMiddlewareConfig, 'requireAuth'>
) => createTurkeyMiddleware({ ...config, requireAuth: true })

export const optionalAuth = (
  config?: Omit<TurKeyMiddlewareConfig, 'requireAuth'>
) => createTurkeyMiddleware({ ...config, requireAuth: false })
