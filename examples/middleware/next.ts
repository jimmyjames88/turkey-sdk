import type { NextRequest } from 'next/server'
import { verifyJwt } from '../../src/server/verify'

export async function exampleNextMiddleware(request: NextRequest, config: any) {
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer '))
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 401,
    })
  const token = auth.slice(7)
  try {
    const payload = await verifyJwt(token, config)
    // You can use payload to enforce role-based access
    return new Response(JSON.stringify({ ok: true, user: payload }))
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 401 })
  }
}
