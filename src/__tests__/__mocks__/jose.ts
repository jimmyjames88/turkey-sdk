// Mock for JOSE library
export const jwtVerify = jest.fn()
export const createRemoteJWKSet = jest.fn()

export type JWTPayload = {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [propName: string]: any
}
