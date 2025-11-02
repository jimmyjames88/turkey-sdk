import {
  createTurkeyMiddleware,
  turkeyAuth,
  requireAuth,
  optionalAuth,
} from '../core'
import { verifyJwt } from '../../server/verify'

// Mock verifyJwt
jest.mock('../../server/verify', () => ({
  verifyJwt: jest.fn(),
}))

const mockVerifyJwt = verifyJwt as jest.MockedFunction<typeof verifyJwt>

// Mock environment variables
const originalEnv = process.env

describe('TurKey Middleware', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TURKEY_BASE_URL: 'https://auth.test.com',
      TURKEY_APP_ID: 'test-app',
      NODE_ENV: 'test',
    }
    mockVerifyJwt.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('createTurkeyMiddleware', () => {
    it('should require TURKEY_BASE_URL environment variable', () => {
      delete process.env.TURKEY_BASE_URL

      expect(() => createTurkeyMiddleware()).toThrow(
        'TURKEY_BASE_URL environment variable is required'
      )
    })

    it('should create middleware with environment configuration', () => {
      const middleware = createTurkeyMiddleware()
      expect(middleware).toBeInstanceOf(Function)
    })

    it('should authenticate valid token', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }

      mockVerifyJwt.mockResolvedValueOnce(mockPayload as any)

      const middleware = createTurkeyMiddleware()
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      }
      const res = {}
      const next = jest.fn()

      await middleware(req, res, next)

      expect(mockVerifyJwt).toHaveBeenCalledWith('valid-token', {
        baseUrl: 'https://auth.test.com',
        appId: 'test-app',
      })

      expect(req).toHaveProperty('user')
      expect(req).toHaveProperty('turkey')
      expect(req).toHaveProperty('token', 'valid-token')
      expect(next).toHaveBeenCalled()
    })

    it('should handle missing token with requireAuth=true', async () => {
      const middleware = createTurkeyMiddleware({ requireAuth: true })
      const req = { headers: {} }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
      const next = jest.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_TOKEN',
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow missing token with requireAuth=false', async () => {
      const middleware = createTurkeyMiddleware({ requireAuth: false })
      const req = { headers: {} }
      const res = {}
      const next = jest.fn()

      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(req).not.toHaveProperty('user')
    })

    it('should extract token from cookies', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'user',
        aud: 'test-app',
        iss: 'https://auth.test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }

      mockVerifyJwt.mockResolvedValueOnce(mockPayload as any)

      const middleware = createTurkeyMiddleware()
      const req = {
        headers: {},
        cookies: {
          turkey_access_token: 'cookie-token',
        },
      }
      const res = {}
      const next = jest.fn()

      await middleware(req, res, next)

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'cookie-token',
        expect.any(Object)
      )
      expect(next).toHaveBeenCalled()
    })
  })

  describe('convenience functions', () => {
    it('should create turkeyAuth middleware', () => {
      const middleware = turkeyAuth()
      expect(middleware).toBeInstanceOf(Function)
    })

    it('should create requireAuth middleware', () => {
      const middleware = requireAuth()
      expect(middleware).toBeInstanceOf(Function)
    })

    it('should create optionalAuth middleware', () => {
      const middleware = optionalAuth()
      expect(middleware).toBeInstanceOf(Function)
    })
  })
})
