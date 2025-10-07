import Cookies from 'js-cookie'

export interface TokenStorage {
  getAccessToken(): string | null
  getRefreshToken(): string | null
  setTokens(accessToken: string, refreshToken: string): void
  clearTokens(): void
}

/**
 * Cookie-based token storage (recommended for SSR)
 */
export class CookieTokenStorage implements TokenStorage {
  private accessTokenKey = 'turkey_access_token'
  private refreshTokenKey = 'turkey_refresh_token'

  constructor(
    private options: {
      secure?: boolean
      sameSite?: 'strict' | 'lax' | 'none'
      domain?: string
      path?: string
    } = {}
  ) {}

  getAccessToken(): string | null {
    const token = Cookies.get(this.accessTokenKey) || null
    console.log(
      '🔍 CookieStorage: getAccessToken called, result:',
      token ? 'Token found' : 'No token'
    )
    return token
  }

  getRefreshToken(): string | null {
    const token = Cookies.get(this.refreshTokenKey) || null
    console.log(
      '🔍 CookieStorage: getRefreshToken called, result:',
      token ? 'Token found' : 'No token'
    )
    return token
  }

  setTokens(accessToken: string, refreshToken: string): void {
    console.log('🔍 CookieStorage: setTokens called with tokens:', {
      accessToken: accessToken.substring(0, 20) + '...',
      refreshToken: refreshToken.substring(0, 20) + '...',
    })

    const cookieOptions = {
      secure: this.options.secure ?? true,
      sameSite: this.options.sameSite ?? 'strict',
      domain: this.options.domain,
      path: this.options.path ?? '/',
    }

    console.log('🔍 CookieStorage: Cookie options:', cookieOptions)

    Cookies.set(this.accessTokenKey, accessToken, {
      ...cookieOptions,
      expires: 1, // 1 day for access token
    })
    console.log('🔍 CookieStorage: Access token cookie set')

    Cookies.set(this.refreshTokenKey, refreshToken, {
      ...cookieOptions,
      expires: 30, // 30 days for refresh token
    })
    console.log('🔍 CookieStorage: Refresh token cookie set')

    // Verify cookies were set
    setTimeout(() => {
      console.log(
        '🔍 CookieStorage: Verification - Access token:',
        Cookies.get(this.accessTokenKey) ? 'Found' : 'Not found'
      )
      console.log(
        '🔍 CookieStorage: Verification - Refresh token:',
        Cookies.get(this.refreshTokenKey) ? 'Found' : 'Not found'
      )
    }, 100)
  }

  clearTokens(): void {
    Cookies.remove(this.accessTokenKey, { path: this.options.path ?? '/' })
    Cookies.remove(this.refreshTokenKey, { path: this.options.path ?? '/' })
  }
}

/**
 * LocalStorage-based token storage (client-side only)
 */
export class LocalStorageTokenStorage implements TokenStorage {
  private accessTokenKey = 'turkey_access_token'
  private refreshTokenKey = 'turkey_refresh_token'

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.accessTokenKey)
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.refreshTokenKey)
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.accessTokenKey, accessToken)
    localStorage.setItem(this.refreshTokenKey, refreshToken)
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.accessTokenKey)
    localStorage.removeItem(this.refreshTokenKey)
  }
}

/**
 * Memory-based token storage (for testing or temporary use)
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null
  private refreshToken: string | null = null

  getAccessToken(): string | null {
    return this.accessToken
  }

  getRefreshToken(): string | null {
    return this.refreshToken
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
  }

  clearTokens(): void {
    this.accessToken = null
    this.refreshToken = null
  }
}
