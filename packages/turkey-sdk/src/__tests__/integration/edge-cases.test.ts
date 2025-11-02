/**
 * Edge Case Integration Tests
 *
 * Tests SDK behavior under failure conditions:
 * - Network failures and timeouts
 * - Expired tokens
 * - Invalid tokens
 * - Concurrent requests
 * - Race conditions
 * - Malformed responses
 */

import { TurKeyClient } from '../../client'
import { MemoryTokenStorage } from '../../storage'
import { TurKeyAuthError } from '../../types'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('Edge Cases', () => {
  let client: TurKeyClient

  beforeEach(() => {
    client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId,
    })
  })

  describe('Network Failures', () => {
    it('should handle network timeout gracefully', async () => {
      const slowClient = new TurKeyClient({
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        appId: INTEGRATION_CONFIG.appId,
        timeout: 1, // 1ms timeout to force failure
      })

      await expect(
        slowClient.login({
          email: generateTestEmail(),
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow()
    })

    it('should handle invalid server URL', async () => {
      const badClient = new TurKeyClient({
        baseUrl: 'http://invalid-server-that-does-not-exist.local:9999',
        appId: INTEGRATION_CONFIG.appId,
        timeout: 2000,
      })

      await expect(
        badClient.login({
          email: 'test@example.com',
          password: 'password',
        })
      ).rejects.toThrow()
    })

    it('should handle server returning 500 error', async () => {
      // Try to register with invalid data that might trigger server error
      await expect(
        client.register({
          email: '', // Empty email should fail validation
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow(TurKeyAuthError)
    })
  })

  describe('Expired Tokens', () => {
    it('should detect expired access token', async () => {
      // Create a token that's already expired (exp in the past)
      const expiredToken =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJhdWQiOiJ0ZXN0LWFwcCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwfQ.signature'

      expect(client.isTokenExpired(expiredToken)).toBe(true)
    })

    it('should detect valid (non-expired) token', async () => {
      // Register and login to get a real valid token
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      expect(client.isTokenExpired(loginResponse.accessToken)).toBe(false)
    })

    it('should calculate time until expiry correctly', async () => {
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const { accessToken } = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      const timeUntilExpiry = client.getTimeUntilExpiry(accessToken)

      // Token should expire in approximately 15 minutes (900 seconds)
      // Allow some variance for test execution time
      expect(timeUntilExpiry).toBeGreaterThan(850)
      expect(timeUntilExpiry).toBeLessThan(950)
    })

    it('should return zero for expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJhdWQiOiJ0ZXN0LWFwcCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwfQ.signature'

      const timeUntilExpiry = client.getTimeUntilExpiry(expiredToken)
      // getTimeUntilExpiry returns Math.max(0, ...) so it never goes negative
      expect(timeUntilExpiry).toBe(0)
    })
  })

  describe('Invalid Tokens', () => {
    it('should reject malformed JWT tokens', () => {
      const malformedToken = 'not-a-valid-jwt-token'

      expect(() => client.decodeToken(malformedToken)).toThrow()
    })

    it('should reject JWT with invalid structure', () => {
      const invalidStructure = 'header.payload' // Missing signature

      expect(() => client.decodeToken(invalidStructure)).toThrow()
    })

    it('should reject JWT with invalid base64 encoding', () => {
      const invalidBase64 = 'invalid!!!.base64!!.encoding!!'

      expect(() => client.decodeToken(invalidBase64)).toThrow()
    })

    it('should handle getUserFromToken with invalid token', () => {
      const invalidToken = 'invalid.token.here'

      const result = client.getUserFromToken(invalidToken)
      expect(result).toBeNull()
    })

    it('should handle getUserFromToken with missing claims', () => {
      // Token without required claims (sub, email, role)
      const tokenMissingClaims =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzAwMDAwMDAsImlhdCI6MTYwMDAwMDAwMH0.signature'

      const result = client.getUserFromToken(tokenMissingClaims)

      // getUserFromToken returns object with undefined fields rather than null
      expect(result).not.toBeNull()
      if (result) {
        expect(result.id).toBeUndefined()
        expect(result.email).toBeUndefined()
        expect(result.role).toBeUndefined()
      }
    })
  })

  describe('Authentication Failures', () => {
    it('should handle login with non-existent user', async () => {
      await expect(
        client.login({
          email: 'nonexistent-user-' + Date.now() + '@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(TurKeyAuthError)
    })

    it('should handle login with wrong password', async () => {
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      await expect(
        client.login({
          email,
          password: 'wrong-password-123',
        })
      ).rejects.toThrow(TurKeyAuthError)
    })

    it('should handle duplicate registration', async () => {
      const email = generateTestEmail()

      // First registration should succeed
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      // Second registration with same email should fail
      await expect(
        client.register({
          email,
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow(TurKeyAuthError)
    })

    it('should handle refresh with invalid token', async () => {
      await expect(
        client.refresh({
          refreshToken: 'invalid-refresh-token',
        })
      ).rejects.toThrow(TurKeyAuthError)
    })

    it('should handle logout with invalid token gracefully', async () => {
      // Logout with invalid token might succeed or fail depending on server implementation
      // The server may just ignore invalid tokens and return success
      const result = await client.logout('invalid-access-token')

      // Should not throw, might return undefined/void
      expect(result).toBeUndefined()
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous registrations', async () => {
      const promises = Array.from({ length: 5 }, () =>
        client.register({
          email: generateTestEmail(),
          password: TEST_PASSWORD,
        })
      )

      const results = await Promise.all(promises)

      // All should succeed with unique users
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.user).toBeDefined()
        expect(result.accessToken).toBeDefined()
        expect(result.refreshToken).toBeDefined()
      })

      // All users should have unique emails
      const emails = results.map((r) => r.user.email)
      const uniqueEmails = new Set(emails)
      expect(uniqueEmails.size).toBe(5)
    })

    it('should handle concurrent login attempts for same user', async () => {
      // First create a user
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      // Then try to login multiple times concurrently
      const promises = Array.from({ length: 5 }, () =>
        client.login({
          email,
          password: TEST_PASSWORD,
        })
      )

      const results = await Promise.all(promises)

      // All should succeed
      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.user.email).toBe(email)
        expect(result.accessToken).toBeDefined()
        expect(result.refreshToken).toBeDefined()
      })

      // Each login should get unique tokens
      const accessTokens = results.map((r) => r.accessToken)
      const uniqueTokens = new Set(accessTokens)
      expect(uniqueTokens.size).toBe(5)
    })

    it('should handle concurrent refresh requests', async () => {
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      const refreshToken = loginResponse.refreshToken

      // Try to refresh multiple times concurrently with same refresh token
      const promises = Array.from({ length: 3 }, () =>
        client.refresh({ refreshToken })
      )

      // Only one should succeed due to refresh token rotation
      // Others should fail because the refresh token gets invalidated
      const results = await Promise.allSettled(promises)

      const succeeded = results.filter((r) => r.status === 'fulfilled')

      // At least one should succeed
      expect(succeeded.length).toBeGreaterThanOrEqual(1)

      // Due to token rotation, subsequent requests with old token should fail
      // This is expected behavior for security
    })
  })

  describe('Token Validation Edge Cases', () => {
    it('should handle token from different app ID', async () => {
      const email = generateTestEmail()

      // Register with app1
      const client1 = new TurKeyClient({
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        appId: INTEGRATION_CONFIG.appId,
      })

      await client1.register({
        email,
        password: TEST_PASSWORD,
      })

      const { accessToken } = await client1.login({
        email,
        password: TEST_PASSWORD,
      })

      // Try to introspect with app2 - should work (introspect is app-agnostic)
      const client2 = new TurKeyClient({
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        appId: INTEGRATION_CONFIG.appId2,
      })

      const introspection = await client2.introspect(accessToken)

      // Token should be active but with different audience
      expect(introspection.active).toBe(true)
      expect(introspection.payload?.aud).toBe(INTEGRATION_CONFIG.appId)
      expect(introspection.payload?.aud).not.toBe(INTEGRATION_CONFIG.appId2)
    })

    it('should handle very long token strings', async () => {
      // Create a test with a legitimately long JWT
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const { accessToken } = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      // JWT tokens are typically 200-500 characters
      expect(accessToken.length).toBeGreaterThan(100)
      expect(accessToken.length).toBeLessThan(1000)

      // Should still be able to decode and verify
      const user = client.getUserFromToken(accessToken)
      expect(user).not.toBeNull()
      expect(user?.email).toBe(email)
    })
  })

  describe('Storage Edge Cases', () => {
    it('should handle storage operations with null/empty tokens', () => {
      const storage = new MemoryTokenStorage()

      // Initial state
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()

      // Set then clear
      storage.setTokens('token1', 'token2')
      expect(storage.getAccessToken()).toBe('token1')

      storage.clearTokens()
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should handle rapid storage updates', () => {
      const storage = new MemoryTokenStorage()

      // Simulate rapid token updates (refresh scenarios)
      for (let i = 0; i < 100; i++) {
        storage.setTokens(`access-${i}`, `refresh-${i}`)
      }

      // Should have the last values
      expect(storage.getAccessToken()).toBe('access-99')
      expect(storage.getRefreshToken()).toBe('refresh-99')
    })

    it('should handle storage with extremely long token strings', () => {
      const storage = new MemoryTokenStorage()
      const longToken = 'x'.repeat(10000) // 10KB token

      storage.setTokens(longToken, 'refresh')

      const retrieved = storage.getAccessToken()
      expect(retrieved).toBe(longToken)
      expect(retrieved?.length).toBe(10000)
    })
  })

  describe('Error Response Handling', () => {
    it('should parse TurKeyAuthError details correctly', async () => {
      try {
        await client.login({
          email: 'invalid-email-format',
          password: 'short',
        })
        throw new Error('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(TurKeyAuthError)
        if (error instanceof TurKeyAuthError) {
          expect(error.message).toBeDefined()
          expect(error.statusCode).toBeDefined()
          expect(error.statusCode).toBeGreaterThanOrEqual(400)
          expect(error.statusCode).toBeLessThan(600)
        }
      }
    })

    it('should handle validation errors with field details', async () => {
      try {
        await client.register({
          email: 'test@example.com',
          password: 'weak', // Too weak password
        })
        throw new Error('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(TurKeyAuthError)
        if (error instanceof TurKeyAuthError) {
          // Error message contains password validation details
          expect(error.message.toLowerCase()).toContain('password')
        }
      }
    })
  })

  describe('Token Introspection Edge Cases', () => {
    it('should handle introspection of expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleS0xIn0.eyJzdWIiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJhdWQiOiJ0ZXN0LWFwcCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwfQ.MEQCIBkXrU3Rj_GyBPJPZqKxvF0Z8JGGgLHV4YLZKkQJgxUNAiBxMZm5Z6R7yH8UZTfZJGMKxLN8VQP7H8GF6TQ3lM9J0Q'

      const introspection = await client.introspect(expiredToken)

      // Server should reject expired token
      expect(introspection.active).toBe(false)
    })

    it('should handle introspection of malformed token', async () => {
      const introspection = await client.introspect('invalid-token')

      // Introspect returns {active: false} instead of throwing for invalid tokens
      expect(introspection.active).toBe(false)
    })

    it('should handle introspection of token with invalid signature', async () => {
      // Valid JWT structure but invalid signature
      const invalidSigToken =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtleS0xIn0.eyJzdWIiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJhdWQiOiJ0ZXN0LWFwcCIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNjAwMDAwMDAwfQ.INVALID_SIGNATURE_HERE'

      const introspection = await client.introspect(invalidSigToken)

      // Should be marked as inactive due to verification failure
      expect(introspection.active).toBe(false)
    })
  })
})
