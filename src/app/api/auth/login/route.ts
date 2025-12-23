import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export type UserRole = 'admin' | 'basic';

interface UserConfig {
  password: string;
  role: UserRole;
}

function getUsers(): Record<string, UserConfig> {
  const adminU = process.env.APP_ADMIN_USERNAME;
  const adminP = process.env.APP_ADMIN_PASSWORD;
  const basicU = process.env.APP_BASIC_USERNAME;
  const basicP = process.env.APP_BASIC_PASSWORD;

  if (!adminU || !adminP || !basicU || !basicP) {
    throw new Error('Missing auth environment variables');
  }

  return {
    [adminU]: { password: adminP, role: 'admin' },
    [basicU]: { password: basicP, role: 'basic' },
  };
}


export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'Brukernavn og passord er påkrevd' }, { status: 400 });
    }

    const users = getUsers();
    const user = users[username];

    if (!user || user.password !== password) {
      return NextResponse.json({ ok: false, error: 'Feil brukernavn eller passord' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, role: user.role, username });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ ok: false, error: 'Serverkonfigurasjon mangler eller intern feil' }, { status: 500 });
  }
}
