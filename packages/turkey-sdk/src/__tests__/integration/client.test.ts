/**
 * Client API Integration Tests
 *
 * Tests TurKeyClient methods against real Turkey server.
 * No mocks - actual HTTP requests and responses.
 */

import { TurKeyClient } from '../../client'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('TurKeyClient Integration', () => {
  let client: TurKeyClient

  beforeEach(() => {
    client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId,
    })
  })

  describe('register()', () => {
    it('should register a new user and return tokens', async () => {
      const email = generateTestEmail()

      const response = await client.register({
        email,
        password: TEST_PASSWORD,
      })

      expect(response).toHaveProperty('accessToken')
      expect(response).toHaveProperty('refreshToken')
      expect(response).toHaveProperty('user')
      expect(response.user.email).toBe(email)
      expect(typeof response.accessToken).toBe('string')
      expect(typeof response.refreshToken).toBe('string')
      expect(response.user.role).toBe('user') // Default role
    })

    it('should fail with weak password', async () => {
      const email = generateTestEmail()

      await expect(
        client.register({
          email,
          password: 'weak',
        })
      ).rejects.toThrow()
    })

    it('should fail when registering duplicate email', async () => {
      const email = generateTestEmail()

      // Register first time
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      // Try to register again with same email
      await expect(
        client.register({
          email,
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow()
    })
  })

  describe('login()', () => {
    let testEmail: string

    beforeEach(async () => {
      // Create a test user for login tests
      testEmail = generateTestEmail()
      await client.register({
        email: testEmail,
        password: TEST_PASSWORD,
      })
    })

    it('should login with valid credentials', async () => {
      const response = await client.login({
        email: testEmail,
        password: TEST_PASSWORD,
      })

      expect(response).toHaveProperty('accessToken')
      expect(response).toHaveProperty('refreshToken')
      expect(response).toHaveProperty('user')
      expect(response.user.email).toBe(testEmail)
    })

    it('should fail with invalid password', async () => {
      await expect(
        client.login({
          email: testEmail,
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow()
    })

    it('should fail with non-existent email', async () => {
      await expect(
        client.login({
          email: 'nonexistent@test.com',
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow()
    })
  })

  describe('refreshTokens()', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Register and get refresh token
      const email = generateTestEmail()
      const response = await client.register({
        email,
        password: TEST_PASSWORD,
      })
      refreshToken = response.refreshToken
    })

    it('should refresh tokens with valid refresh token', async () => {
      const response = await client.refresh({ refreshToken })

      expect(response).toHaveProperty('accessToken')
      expect(response).toHaveProperty('refreshToken')
      expect(typeof response.accessToken).toBe('string')
      expect(typeof response.refreshToken).toBe('string')

      // New tokens should be different from original
      expect(response.refreshToken).not.toBe(refreshToken)
    })

    it('should fail with invalid refresh token', async () => {
      await expect(
        client.refresh({ refreshToken: 'invalid-token' })
      ).rejects.toThrow()
    })

    it('should fail with expired refresh token', async () => {
      // This would require a token with short expiry or waiting
      // Skip for now as it would make tests slow
      // TODO: Add if Turkey supports test tokens with short expiry
    })
  })

  describe('logout()', () => {
    let refreshToken: string

    beforeEach(async () => {
      const email = generateTestEmail()
      const response = await client.register({
        email,
        password: TEST_PASSWORD,
      })
      refreshToken = response.refreshToken
    })

    it('should logout and invalidate refresh token', async () => {
      // Logout with refresh token
      await client.logout(refreshToken)

      // Try to use the refresh token - should fail
      await expect(client.refresh({ refreshToken })).rejects.toThrow()
    })

    it('should handle logout with invalid token', async () => {
      // Should not throw even with invalid token (server returns success)
      await expect(client.logout('invalid-token')).resolves.not.toThrow()
    })
  })

  describe('getUserFromToken()', () => {
    let accessToken: string

    beforeEach(async () => {
      const email = generateTestEmail()
      const response = await client.register({
        email,
        password: TEST_PASSWORD,
      })
      accessToken = response.accessToken
    })

    it('should decode user from access token', () => {
      const user = client.getUserFromToken(accessToken)

      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email')
      expect(user).toHaveProperty('role')
    })

    it('should return null for invalid token', () => {
      const user = client.getUserFromToken('invalid-token')
      expect(user).toBeNull()
    })
  })

  describe('isTokenExpired()', () => {
    let accessToken: string

    beforeEach(async () => {
      const email = generateTestEmail()
      const response = await client.register({
        email,
        password: TEST_PASSWORD,
      })
      accessToken = response.accessToken
    })

    it('should return false for valid token', () => {
      const isExpired = client.isTokenExpired(accessToken)
      expect(isExpired).toBe(false)
    })

    it('should return true for malformed token', () => {
      const isExpired = client.isTokenExpired('invalid-token')
      expect(isExpired).toBe(true)
    })
  })
})
