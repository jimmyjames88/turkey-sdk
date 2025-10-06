// Basic client usage example
import { TurKeyClient, CookieTokenStorage } from '@jimmyjames88/turkey-sdk'

async function example() {
  // Initialize the client
  const client = new TurKeyClient({
    baseUrl: 'http://localhost:3000', // Your TurKey server
    audience: 'my-app',
  })

  // Initialize storage
  const storage = new CookieTokenStorage({
    secure: false, // Set to true in production
    sameSite: 'lax',
  })

  try {
    // Register a new user
    console.log('Registering user...')
    const registerResponse = await client.register({
      email: 'john@example.com',
      password: 'SecurePass123!',
      tenantId: 'my-company',
      role: 'user',
    })

    console.log('Registration successful:', registerResponse.user)

    // Store tokens
    storage.setTokens(
      registerResponse.accessToken,
      registerResponse.refreshToken
    )

    // Login
    console.log('Logging in...')
    const loginResponse = await client.login({
      email: 'john@example.com',
      password: 'SecurePass123!',
      tenantId: 'my-company',
    })

    console.log('Login successful:', loginResponse.user)

    // Verify token
    const payload = await client.verifyToken(loginResponse.accessToken)
    console.log('Token verified. Payload:', payload)

    // Get user info from token
    const userInfo = client.getUserFromToken(loginResponse.accessToken)
    console.log('User from token:', userInfo)

    // Check token expiration
    const timeUntilExpiry = client.getTimeUntilExpiry(loginResponse.accessToken)
    console.log(`Token expires in ${timeUntilExpiry} seconds`)

    // Refresh tokens
    console.log('Refreshing tokens...')
    const refreshResponse = await client.refresh({
      refreshToken: loginResponse.refreshToken,
    })

    console.log('Tokens refreshed successfully')

    // Update stored tokens
    storage.setTokens(refreshResponse.accessToken, refreshResponse.refreshToken)

    // Logout
    console.log('Logging out...')
    await client.logout(refreshResponse.accessToken)
    storage.clearTokens()

    console.log('Logout successful')
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the example
example().catch(console.error)
