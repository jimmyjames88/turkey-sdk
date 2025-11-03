/**
 * Granular error types for TurKey SDK
 * Provides specific error classes for different failure scenarios
 */

import { ErrorDetail } from './types'

/**
 * Base error class for all TurKey errors
 */
export abstract class TurKeyError extends Error {
  public readonly code: string
  public readonly statusCode?: number
  public readonly details?: ErrorDetail[]
  public readonly timestamp: Date
  public readonly isRetryable: boolean

  constructor(
    message: string,
    code: string,
    options: {
      statusCode?: number
      details?: ErrorDetail[]
      isRetryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = options.statusCode
    this.details = options.details
    this.timestamp = new Date()
    this.isRetryable = options.isRetryable ?? false

    // Store the cause if provided
    if (options.cause) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        writable: true,
        configurable: true,
      })
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Returns a JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      isRetryable: this.isRetryable,
    }
  }
}

/**
 * Network-related errors (connection issues, timeouts)
 * These are typically retryable
 */
export class NetworkError extends TurKeyError {
  constructor(
    message: string,
    options: {
      cause?: Error
      details?: ErrorDetail[]
    } = {}
  ) {
    super(message, 'NETWORK_ERROR', {
      ...options,
      isRetryable: true,
    })
  }
}

/**
 * Authentication errors (invalid credentials, expired tokens)
 * These are NOT retryable without user action
 */
export class AuthenticationError extends TurKeyError {
  constructor(
    message: string,
    options: {
      statusCode?: number
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'AUTHENTICATION_ERROR', {
      ...options,
      statusCode: options.statusCode ?? 401,
      isRetryable: false,
    })
  }
}

/**
 * Authorization errors (insufficient permissions)
 * These are NOT retryable without changing permissions
 */
export class AuthorizationError extends TurKeyError {
  constructor(
    message: string,
    options: {
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'AUTHORIZATION_ERROR', {
      ...options,
      statusCode: 403,
      isRetryable: false,
    })
  }
}

/**
 * Validation errors (invalid input data)
 * These are NOT retryable without fixing the input
 */
export class ValidationError extends TurKeyError {
  constructor(
    message: string,
    options: {
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'VALIDATION_ERROR', {
      ...options,
      statusCode: 400,
      isRetryable: false,
    })
  }
}

/**
 * Rate limiting errors
 * These are retryable after a delay
 */
export class RateLimitError extends TurKeyError {
  public readonly retryAfter?: number // seconds

  constructor(
    message: string,
    options: {
      retryAfter?: number
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'RATE_LIMIT_ERROR', {
      ...options,
      statusCode: 429,
      isRetryable: true,
    })
    this.retryAfter = options.retryAfter
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
    }
  }
}

/**
 * Server errors (5xx responses)
 * These are typically retryable
 */
export class ServerError extends TurKeyError {
  constructor(
    message: string,
    options: {
      statusCode?: number
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'SERVER_ERROR', {
      ...options,
      statusCode: options.statusCode ?? 500,
      isRetryable: true,
    })
  }
}

/**
 * Configuration errors (missing required config)
 * These are NOT retryable without fixing configuration
 */
export class ConfigurationError extends TurKeyError {
  constructor(
    message: string,
    options: {
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'CONFIGURATION_ERROR', {
      ...options,
      isRetryable: false,
    })
  }
}

/**
 * Token errors (invalid, expired, malformed tokens)
 * These are NOT retryable without obtaining a new token
 */
export class TokenError extends TurKeyError {
  constructor(
    message: string,
    options: {
      statusCode?: number
      details?: ErrorDetail[]
      cause?: Error
    } = {}
  ) {
    super(message, 'TOKEN_ERROR', {
      ...options,
      statusCode: options.statusCode ?? 401,
      isRetryable: false,
    })
  }
}

/**
 * Helper function to create appropriate error from HTTP response
 */
export function createErrorFromResponse(
  status: number,
  data: any,
  originalError?: Error
): TurKeyError {
  const message = data?.message || data?.error || 'An error occurred'
  const details = data?.details

  // Network/timeout errors (handled before reaching this function typically)
  if (status === 0) {
    return new NetworkError('Network request failed', {
      cause: originalError,
      details,
    })
  }

  // Rate limiting
  if (status === 429) {
    const retryAfter =
      data?.retryAfter || parseInt(data?.['Retry-After']) || undefined
    return new RateLimitError(message, {
      retryAfter,
      details,
      cause: originalError,
    })
  }

  // Authentication errors
  if (status === 401) {
    // Check if it's a token-specific error
    if (
      message.toLowerCase().includes('token') ||
      message.toLowerCase().includes('jwt') ||
      data?.code?.includes('TOKEN')
    ) {
      return new TokenError(message, {
        statusCode: status,
        details,
        cause: originalError,
      })
    }
    return new AuthenticationError(message, {
      statusCode: status,
      details,
      cause: originalError,
    })
  }

  // Authorization errors
  if (status === 403) {
    return new AuthorizationError(message, {
      details,
      cause: originalError,
    })
  }

  // Validation errors
  if (status === 400 || status === 422) {
    return new ValidationError(message, {
      details,
      cause: originalError,
    })
  }

  // Server errors (5xx)
  if (status >= 500) {
    return new ServerError(message, {
      statusCode: status,
      details,
      cause: originalError,
    })
  }

  // Generic client error (4xx)
  if (status >= 400 && status < 500) {
    return new ValidationError(message, {
      details,
      cause: originalError,
    })
  }

  // Fallback to generic server error
  return new ServerError('Unknown error occurred', {
    statusCode: status,
    details,
    cause: originalError,
  })
}

/**
 * Type guard to check if an error is a TurKey error
 */
export function isTurKeyError(error: unknown): error is TurKeyError {
  return error instanceof TurKeyError
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isTurKeyError(error) && error.isRetryable
}
