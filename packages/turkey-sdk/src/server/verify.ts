import type { TurKeyConfig, JWTPayload } from '../types'
import { TokenManager } from '../token-manager'

/**
 * Verify a JWT server-side using Turkey's JWKS and TokenManager.
 * Returns the decoded payload on success or throws an Error on failure.
 *
 * @param token - JWT token to verify
 * @param config - TurKey configuration (baseUrl, appId, jwksCacheTtl, etc.)
 * @param expectedAppId - Optional audience to validate against (overrides config.appId)
 * @returns Decoded and validated JWT payload
 * @throws {Error} If token is invalid, expired, or signature verification fails
 */
export async function verifyJwt(
  token: string,
  config: TurKeyConfig,
  expectedAppId?: string
): Promise<JWTPayload> {
  const manager = new TokenManager(config, config.jwksCacheTtl)
  return manager.verifyToken(token, expectedAppId)
}
