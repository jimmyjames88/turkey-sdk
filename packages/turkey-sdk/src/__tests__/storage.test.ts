import {
  TokenStorage,
  MemoryTokenStorage,
  LocalStorageTokenStorage,
  CookieTokenStorage,
} from '../storage'

describe('Storage Implementations', () => {
  describe('MemoryTokenStorage', () => {
    let storage: MemoryTokenStorage

    beforeEach(() => {
      storage = new MemoryTokenStorage()
    })

    it('should store and retrieve access token', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getAccessToken()).toBe('access-token')
    })

    it('should store and retrieve refresh token', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getRefreshToken()).toBe('refresh-token')
    })

    it('should clear tokens', () => {
      storage.setTokens('access-token', 'refresh-token')
      storage.clearTokens()
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should return null for non-existent tokens', () => {
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should overwrite existing tokens', () => {
      storage.setTokens('old-access', 'old-refresh')
      storage.setTokens('new-access', 'new-refresh')
      expect(storage.getAccessToken()).toBe('new-access')
      expect(storage.getRefreshToken()).toBe('new-refresh')
    })

    it('should be isolated between instances', () => {
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
      // Mock localStorage
      const localStorageMock = (() => {
        let store: Record<string, string> = {}
        return {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, value: string) => {
            store[key] = value
          },
          removeItem: (key: string) => {
            delete store[key]
          },
          clear: () => {
            store = {}
          },
        }
      })()

      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      })

      storage = new LocalStorageTokenStorage()
    })

    afterEach(() => {
      window.localStorage.clear()
    })

    it('should store and retrieve access token from localStorage', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getAccessToken()).toBe('access-token')
      expect(window.localStorage.getItem('turkey_access_token')).toBe(
        'access-token'
      )
    })

    it('should store and retrieve refresh token from localStorage', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getRefreshToken()).toBe('refresh-token')
      expect(window.localStorage.getItem('turkey_refresh_token')).toBe(
        'refresh-token'
      )
    })

    it('should clear tokens from localStorage', () => {
      storage.setTokens('access-token', 'refresh-token')
      storage.clearTokens()
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
      expect(window.localStorage.getItem('turkey_access_token')).toBeNull()
      expect(window.localStorage.getItem('turkey_refresh_token')).toBeNull()
    })

    it('should use default key prefix', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(window.localStorage.getItem('turkey_access_token')).toBe(
        'access-token'
      )
      expect(window.localStorage.getItem('turkey_refresh_token')).toBe(
        'refresh-token'
      )
    })

    it('should persist tokens across instance recreation', () => {
      storage.setTokens('access-token', 'refresh-token')

      // Create new instance with same prefix
      const newStorage = new LocalStorageTokenStorage()
      expect(newStorage.getAccessToken()).toBe('access-token')
      expect(newStorage.getRefreshToken()).toBe('refresh-token')
    })
  })

  describe('CookieTokenStorage', () => {
    let storage: CookieTokenStorage

    beforeEach(() => {
      // Mock document.cookie
      let cookieStore = ''
      Object.defineProperty(document, 'cookie', {
        get: () => cookieStore,
        set: (value: string) => {
          const [cookie] = value.split(';')
          const [name, val] = cookie.split('=')

          // Check if we're deleting (max-age=0)
          if (
            value.includes('max-age=0') ||
            value.includes('expires=Thu, 01 Jan 1970')
          ) {
            // Remove cookie
            const cookies = cookieStore
              .split('; ')
              .filter((c) => !c.startsWith(name + '='))
            cookieStore = cookies.join('; ')
          } else {
            // Add or update cookie
            const existingCookies = cookieStore ? cookieStore.split('; ') : []
            const updatedCookies = existingCookies.filter(
              (c) => !c.startsWith(name + '=')
            )
            updatedCookies.push(`${name}=${val}`)
            cookieStore = updatedCookies.join('; ')
          }
        },
        configurable: true,
      })

      storage = new CookieTokenStorage()
    })

    afterEach(() => {
      // Clear all cookies
      document.cookie = 'turkey_access_token=; max-age=0'
      document.cookie = 'turkey_refresh_token=; max-age=0'
    })

    it('should store and retrieve access token from cookies', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getAccessToken()).toBe('access-token')
    })

    it('should store and retrieve refresh token from cookies', () => {
      storage.setTokens('access-token', 'refresh-token')
      expect(storage.getRefreshToken()).toBe('refresh-token')
    })

    it('should clear tokens from cookies', () => {
      storage.setTokens('access-token', 'refresh-token')
      storage.clearTokens()
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })

    it('should handle custom cookie options', () => {
      const customStorage = new CookieTokenStorage({
        path: '/app',
        domain: '.example.com',
        secure: true,
        sameSite: 'strict',
      })

      customStorage.setTokens('access-token', 'refresh-token')
      expect(customStorage.getAccessToken()).toBe('access-token')
    })

    it('should return null for non-existent cookies', () => {
      expect(storage.getAccessToken()).toBeNull()
      expect(storage.getRefreshToken()).toBeNull()
    })
  })

  describe('TokenStorage Interface Compliance', () => {
    const implementations: Array<{
      name: string
      factory: () => TokenStorage
    }> = [
      { name: 'MemoryTokenStorage', factory: () => new MemoryTokenStorage() },
      {
        name: 'LocalStorageTokenStorage',
        factory: () => new LocalStorageTokenStorage(),
      },
      { name: 'CookieTokenStorage', factory: () => new CookieTokenStorage() },
    ]

    implementations.forEach(({ name, factory }) => {
      describe(`${name} Interface Compliance`, () => {
        let storage: TokenStorage

        beforeEach(() => {
          storage = factory()
        })

        it('should implement TokenStorage interface', () => {
          expect(typeof storage.getAccessToken).toBe('function')
          expect(typeof storage.getRefreshToken).toBe('function')
          expect(typeof storage.setTokens).toBe('function')
          expect(typeof storage.clearTokens).toBe('function')
        })

        it('should handle null tokens gracefully', () => {
          expect(() => storage.getAccessToken()).not.toThrow()
          expect(() => storage.getRefreshToken()).not.toThrow()
          expect(() => storage.clearTokens()).not.toThrow()
        })

        it('should handle empty string tokens', () => {
          storage.setTokens('', '')
          const accessToken = storage.getAccessToken()
          const refreshToken = storage.getRefreshToken()
          // Empty strings should be stored (though not recommended in practice)
          expect(accessToken).toBe('')
          expect(refreshToken).toBe('')
        })
      })
    })
  })
})
