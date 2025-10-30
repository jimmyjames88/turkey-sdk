export interface TurKeyConfig {
  baseUrl: string
  appId?: string
  timeout?: number
}

export interface LoginRequest {
  email: string
  password: string
  appId?: string
}

export interface RegisterRequest {
  email: string
  password: string
  role?: 'user' | 'admin'
  appId?: string
}

export interface RefreshRequest {
  refreshToken: string
  appId?: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    role: string
  }
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface User {
  id: string
  email: string
  role: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export interface JWTPayload {
  iss: string
  aud: string
  sub: string
  email: string
  role: string
  scope: string
  jti: string
  tokenVersion: number
  iat: number
  nbf: number
  exp: number
}

export interface ErrorDetail {
  field: string
  message: string
  code: string
}

export interface IntrospectionResult {
  active: boolean
  type?: 'access' | 'refresh'
  payload?: JWTPayload
  expiresAt?: string
  userId?: string
}

export interface TurKeyError {
  error: string
  message: string
  timestamp: string
  path: string
  details?: ErrorDetail[]
}

export class TurKeyAuthError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: ErrorDetail[]

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: ErrorDetail[]
  ) {
    super(message)
    this.name = 'TurKeyAuthError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
