export interface TurKeyConfig {
  baseUrl: string
  audience?: string
  tenantId?: string
  timeout?: number
}

export interface LoginRequest {
  email: string
  password: string
  tenantId: string
  audience?: string
}

export interface RegisterRequest {
  email: string
  password: string
  tenantId: string
  role?: 'user' | 'admin'
  audience?: string
}

export interface RefreshRequest {
  refreshToken: string
  audience?: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    role: string
    tenantId: string
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
  tenantId: string
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
  tenantId: string
  role: string
  scope: string
  jti: string
  tokenVersion: number
  iat: number
  nbf: number
  exp: number
}

export interface TurKeyError {
  error: string
  message: string
  timestamp: string
  path: string
  details?: Array<{
    field: string
    message: string
    code: string
  }>
}

export class TurKeyAuthError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: Array<{
    field: string
    message: string
    code: string
  }>

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: any[]
  ) {
    super(message)
    this.name = 'TurKeyAuthError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
