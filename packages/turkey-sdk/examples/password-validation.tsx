// React password validation example
import React, { useState } from 'react'
import { usePasswordValidation, usePasswordConfirmation } from '../src/react'

function PasswordRegistrationForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Password validation with custom requirements
  const passwordValidation = usePasswordValidation(
    password,
    {
      minLength: 12,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      preventCommonPasswords: true,
      preventUserInfo: ['user@example.com', 'johndoe'], // Prevent using email or username
    },
    300 // 300ms debounce
  )

  // Password confirmation matching with debounce
  const passwordConfirmation = usePasswordConfirmation(
    password,
    confirmPassword,
    300
  )

  return (
    <form>
      {/* Password Input */}
      <div>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Validation Feedback */}
        {password && (
          <div>
            {/* Strength Indicator */}
            <div style={{ color: passwordValidation.strengthColor }}>
              Strength: {passwordValidation.strengthText} (
              {passwordValidation.score}/100)
            </div>

            {/* Errors (blocking) */}
            {passwordValidation.errors.map((error: string, i: number) => (
              <div key={i} style={{ color: 'red' }}>
                ❌ {error}
              </div>
            ))}

            {/* Warnings (non-blocking) */}
            {passwordValidation.warnings.map((warning: string, i: number) => (
              <div key={i} style={{ color: 'orange' }}>
                ⚠️ {warning}
              </div>
            ))}

            {/* Positive Feedback */}
            {passwordValidation.feedback.map((fb: string, i: number) => (
              <div key={i} style={{ color: 'green' }}>
                ✓ {fb}
              </div>
            ))}

            {/* Loading state during debounce */}
            {passwordValidation.isValidating && <div>Validating...</div>}
          </div>
        )}
      </div>

      {/* Confirm Password Input */}
      <div>
        <label>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {/* Confirmation Feedback */}
        {confirmPassword && (
          <div>
            {passwordConfirmation.isMatching && (
              <div style={{ color: 'green' }}>✓ Passwords match</div>
            )}
            {passwordConfirmation.showMismatch && (
              <div style={{ color: 'red' }}>
                ❌ {passwordConfirmation.error}
              </div>
            )}
            {passwordConfirmation.isValidating && <div>Checking...</div>}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={
          !passwordValidation.valid ||
          !passwordConfirmation.isMatching ||
          passwordValidation.isValidating ||
          passwordConfirmation.isValidating
        }
      >
        Register
      </button>
    </form>
  )
}

export default PasswordRegistrationForm
