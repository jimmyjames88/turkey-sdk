import type { TurKeyConfig } from '../types'

export interface RevocationCheckResult {
  revoked: boolean
  revokedAt?: number
  reason?: string
}

/**
 * Check if a token (by JTI) has been revoked
 * Server-side utility for middleware use
 *
 * @param jti - The JWT ID (jti claim) to check
 * @param config - TurKey configuration with baseUrl
 * @returns Promise<boolean> - true if revoked, false if valid
 *
 * @example
 * ```typescript
 * const isRevoked = await checkRevocation(payload.jti, {
 *   baseUrl: process.env.TURKEY_BASE_URL!
 * })
 * if (isRevoked) {
 *   return res.status(401).json({ error: 'Token has been revoked' })
 * }
 * ```
 */
export async function checkRevocation(
  jti: string,
  config: Pick<TurKeyConfig, 'baseUrl'>
): Promise<boolean> {
  try {
    const url = `${config.baseUrl}/v1/auth/revocation-check`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jti }),
    })

    if (!response.ok) {
      // Fail open on HTTP errors - don't block valid tokens
      console.warn(
        `Revocation check failed with status ${response.status}, allowing token`
      )
      return false
    }

    const data: RevocationCheckResult = await response.json()
    return data.revoked === true
  } catch (error) {
    // Fail open on network errors - don't block valid tokens
    console.warn('Revocation check failed with error, allowing token:', error)
    return false
  }
}

/**
 * Get detailed revocation information for a token
 *
 * @param jti - The JWT ID (jti claim) to check
 * @param config - TurKey configuration with baseUrl
 * @returns Promise<RevocationCheckResult> - Revocation details or null if not revoked
 */
export async function getRevocationInfo(
  jti: string,
  config: Pick<TurKeyConfig, 'baseUrl'>
): Promise<RevocationCheckResult | null> {
  try {
    const url = `${config.baseUrl}/v1/auth/revocation-check`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jti }),
    })

    if (!response.ok) {
      return null
    }

    const data: RevocationCheckResult = await response.json()
    return data.revoked ? data : null
  } catch (error) {
    console.warn('Failed to get revocation info:', error)
    return null
  }
}
