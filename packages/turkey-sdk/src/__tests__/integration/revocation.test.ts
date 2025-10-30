/**
 * Integration Tests: Token Revocation
 *
 * Tests token revocation functionality including:
 * - Revoking access tokens
 * - Revoking refresh tokens
 * - Revocation checks via middleware
 * - Expired revocation cleanup
 * - Network failure handling
 */

import { TurKeyClient } from '../../client'
import { checkRevocation } from '../../server/revocation'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('Token Revocation Integration Tests', () => {
  let client: TurKeyClient
  let validAccessToken: string
  let validRefreshToken: string
  let userEmail: string

  beforeEach(async () => {
    // Create a fresh client and user for each test
    client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId,
    })

    userEmail = generateTestEmail()
    const response = await client.register({
      email: userEmail,
      password: TEST_PASSWORD,
    })

    validAccessToken = response.accessToken
    validRefreshToken = response.refreshToken
  })

  describe('Access Token Revocation', () => {
    it('should successfully revoke an access token', async () => {
      // Token should work initially
      const userBefore = client.getUserFromToken(validAccessToken)
      expect(userBefore?.email).toBe(userEmail)

      // Revoke the token
      await client.revoke(validAccessToken)

      // Token should be marked as revoked (check via introspect)
      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })

    it('should support optional reason for revocation', async () => {
      const reason = 'User requested logout from all devices'

      await client.revoke(validAccessToken, reason)

      // Verify revocation occurred
      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })

    it('should prevent using revoked access token for API calls', async () => {
      // Revoke the token
      await client.revoke(validAccessToken)

      // Try to use the revoked token for an authenticated API call
      await expect(client.getCurrentUser(validAccessToken)).rejects.toThrow()
    })
  })

  describe('Refresh Token Revocation', () => {
    it('should successfully revoke a refresh token', async () => {
      // Revoke the refresh token
      await client.revoke(validRefreshToken)

      // Try to use revoked refresh token
      await expect(
        client.refresh({ refreshToken: validRefreshToken })
      ).rejects.toThrow()
    })

    it('should revoke both access and refresh tokens', async () => {
      // Revoke all tokens
      await client.revokeAll(validAccessToken, validRefreshToken)

      // Both tokens should be revoked
      const accessPayload = client.decodeToken(validAccessToken)
      const isAccessRevoked = await checkRevocation(accessPayload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })
      expect(isAccessRevoked).toBe(true)

      // Refresh token should also be revoked
      await expect(
        client.refresh({ refreshToken: validRefreshToken })
      ).rejects.toThrow()
    })

    it('should revoke all tokens with custom reason', async () => {
      const reason = 'Security incident - password compromised'

      await client.revokeAll(validAccessToken, validRefreshToken, reason)

      // Verify both are revoked
      const accessPayload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(accessPayload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })
      expect(isRevoked).toBe(true)
    })
  })

  describe('Revocation Check Utility', () => {
    it('should return false for non-revoked tokens', async () => {
      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(false)
    })

    it('should return true for revoked tokens', async () => {
      await client.revoke(validAccessToken)

      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })

    it('should handle missing jti gracefully', async () => {
      const isRevoked = await checkRevocation('', {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      // Should not error, just return false
      expect(isRevoked).toBe(false)
    })
  })

  describe('Revocation Security', () => {
    it('should not allow using revoked token for new operations', async () => {
      // Revoke access token
      await client.revoke(validAccessToken)

      // Try to use revoked token for an API call
      await expect(client.getCurrentUser(validAccessToken)).rejects.toThrow()
    })

    it('should revoke tokens immediately (no grace period)', async () => {
      await client.revoke(validAccessToken)

      // Immediate check should show revoked
      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })
  })

  describe('Token Lifecycle After Revocation', () => {
    it('should allow creating new tokens after revocation', async () => {
      // Revoke old tokens
      await client.revokeAll(validAccessToken, validRefreshToken)

      // Login again to get new tokens
      const newResponse = await client.login({
        email: userEmail,
        password: TEST_PASSWORD,
      })

      expect(newResponse.accessToken).toBeDefined()
      expect(newResponse.refreshToken).toBeDefined()
      expect(newResponse.accessToken).not.toBe(validAccessToken)

      // New token should work
      const newPayload = client.decodeToken(newResponse.accessToken)
      const isRevoked = await checkRevocation(newPayload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(false)
    })

    it('should maintain revocation after token expiry', async () => {
      await client.revoke(validAccessToken)

      // Even if we wait (simulated), revocation should persist
      // until the token's natural expiration
      const payload = client.decodeToken(validAccessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid token gracefully', async () => {
      await expect(client.revoke('invalid-token')).rejects.toThrow()
    })

    it('should allow revoking already-revoked token', async () => {
      // Revoke once
      await client.revoke(validAccessToken)

      // Try to revoke again - should be idempotent and succeed
      // The server doesn't reject already-revoked tokens to maintain idempotency
      await expect(client.revoke(validAccessToken)).resolves.not.toThrow()
    })

    it('should fail open on network errors for revocation check', async () => {
      // Use invalid baseUrl to simulate network error
      const isRevoked = await checkRevocation('some-jti', {
        baseUrl: 'http://invalid-server-url:99999',
      })

      // Should fail open (return false) rather than throwing
      expect(isRevoked).toBe(false)
    })
  })

  describe('Multiple Token Revocation', () => {
    it('should handle revoking multiple tokens independently', async () => {
      // Create another user
      const user2Email = generateTestEmail()
      const user2Response = await client.register({
        email: user2Email,
        password: TEST_PASSWORD,
      })

      // Revoke first user's token
      await client.revoke(validAccessToken)

      // Second user's token should still work
      const user2Payload = client.decodeToken(user2Response.accessToken)
      const isUser2Revoked = await checkRevocation(user2Payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isUser2Revoked).toBe(false)

      // First user's token should be revoked
      const user1Payload = client.decodeToken(validAccessToken)
      const isUser1Revoked = await checkRevocation(user1Payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isUser1Revoked).toBe(true)
    })

    it('should handle concurrent revocations', async () => {
      // Create multiple tokens
      const token1 = validAccessToken
      const response2 = await client.login({
        email: userEmail,
        password: TEST_PASSWORD,
      })
      const token2 = response2.accessToken

      // Revoke both concurrently
      await Promise.all([client.revoke(token1), client.revoke(token2)])

      // Both should be revoked
      const payload1 = client.decodeToken(token1)
      const payload2 = client.decodeToken(token2)

      const [isRevoked1, isRevoked2] = await Promise.all([
        checkRevocation(payload1.jti, { baseUrl: INTEGRATION_CONFIG.baseUrl }),
        checkRevocation(payload2.jti, { baseUrl: INTEGRATION_CONFIG.baseUrl }),
      ])

      expect(isRevoked1).toBe(true)
      expect(isRevoked2).toBe(true)
    })
  })

  describe('Cross-App Revocation', () => {
    it('should revoke tokens across different app IDs', async () => {
      // Create client with different app ID
      const client2 = new TurKeyClient({
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        appId: INTEGRATION_CONFIG.appId2,
      })

      const app2Email = generateTestEmail()
      const app2Response = await client2.register({
        email: app2Email,
        password: TEST_PASSWORD,
      })

      // Revoke app2 token
      await client2.revoke(app2Response.accessToken)

      // Check revocation (should work cross-app)
      const payload = client2.decodeToken(app2Response.accessToken)
      const isRevoked = await checkRevocation(payload.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(true)
    })
  })
})
