export interface RetryConfig {
  /**
   * Maximum number of retry attempts for retryable errors.
   * Set to 1 to disable retries.
   * @default 3
   */
  maxAttempts?: number
  /**
   * Initial delay in milliseconds before first retry.
   * @default 1000
   */
  initialDelayMs?: number
  /**
   * Maximum delay in milliseconds between retries.
   * Prevents extremely long waits with exponential backoff.
   * @default 30000 (30 seconds)
   */
  maxDelayMs?: number
  /**
   * Multiplier for exponential backoff calculation.
   * Delay = initialDelayMs * (backoffMultiplier ^ attempt)
   * @default 2
   */
  backoffMultiplier?: number
  /**
   * Add random jitter to retry delays (50-100% of calculated delay).
   * Helps prevent thundering herd when many clients retry simultaneously.
   * @default true
   */
  jitter?: boolean
  /**
   * Custom function to determine if an error should be retried.
   * Overrides the default isRetryable flag check.
   * Return true to retry, false to fail immediately.
   *
   * @param error - The error that occurred
   * @param attempt - Current attempt number (1-based)
   * @returns true to retry, false to throw error
   *
   * @example
   * ```typescript
   * shouldRetry: (error, attempt) => {
   *   // Only retry network errors, max 2 times
   *   return error instanceof NetworkError && attempt < 2;
   * }
   * ```
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

export interface TurKeyConfig {
  /**
   * Base URL of the TurKey authentication server.
   * Should include protocol (https://) and domain.
   *
   * @example 'https://auth.example.com'
   */
  baseUrl: string
  /**
   * Optional application identifier for token scoping.
   * Tokens are validated against this audience claim.
   * Different apps can have isolated auth contexts.
   *
   * @example 'my-web-app'
   */
  appId?: string
  /**
   * Request timeout in milliseconds.
   * @default 10000 (10 seconds)
   */
  timeout?: number
  /**
   * Service API key for backend-to-backend authenticated calls.
   * Required for introspection and revocation-check endpoints.
   * Must match TURKEY_SERVICE_API_KEY on the TurKey server.
   *
   * ⚠️ Keep this secret! Only use in server-side code.
   */
  serviceApiKey?: string
  /**
   * Retry configuration for handling transient failures.
   * Set to false to disable automatic retries entirely.
   *
   * @default { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, jitter: true }
   */
  retry?: RetryConfig | false
}

/**
 * Login request parameters.
 */
export interface LoginRequest {
  /** User's email address */
  email: string
  /** User's password */
  password: string
  /** Optional app ID (defaults to client config) */
  appId?: string
}

/**
 * Registration request parameters.
 */
export interface RegisterRequest {
  /** User's email address (must be unique) */
  email: string
  /** User's password (must meet strength requirements) */
  password: string
  /** User role assignment (default: 'user') */
  role?: 'user' | 'admin'
  /** Optional app ID (defaults to client config) */
  appId?: string
}

/**
 * Token refresh request parameters.
 */
export interface RefreshRequest {
  /** Valid refresh token to exchange for new tokens */
  refreshToken: string
  /** Optional app ID (defaults to client config) */
  appId?: string
}

/**
 * Profile update request parameters.
 */
export interface UpdateProfileRequest {
  /** New email address (must be unique) */
  email?: string
}

/**
 * Password change request parameters.
 */
export interface ChangePasswordRequest {
  /** Current password for verification */
  currentPassword: string
  /** New password (must meet strength requirements) */
  newPassword: string
}

/**
 * Response from profile update operation.
 */
export interface UpdateProfileResponse {
  /** Success message */
  message: string
  /** Updated user object */
  user: User
}

/**
 * Response from password change operation.
 */
export interface ChangePasswordResponse {
  /** Success message */
  message: string
  /**
   * Whether re-authentication is required on other devices.
   * Always true for password changes (all refresh tokens revoked).
   */
  requiresReauthentication: boolean
}

/**
 * Response from account deletion operation.
 */
export interface DeleteAccountResponse {
  /** Success message */
  message: string
  /** Information about the deleted user account */
  deletedUser: {
    /** User ID that was deleted */
    id: string
    /** Email of deleted account */
    email: string
  }
}

/**
 * Authentication response from login/register operations.
 * Contains user information and JWT token pair.
 */
/**
 * Authentication response from login/register operations.
 * Contains user information and JWT token pair.
 */
export interface AuthResponse {
  /** User information */
  user: {
    /** Unique user identifier (UUID) */
    id: string
    /** User's email address */
    email: string
    /** User's role (e.g., 'user', 'admin') */
    role: string
  }
  /** Short-lived JWT access token for API authentication */
  accessToken: string
  /** Long-lived JWT refresh token for obtaining new access tokens */
  refreshToken: string
  /** Access token lifetime in seconds */
  expiresIn: number
  /** Token type (always 'Bearer' for JWT) */
  tokenType: string
}

/**
 * User profile information.
 */
export interface User {
  /** Unique user identifier (UUID) */
  id: string
  /** User's email address */
  email: string
  /** User's role (e.g., 'user', 'admin') */
  role: string
}

/**
 * JWT token pair with metadata.
 * Returned from token refresh operations.
 */
export interface TokenPair {
  /** New JWT access token */
  accessToken: string
  /** New JWT refresh token */
  refreshToken: string
  /** Access token lifetime in seconds */
  expiresIn: number
  /** Token type (always 'Bearer') */
  tokenType: string
}

/**
 * Decoded JWT payload structure.
 * Contains standard JWT claims and TurKey-specific fields.
 */
/**
 * Decoded JWT payload structure.
 * Contains standard JWT claims and TurKey-specific fields.
 */
export interface JWTPayload {
  /** Issuer - base URL of TurKey server */
  iss: string
  /** Audience - app ID this token is scoped to */
  aud: string
  /** Subject - user ID (UUID) */
  sub: string
  /** User's email address */
  email: string
  /** User's role */
  role: string
  /** Token scope (e.g., 'access' or 'refresh') */
  scope: string
  /** JWT ID - unique token identifier */
  jti: string
  /** Token version for revocation tracking */
  tokenVersion: number
  /** Issued at - Unix timestamp (seconds) */
  iat: number
  /** Not before - Unix timestamp (seconds) */
  nbf: number
  /** Expiration - Unix timestamp (seconds) */
  exp: number
}

/**
 * Validation error detail for a specific field.
 */
export interface ErrorDetail {
  /** Field name that failed validation */
  field: string
  /** Human-readable error message */
  message: string
  /** Machine-readable error code */
  code: string
}

/**
 * Token introspection result.
 * Provides detailed information about token validity and contents.
 */
export interface IntrospectionResult {
  /** Whether the token is currently valid and active */
  active: boolean
  /** Type of token ('access' or 'refresh') */
  type?: 'access' | 'refresh'
  /** Decoded JWT payload (only if active) */
  payload?: JWTPayload
  /** ISO 8601 expiration timestamp (only if active) */
  expiresAt?: string
  /** User ID associated with token (only if active) */
  userId?: string
}

/**
 * Standard error response structure from TurKey API.
 */
/**
 * Standard error response structure from TurKey API.
 */
export interface TurKeyError {
  /** Error type/category */
  error: string
  /** Human-readable error message */
  message: string
  /** ISO 8601 timestamp when error occurred */
  timestamp: string
  /** API endpoint path where error occurred */
  path: string
  /** Optional array of field-specific validation errors */
  details?: ErrorDetail[]
}

/**
 * Base error class for TurKey authentication errors.
 *
 * @deprecated Use specific error classes (NetworkError, AuthenticationError, etc.) instead.
 * This class is maintained for backward compatibility.
 */
export class TurKeyAuthError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: ErrorDetail[]

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: ErrorDetail[]
  ) {
    super(message)
    this.name = 'TurKeyAuthError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
