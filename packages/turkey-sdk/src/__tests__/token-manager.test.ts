import { TokenManager } from '../token-manager'
import { jwtVerify, createRemoteJWKSet } from 'jose'

// Mock jose methods
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  createRemoteJWKSet: jest.fn(),
}))

const mockJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>
const mockCreateRemoteJWKSet = createRemoteJWKSet as jest.MockedFunction<
  typeof createRemoteJWKSet
>

describe('TokenManager', () => {
  const mockConfig = {
    baseUrl: 'https://auth.test.com',
    appId: 'test-app',
  }

  const validToken =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6InRlc3Qta2V5In0.eyJpc3MiOiJodHRwczovL2F1dGgudGVzdC5jb20iLCJhdWQiOiJ0ZXN0LWFwcCIsInN1YiI6InVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTY3MDAwMDAwMH0.mock-signature'

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateRemoteJWKSet.mockReturnValue(jest.fn() as any)
  })

  describe('constructor', () => {
    it('should create TokenManager with config', () => {
      const manager = new TokenManager(mockConfig)
      expect(manager).toBeInstanceOf(TokenManager)
    })
  })

  describe('validateTokenFormat', () => {
    it('should validate token format successfully', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: 9999999999,
        iat: 1670000000,
      }

      mockJwtVerify.mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: {},
      } as any)

      const manager = new TokenManager(mockConfig)
      const result = await manager.validateTokenFormat(validToken)

      expect(result).toEqual(mockPayload)
      expect(mockJwtVerify).toHaveBeenCalledWith(
        validToken,
        expect.any(Function),
        expect.objectContaining({
          issuer: mockConfig.baseUrl,
          audience: mockConfig.appId,
          algorithms: ['ES256'],
        })
      )
    })

    it('should validate token with custom appId', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'custom-app',
        iss: 'https://auth.test.com',
        exp: 9999999999,
        iat: 1670000000,
      }

      mockJwtVerify.mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: {},
      } as any)

      const manager = new TokenManager(mockConfig)
      const result = await manager.validateTokenFormat(validToken, 'custom-app')

      expect(result).toEqual(mockPayload)
      expect(mockJwtVerify).toHaveBeenCalledWith(
        validToken,
        expect.any(Function),
        expect.objectContaining({
          audience: 'custom-app',
        })
      )
    })

    it('should throw error for invalid token', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('Invalid signature'))

      const manager = new TokenManager(mockConfig)

      await expect(
        manager.validateTokenFormat('invalid-token')
      ).rejects.toThrow('Token format validation failed')
    })

    it('should throw error for expired token', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('Token expired'))

      const manager = new TokenManager(mockConfig)

      await expect(manager.validateTokenFormat(validToken)).rejects.toThrow(
        'Token format validation failed'
      )
    })

    it('should initialize JWKS only once', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: 9999999999,
        iat: 1670000000,
      }

      mockJwtVerify.mockResolvedValue({
        payload: mockPayload,
        protectedHeader: {},
      } as any)

      const manager = new TokenManager(mockConfig)

      // Call validateTokenFormat multiple times
      await manager.validateTokenFormat(validToken)
      await manager.validateTokenFormat(validToken)
      await manager.validateTokenFormat(validToken)

      // JWKS should only be created once
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledTimes(1)
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL('/.well-known/jwks.json', mockConfig.baseUrl)
      )
    })
  })

  describe('verifyToken (deprecated)', () => {
    it('should still work but is deprecated', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: 9999999999,
        iat: 1670000000,
      }

      mockJwtVerify.mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: {},
      } as any)

      const manager = new TokenManager(mockConfig)
      const result = await manager.verifyToken(validToken)

      expect(result).toEqual(mockPayload)
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      const token = validToken // Uses exp: 9999999999

      const manager = new TokenManager(mockConfig)
      const isExpired = manager.isTokenExpired(token)

      expect(isExpired).toBe(false)
    })

    it('should return true for expired token', () => {
      // Create token with expired timestamp
      const expiredToken =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJodHRwczovL2F1dGgudGVzdC5jb20iLCJhdWQiOiJ0ZXN0LWFwcCIsInN1YiI6InVzZXItMTIzIiwiZXhwIjoxfQ.sig'

      const manager = new TokenManager(mockConfig)
      const isExpired = manager.isTokenExpired(expiredToken)

      expect(isExpired).toBe(true)
    })

    it('should return true for invalid token format', () => {
      const manager = new TokenManager(mockConfig)
      const isExpired = manager.isTokenExpired('invalid-token')

      expect(isExpired).toBe(true)
    })
  })

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const manager = new TokenManager(mockConfig)
      const decoded = manager.decodeToken(validToken)

      expect(decoded.sub).toBe('user-123')
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.role).toBe('user')
      expect(decoded.aud).toBe('test-app')
      expect(decoded.iss).toBe('https://auth.test.com')
    })

    it('should throw error for malformed token', () => {
      const manager = new TokenManager(mockConfig)

      expect(() => manager.decodeToken('not.a.valid')).toThrow(
        'Token decode failed'
      )
    })

    it('should throw error for token with wrong number of parts', () => {
      const manager = new TokenManager(mockConfig)

      expect(() => manager.decodeToken('only-two.parts')).toThrow(
        'Invalid token format'
      )
    })

    it('should handle tokens with base64url encoding', () => {
      // Token with special characters that need base64url encoding
      const manager = new TokenManager(mockConfig)
      const decoded = manager.decodeToken(validToken)

      expect(decoded).toBeDefined()
      expect(decoded.sub).toBeDefined()
    })

    it('should decode token payload correctly', () => {
      const manager = new TokenManager(mockConfig)
      const decoded = manager.decodeToken(validToken)

      // Verify all expected fields are present
      expect(decoded).toHaveProperty('iss')
      expect(decoded).toHaveProperty('aud')
      expect(decoded).toHaveProperty('sub')
      expect(decoded).toHaveProperty('email')
      expect(decoded).toHaveProperty('role')
      expect(decoded).toHaveProperty('exp')
      expect(decoded).toHaveProperty('iat')
    })
  })

  describe('JWKS URL construction', () => {
    it('should construct correct JWKS URL', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: 9999999999,
        iat: 1670000000,
      }

      mockJwtVerify.mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: {},
      } as any)

      const manager = new TokenManager({
        baseUrl: 'https://custom-auth.example.com',
        appId: 'custom-app',
      })

      await manager.validateTokenFormat(validToken)

      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL('/.well-known/jwks.json', 'https://custom-auth.example.com')
      )
    })
  })
})
