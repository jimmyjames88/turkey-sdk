/**
 * TurKey SDK - Profile Management Examples
 *
 * Demonstrates user profile update, password change, and account deletion
 */

/* eslint-disable no-console */

import { TurKeyClient, ValidationError, AuthenticationError } from '../src'

const client = new TurKeyClient({
  baseUrl: 'http://localhost:3000',
  appId: 'my-app',
})

// Example 1: Update user email
async function updateUserEmail() {
  try {
    // Assume user is already logged in and has an access token
    const accessToken = 'user-access-token'

    const result = await client.updateProfile(accessToken, {
      email: 'newemail@example.com',
    })

    console.log('✅ Email updated successfully')
    console.log('Updated user:', result.user)
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation error:', error.details)
    } else if (error instanceof AuthenticationError) {
      console.error('❌ Token expired or invalid - please log in again')
    } else {
      console.error('❌ Failed to update email:', error)
    }
  }
}

// Example 2: Change password with validation
async function changeUserPassword() {
  try {
    const accessToken = 'user-access-token'

    const result = await client.changePassword(accessToken, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewSecurePassword456!',
    })

    console.log('✅', result.message)
    console.log('Requires reauthentication:', result.requiresReauthentication)

    // Note: After changing password, all refresh tokens are revoked
    // User must log in again on all devices
    if (result.requiresReauthentication) {
      console.log('🔄 Redirecting to login...')
      // Redirect to login page or show login modal
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      // Display field-specific errors
      error.details?.forEach((detail) => {
        console.error(`Field ${detail.field}: ${detail.message}`)
      })
    } else if (error instanceof AuthenticationError) {
      console.error('❌ Current password is incorrect or token expired')
    } else {
      console.error('❌ Failed to change password:', error)
    }
  }
}

// Example 3: Change password with client-side validation
async function changePasswordWithValidation(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  // Client-side validation before API call
  if (newPassword !== confirmPassword) {
    throw new ValidationError('Passwords do not match', {
      details: [
        {
          field: 'confirmPassword',
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH',
        },
      ],
    })
  }

  if (currentPassword === newPassword) {
    throw new ValidationError(
      'New password must be different from current password',
      {
        details: [
          {
            field: 'newPassword',
            message: 'New password must be different from current password',
            code: 'PASSWORD_SAME',
          },
        ],
      }
    )
  }

  // SDK will validate password strength automatically
  const result = await client.changePassword(accessToken, {
    currentPassword,
    newPassword,
  })

  return result
}

// Example 4: Delete account with confirmation
async function deleteUserAccount() {
  try {
    const accessToken = 'user-access-token'

    // Show confirmation dialog first
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    )

    if (!confirmed) {
      console.log('Account deletion cancelled')
      return
    }

    const result = await client.deleteAccount(accessToken)

    console.log('✅', result.message)
    console.log('Deleted account:', result.deletedUser)

    // Redirect to homepage or goodbye page
    console.log('👋 Redirecting to homepage...')
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('❌ Token expired or invalid - please log in again')
    } else {
      console.error('❌ Failed to delete account:', error)
    }
  }
}

// Example 5: Complete profile update flow with React
interface ProfileFormData {
  email: string
}

async function handleProfileUpdate(
  accessToken: string,
  formData: ProfileFormData,
  setError: (field: string, message: string) => void,
  onSuccess: (message: string) => void
) {
  try {
    const result = await client.updateProfile(accessToken, {
      email: formData.email,
    })

    onSuccess('Profile updated successfully!')

    return result.user
  } catch (error) {
    if (error instanceof ValidationError && error.details) {
      // Display field-specific errors
      error.details.forEach((detail) => {
        setError(detail.field, detail.message)
      })
    } else if (error instanceof AuthenticationError) {
      setError('general', 'Your session has expired. Please log in again.')
    } else {
      setError('general', 'Failed to update profile. Please try again.')
    }
    throw error
  }
}

// Example 6: Password change with form validation
interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

async function handlePasswordChange(
  accessToken: string,
  formData: PasswordFormData,
  setError: (field: string, message: string) => void,
  onSuccess: (requiresReauth: boolean) => void
) {
  // Clear previous errors
  setError('currentPassword', '')
  setError('newPassword', '')
  setError('confirmPassword', '')

  // Client-side validation
  if (!formData.currentPassword) {
    setError('currentPassword', 'Current password is required')
    return
  }

  if (!formData.newPassword) {
    setError('newPassword', 'New password is required')
    return
  }

  if (formData.newPassword !== formData.confirmPassword) {
    setError('confirmPassword', 'Passwords do not match')
    return
  }

  if (formData.currentPassword === formData.newPassword) {
    setError(
      'newPassword',
      'New password must be different from current password'
    )
    return
  }

  try {
    const result = await client.changePassword(accessToken, {
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    })

    onSuccess(result.requiresReauthentication)
  } catch (error) {
    if (error instanceof ValidationError && error.details) {
      // Server-side validation errors
      error.details.forEach((detail) => {
        setError(detail.field, detail.message)
      })
    } else if (error instanceof AuthenticationError) {
      setError('currentPassword', 'Current password is incorrect')
    } else {
      setError('general', 'Failed to change password. Please try again.')
    }
    throw error
  }
}

// Example 7: Account deletion with double confirmation
async function handleAccountDeletion(
  accessToken: string,
  userEmail: string,
  confirmationEmail: string,
  onSuccess: () => void,
  onError: (message: string) => void
) {
  // First confirmation: email match
  if (confirmationEmail !== userEmail) {
    onError('Email does not match. Please type your email to confirm.')
    return
  }

  // Second confirmation: final warning
  const finalConfirm = confirm(
    'This will permanently delete your account and all associated data. ' +
      'This action cannot be undone. Are you absolutely sure?'
  )

  if (!finalConfirm) {
    console.log('Account deletion cancelled')
    return
  }

  try {
    await client.deleteAccount(accessToken)
    onSuccess()
  } catch (error) {
    if (error instanceof AuthenticationError) {
      onError('Your session has expired. Please log in to delete your account.')
    } else {
      onError('Failed to delete account. Please try again or contact support.')
    }
  }
}

// Example 8: Get current user and update profile in one flow
async function getUserAndUpdateProfile(accessToken: string, newEmail: string) {
  try {
    // First, get current user info
    const currentUser = await client.getCurrentUser(accessToken)
    console.log('Current user:', currentUser)

    // Check if email is actually changing
    if (currentUser.email === newEmail) {
      console.log('Email is already set to:', newEmail)
      return currentUser
    }

    // Update email
    const result = await client.updateProfile(accessToken, { email: newEmail })
    console.log(
      '✅ Email updated from',
      currentUser.email,
      'to',
      result.user.email
    )

    return result.user
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

// Export all examples
export {
  updateUserEmail,
  changeUserPassword,
  changePasswordWithValidation,
  deleteUserAccount,
  handleProfileUpdate,
  handlePasswordChange,
  handleAccountDeletion,
  getUserAndUpdateProfile,
}
