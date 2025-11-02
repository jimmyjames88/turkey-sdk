// Core middleware exports
export {
  createTurkeyMiddleware,
  turkeyAuth,
  requireAuth,
  optionalAuth,
} from './core'

// Next.js-specific exports
export { getTurkeyUser, verifyNextJwt, extractNextToken } from './nextjs'

export type { NextTurKeyUser, NextTurKeyConfig } from './nextjs'

// Type exports
export type {
  TurKeyUser,
  TurKeyPayload,
  TurKeyAuthenticatedRequest,
  TurKeyMiddlewareConfig,
  ExpressAuthRequest,
  NextAuthRequest,
} from './types'
