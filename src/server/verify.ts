import type { TurKeyConfig, JWTPayload } from '../types'
import { TokenManager } from '../token-manager'

/**
 * Verify a JWT server-side using Turkey's JWKS and TokenManager.
 * Returns the decoded payload on success or throws an Error on failure.
 */
export async function verifyJwt(
  token: string,
  config: TurKeyConfig,
  expectedAppId?: string
): Promise<JWTPayload> {
  const manager = new TokenManager(config)
  return manager.verifyToken(token, expectedAppId)
}
