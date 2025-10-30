/**
 * JWT Verification Integration Tests (HTTP-based)
 *
 * Tests token verification through Turkey server's introspect endpoint.
 * This approach avoids Jest's ESM limitations with the jose library
 * while still testing real JWT verification in production.
 */

import { TurKeyClient } from '../../client'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('JWT Verification Integration (HTTP)', () => {
  let client: TurKeyClient
  let validAccessToken: string
  let validRefreshToken: string

  beforeAll(async () => {
    client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId,
    })

    // Register a user and get tokens
    const email = generateTestEmail()
    const response = await client.register({
      email,
      password: TEST_PASSWORD,
    })

    validAccessToken = response.accessToken
    validRefreshToken = response.refreshToken
  })

  describe('Token Introspection', () => {
    it('should validate access token via introspect endpoint', async () => {
      const result = await client.introspect(validAccessToken)

      expect(result).toHaveProperty('active')
      expect(result.active).toBe(true)
      expect(result.type).toBe('access')
      expect(result).toHaveProperty('payload')
      expect(result.payload).toBeDefined()
      expect(result.payload).toHaveProperty('sub')
      expect(result.payload).toHaveProperty('email')
      expect(result.payload).toHaveProperty('aud')
      expect(result.payload?.aud).toBe(INTEGRATION_CONFIG.appId)
    })

    it('should validate refresh token via introspect endpoint', async () => {
      const result = await client.introspect(validRefreshToken)

      expect(result).toHaveProperty('active')
      expect(result.active).toBe(true)
      expect(result.type).toBe('refresh')
      expect(result).toHaveProperty('userId')
      expect(result).toHaveProperty('expiresAt')
    })

    it('should reject invalid token', async () => {
      const result = await client.introspect('invalid-token')

      expect(result).toHaveProperty('active')
      expect(result.active).toBe(false)
    })

    it('should reject token with invalid signature', async () => {
      // Tamper with token signature
      const parts = validAccessToken.split('.')
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`

      const result = await client.introspect(tamperedToken)

      expect(result.active).toBe(false)
    })

    it('should reject malformed token', async () => {
      const result = await client.introspect('not-a-jwt-token')

      expect(result.active).toBe(false)
    })

    it('should reject empty token', async () => {
      // Empty token returns 400 error from server
      await expect(client.introspect('')).rejects.toThrow()
    })
  })

  describe('Multi-App Token Isolation', () => {
    it('should create tokens with correct appId in audience claim', async () => {
      const result = await client.introspect(validAccessToken)

      expect(result.active).toBe(true)
      expect(result.payload?.aud).toBe(INTEGRATION_CONFIG.appId)
    })

    it('should create app-specific tokens for different appIds', async () => {
      // Create client with different appId
      const client2 = new TurKeyClient({
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        appId: INTEGRATION_CONFIG.appId2,
      })

      const email = generateTestEmail()
      const response = await client2.register({
        email,
        password: TEST_PASSWORD,
      })

      // Introspect the token
      const result = await client2.introspect(response.accessToken)

      expect(result.active).toBe(true)
      expect(result.payload?.aud).toBe(INTEGRATION_CONFIG.appId2)

      // Verify it's different from first app's token audience
      expect(result.payload?.aud).not.toBe(INTEGRATION_CONFIG.appId)
    })
  })

  describe('JWKS Endpoint', () => {
    it('should fetch JWKS successfully', async () => {
      const response = await fetch(
        `${INTEGRATION_CONFIG.baseUrl}/.well-known/jwks.json`
      )

      expect(response.ok).toBe(true)

      const jwks = await response.json()
      expect(jwks).toHaveProperty('keys')
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys.length).toBeGreaterThan(0)

      // Check first key structure
      const key = jwks.keys[0]
      expect(key).toHaveProperty('kty')
      expect(key).toHaveProperty('kid')
      expect(key).toHaveProperty('use')
      expect(key.use).toBe('sig')
    })
  })

  describe('Refresh Token Rotation', () => {
    it('should invalidate old refresh token after rotation', async () => {
      // Get initial tokens
      const email = generateTestEmail()
      const initialResponse = await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const oldRefreshToken = initialResponse.refreshToken

      // Refresh tokens (this rotates the refresh token)
      const newTokens = await client.refresh({ refreshToken: oldRefreshToken })

      expect(newTokens.refreshToken).not.toBe(oldRefreshToken)

      // Old refresh token should now be invalid
      const oldTokenIntrospect = await client.introspect(oldRefreshToken)
      expect(oldTokenIntrospect.active).toBe(false)

      // New refresh token should be valid
      const newTokenIntrospect = await client.introspect(newTokens.refreshToken)
      expect(newTokenIntrospect.active).toBe(true)
    })
  })
})

/**
 * NOTE: Direct JWKS verification tests are skipped due to Jest ESM limitations.
 *
 * JWT verification is tested in production through:
 * - HTTP introspect endpoint tests (above)
 * - turkey-sdk-next middleware in Edge Runtime
 * - Turkey server's own JWKS verification
 * - Manual testing and E2E tests in consuming applications
 *
 * The jose library works correctly in production but cannot be tested
 * directly in Jest due to its ESM-only nature and Jest's CommonJS transpilation.
 */
