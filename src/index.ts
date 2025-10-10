// Core client
export { TurKeyClient } from './client'
export { TokenManager } from './token-manager'

// Password validation utilities
export {
  validatePassword,
  generateSecurePassword,
  getPasswordRequirementsText,
  DEFAULT_PASSWORD_REQUIREMENTS,
  type PasswordValidationResult,
  type PasswordRequirements,
} from './password-validation'

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
  usePasswordValidation,
  usePasswordConfirmation,
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
