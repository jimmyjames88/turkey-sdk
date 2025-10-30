import type { TurKeyConfig } from '../types'
import { TurKeyClient } from '../client'

/**
 * Introspect token using TurKey API. Returns token metadata or throws on error.
 */
export async function introspectToken(token: string, config: TurKeyConfig) {
  const client = new TurKeyClient(config)
  return client.introspect(token)
}

export async function revokeToken(token: string, config: TurKeyConfig) {
  const client = new TurKeyClient(config)
  return client.revoke(token)
}
