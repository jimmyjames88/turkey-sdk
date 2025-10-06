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
   * Verify and decode a JWT token
   */
  async verifyToken(
    token: string,
    expectedAudience?: string
  ): Promise<JWTPayload> {
    try {
      const jwks = this.initJWKS()
      const audience = expectedAudience || this.config.audience

      const { payload } = await jwtVerify(token, jwks, {
        issuer: this.config.baseUrl,
        audience: audience,
        algorithms: ['ES256'],
      })

      return payload as unknown as JWTPayload
    } catch (error) {
      throw new Error(`Token verification failed: ${error}`)
    }
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

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf-8')
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
    tenantId: string
  } {
    const payload = this.decodeToken(token)
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    }
  }
}
