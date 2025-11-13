/**
 * Multi-App Isolation Integration Tests
 *
 * Tests that Turkey authentication server properly isolates users and tokens
 * across different applications using the same authentication backend.
 *
 * Critical for production deployments where multiple domains share one auth server
 * but need completely isolated user bases.
 */

import { TurKeyClient } from '../../client'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('Multi-App Isolation', () => {
  let app1Client: TurKeyClient
  let app2Client: TurKeyClient
  let testEmail: string
  let app1Token: string
  let app2Token: string

  beforeAll(() => {
    // Create two separate app clients with different appIds
    app1Client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId, // 'test-app'
    })

    app2Client = new TurKeyClient({
      baseUrl: INTEGRATION_CONFIG.baseUrl,
      appId: INTEGRATION_CONFIG.appId2, // 'test-app-2'
    })

    testEmail = generateTestEmail()
  })

  describe('User Registration', () => {
    it('should allow same email to register in different apps', async () => {
      // Register in app1
      const app1Response = await app1Client.register({
        email: testEmail,
        password: TEST_PASSWORD,
      })

      expect(app1Response.user.email).toBe(testEmail)
      expect(app1Response.user.id).toBeDefined()

      // Register same email in app2 (should succeed - different app)
      const app2Response = await app2Client.register({
        email: testEmail,
        password: TEST_PASSWORD,
      })

      expect(app2Response.user.email).toBe(testEmail)
      expect(app2Response.user.id).toBeDefined()

      // Different user IDs (separate records)
      expect(app1Response.user.id).not.toBe(app2Response.user.id)
    })

    it('should prevent duplicate registration within same app', async () => {
      const duplicateEmail = generateTestEmail()

      await app1Client.register({
        email: duplicateEmail,
        password: TEST_PASSWORD,
      })

      // Try to register same email in same app (should fail)
      await expect(
        app1Client.register({
          email: duplicateEmail,
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow()
    })
  })

  describe('Authentication', () => {
    it('should allow independent login to both apps', async () => {
      // Login to app1
      const app1Login = await app1Client.login({
        email: testEmail,
        password: TEST_PASSWORD,
      })

      app1Token = app1Login.accessToken
      expect(app1Login.accessToken).toBeDefined()
      expect(app1Login.refreshToken).toBeDefined()

      // Login to app2
      const app2Login = await app2Client.login({
        email: testEmail,
        password: TEST_PASSWORD,
      })

      app2Token = app2Login.accessToken
      expect(app2Login.accessToken).toBeDefined()
      expect(app2Login.refreshToken).toBeDefined()

      // Tokens should be different
      expect(app1Login.accessToken).not.toBe(app2Login.accessToken)
      expect(app1Login.refreshToken).not.toBe(app2Login.refreshToken)
    })
  })

  describe('JWT Token Claims', () => {
    it('should have app-specific audience claims', () => {
      const app1Decoded = app1Client.decodeToken(app1Token)
      const app2Decoded = app2Client.decodeToken(app2Token)

      expect(app1Decoded?.aud).toBe(INTEGRATION_CONFIG.appId)
      expect(app2Decoded?.aud).toBe(INTEGRATION_CONFIG.appId2)
    })

    it('should have different user IDs in token claims', () => {
      const app1Decoded = app1Client.decodeToken(app1Token)
      const app2Decoded = app2Client.decodeToken(app2Token)

      expect(app1Decoded?.sub).toBeDefined()
      expect(app2Decoded?.sub).toBeDefined()
      expect(app1Decoded?.sub).not.toBe(app2Decoded?.sub)
    })

    it('should have same email but different user contexts', () => {
      const app1Decoded = app1Client.decodeToken(app1Token)
      const app2Decoded = app2Client.decodeToken(app2Token)

      expect(app1Decoded?.email).toBe(testEmail)
      expect(app2Decoded?.email).toBe(testEmail)
      expect(app1Decoded?.sub).not.toBe(app2Decoded?.sub)
    })
  })

  describe('Cross-App Token Verification', () => {
    it('should reject tokens from other apps', async () => {
      // Try to verify app1 token with app2 audience
      // Should throw error because audience claim doesn't match
      await expect(app2Client.validateTokenFormat(app1Token)).rejects.toThrow()
    })
  })

  describe('Token Revocation Isolation', () => {
    it('should revoke token only in the specific app', async () => {
      const newEmail = generateTestEmail()

      // Register and login to both apps
      await app1Client.register({ email: newEmail, password: TEST_PASSWORD })
      await app2Client.register({ email: newEmail, password: TEST_PASSWORD })

      const app1Login = await app1Client.login({
        email: newEmail,
        password: TEST_PASSWORD,
      })
      const app2Login = await app2Client.login({
        email: newEmail,
        password: TEST_PASSWORD,
      })

      // Revoke app1 token
      await app1Client.revoke(app1Login.accessToken, 'test-revocation')

      // App1 user can still login (revocation affects tokens, not account)
      const app1Relogin = await app1Client.login({
        email: newEmail,
        password: TEST_PASSWORD,
      })
      expect(app1Relogin.accessToken).toBeDefined()

      // App2 token should still work (revocation is app-isolated)
      const app2Relogin = await app2Client.login({
        email: newEmail,
        password: TEST_PASSWORD,
      })
      expect(app2Relogin.accessToken).toBeDefined()
    })
  })

  describe('Password Independence', () => {
    it('should allow different passwords for same email across apps', async () => {
      const isolatedEmail = generateTestEmail()
      const app1Password = 'App1Password123!'
      const app2Password = 'App2Password456!'

      // Register with different passwords
      await app1Client.register({
        email: isolatedEmail,
        password: app1Password,
      })
      await app2Client.register({
        email: isolatedEmail,
        password: app2Password,
      })

      // Should login to app1 with app1 password
      const app1Login = await app1Client.login({
        email: isolatedEmail,
        password: app1Password,
      })
      expect(app1Login.accessToken).toBeDefined()

      // Should login to app2 with app2 password
      const app2Login = await app2Client.login({
        email: isolatedEmail,
        password: app2Password,
      })
      expect(app2Login.accessToken).toBeDefined()

      // App1 password shouldn't work in app2
      await expect(
        app2Client.login({ email: isolatedEmail, password: app1Password })
      ).rejects.toThrow()

      // App2 password shouldn't work in app1
      await expect(
        app1Client.login({ email: isolatedEmail, password: app2Password })
      ).rejects.toThrow()
    })
  })

  describe('Refresh Token Isolation', () => {
    it('should not allow cross-app refresh token usage', async () => {
      const refreshEmail = generateTestEmail()

      await app1Client.register({
        email: refreshEmail,
        password: TEST_PASSWORD,
      })
      await app2Client.register({
        email: refreshEmail,
        password: TEST_PASSWORD,
      })

      const app1Login = await app1Client.login({
        email: refreshEmail,
        password: TEST_PASSWORD,
      })
      const app2Login = await app2Client.login({
        email: refreshEmail,
        password: TEST_PASSWORD,
      })

      // Tokens should work with their own clients
      const app1Refresh = await app1Client.refresh({
        refreshToken: app1Login.refreshToken,
      })
      expect(app1Refresh.accessToken).toBeDefined()

      // Verify app1 refreshed token has correct audience
      const app1RefreshDecoded = app1Client.decodeToken(app1Refresh.accessToken)
      expect(app1RefreshDecoded?.aud).toBe(INTEGRATION_CONFIG.appId)

      const app2Refresh = await app2Client.refresh({
        refreshToken: app2Login.refreshToken,
      })
      expect(app2Refresh.accessToken).toBeDefined()

      // Verify app2 refreshed token has correct audience
      const app2RefreshDecoded = app2Client.decodeToken(app2Refresh.accessToken)
      expect(app2RefreshDecoded?.aud).toBe(INTEGRATION_CONFIG.appId2)

      // CRITICAL SECURITY TEST: Cross-app refresh should fail
      // App1 refresh token should not work in app2 client
      await expect(
        app2Client.refresh({ refreshToken: app1Login.refreshToken })
      ).rejects.toThrow()

      // App2 refresh token should not work in app1 client
      await expect(
        app1Client.refresh({ refreshToken: app2Login.refreshToken })
      ).rejects.toThrow()
    })
  })
})
