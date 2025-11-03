// Core client
export { TurKeyClient } from './client'
export { TokenManager } from './token-manager'
export { verifyJwt } from './server/verify'
export { introspectToken, revokeToken } from './server/introspect'
export { checkRevocation, getRevocationInfo } from './server/revocation'

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
  getPasswordStrength,
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
  RetryConfig,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  AuthResponse,
  TokenPair,
  UpdateProfileResponse,
  ChangePasswordResponse,
  DeleteAccountResponse,
  User,
  JWTPayload,
  TurKeyError,
  IntrospectionResult,
  ErrorDetail,
} from './types'

export type { RevocationCheckResult } from './server/revocation'

// Error classes (NEW - granular error types)
export {
  TurKeyError as TurKeyErrorBase,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  ServerError,
  ConfigurationError,
  TokenError,
  createErrorFromResponse,
  isTurKeyError,
  isRetryableError,
} from './errors'

// Legacy error export for backwards compatibility
export { TurKeyAuthError } from './types'

// Default export for convenience
export { TurKeyClient as default } from './client'
