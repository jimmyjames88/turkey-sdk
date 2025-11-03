import { verifyJwt } from '../verify'
import { TokenManager } from '../../token-manager'

// Mock TokenManager
jest.mock('../../token-manager', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    verifyToken: jest.fn(),
  })),
}))

describe('verifyJwt', () => {
  const mockConfig = {
    baseUrl: 'https://auth.test.com',
    appId: 'test-app',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should verify JWT using TokenManager', async () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'user',
      aud: 'test-app',
      iss: 'https://auth.test.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }

    const mockTokenManager = {
      verifyToken: jest.fn().mockResolvedValue(mockPayload),
    }
    ;(TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager as any
    )

    const result = await verifyJwt('valid-token', mockConfig)

    expect(TokenManager).toHaveBeenCalledWith(mockConfig)
    expect(mockTokenManager.verifyToken).toHaveBeenCalledWith(
      'valid-token',
      undefined
    )
    expect(result).toEqual(mockPayload)
  })

  it('should verify JWT with expected appId', async () => {
    const mockPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'user',
      aud: 'specific-app',
      iss: 'https://auth.test.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }

    const mockTokenManager = {
      verifyToken: jest.fn().mockResolvedValue(mockPayload),
    }
    ;(TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager as any
    )

    const result = await verifyJwt('valid-token', mockConfig, 'specific-app')

    expect(mockTokenManager.verifyToken).toHaveBeenCalledWith(
      'valid-token',
      'specific-app'
    )
    expect(result).toEqual(mockPayload)
  })

  it('should throw error for invalid token', async () => {
    const mockTokenManager = {
      verifyToken: jest
        .fn()
        .mockRejectedValue(new Error('Token verification failed')),
    }
    ;(TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager as any
    )

    await expect(verifyJwt('invalid-token', mockConfig)).rejects.toThrow(
      'Token verification failed'
    )
  })

  it('should handle expired tokens', async () => {
    const mockTokenManager = {
      verifyToken: jest.fn().mockRejectedValue(new Error('Token expired')),
    }
    ;(TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager as any
    )

    await expect(verifyJwt('expired-token', mockConfig)).rejects.toThrow(
      'Token expired'
    )
  })

  it('should work with different baseUrl', async () => {
    const customConfig = {
      baseUrl: 'https://custom-auth.example.com',
      appId: 'custom-app',
    }

    const mockPayload = {
      sub: 'user-456',
      email: 'user@custom.com',
      role: 'admin',
      aud: 'custom-app',
      iss: 'https://custom-auth.example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }

    const mockTokenManager = {
      verifyToken: jest.fn().mockResolvedValue(mockPayload),
    }
    ;(TokenManager as jest.MockedClass<typeof TokenManager>).mockImplementation(
      () => mockTokenManager as any
    )

    const result = await verifyJwt('token', customConfig)

    expect(TokenManager).toHaveBeenCalledWith(customConfig)
    expect(result).toEqual(mockPayload)
  })
})
