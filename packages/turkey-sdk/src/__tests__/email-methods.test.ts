import { TurKeyClient } from '../client'

// Mock fetch globally
global.fetch = jest.fn()

describe('TurKeyClient - Email Methods', () => {
  let client: TurKeyClient
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    client = new TurKeyClient({
      baseUrl: 'https://auth.test.com',
      appId: 'test-app',
    })

    mockFetch.mockClear()
  })

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      const mockResponse = {
        message:
          'If an account exists with that email, a password reset link has been sent.',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as any)

      const result = await client.requestPasswordReset('test@example.com')

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.test.com/v1/auth/request-password-reset',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        })
      )
    })

    it('should handle request password reset errors', async () => {
      const mockError = {
        error: 'rate_limit_exceeded',
        message: 'Too many password reset requests',
        timestamp: '2023-01-01T00:00:00Z',
        path: '/v1/auth/request-password-reset',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(
        client.requestPasswordReset('test@example.com')
      ).rejects.toThrow('Too many password reset requests')
    })
  })

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockResponse = {
        message: 'Password has been reset successfully',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as any)

      const result = await client.resetPassword(
        'reset-token',
        'NewPassword123!'
      )

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.test.com/v1/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            token: 'reset-token',
            newPassword: 'NewPassword123!',
          }),
        })
      )
    })

    it('should handle invalid token', async () => {
      const mockError = {
        error: 'bad_request',
        message: 'Invalid or expired password reset token',
        timestamp: '2023-01-01T00:00:00Z',
        path: '/v1/auth/reset-password',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(
        client.resetPassword('invalid-token', 'NewPassword123!')
      ).rejects.toThrow('Invalid or expired password reset token')
    })

    it('should handle weak password', async () => {
      const mockError = {
        error: 'validation_error',
        message: 'Invalid request data',
        details: [
          {
            field: 'newPassword',
            message: 'Password must be at least 8 characters',
            code: 'too_small',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(client.resetPassword('reset-token', 'weak')).rejects.toThrow(
        'Invalid request data'
      )
    })
  })

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockResponse = {
        message: 'Email verified successfully',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as any)

      const result = await client.verifyEmail('verification-token')

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.test.com/v1/auth/verify-email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            token: 'verification-token',
          }),
        })
      )
    })

    it('should handle invalid verification token', async () => {
      const mockError = {
        error: 'bad_request',
        message: 'Invalid or expired email verification token',
        timestamp: '2023-01-01T00:00:00Z',
        path: '/v1/auth/verify-email',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(client.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid or expired email verification token'
      )
    })
  })

  describe('resendVerification', () => {
    it('should resend verification email successfully', async () => {
      const mockResponse = {
        message:
          'If your email is not verified, a new verification link has been sent.',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      } as any)

      const result = await client.resendVerification('test@example.com')

      expect(result).toEqual(mockResponse)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.test.com/v1/auth/resend-verification',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        })
      )
    })

    it('should handle rate limiting', async () => {
      const mockError = {
        error: 'rate_limit_exceeded',
        message: 'Too many verification requests',
        timestamp: '2023-01-01T00:00:00Z',
        path: '/v1/auth/resend-verification',
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValueOnce(mockError),
      } as any)

      await expect(
        client.resendVerification('test@example.com')
      ).rejects.toThrow('Too many verification requests')
    })
  })
})
