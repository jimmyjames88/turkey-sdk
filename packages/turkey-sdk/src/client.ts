import type {
  TurKeyConfig,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  AuthResponse,
  TokenPair,
  TurKeyError,
  User,
  IntrospectionResult,
} from './types'
import { TurKeyAuthError } from './types'
import { TokenManager } from './token-manager'
import { validatePassword } from './password-validation'

export class TurKeyClient {
  private config: TurKeyConfig
  private tokenManager: TokenManager

  constructor(config: TurKeyConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    }
    this.tokenManager = new TokenManager(this.config)
  }

  /**
   * Make authenticated request to TurKey API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = new URL(endpoint, this.config.baseUrl)

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout!),
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as TurKeyError
      throw new TurKeyAuthError(
        error.message,
        error.error,
        response.status,
        error.details
      )
    }

    return data
  }

  /**
   * Login user and return authentication response
   */
  async login(params: LoginRequest): Promise<AuthResponse> {
    const requestData = {
      ...params,
      appId: params.appId || this.config.appId,
    }

    const response = await this.request<{ data: AuthResponse }>(
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
        throw new TurKeyAuthError(
          `Password validation failed: ${validation.errors.join(', ')}`,
          'weak_password',
          400
        )
      }
    }

    const requestData = {
      role: 'user' as const,
      ...params,
      appId: params.appId || this.config.appId,
      validatePassword: undefined, // Remove from request data
    }

    const response = await this.request<{ data: AuthResponse }>(
      '/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    )

    return response.data
  }

  /**
   * Refresh access token
   */
  async refresh(params: RefreshRequest): Promise<TokenPair> {
    const requestData = {
      ...params,
      appId: params.appId || this.config.appId,
    }

    const response = await this.request<{ data: TokenPair }>(
      '/v1/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify(requestData),
      }
    )

    return response.data
  }

  /**
   * Logout user (invalidate current session)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.request('/v1/auth/logout', {
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
    await this.request('/v1/auth/logout-all', {
      method: 'POST',
      body: JSON.stringify({
        refreshToken,
        appId: this.config.appId,
      }),
    })
  }

  /**
   * Introspect an access or refresh token server-side
   */
  async introspect(token: string): Promise<IntrospectionResult> {
    const response = await this.request<{ data: IntrospectionResult }>(
      '/v1/auth/introspect',
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    )
    return response.data
  }

  /**
   * Revoke a token (access or refresh)
   * @param token - The token to revoke
   * @param reason - Optional reason for revocation (for audit logs)
   */
  async revoke(token: string, reason?: string): Promise<void> {
    await this.request('/v1/auth/revoke', {
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
    const response = await this.request<{ data: User }>('/v1/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return response.data
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
