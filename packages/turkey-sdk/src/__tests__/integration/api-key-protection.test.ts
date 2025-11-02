import { TurKeyClient } from '../../client'
import { checkRevocation, getRevocationInfo } from '../../server/revocation'
import { INTEGRATION_CONFIG, generateTestEmail, TEST_PASSWORD } from './setup'

describe('API Key Protection', () => {
  describe('Introspection Endpoint', () => {
    it('should work without API key when not configured (backward compatibility)', async () => {
      const client = new TurKeyClient(INTEGRATION_CONFIG)

      // Register and login to get a valid token
      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      // Introspect without API key should work if server doesn't require it
      const introspection = await client.introspect(loginResponse.accessToken)
      expect(introspection).toBeDefined()
      expect(introspection.active).toBe(true)
    })

    it('should fail with invalid API key if server requires it', async () => {
      // This test assumes TURKEY_SERVICE_API_KEY is set on the server
      // Skip if not configured
      if (!process.env.TURKEY_SERVICE_API_KEY) {
        console.log(
          '⚠️  Skipping API key validation test - TURKEY_SERVICE_API_KEY not set'
        )
        return
      }

      const client = new TurKeyClient({
        ...INTEGRATION_CONFIG,
        serviceApiKey: 'invalid-key',
      })

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      // Should fail with 403 when using invalid API key
      await expect(
        client.introspect(loginResponse.accessToken)
      ).rejects.toThrow(/403|forbidden|unauthorized/i)
    })

    it('should succeed with valid API key', async () => {
      if (!process.env.TURKEY_SERVICE_API_KEY) {
        console.log(
          '⚠️  Skipping API key validation test - TURKEY_SERVICE_API_KEY not set'
        )
        return
      }

      const client = new TurKeyClient({
        ...INTEGRATION_CONFIG,
        serviceApiKey: process.env.TURKEY_SERVICE_API_KEY,
      })

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      const introspection = await client.introspect(loginResponse.accessToken)
      expect(introspection).toBeDefined()
      expect(introspection.active).toBe(true)
      expect(introspection.userId).toBeDefined()
    })
  })

  describe('Revocation Check Endpoint', () => {
    it('should work without API key when not configured (backward compatibility)', async () => {
      const client = new TurKeyClient(INTEGRATION_CONFIG)

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      // Check revocation without API key
      const decoded = client.decodeToken(loginResponse.accessToken)
      const isRevoked = await checkRevocation(decoded.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
      })

      expect(isRevoked).toBe(false)
    })

    it('should fail with invalid API key if server requires it', async () => {
      if (!process.env.TURKEY_SERVICE_API_KEY) {
        console.log(
          '⚠️  Skipping API key validation test - TURKEY_SERVICE_API_KEY not set'
        )
        return
      }

      const client = new TurKeyClient(INTEGRATION_CONFIG)

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      // Should fail with 403 when using invalid API key
      const decoded = client.decodeToken(loginResponse.accessToken)
      await expect(
        checkRevocation(decoded.jti, {
          baseUrl: INTEGRATION_CONFIG.baseUrl,
          serviceApiKey: 'invalid-key',
        })
      ).rejects.toThrow(/403|forbidden|unauthorized/i)
    })

    it('should succeed with valid API key', async () => {
      if (!process.env.TURKEY_SERVICE_API_KEY) {
        console.log(
          '⚠️  Skipping API key validation test - TURKEY_SERVICE_API_KEY not set'
        )
        return
      }

      const client = new TurKeyClient(INTEGRATION_CONFIG)

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      const decoded = client.decodeToken(loginResponse.accessToken)
      const isRevoked = await checkRevocation(decoded.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        serviceApiKey: process.env.TURKEY_SERVICE_API_KEY,
      })

      expect(isRevoked).toBe(false)
    })

    it('should get revocation info with valid API key', async () => {
      if (!process.env.TURKEY_SERVICE_API_KEY) {
        console.log(
          '⚠️  Skipping API key validation test - TURKEY_SERVICE_API_KEY not set'
        )
        return
      }

      const client = new TurKeyClient(INTEGRATION_CONFIG)

      const email = generateTestEmail()
      await client.register({
        email,
        password: TEST_PASSWORD,
      })

      const loginResponse = await client.login({
        email,
        password: TEST_PASSWORD,
      })

      const decoded = client.decodeToken(loginResponse.accessToken)
      const info = await getRevocationInfo(decoded.jti, {
        baseUrl: INTEGRATION_CONFIG.baseUrl,
        serviceApiKey: process.env.TURKEY_SERVICE_API_KEY,
      })

      expect(info).toBeDefined()
      expect(info?.revoked).toBe(false)
    })
  })
})
