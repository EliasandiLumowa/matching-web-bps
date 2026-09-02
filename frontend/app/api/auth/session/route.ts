import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Tanya ke Strapi, "Token ini milik siapa?"
    const userRes = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const userData = await userRes.json();

    // Kembalikan nama (username) dan email user tersebut
    return NextResponse.json({
      user: {
        username: userData.username,
        email: userData.email
      }
    });

  } catch (error) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}