/**
 * Password validation utilities for Turkey SDK
 */

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  score: number // 0-100 strength score
}

export interface PasswordRequirements {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  specialChars: string
}

// Default requirements that match Turkey server
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '@$!%*?&',
}

/**
 * Validate password against Turkey's requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult {
  const errors: string[] = []
  let score = 0

  // Length check
  if (password.length < requirements.minLength) {
    errors.push(
      `Password must be at least ${requirements.minLength} characters`
    )
  } else {
    score += 20
  }

  // Uppercase check
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else if (/[A-Z]/.test(password)) {
    score += 15
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
    }
  }

  // Bonus points for additional complexity
  if (password.length >= 12) score += 10
  if (/[A-Z].*[A-Z]/.test(password)) score += 5
  if (/\d.*\d/.test(password)) score += 5
  if (
    new RegExp(
      `[${requirements.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}].*[${requirements.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
    ).test(password)
  )
    score += 5

  return {
    valid: errors.length === 0,
    errors,
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
