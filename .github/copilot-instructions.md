# TurKey SDK AI Development Guide

## Project Overview

TurKey SDK is a TypeScript JWT authentication client library that provides both client-side and server-side utilities for TurKey authentication service integration. The library supports React hooks, multiple storage backends, comprehensive JWT verification, and zero-configuration server middleware.

## Workspace Ecosystem

This SDK is part of a larger authentication ecosystem:

- **turkey-sdk** (this project): TypeScript client library for consuming TurKey auth
- **turkey**: Express.js authentication server with JWKS, refresh rotation, and multi-tenant support
- **renoodles-next**: Next.js application demonstrating SDK integration patterns
- **eslint-config-jimmyjames88**: Shared ESLint configuration across all projects

### Integration Example

See `renoodles-next/src/lib/turkey-client.ts` for real-world SDK usage:

```typescript
export const turkeyClient = new TurKeyClient({
  baseUrl: process.env.NEXT_PUBLIC_TURKEY_BASE_URL,
  audience: 'renoodles-app',
  tenantId: process.env.NEXT_PUBLIC_TURKEY_TENANT_ID,
})
```

## Architecture Components

### Core Client (`src/client.ts`)

- **TurKeyClient**: Main authentication client with RESTful API methods
- All API endpoints use `/v1/auth/*` pattern with JSON payloads
- Error handling via custom `TurKeyAuthError` class with structured error details
- Built-in password validation during registration (can be disabled with `validatePassword: false`)

### Token Management (`src/token-manager.ts`)

- **JWKS-based verification**: Uses `jose` library with remote JWKS from `/.well-known/jwks.json`
- **ES256 algorithm**: All tokens use Elliptic Curve signatures, not RSA
- **Audience validation**: Critical for multi-app security - each app should have unique audience
- **Client-side utilities**: `decodeToken()` for UI state, `isTokenExpired()` for refresh timing
- **Security boundary**: Only server-side `verifyJwt()` should be used for authorization decisions

### Storage Abstraction (`src/storage.ts`)

Three storage implementations following `TokenStorage` interface:

- **CookieTokenStorage** (recommended): SSR-safe, configurable cookie options
- **LocalStorageTokenStorage**: Client-only, browser localStorage
- **MemoryTokenStorage**: Testing/temporary use

### React Integration (`src/react/index.tsx`)

- **AuthProvider**: Context provider managing auth state with auto-refresh
- **Auto-refresh logic**: Refreshes tokens 5 minutes before expiry (minimum 30s buffer)
- **useTurkey()**: Primary hook for auth operations
- **Storage-agnostic**: Pass storage instance to provider

### Server Middleware (`src/middleware/`)

- **Zero-config approach**: Uses environment variables (`TURKEY_BASE_URL`, `TURKEY_AUDIENCE`, `TURKEY_TENANT_ID`)
- **Framework-agnostic core**: Works with Express, Fastify, Koa, Next.js, etc.
- **Smart token extraction**: Automatically finds tokens in headers, cookies, custom headers
- **Type safety**: Framework-specific request augmentation without bias
- **Development mode**: Enhanced logging when `NODE_ENV=development`

## Development Patterns

### Authentication Flow

```typescript
// Always include tenantId and audience for proper token scoping
const response = await client.login({
  email: 'user@example.com',
  password: 'password',
  tenantId: 'company-id', // Required for multi-tenant
  audience: 'specific-app', // Optional, falls back to client config
})
```

### Server-Side Verification

Use `verifyJwt()` helper in middleware - never client-side verification for auth decisions:

```typescript
import { verifyJwt } from '@jimmyjames88/turkey-sdk'
const payload = await verifyJwt(token, { baseUrl: process.env.TURKEY_BASE_URL })
```

### Client-Side Token Utilities

Use only for UX/UI decisions, never for authorization:

```typescript
// ✅ UI state decisions
const user = client.getUserFromToken(accessToken)
if (user.role === 'admin') return <AdminDashboard />

// ✅ Auto-refresh timing
if (client.isTokenExpired(accessToken)) {
  await refreshTokens()
}

// ❌ Never use for security decisions
// const isValid = await client.verifyToken(token) // Don't rely on this for auth!
```

### Testing Patterns

- **Mock JWKS**: Use `src/__tests__/__mocks__/jose.ts` for JWT verification mocking
- **MemoryTokenStorage**: Preferred for isolated test scenarios
- **Global fetch mock**: Required for client tests (`global.fetch = jest.fn()`)

## Build & Development

### Scripts

- `npm run dev`: Rollup watch mode for live development
- `npm run build`: Dual ESM/CommonJS output to `dist/`
- `npm test`: Jest with jsdom environment for React testing
- `npm run type-check`: TypeScript validation without emit

### Build Configuration

- **Rollup**: Generates both ESM (`index.esm.js`) and CJS (`index.js`) bundles
- **External dependencies**: `jose`, `js-cookie`, `react` are externalized
- **TypeScript**: Declaration files generated only for ESM build

### Development Dependencies

- Uses `@jimmyjames88/eslint-config` for consistent code style across the ecosystem
- Jest configured with jsdom for React component testing
- Husky + lint-staged for pre-commit hooks
- All projects in workspace share same ESLint/Prettier configuration

### Cross-Project Testing

- **turkey** server provides real JWKS endpoints for integration testing
- **renoodles-next** serves as reference implementation for Next.js integration
- SDK tests can run against local turkey server on port 3000

## Key Conventions

### Error Handling

- All API errors wrapped in `TurKeyAuthError` with structured details
- Server-side verification throws standard `Error` objects
- Password validation errors include field-specific details

### Token Validation

- Client-side: Use `isTokenExpired()` and `decodeToken()` for UI state decisions only
- Server-side: Always use `verifyJwt()` with JWKS validation for authorization
- Client-side `verifyToken()`: Only for format validation/debugging - never for security
- Audience parameter is critical for security in multi-app scenarios

### React State Management

- AuthProvider manages user state and auto-refresh timers
- Storage instance should be stable reference to avoid re-renders
- Manual `refreshTokens()` available for explicit refresh scenarios

## Example Implementations

See `examples/` directory for:

- `basic-usage.ts`: Complete client-side flow
- `middleware/express.ts`: Server middleware pattern
- `react-hooks.tsx`: React integration example

## Common Gotchas

1. **Audience scope**: Different audiences create isolated token contexts
2. **Storage persistence**: CookieStorage requires proper domain/path config for SSR
3. **Auto-refresh timing**: Calculated from token expiry, not issuance time
4. **JWKS caching**: TokenManager instances cache JWKS URLs - reuse instances when possible
5. **Mock dependencies**: Jose library must be mocked for JWT tests to avoid network calls
6. **Environment variables**: Next.js example uses `NEXT_PUBLIC_` prefixes for client-side access
7. **Workspace dependencies**: SDK version in renoodles-next should match local development version

## Recent Updates (v0.3.0)

### Client-Side Token Method Clarification

- **NEW**: `validateTokenFormat()` - Clearly named method for client-side token format validation
- **DEPRECATED**: `verifyToken()` - Misleading name, will be removed in v1.0.0
- **Purpose**: Client-side methods are for UX/UI decisions only, never for authorization
- **Security**: Only server-side `verifyJwt()` should be used for auth decisions
