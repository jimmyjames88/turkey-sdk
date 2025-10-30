// Basic client usage example
import { TurKeyClient, CookieTokenStorage } from '@jimmyjames88/turkey-sdk'

async function example() {
  // Initialize the client
  const client = new TurKeyClient({
    baseUrl: 'http://localhost:3000', // Your TurKey server
    appId: 'my-app',
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
    })

    console.log('Login successful:', loginResponse.user)

    // ✅ Client-side format validation (UI purposes only)
    try {
      const payload = await client.validateTokenFormat(
        loginResponse.accessToken
      )
      console.log('Token format is valid. User:', payload.email)
    } catch {
      console.log('Token format invalid, redirecting to login...')
    }

    // ✅ Get user info from token (UI purposes)
    const userInfo = client.getUserFromToken(loginResponse.accessToken)
    console.log('User from token:', userInfo)

    // ✅ Check token expiration (refresh timing)
    const timeUntilExpiry = client.getTimeUntilExpiry(loginResponse.accessToken)
    console.log(`Token expires in ${timeUntilExpiry} seconds`)

    // Note: For server-side authorization, always use:
    // const payload = await verifyJwt(token, { baseUrl: 'http://localhost:3000' })

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
