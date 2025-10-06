import type {
  TurKeyConfig,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  AuthResponse,
  TokenPair,
  TurKeyError,
} from './types'
import { TurKeyAuthError } from './types'
import { TokenManager } from './token-manager'

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
      audience: params.audience || this.config.audience,
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
  async register(params: RegisterRequest): Promise<AuthResponse> {
    const requestData = {
      role: 'user' as const,
      ...params,
      audience: params.audience || this.config.audience,
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
      audience: params.audience || this.config.audience,
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
  async logout(accessToken: string): Promise<void> {
    await this.request('/v1/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  /**
   * Logout from all devices (invalidate all sessions)
   */
  async logoutAll(accessToken: string): Promise<void> {
    await this.request('/v1/auth/logout-all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  /**
   * Get current user info from access token
   */
  async getCurrentUser(accessToken: string): Promise<any> {
    const response = await this.request('/v1/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return response
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string, audience?: string) {
    return this.tokenManager.verifyToken(token, audience)
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
    return this.tokenManager.getUserFromToken(token)
  }

  /**
   * Get time until token expires
   */
  getTimeUntilExpiry(token: string): number {
    return this.tokenManager.getTimeUntilExpiry(token)
  }
}
