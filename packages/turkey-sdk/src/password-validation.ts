/**
 * Password validation utilities for Turkey SDK
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  score: number // 0-100 strength score
  warnings: string[] // Non-blocking suggestions
  feedback: string[] // Positive feedback
}

export interface PasswordRequirements {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  specialChars: string
  maxLength?: number
  preventCommonPasswords?: boolean
  preventUserInfo?: string[] // Email, username, etc. to prevent in password
  customValidators?: Array<(password: string) => string | null> // Return error message or null
}

// Default requirements that match Turkey server
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '@$!%*?&',
  maxLength: 128,
  preventCommonPasswords: true,
}

// Common weak passwords to prevent
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'passw0rd',
  'shadow',
  'superman',
  'qazwsx',
  'michael',
  'football',
  'welcome',
  'jesus',
  'ninja',
  'mustang',
  'password1',
  'admin',
  'root',
  'test',
  'guest',
])

// Detect sequential characters
function hasSequentialChars(password: string): boolean {
  const sequences = [
    '0123456789',
    'abcdefghijklmnopqrstuvwxyz',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
  ]
  const lower = password.toLowerCase()

  for (const seq of sequences) {
    for (let i = 0; i < seq.length - 2; i++) {
      const substring = seq.substring(i, i + 3)
      if (
        lower.includes(substring) ||
        lower.includes(substring.split('').reverse().join(''))
      ) {
        return true
      }
    }
  }
  return false
}

// Detect repeated characters
function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password)
}

/**
 * Validate password against Turkey's requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const feedback: string[] = []
  let score = 0

  // Empty password
  if (!password) {
    return {
      valid: false,
      errors: ['Password is required'],
      warnings: [],
      feedback: [],
      score: 0,
    }
  }

  // Max length check
  if (requirements.maxLength && password.length > requirements.maxLength) {
    errors.push(`Password must not exceed ${requirements.maxLength} characters`)
  }

  // Length check
  if (password.length < requirements.minLength) {
    errors.push(
      `Password must be at least ${requirements.minLength} characters`
    )
  } else {
    score += 20
    if (password.length >= 12) {
      score += 10
      feedback.push('Good length')
    }
  }

  // Uppercase check
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else if (/[A-Z]/.test(password)) {
    score += 15
    if (/[A-Z].*[A-Z]/.test(password)) {
      score += 5
      feedback.push('Multiple uppercase letters')
    }
  }

  // Lowercase check
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  } else if (/[a-z]/.test(password)) {
    score += 15
  }

  // Numbers check
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  } else if (/\d/.test(password)) {
    score += 15
    if (/\d.*\d/.test(password)) {
      score += 5
      feedback.push('Multiple numbers')
    }
  }

  // Special characters check
  if (requirements.requireSpecialChars) {
    const specialCharsRegex = new RegExp(
      `[${requirements.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
    )
    if (!specialCharsRegex.test(password)) {
      errors.push(
        `Password must contain at least one special character (${requirements.specialChars})`
      )
    } else {
      score += 15
      if (
        new RegExp(
          `[${requirements.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}].*[${requirements.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
        ).test(password)
      ) {
        score += 5
        feedback.push('Multiple special characters')
      }
    }
  }

  // Check for common passwords
  if (
    requirements.preventCommonPasswords &&
    COMMON_PASSWORDS.has(password.toLowerCase())
  ) {
    errors.push('This password is too common and easily guessable')
    score = Math.max(0, score - 30)
  }

  // Check for user info in password
  if (requirements.preventUserInfo && requirements.preventUserInfo.length > 0) {
    for (const info of requirements.preventUserInfo) {
      if (
        info &&
        info.length >= 3 &&
        password.toLowerCase().includes(info.toLowerCase())
      ) {
        warnings.push('Avoid using personal information in your password')
        score = Math.max(0, score - 15)
        break
      }
    }
  }

  // Check for sequential characters
  if (hasSequentialChars(password)) {
    warnings.push('Avoid sequential characters (e.g., "abc", "123")')
    score = Math.max(0, score - 10)
  }

  // Check for repeated characters
  if (hasRepeatedChars(password)) {
    warnings.push('Avoid repeated characters (e.g., "aaa", "111")')
    score = Math.max(0, score - 10)
  }

  // Custom validators
  if (requirements.customValidators) {
    for (const validator of requirements.customValidators) {
      const error = validator(password)
      if (error) {
        errors.push(error)
        score = Math.max(0, score - 10)
      }
    }
  }

  // Bonus for variety
  const uniqueChars = new Set(password).size
  if (uniqueChars >= password.length * 0.7) {
    score += 5
    feedback.push('Good character variety')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    feedback,
    score: Math.min(100, score),
  }
}

/**
 * Get user-friendly password requirements text
 */
export function getPasswordRequirementsText(
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string {
  const parts = []

  parts.push(`At least ${requirements.minLength} characters`)

  if (requirements.requireUppercase) parts.push('one uppercase letter')
  if (requirements.requireLowercase) parts.push('one lowercase letter')
  if (requirements.requireNumbers) parts.push('one number')
  if (requirements.requireSpecialChars)
    parts.push(`one special character (${requirements.specialChars})`)

  return `Password must contain ${parts.join(', ')}`
}

/**
 * Get strength text and color from score
 */
export function getPasswordStrength(score: number): {
  text: string
  color: 'error' | 'warning' | 'info' | 'success'
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong'
} {
  if (score >= 80) {
    return { text: 'Strong', color: 'success', level: 'strong' }
  } else if (score >= 60) {
    return { text: 'Good', color: 'info', level: 'good' }
  } else if (score >= 40) {
    return { text: 'Fair', color: 'warning', level: 'fair' }
  } else if (score >= 20) {
    return { text: 'Weak', color: 'warning', level: 'weak' }
  } else {
    return { text: 'Very Weak', color: 'error', level: 'very-weak' }
  }
}

/**
 * Generate a secure password that meets requirements
 */
export function generateSecurePassword(
  length: number = 12,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const special = requirements.specialChars

  let charset = ''
  let password = ''

  // Ensure at least one character from each required set
  if (requirements.requireLowercase) {
    charset += lowercase
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
  }

  if (requirements.requireUppercase) {
    charset += uppercase
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
  }

  if (requirements.requireNumbers) {
    charset += numbers
    password += numbers[Math.floor(Math.random() * numbers.length)]
  }

  if (requirements.requireSpecialChars) {
    charset += special
    password += special[Math.floor(Math.random() * special.length)]
  }

  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
