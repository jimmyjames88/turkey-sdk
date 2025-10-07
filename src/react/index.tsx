import {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  ReactNode,
} from 'react'
import { TurKeyClient } from '../client'
import { TokenStorage, CookieTokenStorage } from '../storage'
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from '../types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (params: Omit<LoginRequest, 'tenantId'>) => Promise<AuthResponse>
  register: (params: Omit<RegisterRequest, 'tenantId'>) => Promise<AuthResponse>
  logout: () => Promise<void>
  refreshTokens: () => Promise<void>
  client: TurKeyClient
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  client: TurKeyClient
  tenantId: string
  storage?: TokenStorage
  autoRefresh?: boolean
}

export function AuthProvider({
  children,
  client,
  tenantId,
  storage = new CookieTokenStorage(),
  autoRefresh = true,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔍 AuthProvider: Initializing auth state...')
      const accessToken = storage.getAccessToken()
      console.log(
        '🔍 AuthProvider: Retrieved access token:',
        accessToken ? 'Token found' : 'No token'
      )

      if (accessToken && !client.isTokenExpired(accessToken)) {
        try {
          console.log(
            '🔍 AuthProvider: Token is valid, extracting user info...'
          )
          const userInfo = client.getUserFromToken(accessToken)
          console.log('🔍 AuthProvider: User info extracted:', userInfo)
          setUser(userInfo)
        } catch (error) {
          console.warn('🔍 AuthProvider: Failed to parse stored token:', error)
          storage.clearTokens()
        }
      } else if (accessToken) {
        console.log('🔍 AuthProvider: Token is expired, clearing storage')
        storage.clearTokens()
      }

      setIsLoading(false)
      console.log('🔍 AuthProvider: Auth initialization complete')
    }

    initAuth()
  }, [client, storage])

  // Auto-refresh tokens
  useEffect(() => {
    if (!autoRefresh || !user) return

    const accessToken = storage.getAccessToken()
    if (!accessToken) return

    const timeUntilExpiry = client.getTimeUntilExpiry(accessToken)
    const refreshTime = Math.max(0, (timeUntilExpiry - 300) * 1000) // Refresh 5 minutes before expiry

    const timer = setTimeout(async () => {
      try {
        await refreshTokens()
      } catch (error) {
        console.warn('Auto-refresh failed:', error)
        await logout()
      }
    }, refreshTime)

    return () => clearTimeout(timer)
  }, [user, autoRefresh])

  const login = useCallback(
    async (params: Omit<LoginRequest, 'tenantId'>): Promise<AuthResponse> => {
      console.log('🔍 Login: Starting login process...')
      setIsLoading(true)
      try {
        const response = await client.login({ ...params, tenantId })
        console.log('🔍 Login: API response received:', response)

        console.log('🔍 Login: Storing tokens...')
        storage.setTokens(response.accessToken, response.refreshToken)

        console.log('🔍 Login: Setting user state...')
        setUser(response.user)

        console.log('🔍 Login: Login complete, user:', response.user)
        return response
      } finally {
        setIsLoading(false)
      }
    },
    [client, tenantId, storage]
  )

  const register = useCallback(
    async (
      params: Omit<RegisterRequest, 'tenantId'>
    ): Promise<AuthResponse> => {
      setIsLoading(true)
      try {
        const response = await client.register({ ...params, tenantId })

        storage.setTokens(response.accessToken, response.refreshToken)
        setUser(response.user)

        return response
      } finally {
        setIsLoading(false)
      }
    },
    [client, tenantId, storage]
  )

  const logout = useCallback(async () => {
    const accessToken = storage.getAccessToken()

    if (accessToken) {
      try {
        await client.logout(accessToken)
      } catch (error) {
        console.warn('Logout request failed:', error)
      }
    }

    storage.clearTokens()
    setUser(null)
  }, [client, storage])

  const refreshTokens = useCallback(async () => {
    const refreshToken = storage.getRefreshToken()

    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await client.refresh({ refreshToken })
    storage.setTokens(response.accessToken, response.refreshToken)

    // Update user info from new token
    const userInfo = client.getUserFromToken(response.accessToken)
    setUser(userInfo)
  }, [client, storage])

  const contextValue: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshTokens,
    client,
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

export function useTurkey(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useTurkey must be used within an AuthProvider')
  }

  return context
}

/**
 * Hook for accessing the current access token
 */
export function useAccessToken(
  storage: TokenStorage = new CookieTokenStorage()
): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setToken(storage.getAccessToken())
  }, [storage])

  return token
}

/**
 * Hook for making authenticated API requests
 */
export function useAuthenticatedFetch(
  storage: TokenStorage = new CookieTokenStorage()
) {
  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      const accessToken = storage.getAccessToken()

      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
      })
    },
    [storage]
  )
}
