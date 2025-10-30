// Core client
export { TurKeyClient } from './client'
export { TokenManager } from './token-manager'
export { verifyJwt } from './server/verify'
export { introspectToken, revokeToken } from './server/introspect'

// Middleware (server-side)
export {
  createTurkeyMiddleware,
  turkeyAuth,
  requireAuth,
  optionalAuth,
  type TurKeyUser,
  type TurKeyPayload,
  type TurKeyAuthenticatedRequest,
  type TurKeyMiddlewareConfig,
  type ExpressAuthRequest,
  type NextAuthRequest,
} from './middleware'

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
  IntrospectionResult,
  ErrorDetail,
} from './types'

export { TurKeyAuthError } from './types'

// Default export for convenience
export { TurKeyClient as default } from './client'
