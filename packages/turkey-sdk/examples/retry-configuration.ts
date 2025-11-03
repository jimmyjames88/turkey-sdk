/**
 * TurKey SDK - Retry Configuration Examples
 *
 * Demonstrates automatic retry logic with exponential backoff
 */

/* eslint-disable no-console, @typescript-eslint/no-unused-vars */

import {
  TurKeyClient,
  NetworkError,
  RateLimitError,
  isRetryableError,
} from '../src'

// Example 1: Default retry configuration
// Automatically retries transient failures with exponential backoff
const defaultClient = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
  // Default retry config:
  // - maxAttempts: 3
  // - initialDelayMs: 1000 (1 second)
  // - maxDelayMs: 30000 (30 seconds)
  // - backoffMultiplier: 2 (doubles each attempt)
  // - jitter: true (randomizes delay to prevent thundering herd)
})

async function loginWithDefaultRetry() {
  try {
    // This will automatically retry on NetworkError, ServerError, RateLimitError
    const response = await defaultClient.login({
      email: 'user@example.com',
      password: 'password123',
    })
    console.log('Login successful:', response.user)
  } catch (error) {
    // After 3 attempts, error is thrown
    console.error('Login failed after retries:', error)
  }
}

// Example 2: Custom retry configuration
const customClient = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
  retry: {
    maxAttempts: 5, // More aggressive retry
    initialDelayMs: 500, // Start with shorter delay
    maxDelayMs: 10000, // Cap at 10 seconds
    backoffMultiplier: 1.5, // Slower exponential growth
    jitter: true,
  },
})

async function registerWithCustomRetry() {
  try {
    const response = await customClient.register({
      email: 'new@example.com',
      password: 'SecurePass123!',
    })
    console.log('Registration successful:', response.user)
  } catch (error) {
    console.error('Registration failed:', error)
  }
}

// Example 3: Disable automatic retry
const noRetryClient = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
  retry: false, // No automatic retries
})

async function loginWithoutRetry() {
  try {
    const response = await noRetryClient.login({
      email: 'user@example.com',
      password: 'password123',
    })
    console.log('Login successful:', response.user)
  } catch (error) {
    // Error thrown immediately on first failure
    console.error('Login failed (no retry):', error)
  }
}

// Example 4: Custom retry logic with shouldRetry callback
const selectiveRetryClient = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
  retry: {
    maxAttempts: 3,
    shouldRetry: (error, attempt) => {
      // Only retry network errors, not authentication errors
      if (error instanceof NetworkError) {
        console.log(`Network error, retrying (attempt ${attempt})...`)
        return true
      }

      // Don't retry rate limits if this is a login endpoint
      if (error instanceof RateLimitError) {
        console.log('Rate limited, not retrying login')
        return false
      }

      // Use default retry logic for other errors
      return isRetryableError(error)
    },
  },
})

async function loginWithSelectiveRetry() {
  try {
    const response = await selectiveRetryClient.login({
      email: 'user@example.com',
      password: 'password123',
    })
    console.log('Login successful:', response.user)
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Example 5: Monitoring retry attempts (exported for use)
export const monitoredClient = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
  retry: {
    maxAttempts: 3,
    shouldRetry: (error, attempt) => {
      if (isRetryableError(error)) {
        console.log(`Retrying request (attempt ${attempt})...`)

        // Send to monitoring service
        monitoringService.trackRetry({
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt,
          timestamp: new Date(),
        })

        return true
      }
      return false
    },
  },
})

const monitoringService = {
  trackRetry(data: { error: string; attempt: number; timestamp: Date }) {
    console.log('Monitoring:', data)
  },
}

// Example 6: Rate limit handling with retry
async function handleRateLimit() {
  const client = new TurKeyClient({
    baseUrl: 'http://localhost:3000',
    appId: 'my-app',
    retry: {
      maxAttempts: 3,
    },
  })

  try {
    // SDK automatically handles rate limits:
    // - Extracts retryAfter from RateLimitError
    // - Waits specified time before retrying
    // - Continues with remaining retry attempts
    const response = await client.login({
      email: 'user@example.com',
      password: 'password123',
    })
    console.log('Login successful:', response.user)
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error(`Rate limited. Retry after: ${error.retryAfter} seconds`)
    }
  }
}

// Example 7: Token refresh with automatic deduplication
async function refreshWithDeduplication() {
  const client = new TurKeyClient({
    baseUrl: 'http://localhost:3000',
    appId: 'my-app',
  })

  const refreshToken = 'your-refresh-token'

  // Multiple simultaneous refresh calls are deduplicated
  // Only one actual API request is made, preventing race conditions
  const [result1, result2, result3] = await Promise.all([
    client.refresh({ refreshToken }),
    client.refresh({ refreshToken }), // Reuses first request
    client.refresh({ refreshToken }), // Reuses first request
  ])

  console.log(
    'All results identical:',
    result1.accessToken === result2.accessToken &&
      result2.accessToken === result3.accessToken
  )
}

// Example 8: Exponential backoff timing
function calculateRetryDelays() {
  const config = {
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelayMs
    )
    console.log(`Attempt ${attempt}: ${delay}ms delay`)
  }
  // Output:
  // Attempt 1: 1000ms delay
  // Attempt 2: 2000ms delay
  // Attempt 3: 4000ms delay
  // Attempt 4: 8000ms delay
  // Attempt 5: 16000ms delay
}

// Example 9: Jitter demonstration
function demonstrateJitter() {
  const baseDelay = 1000 // 1 second

  console.log('Without jitter (fixed):')
  console.log(`Delay: ${baseDelay}ms`)

  console.log('\nWith jitter (randomized 50-100% of base):')
  for (let i = 0; i < 5; i++) {
    const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5)
    console.log(`Delay ${i + 1}: ${Math.round(jitteredDelay)}ms`)
  }
  // Output varies each run, helps prevent thundering herd problem
}

// Export all examples
export {
  loginWithDefaultRetry,
  registerWithCustomRetry,
  loginWithoutRetry,
  loginWithSelectiveRetry,
  handleRateLimit,
  refreshWithDeduplication,
  calculateRetryDelays,
  demonstrateJitter,
}
