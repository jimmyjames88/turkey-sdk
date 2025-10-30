import { verifyJwt } from '../server/verify'
import { checkRevocation } from '../server/revocation'
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
  Pick<TurKeyMiddlewareConfig, 'appId' | 'development' | 'serviceApiKey'> {
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
    if (!env.TURKEY_APP_ID) {
      console.warn('⚠️  TURKEY_APP_ID not set - using default app validation')
    }
    if (!env.TURKEY_SERVICE_API_KEY) {
      console.warn(
        '⚠️  TURKEY_SERVICE_API_KEY not set - revocation checks may fail if server requires it'
      )
    }
  }

  return {
    baseUrl: env.TURKEY_BASE_URL,
    appId: env.TURKEY_APP_ID,
    serviceApiKey: env.TURKEY_SERVICE_API_KEY,
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
    appId: userConfig.appId || envConfig.appId,
    serviceApiKey: userConfig.serviceApiKey || envConfig.serviceApiKey,
    requireAuth: userConfig.requireAuth !== false, // Default to true
    cookieName: userConfig.cookieName || 'turkey_access_token',
    development: userConfig.development ?? envConfig.development ?? false,
    checkRevocation: userConfig.checkRevocation !== false, // Default to true
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
      appId: config.appId || 'default',
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
        appId: config.appId,
      })) as TurKeyPayload

      // Check if token has been revoked (if jti present)
      if (payload.jti && config.checkRevocation !== false) {
        const isRevoked = await checkRevocation(payload.jti, {
          baseUrl: config.baseUrl,
          serviceApiKey: config.serviceApiKey,
        })

        if (isRevoked) {
          const error = new Error('Token has been revoked')
          return config.onError(error, req, res)
        }
      }

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
