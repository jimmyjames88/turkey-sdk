// React example with hooks
import React from 'react'
import { TurKeyClient, AuthProvider, useTurkey } from '@turkey/sdk'

// Initialize client
const client = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  audience: 'my-react-app'
})

// Login component
function LoginForm() {
  const { login, register, isLoading } = useTurkey()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login({ email, password })
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await register({ email, password })
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }

  return (
    <form>
      <div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div>
        <button onClick={handleLogin} disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
        <button onClick={handleRegister} disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </div>
    </form>
  )
}

// User profile component
function UserProfile() {
  const { user, logout } = useTurkey()

  return (
    <div>
      <h2>Welcome, {user?.email}!</h2>
      <p>Role: {user?.role}</p>
      <p>Tenant: {user?.tenantId}</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

// Main app component
function App() {
  const { isAuthenticated, isLoading } = useTurkey()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>TurKey SDK React Example</h1>
      {isAuthenticated ? <UserProfile /> : <LoginForm />}
    </div>
  )
}

// Root component with provider
export default function Root() {
  return (
    <AuthProvider 
      client={client} 
      tenantId="my-company"
      autoRefresh={true}
    >
      <App />
    </AuthProvider>
  )
}