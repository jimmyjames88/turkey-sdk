// Core client
export { TurKeyClient } from './client'
export { TokenManager } from './token-manager'

// Storage implementations
export {
  CookieTokenStorage,
  LocalStorageTokenStorage,
  MemoryTokenStorage,
  type TokenStorage,
} from './storage'

// React hooks (optional peer dependency)
export {
  AuthProvider,
  useTurkey,
  useAccessToken,
  useAuthenticatedFetch,
} from './react'

// Types
export type {
  TurKeyConfig,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  AuthResponse,
  TokenPair,
  User,
  JWTPayload,
  TurKeyError,
} from './types'

export { TurKeyAuthError } from './types'

// Default export for convenience
export { TurKeyClient as default } from './client'
