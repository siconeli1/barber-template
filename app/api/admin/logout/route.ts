import { NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE_NAME } from '@/lib/admin-session'

export async function POST() {
  const response = NextResponse.json({ ok: true })

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })

  return response
}
