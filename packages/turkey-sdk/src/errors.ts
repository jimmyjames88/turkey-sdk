/**
 * Granular error types for TurKey SDK.
 * Provides specific error classes for different failure scenarios with isRetryable flags.
 *
 * All errors extend TurKeyError base class which includes:
 * - Structured error details with field-level validation info
 * - HTTP status codes for API errors
 * - Automatic timestamp tracking
 * - Retry eligibility flag
 * - Error cause chaining
 *
 * @example
 * ```typescript
 * try {
 *   await client.login({ email, password });
 * } catch (error) {
 *   if (error instanceof NetworkError && error.isRetryable) {
 *     // Safe to retry
 *     await retry();
 *   } else if (error instanceof AuthenticationError) {
 *     // User action required
 *     showErrorMessage('Invalid credentials');
 *   }
 * }
 * ```
 */

import { ErrorDetail } from './types'

/**
 * Base error class for all TurKey SDK errors.
 *
 * Provides common error properties and JSON serialization.
 * All specific error types extend this class.
 *
 * @abstract - Do not instantiate directly, use specific error classes
 */
export abstract class TurKeyError extends Error {
  /** Machine-readable error code */
  public readonly code: string
  /** HTTP status code (if applicable) */
  public readonly statusCode?: number
  /** Field-specific validation errors */
  public readonly details?: ErrorDetail[]
  /** When the error occurred */
  public readonly timestamp: Date
  /** Whether this error can be safely retried */
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
   * Convert error to JSON-serializable object.
   * Useful for logging, API responses, or error reporting services.
   *
   * @returns Object representation of the error
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
 * Network-related errors (connection failures, timeouts, DNS issues).
 *
 * These errors are **automatically retryable** (isRetryable = true).
 * Common causes:
 * - Network connectivity issues
 * - Request timeouts
 * - DNS resolution failures
 * - Server temporarily unavailable
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof NetworkError) {
 *     console.log('Network issue, retrying...');
 *     await delay(1000);
 *     return retry();
 *   }
 * }
 * ```
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
 * Authentication/authorization errors (invalid credentials, expired tokens, insufficient permissions).
 *
 * These errors are **NOT retryable** (isRetryable = false) without user action.
 * Common causes:
 * - Invalid email/password combination
 * - Expired or revoked access/refresh tokens
 * - Insufficient permissions for operation
 * - Account locked or disabled
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     // Prompt user to login again
 *     redirectToLogin();
 *   }
 * }
 * ```
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
 * Authorization errors (insufficient permissions, forbidden access).
 *
 * These errors are **NOT retryable** (isRetryable = false) without permission changes.
 * Common causes:
 * - User lacks required role for operation
 * - Resource access denied
 * - API endpoint requires admin privileges
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof AuthorizationError) {
 *     showError('You do not have permission for this action');
 *   }
 * }
 * ```
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
 * Validation errors (invalid input data, format errors, constraint violations).
 *
 * These errors are **NOT retryable** (isRetryable = false) without fixing input.
 * Common causes:
 * - Invalid email format
 * - Password doesn't meet requirements
 * - Required fields missing
 * - Data constraint violations
 *
 * The `details` property contains field-specific error information.
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof ValidationError) {
 *     error.details?.forEach(detail => {
 *       showFieldError(detail.field, detail.message);
 *     });
 *   }
 * }
 * ```
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
 * Rate limiting errors (too many requests).
 *
 * These errors are **retryable** (isRetryable = true) after waiting.
 * The SDK automatically handles retry delays based on `retryAfter` value.
 *
 * Common causes:
 * - Too many login attempts
 * - API rate limit exceeded
 * - Burst limit hit
 *
 * The `retryAfter` property indicates how many seconds to wait before retrying.
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof RateLimitError) {
 *     const waitTime = error.retryAfter || 60;
 *     showMessage(`Rate limited. Please wait ${waitTime} seconds.`);
 *   }
 * }
 * ```
 */
export class RateLimitError extends TurKeyError {
  /** Seconds to wait before retrying (from Retry-After header) */
  public readonly retryAfter?: number

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
 * Server errors (5xx HTTP status codes, internal server issues).
 *
 * These errors are **automatically retryable** (isRetryable = true).
 * Common causes:
 * - Internal server error (500)
 * - Service unavailable (503)
 * - Gateway timeout (504)
 * - Temporary server issues
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof ServerError) {
 *     console.log('Server error, will auto-retry');
 *     // SDK handles retry automatically
 *   }
 * }
 * ```
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
 * Configuration errors (missing required settings, invalid config values).
 *
 * These errors are **NOT retryable** (isRetryable = false) without fixing config.
 * Common causes:
 * - Missing baseUrl in TurKeyConfig
 * - Invalid service API key
 * - Malformed configuration object
 *
 * @example
 * ```typescript
 * try {
 *   const client = new TurKeyClient({ baseUrl: '' }); // Invalid!
 * } catch (error) {
 *   if (error instanceof ConfigurationError) {
 *     console.error('Fix your config:', error.message);
 *   }
 * }
 * ```
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
 * Token-specific errors (invalid format, expired, revoked, signature mismatch).
 *
 * These errors are **NOT retryable** (isRetryable = false) without obtaining new token.
 * Common causes:
 * - Token signature verification failed
 * - Token expired (use refresh token to get new one)
 * - Token revoked by server
 * - Malformed JWT structure
 * - Wrong app ID (audience mismatch)
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (error instanceof TokenError) {
 *     // Try to refresh token
 *     if (refreshToken) {
 *       await client.refresh({ refreshToken });
 *     } else {
 *       // No refresh token, must re-authenticate
 *       redirectToLogin();
 *     }
 *   }
 * }
 * ```
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
 * Create appropriate error instance from HTTP response.
 *
 * Maps HTTP status codes to specific error classes with proper
 * retry flags and error details. Used internally by TurKeyClient.
 *
 * @param status - HTTP status code
 * @param data - Response body (should contain error details)
 * @param originalError - Optional original error for cause chaining
 * @returns Specific TurKeyError subclass instance
 *
 * @internal
 *
 * Status code mapping:
 * - 0: NetworkError (connection failed)
 * - 400, 422: ValidationError (bad input)
 * - 401: AuthenticationError or TokenError (based on message content)
 * - 403: AuthorizationError (forbidden)
 * - 404: NotFoundError (resource not found)
 * - 409: ConflictError (duplicate resource)
 * - 429: RateLimitError (too many requests)
 * - 500-599: ServerError (server issues)
 * - Other: Generic TurKeyError
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
 * Type guard to check if an error is a TurKeyError instance.
 *
 * Useful for type narrowing in catch blocks to access TurKeyError-specific
 * properties like isRetryable, details, code, etc.
 *
 * @param error - Unknown error object to check
 * @returns true if error is a TurKeyError, false otherwise
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (isTurKeyError(error)) {
 *     // TypeScript now knows error is TurKeyError
 *     console.log('Error code:', error.code);
 *     console.log('Retryable:', error.isRetryable);
 *     console.log('Details:', error.details);
 *   }
 * }
 * ```
 */
export function isTurKeyError(error: unknown): error is TurKeyError {
  return error instanceof TurKeyError
}

/**
 * Type guard to check if an error can be safely retried.
 *
 * Checks if error is a TurKeyError with isRetryable flag set to true.
 * Used internally by SDK retry logic and available for custom retry handling.
 *
 * @param error - Unknown error object to check
 * @returns true if error is retryable, false otherwise
 *
 * @example
 * ```typescript
 * catch (error) {
 *   if (isRetryableError(error)) {
 *     console.log('Will retry this operation');
 *     await delay(1000);
 *     return retry();
 *   } else {
 *     console.error('Cannot retry, failing permanently');
 *     throw error;
 *   }
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  return isTurKeyError(error) && error.isRetryable
}
