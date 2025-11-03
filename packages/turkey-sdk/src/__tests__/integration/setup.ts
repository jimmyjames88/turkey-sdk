/**
 * Integration Test Setup
 *
 * Ensures Turkey server is running and provides utilities for test isolation.
 * These tests hit REAL endpoints - no mocking.
 */

// Polyfill fetch for Node.js < 18 or if not available
if (typeof global.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  global.fetch = require('node-fetch')
}

const TURKEY_BASE_URL = process.env.TURKEY_BASE_URL || 'http://localhost:3000'
const TURKEY_APP_ID = process.env.TURKEY_APP_ID || 'test-app'

/**
 * Verify Turkey server is accessible before running tests
 */
async function verifyTurkeyServer() {
  try {
    const response = await fetch(`${TURKEY_BASE_URL}/.well-known/jwks.json`)
    if (!response.ok) {
      throw new Error(`JWKS endpoint returned ${response.status}`)
    }

    const jwks = await response.json()
    if (!jwks.keys || jwks.keys.length === 0) {
      throw new Error('JWKS has no keys')
    }

    console.log('✓ Turkey server is running and accessible')
    console.log(`  Base URL: ${TURKEY_BASE_URL}`)
    console.log(`  App ID: ${TURKEY_APP_ID}`)
  } catch (error) {
    console.error('\n❌ INTEGRATION TESTS FAILED TO START')
    console.error("Turkey server is not accessible. Make sure it's running:")
    console.error(`  Expected: ${TURKEY_BASE_URL}`)
    console.error(
      `  Error: ${error instanceof Error ? error.message : String(error)}`
    )
    console.error('\nStart the server with: cd ../turkey && npm run dev\n')
    process.exit(1)
  }
}

/**
 * Generate unique test user email to avoid conflicts
 */
export function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `test-${timestamp}-${random}@integration.test`
}

/**
 * Test user credentials
 */
export const TEST_PASSWORD = 'Test123!@#'

/**
 * Export config for tests
 */
export const INTEGRATION_CONFIG = {
  baseUrl: TURKEY_BASE_URL,
  appId: TURKEY_APP_ID,
  appId2: 'test-app-2', // For multi-app isolation tests
}

// Run server verification before all tests
// eslint-disable-next-line no-undef
beforeAll(async () => {
  await verifyTurkeyServer()
})

// Global test timeout already set in jest.integration.config.cjs
