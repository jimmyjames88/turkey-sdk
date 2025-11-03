// Example: Error handling with granular error types
/* eslint-disable no-console, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import {
  TurKeyClient,
  NetworkError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  ServerError,
  isTurKeyError,
  isRetryableError,
} from '../src'

const client = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
})

// Example 1: Basic error handling with type checking
async function loginWithErrorHandling(email: string, password: string) {
  try {
    const response = await client.login({ email, password })
    console.log('✅ Login successful:', response.user.email)
    return response
  } catch (error) {
    // Check if it's a TurKey error
    if (isTurKeyError(error)) {
      console.error('❌ TurKey Error:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
        timestamp: error.timestamp,
      })

      // Handle specific error types
      if (error instanceof AuthenticationError) {
        console.error(
          '🔒 Invalid credentials - please check email and password'
        )
      } else if (error instanceof NetworkError) {
        console.error('🌐 Network error - please check your connection')
      } else if (error instanceof ValidationError) {
        console.error('⚠️ Validation error:', error.details)
      } else if (error instanceof RateLimitError) {
        console.error(
          `⏱️ Rate limited - retry after ${error.retryAfter} seconds`
        )
      } else if (error instanceof ServerError) {
        console.error('🔥 Server error - please try again later')
      }
    } else {
      console.error('Unknown error:', error)
    }
    throw error
  }
}

// Example 2: Automatic retry for retryable errors
async function loginWithRetry(
  email: string,
  password: string,
  maxAttempts = 3
): Promise<any> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Login attempt ${attempt}/${maxAttempts}`)
      return await client.login({ email, password })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Only retry if the error is retryable
      if (!isRetryableError(error)) {
        console.error('❌ Non-retryable error, aborting')
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      console.log(`⏳ Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  console.error(`❌ All ${maxAttempts} attempts failed`)
  throw lastError
}

// Example 3: Handling validation errors with detailed feedback
async function registerWithValidation(email: string, password: string) {
  try {
    const response = await client.register({
      email,
      password,
      validatePassword: true, // Enable client-side validation
    })
    console.log('✅ Registration successful')
    return response
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('⚠️ Validation failed:')
      error.details?.forEach((detail) => {
        console.error(`  - ${detail.field}: ${detail.message}`)
      })
    }
    throw error
  }
}

// Example 4: Handling rate limiting with custom logic
async function loginWithRateLimitHandling(email: string, password: string) {
  try {
    return await client.login({ email, password })
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error(`⏱️ Rate limited!`)
      if (error.retryAfter) {
        console.error(`   Retry after: ${error.retryAfter} seconds`)
        console.error(`   Waiting...`)
        await new Promise((resolve) =>
          setTimeout(resolve, error.retryAfter! * 1000)
        )
        console.error(`   Retrying now...`)
        return client.login({ email, password })
      }
    }
    throw error
  }
}

// Example 5: Error logging and monitoring
function logErrorToMonitoring(error: unknown) {
  if (isTurKeyError(error)) {
    // Send to your monitoring service (e.g., Sentry, DataDog)
    console.log('📊 Sending to monitoring:', error.toJSON())

    // Log different severity levels based on error type
    if (error instanceof ServerError) {
      console.error('🚨 CRITICAL:', error.toJSON())
    } else if (error instanceof NetworkError) {
      console.warn('⚠️  WARNING:', error.toJSON())
    } else {
      console.info('ℹ️  INFO:', error.toJSON())
    }
  }
}

// Example 6: User-friendly error messages
function getUserFriendlyMessage(error: unknown): string {
  if (!isTurKeyError(error)) {
    return 'An unexpected error occurred. Please try again.'
  }

  switch (error.constructor) {
    case NetworkError:
      return 'Unable to connect to the server. Please check your internet connection.'

    case AuthenticationError:
      return 'Invalid email or password. Please try again.'

    case ValidationError:
      if (error.details && error.details.length > 0) {
        return error.details.map((d) => d.message).join('. ')
      }
      return 'Please check your input and try again.'

    case RateLimitError:
      return error.retryAfter
        ? `Too many attempts. Please wait ${error.retryAfter} seconds before trying again.`
        : 'Too many attempts. Please wait a moment before trying again.'

    case ServerError:
      return 'Our servers are experiencing issues. Please try again later.'

    default:
      return error.message || 'An error occurred. Please try again.'
  }
}

// Example usage (exported for potential use)
export async function main() {
  console.log('=== Example 1: Basic error handling ===')
  try {
    await loginWithErrorHandling('user@example.com', 'wrongpassword')
  } catch (error) {
    console.log('Error caught and handled\n')
  }

  console.log('=== Example 2: Retry logic ===')
  try {
    await loginWithRetry('user@example.com', 'password123')
  } catch (error) {
    console.log('All retry attempts exhausted\n')
  }

  console.log('=== Example 3: Validation errors ===')
  try {
    await registerWithValidation('user@example.com', '123')
  } catch (error) {
    console.log('Validation error handled\n')
  }

  console.log('=== Example 6: User-friendly messages ===')
  try {
    await client.login({ email: 'test@example.com', password: 'wrong' })
  } catch (error) {
    console.log('User sees:', getUserFriendlyMessage(error))
  }
}

// Run examples (uncomment to test)
// main().catch(console.error)

export {
  loginWithErrorHandling,
  loginWithRetry,
  registerWithValidation,
  loginWithRateLimitHandling,
  logErrorToMonitoring,
  getUserFriendlyMessage,
}
