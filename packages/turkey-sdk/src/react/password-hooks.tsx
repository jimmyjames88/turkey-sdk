import { useState, useEffect, useMemo } from 'react'
import {
  validatePassword,
  getPasswordStrength,
  type PasswordValidationResult,
  DEFAULT_PASSWORD_REQUIREMENTS,
  type PasswordRequirements,
} from '../password-validation'

/**
 * React hook for real-time password validation with debouncing
 */
export function usePasswordValidation(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
  debounceMs: number = 300
): PasswordValidationResult & {
  strengthText: string
  strengthColor: 'error' | 'warning' | 'info' | 'success'
  strengthLevel: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong'
  isValidating: boolean
} {
  const [validationResult, setValidationResult] =
    useState<PasswordValidationResult>({
      valid: false,
      errors: [],
      warnings: [],
      feedback: [],
      score: 0,
    })
  const [isValidating, setIsValidating] = useState(false)

  // Debounced validation
  useEffect(() => {
    if (!password) {
      setValidationResult({
        valid: false,
        errors: [],
        warnings: [],
        feedback: [],
        score: 0,
      })
      setIsValidating(false)
      return
    }

    setIsValidating(true)
    const timeoutId = setTimeout(() => {
      setValidationResult(validatePassword(password, requirements))
      setIsValidating(false)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [password, requirements, debounceMs])

  const strengthInfo = useMemo(() => {
    return getPasswordStrength(validationResult.score)
  }, [validationResult.score])

  return {
    ...validationResult,
    strengthText: strengthInfo.text,
    strengthColor: strengthInfo.color,
    strengthLevel: strengthInfo.level,
    isValidating,
  }
}

/**
 * React hook for password confirmation validation with debouncing
 */
export function usePasswordConfirmation(
  password: string,
  confirmPassword: string,
  debounceMs: number = 300
): {
  isMatching: boolean
  showMismatch: boolean
  error: string | undefined
  isValidating: boolean
} {
  const [isMatching, setIsMatching] = useState(false)
  const [showMismatch, setShowMismatch] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    if (!confirmPassword) {
      setIsMatching(false)
      setShowMismatch(false)
      setIsValidating(false)
      return
    }

    setIsValidating(true)
    const timeoutId = setTimeout(() => {
      const matches = password === confirmPassword
      setIsMatching(matches)
      setShowMismatch(confirmPassword.length > 0 && !matches)
      setIsValidating(false)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [password, confirmPassword, debounceMs])

  return {
    isMatching,
    showMismatch,
    error: showMismatch ? 'Passwords do not match' : undefined,
    isValidating,
  }
}
