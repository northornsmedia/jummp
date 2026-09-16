import { NextRequest, NextResponse } from 'next/server';
import {
  validateAdminCredentials,
  createAdminSessionToken,
  getAdminSessionFromRequest,
  SESSION_COOKIE_NAME,
} from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const isValid = validateAdminCredentials(String(username).trim(), String(password).trim());
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin username or password' },
        { status: 401 }
      );
    }

    const sessionToken = createAdminSessionToken(String(username).trim());

    const res = NextResponse.json({
      success: true,
      message: 'Admin session established',
      token: sessionToken,
    });

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const isAuthenticated = getAdminSessionFromRequest(req);
  return NextResponse.json({
    authenticated: isAuthenticated,
  });
}

export async function DELETE() {
  const res = NextResponse.json({
    success: true,
    message: 'Admin session logged out',
  });

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return res;
}
