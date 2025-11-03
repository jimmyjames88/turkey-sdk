import { introspectToken, revokeToken } from '../introspect'
import { TurKeyClient } from '../../client'

// Mock TurKeyClient
jest.mock('../../client', () => ({
  TurKeyClient: jest.fn().mockImplementation(() => ({
    introspect: jest.fn(),
    revoke: jest.fn(),
  })),
}))

describe('Token Introspection and Revocation', () => {
  const mockConfig = {
    baseUrl: 'https://auth.test.com',
    appId: 'test-app',
    serviceApiKey: 'test-service-key',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('introspectToken', () => {
    it('should introspect token successfully', async () => {
      const mockIntrospectResult = {
        active: true,
        type: 'access' as const,
        payload: {
          sub: 'user-123',
          email: 'test@example.com',
          role: 'user',
          aud: 'test-app',
          iss: 'https://auth.test.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }

      const mockClient = {
        introspect: jest.fn().mockResolvedValue(mockIntrospectResult),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      const result = await introspectToken('access-token', mockConfig)

      expect(TurKeyClient).toHaveBeenCalledWith(mockConfig)
      expect(mockClient.introspect).toHaveBeenCalledWith('access-token')
      expect(result).toEqual(mockIntrospectResult)
      expect(result.active).toBe(true)
      expect(result.userId).toBe('user-123')
    })

    it('should handle inactive tokens', async () => {
      const mockIntrospectResult = {
        active: false,
      }

      const mockClient = {
        introspect: jest.fn().mockResolvedValue(mockIntrospectResult),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      const result = await introspectToken('inactive-token', mockConfig)

      expect(result.active).toBe(false)
      expect(result.payload).toBeUndefined()
      expect(result.userId).toBeUndefined()
    })

    it('should handle introspection errors', async () => {
      const mockClient = {
        introspect: jest
          .fn()
          .mockRejectedValue(new Error('Introspection failed')),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      await expect(introspectToken('token', mockConfig)).rejects.toThrow(
        'Introspection failed'
      )
    })

    it('should work without service API key (if server allows)', async () => {
      const configWithoutKey = {
        baseUrl: 'https://auth.test.com',
        appId: 'test-app',
      }

      const mockClient = {
        introspect: jest.fn().mockResolvedValue({ active: true }),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      await introspectToken('token', configWithoutKey)

      expect(TurKeyClient).toHaveBeenCalledWith(configWithoutKey)
    })
  })

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      const mockRevokeResult = {
        message: 'Token revoked successfully',
      }

      const mockClient = {
        revoke: jest.fn().mockResolvedValue(mockRevokeResult),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      const result = await revokeToken('access-token', mockConfig)

      expect(TurKeyClient).toHaveBeenCalledWith(mockConfig)
      expect(mockClient.revoke).toHaveBeenCalledWith('access-token')
      expect(result).toEqual(mockRevokeResult)
    })

    it('should handle revocation errors', async () => {
      const mockClient = {
        revoke: jest.fn().mockRejectedValue(new Error('Token not found')),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      await expect(revokeToken('invalid-token', mockConfig)).rejects.toThrow(
        'Token not found'
      )
    })

    it('should handle already revoked tokens gracefully', async () => {
      const mockClient = {
        revoke: jest.fn().mockRejectedValue(new Error('Token already revoked')),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      await expect(revokeToken('revoked-token', mockConfig)).rejects.toThrow(
        'Token already revoked'
      )
    })

    it('should require proper authentication', async () => {
      const mockClient = {
        revoke: jest.fn().mockRejectedValue(new Error('Unauthorized')),
      }
      ;(
        TurKeyClient as jest.MockedClass<typeof TurKeyClient>
      ).mockImplementation(() => mockClient as any)

      await expect(
        revokeToken('token', {
          baseUrl: 'https://auth.test.com',
          appId: 'test-app',
        })
      ).rejects.toThrow('Unauthorized')
    })
  })
})
