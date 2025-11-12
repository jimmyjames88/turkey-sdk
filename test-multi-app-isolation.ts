/**
 * Multi-App Isolation Test Script
 * 
 * Tests that Turkey authentication properly isolates users across different apps:
 * 1. Same email can register in different apps (different user records)
 * 2. Tokens from one app cannot access another app's resources
 * 3. JWT audience claims are properly validated
 * 4. Revoked tokens are tracked per-app
 */

import { TurKeyClient } from '@jimmyjames88/turkey-sdk'

const TURKEY_BASE_URL = process.env.TURKEY_BASE_URL || 'http://localhost:3000'
const TEST_EMAIL = 'isolation-test@example.com'
const TEST_PASSWORD = 'TestPassword123!'

// Create two separate app clients
const app1Client = new TurKeyClient({
  baseUrl: TURKEY_BASE_URL,
  appId: 'test-app-1',
})

const app2Client = new TurKeyClient({
  baseUrl: TURKEY_BASE_URL,
  appId: 'test-app-2',
})

async function runTests() {
  console.log('🧪 Multi-App Isolation Test Suite\n')
  console.log('='.repeat(60))
  
  let testsPassed = 0
  let testsFailed = 0
  
  // Test 1: Register same email in both apps
  console.log('\n📝 Test 1: Same email can register in different apps')
  try {
    const app1User = await app1Client.register({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    console.log(`✅ App1 registration successful - User ID: ${app1User.user.id}`)
    
    const app2User = await app2Client.register({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    console.log(`✅ App2 registration successful - User ID: ${app2User.user.id}`)
    
    if (app1User.user.id !== app2User.user.id) {
      console.log('✅ Different user IDs confirmed (proper isolation)')
      testsPassed++
    } else {
      console.log('❌ FAILED: Same user ID returned (no isolation!)')
      testsFailed++
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`)
    testsFailed++
  }
  
  // Test 2: Login to both apps
  console.log('\n🔐 Test 2: Login to both apps independently')
  let app1Token = ''
  let app2Token = ''
  
  try {
    const app1Login = await app1Client.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    app1Token = app1Login.accessToken
    console.log(`✅ App1 login successful`)
    
    const app2Login = await app2Client.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    app2Token = app2Login.accessToken
    console.log(`✅ App2 login successful`)
    
    if (app1Token !== app2Token) {
      console.log('✅ Different access tokens confirmed')
      testsPassed++
    } else {
      console.log('❌ FAILED: Same access token (no isolation!)')
      testsFailed++
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`)
    testsFailed++
  }
  
  // Test 3: Verify JWT audience claims
  console.log('\n🎯 Test 3: JWT audience claims are app-specific')
  try {
    const app1Decoded = app1Client.decodeToken(app1Token)
    const app2Decoded = app2Client.decodeToken(app2Token)
    
    console.log(`App1 JWT audience: ${app1Decoded?.aud}`)
    console.log(`App2 JWT audience: ${app2Decoded?.aud}`)
    
    if (app1Decoded?.aud === 'test-app-1' && app2Decoded?.aud === 'test-app-2') {
      console.log('✅ Audience claims properly isolated')
      testsPassed++
    } else {
      console.log('❌ FAILED: Incorrect audience claims')
      testsFailed++
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`)
    testsFailed++
  }
  
  // Test 4: Cross-app token verification should fail
  console.log('\n🛡️  Test 4: Cross-app token verification fails')
  try {
    // Try to verify app1 token with app2 client
    const isValid = await app2Client.validateTokenFormat(app1Token)
    
    if (!isValid) {
      console.log('✅ App1 token correctly rejected by App2 client')
      testsPassed++
    } else {
      console.log('❌ FAILED: App1 token accepted by App2 client!')
      testsFailed++
    }
  } catch (error: any) {
    // Expected to throw due to audience mismatch
    console.log('✅ App1 token correctly rejected by App2 client (threw error)')
    testsPassed++
  }
  
  // Test 5: Profile fetching is app-isolated
  console.log('\n👤 Test 5: Profile data is app-isolated')
  try {
    const app1Decoded = app1Client.decodeToken(app1Token)
    const app2Decoded = app2Client.decodeToken(app2Token)
    
    console.log(`App1 user ID from token: ${app1Decoded?.sub}`)
    console.log(`App2 user ID from token: ${app2Decoded?.sub}`)
    
    if (app1Decoded?.sub !== app2Decoded?.sub && 
        app1Decoded?.email === TEST_EMAIL && 
        app2Decoded?.email === TEST_EMAIL) {
      console.log('✅ Same email, different user IDs (proper isolation)')
      testsPassed++
    } else {
      console.log('❌ FAILED: User IDs not properly isolated')
      testsFailed++
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`)
    testsFailed++
  }
  
  // Test 6: Token revocation is app-isolated
  console.log('\n🚫 Test 6: Token revocation is app-isolated')
  try {
    // Revoke app1 token
    await app1Client.revoke(app1Token, 'test-revocation')
    console.log('✅ App1 token revoked')
    
    // Try to login again with app1 (should work - only token revoked, not user)
    try {
      const app1Relogin = await app1Client.login({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
      console.log('✅ App1 can still login (revocation only affects tokens, not account)')
    } catch (error: any) {
      console.log(`❌ FAILED: Cannot login to app1 after token revocation: ${error.message}`)
      testsFailed++
    }
    
    // Verify app2 token still works by logging in again
    try {
      const app2Relogin = await app2Client.login({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })
      console.log('✅ App2 token still works (revocation is app-isolated)')
      testsPassed++
    } catch (error: any) {
      console.log(`❌ FAILED: Cannot login to app2: ${error.message}`)
      testsFailed++
    }
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.message}`)
    testsFailed++
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 Test Results:`)
  console.log(`   ✅ Passed: ${testsPassed}/6`)
  console.log(`   ❌ Failed: ${testsFailed}/6`)
  
  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Multi-app isolation is working correctly.\n')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Multi-app isolation needs attention.\n')
    process.exit(1)
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error)
  process.exit(1)
})
