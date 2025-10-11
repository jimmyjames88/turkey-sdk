import type { Request, Response, NextFunction } from 'express'
import { verifyJwt } from '../../src/server/verify'

// Example Express middleware factory
export function turkeyAuthMiddleware(config: any) {
  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      const auth = req.headers.authorization || ''
      if (!auth.startsWith('Bearer '))
        return res.status(401).json({ error: 'Missing token' })
      const token = auth.slice(7)
      const payload = await verifyJwt(token, config)
      // attach user to request
      ;(req as any).user = payload
      next()
    } catch (err: any) {
      res.status(401).json({ error: err.message })
    }
  }
}
