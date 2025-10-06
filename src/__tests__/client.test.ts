import { TurKeyClient } from '../client'
import { MemoryTokenStorage } from '../storage'

// Mock fetch globally
global.fetch = jest.fn()

describe('TurKeyClient', () => {
  let client: TurKeyClient
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    client = new TurKeyClient({
      baseUrl: 'https://auth.test.com',
      audience: 'test-app',
    })

    mockFetch.mockClear()
  })

  describe('login', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'user',
            tenantId: 'test-tenant',
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
          tokenType: 'Bearer',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as any)

      const result = await client.login({
        email: 'test@example.com',
        password: 'password',
        tenantId: 'test-tenant',
      })

      expect(result).toEqual(mockResponse.data)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.test.com/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password',
            tenantId: 'test-tenant',
            audience: 'test-app',
          }),
        })
      )
    })

    it('should handle login failure', async () => {
      const mockError = {
        error: 'invalid_credentials',
        message: 'Invalid email or password',
        timestamp: '2023-01-01T00:00:00Z',
        path: '/v1/auth/login',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(
        client.login({
          email: 'test@example.com',
          password: 'wrong-password',
          tenantId: 'test-tenant',
        })
      ).rejects.toThrow('Invalid email or password')
    })
  })

  describe('token management', () => {
    const mockToken =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6InRlc3Qta2V5In0.eyJpc3MiOiJodHRwczovL3R1cmtleS5leGFtcGxlLmNvbSIsImF1ZCI6InRlc3QtYXBwIiwic3ViIjoidXNlci0xMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ0ZW5hbnRJZCI6InRlc3QtdGVuYW50Iiwicm9sZSI6InVzZXIiLCJzY29wZSI6IiIsImp0aSI6ImF0XzEyMyIsInRva2VuVmVyc2lvbiI6MSwidGVzdCI6dHJ1ZSwiaWF0IjoxNjcwMDAwMDAwLCJuYmYiOjE2NzAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.mock-signature'

    it('should decode token correctly', () => {
      const decoded = client.decodeToken(mockToken)

      expect(decoded.sub).toBe('user-123')
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.aud).toBe('test-app')
    })

    it('should extract user from token', () => {
      const user = client.getUserFromToken(mockToken)

      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        tenantId: 'test-tenant',
      })
    })

    it('should check token expiration', () => {
      const isExpired = client.isTokenExpired(mockToken)
      expect(isExpired).toBe(false) // Mock token has far future expiry
    })
  })
})

describe('MemoryTokenStorage', () => {
  let storage: MemoryTokenStorage

  beforeEach(() => {
    storage = new MemoryTokenStorage()
  })

  it('should store and retrieve tokens', () => {
    storage.setTokens('access-token', 'refresh-token')

    expect(storage.getAccessToken()).toBe('access-token')
    expect(storage.getRefreshToken()).toBe('refresh-token')
  })

  it('should clear tokens', () => {
    storage.setTokens('access-token', 'refresh-token')
    storage.clearTokens()

    expect(storage.getAccessToken()).toBeNull()
    expect(storage.getRefreshToken()).toBeNull()
  })

  it('should return null for empty storage', () => {
    expect(storage.getAccessToken()).toBeNull()
    expect(storage.getRefreshToken()).toBeNull()
  })
})
