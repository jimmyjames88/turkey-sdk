import { jwtVerify, createRemoteJWKSet } from 'jose'
import type { JWTPayload, TurKeyConfig } from './types'

/**
 * Manages JWT token operations including validation, decoding, and expiry checks.
 *
 * Handles JWKS (JSON Web Key Set) fetching and caching for token verification.
 * Provides both secure server-side verification and client-side utilities.
 *
 * @internal This class is used internally by TurKeyClient
 */
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
   * Validate JWT token format and signature using JWKS.
   *
   * ⚠️ SECURITY WARNING ⚠️
   * This is client-side validation and should ONLY be used for:
   * - UI/UX decisions (showing/hiding elements)
   * - Format validation before API calls
   * - Development and debugging
   *
   * NEVER use for authorization decisions! Always verify tokens
   * server-side using verifyJwt() for security-critical operations.
   *
   * @param token - JWT token to validate
   * @param expectedAppId - Expected audience/app ID (defaults to config)
   * @returns Decoded and validated JWT payload
   * @throws {Error} Invalid token format, expired, or signature mismatch
   *
   * @example
   * ```typescript
   * // ✅ Good: UI validation
   * try {
   *   const payload = await tokenManager.validateTokenFormat(token);
   *   showUserDashboard(payload);
   * } catch {
   *   showLoginForm();
   * }
   *
   * // ❌ Bad: Authorization decision
   * // if (payload.role === 'admin') { grantAccess() } // INSECURE!
   * ```
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
   * Check if a JWT token has expired.
   *
   * Decodes token and compares exp (expiration) claim with current time.
   * Returns true if decoding fails or token is past expiration.
   *
   * @param token - JWT token to check
   * @returns true if expired or invalid, false if still valid
   *
   * @example
   * ```typescript
   * if (tokenManager.isTokenExpired(accessToken)) {
   *   // Initiate token refresh
   *   await refreshTokens();
   * }
   * ```
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
   * Decode JWT token payload without cryptographic verification.
   *
   * Extracts and parses the base64-encoded payload section of the JWT.
   * Does NOT validate:
   * - Token signature
   * - Expiration time
   * - Issuer or audience
   *
   * Use only for client-side inspection, never for security decisions.
   *
   * @param token - JWT token to decode (format: header.payload.signature)
   * @returns Decoded JWT payload object
   * @throws {Error} Invalid token format or malformed base64
   *
   * @example
   * ```typescript
   * const payload = tokenManager.decodeToken(token);
   * console.log('User ID:', payload.sub);
   * console.log('Email:', payload.email);
   * console.log('Expires:', new Date(payload.exp * 1000));
   * ```
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
   * Calculate seconds remaining until token expires.
   *
   * Decodes token and calculates time difference between exp claim
   * and current time. Returns 0 if token is expired or invalid.
   *
   * @param token - JWT token to check
   * @returns Seconds until expiration (0 if expired or invalid)
   *
   * @example
   * ```typescript
   * const timeLeft = tokenManager.getTimeUntilExpiry(token);
   *
   * if (timeLeft < 300) { // Less than 5 minutes
   *   showWarning('Session expiring soon!');
   * }
   *
   * const minutes = Math.floor(timeLeft / 60);
   * updateUI(`Session: ${minutes}m remaining`);
   * ```
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
   * Extract user information from a JWT token.
   *
   * Convenience method that decodes the token and returns
   * commonly-needed user fields (id, email, role).
   *
   * @param token - JWT token containing user claims
   * @returns User object with id (sub), email, and role
   * @throws {Error} Invalid token format
   *
   * @example
   * ```typescript
   * const user = tokenManager.getUserFromToken(token);
   * console.log(`User: ${user.email} (${user.role})`);
   * console.log(`ID: ${user.id}`);
   * ```
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
