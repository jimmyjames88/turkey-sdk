// Mock for JOSE library
/* eslint-disable no-undef */
export const jwtVerify = jest.fn()
export const createRemoteJWKSet = jest.fn()
/* eslint-enable no-undef */

export type JWTPayload = {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any
}
