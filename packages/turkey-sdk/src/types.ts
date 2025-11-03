export interface RetryConfig {
  /**
   * Maximum number of retry attempts for retryable errors
   * @default 3
   */
  maxAttempts?: number
  /**
   * Initial delay in milliseconds before first retry
   * @default 1000
   */
  initialDelayMs?: number
  /**
   * Maximum delay in milliseconds between retries
   * @default 30000 (30 seconds)
   */
  maxDelayMs?: number
  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number
  /**
   * Whether to add random jitter to retry delays (helps prevent thundering herd)
   * @default true
   */
  jitter?: boolean
  /**
   * Function to determine if an error should be retried
   * Overrides default isRetryable check
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

export interface TurKeyConfig {
  baseUrl: string
  appId?: string
  timeout?: number
  /**
   * Service API key for backend-to-backend calls
   * Required for introspection and revocation-check endpoints
   * Set this to match TURKEY_SERVICE_API_KEY on the server
   */
  serviceApiKey?: string
  /**
   * Retry configuration for transient failures
   * Set to false to disable automatic retries
   * @default { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 30000, backoffMultiplier: 2, jitter: true }
   */
  retry?: RetryConfig | false
}

export interface LoginRequest {
  email: string
  password: string
  appId?: string
}

export interface RegisterRequest {
  email: string
  password: string
  role?: 'user' | 'admin'
  appId?: string
}

export interface RefreshRequest {
  refreshToken: string
  appId?: string
}

export interface UpdateProfileRequest {
  email?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileResponse {
  message: string
  user: User
}

export interface ChangePasswordResponse {
  message: string
  requiresReauthentication: boolean
}

export interface DeleteAccountResponse {
  message: string
  deletedUser: {
    id: string
    email: string
  }
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    role: string
  }
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface User {
  id: string
  email: string
  role: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface JWTPayload {
  iss: string
  aud: string
  sub: string
  email: string
  role: string
  scope: string
  jti: string
  tokenVersion: number
  iat: number
  nbf: number
  exp: number
}

export interface ErrorDetail {
  field: string
  message: string
  code: string
}

export interface IntrospectionResult {
  active: boolean
  type?: 'access' | 'refresh'
  payload?: JWTPayload
  expiresAt?: string
  userId?: string
}

export interface TurKeyError {
  error: string
  message: string
  timestamp: string
  path: string
  details?: ErrorDetail[]
}

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
