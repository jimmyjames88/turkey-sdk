# TurKey SDK

A TypeScript SDK for seamless integration with TurKey JWT authentication service.

## Features

- 🔐 **Complete Authentication Flow** - Login, register, refresh, logout
- 🎯 **App-Specific Audiences** - Token isolation between applications
- ⚡ **TypeScript First** - Full type safety and IntelliSense
- 🍪 **Flexible Storage** - Cookie, localStorage, or memory storage
- ⚛️ **React Integration** - Ready-to-use hooks and providers
- 🛡️ **JWT Verification** - ES256 signature verification with JWKS
- 📦 **Multiple Formats** - ESM and CommonJS builds
- 🧪 **Well Tested** - Comprehensive test suite

## Installation

```bash
npm install @turkey/sdk
```

## Quick Start

### Basic Usage

```typescript
import { TurKeyClient, CookieTokenStorage } from '@turkey/sdk'

const client = new TurKeyClient({
  baseUrl: 'https://auth.yourapp.com',
  audience: 'my-app',
  tenantId: 'my-tenant',
})

// Login
const { user, accessToken, refreshToken } = await client.login({
  email: 'user@example.com',
  password: 'securepassword',
  tenantId: 'my-tenant',
})

// Store tokens
const storage = new CookieTokenStorage()
storage.setTokens(accessToken, refreshToken)

// Verify tokens
const isValid = await client.verifyToken(accessToken)
const userInfo = client.getUserFromToken(accessToken)
```

### React Integration

```tsx
import { AuthProvider, useTurkey } from '@turkey/sdk'

function App() {
  const client = new TurKeyClient({
    baseUrl: 'https://auth.yourapp.com',
    audience: 'my-app',
  })

  return (
    <AuthProvider client={client} tenantId="my-tenant">
      <LoginComponent />
    </AuthProvider>
  )
}

function LoginComponent() {
  const { login, user, isAuthenticated } = useTurkey()

  if (isAuthenticated) {
    return <div>Welcome, {user?.email}!</div>
  }

  return (
    <button onClick={() => login({ email: 'user@example.com', password: 'pass' })}>
      Login
    </button>
  )
}
```

## API Reference

### TurKeyClient

The main client for interacting with TurKey authentication service.

#### Constructor

```typescript
new TurKeyClient(config: TurKeyConfig)
```

#### Methods

- `login(params)` - Authenticate user and return tokens
- `register(params)` - Register new user and return tokens  
- `refresh(params)` - Refresh access token
- `logout(accessToken)` - Logout current session
- `logoutAll(accessToken)` - Logout all sessions
- `verifyToken(token, audience?)` - Verify JWT token
- `decodeToken(token)` - Decode token without verification
- `getUserFromToken(token)` - Extract user info from token
- `isTokenExpired(token)` - Check if token is expired

### Storage Options

#### CookieTokenStorage (Recommended)

```typescript
const storage = new CookieTokenStorage({
  secure: true,
  sameSite: 'strict',
  domain: '.yourapp.com',
})
```

#### LocalStorageTokenStorage

```typescript
const storage = new LocalStorageTokenStorage()
```

#### MemoryTokenStorage

```typescript
const storage = new MemoryTokenStorage()
```

### React Hooks

#### useTurkey()

Primary hook for authentication state and actions.

```typescript
const {
  user,           // Current user info
  isAuthenticated, // Authentication status
  isLoading,      // Loading state
  login,          // Login function
  register,       // Register function
  logout,         // Logout function
  refreshTokens,  // Manual refresh
  client,         // TurKey client instance
} = useTurkey()
```

#### useAccessToken()

Get current access token from storage.

```typescript
const accessToken = useAccessToken(storage)
```

#### useAuthenticatedFetch()

Fetch wrapper that automatically includes auth headers.

```typescript
const authenticatedFetch = useAuthenticatedFetch(storage)
const response = await authenticatedFetch('/api/protected-endpoint')
```

## App-Specific Audiences

TurKey supports app-specific audiences for enhanced security:

```typescript
// Different apps request tokens with different audiences
const blogClient = new TurKeyClient({
  baseUrl: 'https://auth.yourapp.com',
  audience: 'blog-app',
})

const shopClient = new TurKeyClient({
  baseUrl: 'https://auth.yourapp.com', 
  audience: 'shop-app',
})

// Tokens are isolated - blog tokens won't work for shop
const blogToken = await blogClient.login({ ... })
const shopToken = await shopClient.login({ ... })
```

## Error Handling

```typescript
import { TurKeyAuthError } from '@turkey/sdk'

try {
  await client.login({ ... })
} catch (error) {
  if (error instanceof TurKeyAuthError) {
    console.error('Auth failed:', error.message)
    console.error('Code:', error.code)
    console.error('Status:', error.statusCode)
    console.error('Details:', error.details)
  }
}
```

## Configuration

```typescript
interface TurKeyConfig {
  baseUrl: string        // TurKey service URL
  audience?: string      // Default audience for tokens
  tenantId?: string      // Default tenant ID
  timeout?: number       // Request timeout (default: 10000ms)
}
```

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```