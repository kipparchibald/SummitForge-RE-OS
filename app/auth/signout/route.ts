// app/auth/signout/route.ts
// POST /auth/signout — clears the Supabase session and returns to /login.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
