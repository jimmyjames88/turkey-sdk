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

/**
 * Main client for TurKey authentication service.
 *
 * Provides methods for user authentication, token management, and profile operations.
 * Includes automatic retry logic with exponential backoff for transient failures.
 *
 * @example
 * ```typescript
 * const client = new TurKeyClient({
 *   baseUrl: 'https://auth.example.com',
 *   appId: 'my-app',
 *   retry: { maxAttempts: 3 }
 * });
 *
 * // Login
 * const { user, accessToken, refreshToken } = await client.login({
 *   email: 'user@example.com',
 *   password: 'password'
 * });
 *
 * // Get current user
 * const currentUser = await client.getCurrentUser(accessToken);
 * ```
 */
export class TurKeyClient {
  private config: TurKeyConfig
  private tokenManager: TokenManager
  private retryConfig: RetryConfig
  private refreshPromise: Promise<TokenPair> | null = null

  /**
   * Create a new TurKey client instance.
   *
   * @param config - Client configuration
   * @param config.baseUrl - Base URL of the TurKey authentication server
   * @param config.appId - Optional application identifier for token scoping
   * @param config.timeout - Request timeout in milliseconds (default: 10000)
   * @param config.serviceApiKey - Service API key for backend-to-backend calls
   * @param config.retry - Retry configuration or false to disable (default: enabled with 3 attempts)
   */
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
   * Authenticate a user with email and password.
   *
   * Returns user information and token pair (access + refresh tokens).
   * Access tokens are short-lived and used for API authentication.
   * Refresh tokens are long-lived and used to obtain new access tokens.
   *
   * @param params - Login credentials
   * @param params.email - User's email address
   * @param params.password - User's password
   * @param params.appId - Optional app ID (defaults to client config)
   * @returns Authentication response with user info and tokens
   * @throws {AuthenticationError} Invalid credentials
   * @throws {ValidationError} Invalid email format or missing fields
   * @throws {RateLimitError} Too many login attempts
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * try {
   *   const { user, accessToken, refreshToken } = await client.login({
   *     email: 'user@example.com',
   *     password: 'SecurePass123!'
   *   });
   *   // Store tokens securely
   *   storage.setItem('accessToken', accessToken);
   *   storage.setItem('refreshToken', refreshToken);
   * } catch (error) {
   *   if (error instanceof AuthenticationError) {
   *     console.error('Invalid credentials');
   *   }
   * }
   * ```
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
   * Register a new user account.
   *
   * Creates a new user with email and password, then returns authentication tokens.
   * Password validation is performed client-side by default (can be disabled).
   *
   * @param params - Registration information
   * @param params.email - User's email address (must be unique)
   * @param params.password - User's password (must meet strength requirements)
   * @param params.role - User role (default: 'user')
   * @param params.appId - Optional app ID (defaults to client config)
   * @param params.validatePassword - Whether to validate password strength client-side (default: true)
   * @returns Authentication response with user info and tokens
   * @throws {ValidationError} Invalid email, weak password, or missing fields
   * @throws {ConflictError} Email already registered
   * @throws {RateLimitError} Too many registration attempts
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * try {
   *   const { user, accessToken, refreshToken } = await client.register({
   *     email: 'newuser@example.com',
   *     password: 'SecurePass123!',
   *     role: 'user'
   *   });
   * } catch (error) {
   *   if (error instanceof ValidationError) {
   *     console.error('Validation failed:', error.details);
   *   } else if (error instanceof ConflictError) {
   *     console.error('Email already exists');
   *   }
   * }
   * ```
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
   * Refresh an expired or expiring access token.
   *
   * Uses a refresh token to obtain a new access token and refresh token pair.
   * Implements token refresh queue to prevent race conditions when multiple
   * requests attempt to refresh simultaneously (thundering herd protection).
   *
   * @param params - Refresh parameters
   * @param params.refreshToken - Valid refresh token
   * @param params.appId - Optional app ID (defaults to client config)
   * @returns New token pair with updated expiry
   * @throws {AuthenticationError} Invalid or expired refresh token
   * @throws {RateLimitError} Too many refresh attempts
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * // Automatic refresh when token expires soon
   * if (client.getTimeUntilExpiry(accessToken) < 300) { // Less than 5 minutes
   *   const { accessToken: newToken, refreshToken: newRefresh } =
   *     await client.refresh({ refreshToken });
   *   storage.setItem('accessToken', newToken);
   *   storage.setItem('refreshToken', newRefresh);
   * }
   * ```
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
   * Logout from current session.
   *
   * Invalidates the provided refresh token on the server, effectively ending
   * the user's session. The user will need to login again to obtain new tokens.
   *
   * @param refreshToken - Refresh token to invalidate
   * @throws {AuthenticationError} Invalid refresh token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * await client.logout(refreshToken);
   * storage.removeItem('accessToken');
   * storage.removeItem('refreshToken');
   * ```
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
   * Logout from all sessions on all devices.
   *
   * Invalidates ALL refresh tokens for the user across all devices and sessions.
   * This is a security measure useful when a user suspects unauthorized access
   * or wants to force re-authentication everywhere.
   *
   * @param refreshToken - Any valid refresh token for the user
   * @throws {AuthenticationError} Invalid refresh token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * // User clicked "Logout from all devices"
   * await client.logoutAll(refreshToken);
   * storage.clear();
   * router.push('/login');
   * ```
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
   * Introspect a token to check its validity and get payload information.
   *
   * This is a server-side operation that verifies token signature and returns
   * detailed information about the token. Requires service API key if the
   * TurKey server has TURKEY_SERVICE_API_KEY configured.
   *
   * @param token - Access or refresh token to introspect
   * @returns Introspection result with token status and payload
   * @throws {AuthenticationError} Invalid service API key
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * const result = await client.introspect(accessToken);
   * if (result.active) {
   *   console.log('Token valid until:', result.expiresAt);
   *   console.log('User ID:', result.userId);
   * }
   * ```
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
   * Revoke a single token (access or refresh).
   *
   * Permanently invalidates the token, ensuring it cannot be used even if
   * intercepted. More secure than regular logout for sensitive operations.
   *
   * @param token - Token to revoke (access or refresh)
   * @param reason - Optional reason for audit logging
   * @throws {AuthenticationError} Invalid token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * // Revoke compromised token
   * await client.revoke(suspiciousToken, 'Security incident');
   * ```
   */
  async revoke(token: string, reason?: string): Promise<void> {
    await this.requestWithRetry('/v1/auth/revoke', {
      method: 'POST',
      body: JSON.stringify({ token, reason }),
    })
  }

  /**
   * Revoke both access and refresh tokens (secure logout).
   *
   * Invalidates both tokens, providing more security than regular logout.
   * Ensures tokens cannot be used even if intercepted during transmission
   * or if stored insecurely.
   *
   * @param accessToken - Current access token to revoke
   * @param refreshToken - Current refresh token to revoke
   * @param reason - Optional reason for audit logging
   * @throws {AuthenticationError} Invalid tokens
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * // Secure logout with token revocation
   * await client.revokeAll(accessToken, refreshToken, 'User logout');
   * storage.clear();
   * ```
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
   * Get current authenticated user's information.
   *
   * Retrieves user profile from the server using an access token.
   * Useful for fetching latest user data after login or profile updates.
   *
   * @param accessToken - Valid access token
   * @returns User profile information
   * @throws {AuthenticationError} Invalid or expired access token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * const user = await client.getCurrentUser(accessToken);
   * console.log(`Logged in as: ${user.email}`);
   * console.log(`Role: ${user.role}`);
   * ```
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
   * Update the current user's profile information.
   *
   * Currently supports updating email address. Requires valid access token.
   *
   * @param accessToken - Valid access token
   * @param updates - Profile fields to update
   * @param updates.email - New email address (must be unique)
   * @returns Update response with new user data
   * @throws {ValidationError} Invalid email format or missing fields
   * @throws {ConflictError} Email already in use by another account
   * @throws {AuthenticationError} Invalid or expired access token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * try {
   *   const result = await client.updateProfile(accessToken, {
   *     email: 'newemail@example.com'
   *   });
   *   console.log('Profile updated:', result.user);
   * } catch (error) {
   *   if (error instanceof ConflictError) {
   *     console.error('Email already taken');
   *   }
   * }
   * ```
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
   * Change the current user's password.
   *
   * Validates password strength and updates the password. This operation
   * revokes ALL refresh tokens, requiring re-authentication on all devices
   * for security purposes.
   *
   * @param accessToken - Valid access token
   * @param params - Password change parameters
   * @param params.currentPassword - User's current password for verification
   * @param params.newPassword - New password (must meet strength requirements)
   * @returns Change response indicating success and re-auth requirement
   * @throws {ValidationError} Weak password, missing fields, or same as current
   * @throws {AuthenticationError} Invalid current password or expired token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * try {
   *   const result = await client.changePassword(accessToken, {
   *     currentPassword: 'OldPass123!',
   *     newPassword: 'NewSecurePass456!'
   *   });
   *
   *   if (result.requiresReauthentication) {
   *     // All other sessions invalidated
   *     console.log('Please login again on other devices');
   *   }
   * } catch (error) {
   *   if (error instanceof AuthenticationError) {
   *     console.error('Current password is incorrect');
   *   }
   * }
   * ```
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
   * Permanently delete the current user's account.
   *
   * ⚠️ WARNING: This action is irreversible! ⚠️
   *
   * Deletes all user data including profile, sessions, and tokens.
   * Use with caution and always confirm with the user before calling.
   *
   * @param accessToken - Valid access token
   * @returns Deletion response with deleted user information
   * @throws {AuthenticationError} Invalid or expired access token
   * @throws {NetworkError} Network or timeout issues
   *
   * @example
   * ```typescript
   * // Always confirm with user first!
   * const confirmed = await showConfirmDialog(
   *   'Are you sure? This action cannot be undone.'
   * );
   *
   * if (confirmed) {
   *   const result = await client.deleteAccount(accessToken);
   *   console.log('Account deleted:', result.deletedUser.email);
   *   storage.clear();
   *   router.push('/goodbye');
   * }
   * ```
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
   * Validate JWT token format client-side (UI purposes only).
   *
   * ⚠️ SECURITY WARNING ⚠️
   * This performs format validation but is NOT secure for authorization!
   * Client-side validation can be bypassed. Always use server-side
   * verifyJwt() for actual authentication/authorization decisions.
   *
   * Valid use cases:
   * - Validating token format before API calls
   * - Providing immediate user feedback on token issues
   * - Development/debugging
   *
   * Invalid use cases:
   * - Authorizing access to protected resources
   * - Making security decisions based on token validity
   *
   * @param token - JWT token to validate
   * @param appId - Expected app ID (defaults to client config)
   * @returns Decoded JWT payload if valid format
   * @throws {Error} Invalid token format, signature, or app ID mismatch
   *
   * @example
   * ```typescript
   * // ✅ Good: UI validation before API call
   * try {
   *   await client.validateTokenFormat(token);
   *   // Token format is valid, proceed with API call
   * } catch (error) {
   *   showError('Invalid token, please login again');
   * }
   *
   * // ❌ Bad: Using for authorization
   * // const payload = await client.validateTokenFormat(token);
   * // if (payload.role === 'admin') { ... } // INSECURE!
   * ```
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
   * Check if a JWT token is expired.
   *
   * Decodes the token and compares the expiration time (exp claim)
   * with current time. Useful for determining when to refresh tokens.
   *
   * @param token - JWT token to check
   * @returns true if token is expired, false if still valid
   *
   * @example
   * ```typescript
   * if (client.isTokenExpired(accessToken)) {
   *   // Token expired, refresh it
   *   const newTokens = await client.refresh({ refreshToken });
   *   accessToken = newTokens.accessToken;
   * }
   * ```
   */
  isTokenExpired(token: string): boolean {
    return this.tokenManager.isTokenExpired(token)
  }

  /**
   * Decode a JWT token without cryptographic verification.
   *
   * Extracts and parses the JWT payload for client-side inspection.
   * Does NOT validate signature, expiration, or issuer.
   *
   * ⚠️ Use only for UI/UX decisions, never for authorization!
   *
   * @param token - JWT token to decode
   * @returns Decoded JWT payload
   * @throws {Error} Invalid token format
   *
   * @example
   * ```typescript
   * const payload = client.decodeToken(accessToken);
   * console.log(`Logged in as: ${payload.email}`);
   * console.log(`Token expires: ${new Date(payload.exp * 1000)}`);
   * ```
   */
  decodeToken(token: string) {
    return this.tokenManager.decodeToken(token)
  }

  /**
   * Extract user information from a JWT token.
   *
   * Convenience method that decodes token and returns user-specific fields.
   * Returns null if token is invalid instead of throwing.
   *
   * @param token - JWT token containing user information
   * @returns User object with id, email, and role, or null if invalid
   *
   * @example
   * ```typescript
   * const user = client.getUserFromToken(accessToken);
   * if (user) {
   *   console.log(`Welcome, ${user.email}!`);
   *   if (user.role === 'admin') {
   *     showAdminPanel();
   *   }
   * } else {
   *   redirectToLogin();
   * }
   * ```
   */
  getUserFromToken(token: string) {
    try {
      return this.tokenManager.getUserFromToken(token)
    } catch {
      return null
    }
  }

  /**
   * Get time remaining until token expires.
   *
   * Calculates seconds remaining before token expiration.
   * Useful for implementing auto-refresh logic or showing
   * session timeout warnings to users.
   *
   * @param token - JWT token to check
   * @returns Seconds until expiration (0 if already expired or invalid)
   *
   * @example
   * ```typescript
   * const secondsLeft = client.getTimeUntilExpiry(accessToken);
   *
   * if (secondsLeft < 300) { // Less than 5 minutes
   *   console.log('Token expiring soon, refreshing...');
   *   await client.refresh({ refreshToken });
   * }
   *
   * // Show countdown to user
   * const minutes = Math.floor(secondsLeft / 60);
   * console.log(`Session expires in ${minutes} minutes`);
   * ```
   */
  getTimeUntilExpiry(token: string): number {
    return this.tokenManager.getTimeUntilExpiry(token)
  }
}
