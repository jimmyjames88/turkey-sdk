import { jwtVerify, createRemoteJWKSet } from 'jose'
import type { JWTPayload, TurKeyConfig } from './types'

export class TokenManager {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null
  private config: TurKeyConfig

  constructor(config: TurKeyConfig) {
    this.config = config
  }

  /**
   * Initialize JWKS for token verification
   */
  private initJWKS() {
    if (!this.jwks) {
      const jwksUrl = new URL('/.well-known/jwks.json', this.config.baseUrl)
      this.jwks = createRemoteJWKSet(jwksUrl)
    }
    return this.jwks
  }

  /**
   * Client-side token format validation for UI purposes only.
   * ⚠️  WARNING: This is NOT secure for authorization decisions!
   * ⚠️  Always use server-side verifyJwt() for auth/authz.
   *
   * Use cases:
   * - Validating token format before sending to server
   * - Client-side error handling and user feedback
   * - Development/debugging token issues
   */
  async validateTokenFormat(
    token: string,
    expectedAppId?: string
  ): Promise<JWTPayload> {
    try {
      const jwks = this.initJWKS()
      const appId = expectedAppId || this.config.appId

      const { payload } = await jwtVerify(token, jwks, {
        issuer: this.config.baseUrl,
        audience: appId,
        algorithms: ['ES256'],
      })

      return payload as unknown as JWTPayload
    } catch (error) {
      throw new Error(`Token format validation failed: ${error}`)
    }
  }

  /**
   * @deprecated Use validateTokenFormat() instead. This method name is misleading.
   * Will be removed in v1.0.0
   */
  async verifyToken(
    token: string,
    expectedAppId?: string
  ): Promise<JWTPayload> {
    return this.validateTokenFormat(token, expectedAppId)
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token)
      const now = Math.floor(Date.now() / 1000)
      return payload.exp < now
    } catch {
      return true
    }
  }

  /**
   * Decode token without verification (for client-side inspection)
   */
  decodeToken(token: string): JWTPayload {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid token format')
      }

      // Convert base64url to base64 for better compatibility
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padding = '='.repeat((4 - (base64.length % 4)) % 4)
      const base64Padded = base64 + padding

      const payload = JSON.parse(
        Buffer.from(base64Padded, 'base64').toString('utf-8')
      )

      return payload as JWTPayload
    } catch (error) {
      throw new Error(`Token decode failed: ${error}`)
    }
  }

  /**
   * Get time until token expires (in seconds)
   */
  getTimeUntilExpiry(token: string): number {
    try {
      const payload = this.decodeToken(token)
      const now = Math.floor(Date.now() / 1000)
      return Math.max(0, payload.exp - now)
    } catch {
      return 0
    }
  }

  /**
   * Extract user info from token
   */
  getUserFromToken(token: string): {
    id: string
    email: string
    role: string
  } {
    const payload = this.decodeToken(token)
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
  }
}
