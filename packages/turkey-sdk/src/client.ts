import type {
  TurKeyConfig,
  RetryConfig,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  AuthResponse,
  TokenPair,
  UpdateProfileResponse,
  ChangePasswordResponse,
  DeleteAccountResponse,
  User,
  IntrospectionResult,
} from './types'
import {
  createErrorFromResponse,
  NetworkError,
  ValidationError,
  RateLimitError,
  isRetryableError,
} from './errors'
import { TokenManager } from './token-manager'
import { validatePassword } from './password-validation'

export class TurKeyClient {
  private config: TurKeyConfig
  private tokenManager: TokenManager
  private retryConfig: RetryConfig
  private refreshPromise: Promise<TokenPair> | null = null

  constructor(config: TurKeyConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    }
    this.tokenManager = new TokenManager(this.config)

    // Set default retry config
    this.retryConfig =
      config.retry === false
        ? { maxAttempts: 1 }
        : {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
            ...config.retry,
          }
  }

  /**
   * Calculate retry delay with exponential backoff and optional jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const {
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      jitter = true,
    } = this.retryConfig

    // Exponential backoff: initialDelay * (multiplier ^ (attempt - 1))
    let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)
    delay = Math.min(delay, maxDelayMs)

    // Add jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5) // Random between 50% and 100% of delay
    }

    return delay
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetryError(error: unknown, attempt: number): boolean {
    const { maxAttempts = 3, shouldRetry } = this.retryConfig

    // Check attempt limit
    if (attempt >= maxAttempts) {
      return false
    }

    // Use custom retry logic if provided
    if (shouldRetry) {
      return shouldRetry(error, attempt)
    }

    // Default: retry if error is retryable
    return isRetryableError(error)
  }

  /**
   * Execute request with retry logic
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    includeServiceKey = false
  ): Promise<T> {
    let lastError: unknown
    const maxAttempts = this.retryConfig.maxAttempts || 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.request<T>(endpoint, options, includeServiceKey)
      } catch (error) {
        lastError = error

        // Check if we should retry
        if (!this.shouldRetryError(error, attempt)) {
          throw error
        }

        // Handle rate limit with specific retry timing
        if (error instanceof RateLimitError && error.retryAfter) {
          const waitMs = error.retryAfter * 1000 // Convert seconds to milliseconds
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          continue
        }

        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted
    throw lastError
  }

  /**
   * Make authenticated request to TurKey API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    includeServiceKey = false
  ): Promise<T> {
    const url = new URL(endpoint, this.config.baseUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Add service API key for backend-to-backend endpoints
    if (includeServiceKey && this.config.serviceApiKey) {
      headers['X-Turkey-Service-Key'] = this.config.serviceApiKey
    }

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.config.timeout!),
      })

      const data = await response.json()

      if (!response.ok) {
        throw createErrorFromResponse(response.status, data)
      }

      return data
    } catch (error) {
      // Re-throw if it's already a TurKey error
      if (error instanceof Error && error.name.includes('Error')) {
        throw error
      }

      // Handle network errors (AbortError, TypeError, etc.)
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new NetworkError('Request timeout', { cause: error })
        }
        if (error.name === 'TypeError') {
          throw new NetworkError('Network request failed', { cause: error })
        }
      }

      // Unknown error
      throw new NetworkError('An unexpected error occurred', {
        cause: error instanceof Error ? error : undefined,
      })
    }
  }

  /**
   * Login user and return authentication response
   */
  async login(params: LoginRequest): Promise<AuthResponse> {
    const requestData = {
      ...params,
      appId: params.appId || this.config.appId,
    }

    const response = await this.requestWithRetry<{ data: AuthResponse }>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    )

    return response.data
  }

  /**
   * Register new user and return authentication response
   */
  async register(
    params: RegisterRequest & { validatePassword?: boolean }
  ): Promise<AuthResponse> {
    // Optionally validate password before making API call
    if (params.validatePassword !== false) {
      const validation = validatePassword(params.password)
      if (!validation.valid) {
        throw new ValidationError(
          `Password validation failed: ${validation.errors.join(', ')}`,
          {
            details: validation.errors.map((error) => ({
              field: 'password',
              message: error,
              code: 'WEAK_PASSWORD',
            })),
          }
        )
      }
    }

    const requestData = {
      role: 'user' as const,
      ...params,
      appId: params.appId || this.config.appId,
      validatePassword: undefined, // Remove from request data
    }

    const response = await this.requestWithRetry<{ data: AuthResponse }>(
      '/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    )

    return response.data
  }

  /**
   * Refresh access token with token refresh queue to prevent race conditions
   */
  async refresh(params: RefreshRequest): Promise<TokenPair> {
    // If a refresh is already in progress, return the same promise
    // This prevents multiple simultaneous refresh requests (thundering herd)
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    const requestData = {
      ...params,
      appId: params.appId || this.config.appId,
    }

    this.refreshPromise = this.requestWithRetry<{ data: TokenPair }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    )
      .then((response) => response.data)
      .finally(() => {
        // Clear the promise when done
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  /**
   * Logout user (invalidate current session)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.requestWithRetry('/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken,
        appId: this.config.appId,
      }),
    })
  }

  /**
   * Logout from all devices (invalidate all sessions)
   */
  async logoutAll(refreshToken: string): Promise<void> {
    await this.requestWithRetry('/v1/auth/logout-all', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken,
        appId: this.config.appId,
      }),
    })
  }

  /**
   * Introspect an access or refresh token server-side
   * Requires service API key if server has TURKEY_SERVICE_API_KEY configured
   */
  async introspect(token: string): Promise<IntrospectionResult> {
    const response = await this.requestWithRetry<{ data: IntrospectionResult }>(
      '/v1/auth/introspect',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      },
      true // Include service API key
    )
    return response.data
  }

  /**
   * Revoke a token (access or refresh)
   * @param token - The token to revoke
   * @param reason - Optional reason for revocation (for audit logs)
   */
  async revoke(token: string, reason?: string): Promise<void> {
    await this.requestWithRetry('/v1/auth/revoke', {
      method: 'POST',
      body: JSON.stringify({ token, reason }),
    })
  }

  /**
   * Revoke both access and refresh tokens (complete logout with revocation)
   * This is more secure than regular logout as it ensures tokens cannot be used even if intercepted
   * @param accessToken - Current access token
   * @param refreshToken - Current refresh token
   * @param reason - Optional reason for revocation
   */
  async revokeAll(
    accessToken: string,
    refreshToken: string,
    reason?: string
  ): Promise<void> {
    // Revoke both tokens
    await this.revoke(accessToken, reason || 'User logout')
    await this.revoke(refreshToken, reason || 'User logout')
  }

  /**
   * Get current user info from access token
   */
  async getCurrentUser(accessToken: string): Promise<User> {
    const response = await this.requestWithRetry<{ data: User }>(
      '/v1/users/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return response.data
  }

  /**
   * Update current user's profile
   * Requires valid access token
   * @param accessToken - Current access token
   * @param updates - Profile fields to update (currently only email)
   */
  async updateProfile(
    accessToken: string,
    updates: UpdateProfileRequest
  ): Promise<UpdateProfileResponse> {
    if (!updates.email) {
      throw new ValidationError(
        'At least one field must be provided for update',
        {
          details: [
            {
              field: 'email',
              message: 'Email is required',
              code: 'REQUIRED_FIELD',
            },
          ],
        }
      )
    }

    const response = await this.requestWithRetry<UpdateProfileResponse>(
      '/v1/users/me',
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      }
    )

    return response
  }

  /**
   * Change current user's password
   * Requires valid access token
   * Note: This will revoke all refresh tokens, requiring re-authentication on all devices
   * @param accessToken - Current access token
   * @param params - Current and new password
   */
  async changePassword(
    accessToken: string,
    params: ChangePasswordRequest
  ): Promise<ChangePasswordResponse> {
    // Client-side validation
    if (!params.currentPassword) {
      throw new ValidationError('Current password is required', {
        details: [
          {
            field: 'currentPassword',
            message: 'Current password is required',
            code: 'REQUIRED_FIELD',
          },
        ],
      })
    }

    if (!params.newPassword) {
      throw new ValidationError('New password is required', {
        details: [
          {
            field: 'newPassword',
            message: 'New password is required',
            code: 'REQUIRED_FIELD',
          },
        ],
      })
    }

    if (params.currentPassword === params.newPassword) {
      throw new ValidationError(
        'New password must be different from current password',
        {
          details: [
            {
              field: 'newPassword',
              message: 'New password must be different from current password',
              code: 'PASSWORD_SAME',
            },
          ],
        }
      )
    }

    // Optionally validate new password strength
    const validation = validatePassword(params.newPassword)
    if (!validation.valid) {
      throw new ValidationError(
        `New password validation failed: ${validation.errors.join(', ')}`,
        {
          details: validation.errors.map((error) => ({
            field: 'newPassword',
            message: error,
            code: 'WEAK_PASSWORD',
          })),
        }
      )
    }

    const response = await this.requestWithRetry<ChangePasswordResponse>(
      '/v1/users/change-password',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(params),
      }
    )

    return response
  }

  /**
   * Delete current user's account
   * Requires valid access token
   * Warning: This action is irreversible
   * @param accessToken - Current access token
   */
  async deleteAccount(accessToken: string): Promise<DeleteAccountResponse> {
    const response = await this.requestWithRetry<DeleteAccountResponse>(
      '/v1/users/me',
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    return response
  }

  /**
   * Client-side token format validation for UI purposes only.
   * ⚠️  WARNING: This is NOT secure for authorization decisions!
   * ⚠️  Always use server-side verifyJwt() for auth/authz.
   */
  async validateTokenFormat(token: string, appId?: string) {
    return this.tokenManager.validateTokenFormat(token, appId)
  }

  /**
   * @deprecated Use validateTokenFormat() instead. This method name is misleading.
   * Will be removed in v1.0.0
   */
  async verifyToken(token: string, appId?: string) {
    return this.tokenManager.verifyToken(token, appId)
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    return this.tokenManager.isTokenExpired(token)
  }

  /**
   * Decode token without verification
   */
  decodeToken(token: string) {
    return this.tokenManager.decodeToken(token)
  }

  /**
   * Get user info from token
   */
  getUserFromToken(token: string) {
    try {
      return this.tokenManager.getUserFromToken(token)
    } catch {
      return null
    }
  }

  /**
   * Get time until token expires
   */
  getTimeUntilExpiry(token: string): number {
    return this.tokenManager.getTimeUntilExpiry(token)
  }
}
