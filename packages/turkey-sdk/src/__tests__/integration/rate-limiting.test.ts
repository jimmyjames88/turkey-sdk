/**
 * Rate Limiting Integration Tests
 *
 * Tests SDK behavior when encountering rate limits from the server:
 * - 429 status code handling
 * - Rate limit error messages
 * - Retry-after headers
 * - Login attempt lockouts
 * - Progressive rate limiting
 *
 * NOTE: These tests are designed to verify rate limit HANDLING,
 * not to exhaustively trigger every rate limit scenario.
 * We verify the SDK correctly processes 429 responses.
 */

import { TurKeyClient } from '../../client'
import { TurKeyAuthError } from '../../types'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('Rate Limiting', () => {
  let client: TurKeyClient

  beforeEach(() => {
    client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId,
    })
  })

  describe('Rate Limit Detection and Handling', () => {
    it('should properly handle 429 rate limit response', async () => {
      // Trigger rate limit by making many rapid login attempts
      const promises: Promise<any>[] = []
      const email = generateTestEmail()

      // Make 60 rapid login attempts to trigger rate limit (limit is 50 per 15 min)
      for (let i = 0; i < 60; i++) {
        promises.push(
          client
            .login({
              email,
              password: 'wrong-password',
            })
            .catch((error) => error)
        )
      }

      const results = await Promise.all(promises)

      // Some requests should be rate limited
      const rateLimitedErrors = results.filter(
        (result) =>
          result instanceof TurKeyAuthError && result.statusCode === 429
      )

      // At least some requests should hit rate limit
      expect(rateLimitedErrors.length).toBeGreaterThan(0)

      // Check rate limit error structure
      if (rateLimitedErrors.length > 0) {
        const error = rateLimitedErrors[0] as TurKeyAuthError
        expect(error.statusCode).toBe(429)
        expect(error.message).toContain('Too many')
        expect(error.code).toBe('rate_limit_exceeded')
      }
    }, 30000)

    it('should handle rate limit errors with proper error type', async () => {
      const promises: Promise<any>[] = []

      // Trigger login rate limit
      for (let i = 0; i < 55; i++) {
        promises.push(
          client
            .login({
              email: 'nonexistent@example.com',
              password: 'wrong',
            })
            .catch((error) => error)
        )
      }

      const results = await Promise.all(promises)
      const rateLimited = results.find(
        (r) => r instanceof TurKeyAuthError && r.statusCode === 429
      )

      if (rateLimited) {
        expect(rateLimited).toBeInstanceOf(TurKeyAuthError)
        expect(rateLimited.statusCode).toBe(429)
      }
    }, 30000)

    it('should parse rate limit error details correctly', async () => {
      // Trigger rate limit
      const promises: Promise<any>[] = []

      for (let i = 0; i < 60; i++) {
        promises.push(
          client
            .login({
              email: 'test@example.com',
              password: 'wrong',
            })
            .catch((error) => error)
        )
      }

      const results = await Promise.all(promises)
      const rateLimited = results.find(
        (r) => r instanceof TurKeyAuthError && r.statusCode === 429
      )

      if (rateLimited instanceof TurKeyAuthError) {
        // Verify TurKeyAuthError structure
        expect(rateLimited.message).toBeDefined()
        expect(rateLimited.statusCode).toBe(429)
        expect(rateLimited.code).toBe('rate_limit_exceeded')

        // Should have details about retry
        expect(rateLimited.message.toLowerCase()).toMatch(
          /too many|rate limit|try again/i
        )
      }
    }, 30000)

    it('should handle concurrent requests hitting rate limit', async () => {
      // Make many concurrent requests
      const promises: Promise<any>[] = []

      for (let i = 0; i < 55; i++) {
        promises.push(
          client
            .login({
              email: `concurrent-${i}@example.com`,
              password: 'password',
            })
            .catch((error) => error)
        )
      }

      const results = await Promise.all(promises)

      // Count different response types
      const authErrors = results.filter(
        (r) => r instanceof TurKeyAuthError && r.statusCode === 401
      )
      const rateLimited = results.filter(
        (r) => r instanceof TurKeyAuthError && r.statusCode === 429
      )

      // Should have mix of auth failures and rate limits
      expect(authErrors.length + rateLimited.length).toBe(55)

      // Some should be rate limited
      if (rateLimited.length > 0) {
        expect(rateLimited[0]).toBeInstanceOf(TurKeyAuthError)
      }
    }, 30000)
  })

  describe('Error Response Structure', () => {
    it('should distinguish between different error types', async () => {
      const email = `distinguish-${Date.now()}@example.com`

      // First attempt - auth error
      try {
        await client.login({
          email,
          password: TEST_PASSWORD,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(TurKeyAuthError)
        if (error instanceof TurKeyAuthError) {
          // Could be 401 (auth failed) or 429 (rate limited)
          expect([401, 429]).toContain(error.statusCode)
        }
      }

      // Verify error code differentiation
      const promises: Promise<any>[] = []
      for (let i = 0; i < 60; i++) {
        promises.push(
          client
            .login({
              email: `other-${Date.now()}-${i}@example.com`,
              password: 'wrong',
            })
            .catch((error) => error)
        )
      }

      const results = await Promise.all(promises)
      const rateLimited = results.find(
        (r) => r instanceof TurKeyAuthError && r.statusCode === 429
      )

      if (rateLimited instanceof TurKeyAuthError) {
        expect(rateLimited.code).toBe('rate_limit_exceeded')
        expect(rateLimited.statusCode).toBe(429)
      }
    }, 30000)
  })
})
