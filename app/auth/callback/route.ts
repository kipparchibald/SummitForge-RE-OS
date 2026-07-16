// app/auth/callback/route.ts
// Completes magic-link / OAuth sign-in: exchanges the auth code for a session
// cookie, then redirects to the originally requested page.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/auth/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
