/**
 * Storage Implementation Integration Tests
 *
 * Tests all storage implementations (Memory, LocalStorage, Cookie)
 * in isolation to verify get/set/remove operations work correctly.
 */

import {
  MemoryTokenStorage,
  LocalStorageTokenStorage,
  CookieTokenStorage,
} from '../../storage'

describe('Storage Implementations', () => {
  const mockAccessToken =
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.signature'
  const mockRefreshToken = 'refresh_token_mock_value_12345'

  describe('MemoryTokenStorage', () => {
    let storage: MemoryTokenStorage

    beforeEach(() => {
      storage = new MemoryTokenStorage()
    })

    it('should initially return null for both tokens', () => {
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should store and retrieve access token', () => {
      storage.setTokens(mockAccessToken, mockRefreshToken)

      expect(storage.getAccessToken()).toBe(mockAccessToken)
    })

    it('should store and retrieve refresh token', () => {
      storage.setTokens(mockAccessToken, mockRefreshToken)

      expect(storage.getRefreshToken()).toBe(mockRefreshToken)
    })

    it('should update tokens when set multiple times', () => {
      storage.setTokens(mockAccessToken, mockRefreshToken)

      const newAccessToken = 'new_access_token'
      const newRefreshToken = 'new_refresh_token'
      storage.setTokens(newAccessToken, newRefreshToken)

      expect(storage.getAccessToken()).toBe(newAccessToken)
      expect(storage.getRefreshToken()).toBe(newRefreshToken)
    })

    it('should clear both tokens', () => {
      storage.setTokens(mockAccessToken, mockRefreshToken)
      storage.clearTokens()

      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should handle multiple instances independently', () => {
      const storage1 = new MemoryTokenStorage()
      const storage2 = new MemoryTokenStorage()

      storage1.setTokens('token1', 'refresh1')
      storage2.setTokens('token2', 'refresh2')

      expect(storage1.getAccessToken()).toBe('token1')
      expect(storage2.getAccessToken()).toBe('token2')
    })
  })

  describe('LocalStorageTokenStorage', () => {
    let storage: LocalStorageTokenStorage

    beforeEach(() => {
      storage = new LocalStorageTokenStorage()
      // Clean up localStorage before each test
      if (typeof window !== 'undefined') {
        localStorage.clear()
      }
    })

    afterEach(() => {
      if (typeof window !== 'undefined') {
        localStorage.clear()
      }
    })

    it('should return null when window is undefined (SSR)', () => {
      // In Node.js test environment, window is undefined
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should handle setTokens gracefully when window is undefined', () => {
      // Should not throw
      expect(() => {
        storage.setTokens(mockAccessToken, mockRefreshToken)
      }).not.toThrow()
    })

    it('should handle clearTokens gracefully when window is undefined', () => {
      // Should not throw
      expect(() => {
        storage.clearTokens()
      }).not.toThrow()
    })

    // Note: We can't test actual localStorage behavior in Node.js environment
    // These tests verify SSR-safety. Browser-specific tests would need jsdom
    // or browser environment, which we skip for integration tests.
  })

  describe('CookieTokenStorage', () => {
    let storage: CookieTokenStorage

    beforeEach(() => {
      storage = new CookieTokenStorage()
    })

    it('should create instance with default options', () => {
      expect(storage).toBeInstanceOf(CookieTokenStorage)
    })

    it('should create instance with custom options', () => {
      const customStorage = new CookieTokenStorage({
        secure: false,
        sameSite: 'lax',
        domain: 'example.com',
        path: '/app',
      })

      expect(customStorage).toBeInstanceOf(CookieTokenStorage)
    })

    it('should not throw when setting tokens in Node environment', () => {
      // js-cookie gracefully handles non-browser environments
      expect(() => {
        storage.setTokens(mockAccessToken, mockRefreshToken)
      }).not.toThrow()
    })

    it('should not throw when getting tokens in Node environment', () => {
      expect(() => {
        storage.getAccessToken()
        storage.getRefreshToken()
      }).not.toThrow()
    })

    it('should not throw when clearing tokens in Node environment', () => {
      expect(() => {
        storage.clearTokens()
      }).not.toThrow()
    })

    // Note: Cookie operations in Node.js don't work the same as browser
    // These tests verify the storage doesn't crash in Node environment
    // Actual cookie behavior is tested in browser/E2E tests
  })

  describe('Storage Interface Compliance', () => {
    const storageImplementations = [
      { name: 'MemoryTokenStorage', instance: new MemoryTokenStorage() },
      {
        name: 'LocalStorageTokenStorage',
        instance: new LocalStorageTokenStorage(),
      },
      { name: 'CookieTokenStorage', instance: new CookieTokenStorage() },
    ]

    storageImplementations.forEach(({ name, instance }) => {
      describe(name, () => {
        it('should implement getAccessToken method', () => {
          expect(typeof instance.getAccessToken).toBe('function')
          expect(instance.getAccessToken()).toBeDefined()
        })

        it('should implement getRefreshToken method', () => {
          expect(typeof instance.getRefreshToken).toBe('function')
          expect(instance.getRefreshToken()).toBeDefined()
        })

        it('should implement setTokens method', () => {
          expect(typeof instance.setTokens).toBe('function')
        })

        it('should implement clearTokens method', () => {
          expect(typeof instance.clearTokens).toBe('function')
        })
      })
    })
  })

  describe('MemoryTokenStorage - Real-world Usage', () => {
    it('should work in authentication flow', () => {
      const storage = new MemoryTokenStorage()

      // Initial state - no tokens
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()

      // Login - store tokens
      storage.setTokens(mockAccessToken, mockRefreshToken)
      expect(storage.getAccessToken()).toBe(mockAccessToken)
      expect(storage.getRefreshToken()).toBe(mockRefreshToken)

      // Token refresh - update tokens
      const newAccessToken = 'new_access_token_after_refresh'
      const newRefreshToken = 'new_refresh_token_after_refresh'
      storage.setTokens(newAccessToken, newRefreshToken)
      expect(storage.getAccessToken()).toBe(newAccessToken)
      expect(storage.getRefreshToken()).toBe(newRefreshToken)

      // Logout - clear tokens
      storage.clearTokens()
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should handle rapid token updates', () => {
      const storage = new MemoryTokenStorage()

      // Simulate rapid token refreshes
      for (let i = 0; i < 100; i++) {
        storage.setTokens(`access_${i}`, `refresh_${i}`)
      }

      // Should have the last values
      expect(storage.getAccessToken()).toBe('access_99')
      expect(storage.getRefreshToken()).toBe('refresh_99')
    })

    it('should maintain token integrity', () => {
      const storage = new MemoryTokenStorage()

      const longToken = 'a'.repeat(1000) // Simulate long JWT
      storage.setTokens(longToken, mockRefreshToken)

      // Token should be stored completely
      expect(storage.getAccessToken()).toBe(longToken)
      expect(storage.getAccessToken()?.length).toBe(1000)
    })
  })
})
