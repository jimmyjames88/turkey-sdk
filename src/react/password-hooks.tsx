import { useState, useEffect, useMemo } from 'react'
import {
  validatePassword,
  type PasswordValidationResult,
  DEFAULT_PASSWORD_REQUIREMENTS,
  type PasswordRequirements,
} from '../password-validation'

/**
 * React hook for real-time password validation
 */
export function usePasswordValidation(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult & {
  strengthText: string
  strengthColor: 'error' | 'warning' | 'info' | 'success'
} {
  const [validationResult, setValidationResult] =
    useState<PasswordValidationResult>({
      valid: false,
      errors: [],
      score: 0,
    })

  useEffect(() => {
    if (password) {
      setValidationResult(validatePassword(password, requirements))
    } else {
      setValidationResult({ valid: false, errors: [], score: 0 })
    }
  }, [password, requirements])

  const strengthInfo = useMemo(() => {
    const { score } = validationResult

    if (score >= 80) {
      return { strengthText: 'Strong', strengthColor: 'success' as const }
    } else if (score >= 60) {
      return { strengthText: 'Good', strengthColor: 'info' as const }
    } else if (score >= 40) {
      return { strengthText: 'Weak', strengthColor: 'warning' as const }
    } else {
      return { strengthText: 'Very Weak', strengthColor: 'error' as const }
    }
  }, [validationResult.score])

  return {
    ...validationResult,
    ...strengthInfo,
  }
}

/**
 * React hook for password confirmation validation
 */
export function usePasswordConfirmation(
  password: string,
  confirmPassword: string
) {
  const [isMatching, setIsMatching] = useState(false)
  const [showMismatch, setShowMismatch] = useState(false)

  useEffect(() => {
    const matches = password === confirmPassword
    setIsMatching(matches)
    setShowMismatch(confirmPassword.length > 0 && !matches)
  }, [password, confirmPassword])

  return {
    isMatching,
    showMismatch,
    error: showMismatch ? 'Passwords do not match' : undefined,
  }
}
