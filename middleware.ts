// middleware.ts
// Route protection for the whole app.
//
// Fail-closed like lib/auth/cron.ts:
// - DEMO mode: everything is open (preview without a Supabase project).
// - Production + Supabase configured: session required; refreshes tokens.
// - Production + Supabase NOT configured: block with 503 rather than serving
//   the app unauthenticated.
//
// Excluded from protection: /login, /auth/* (the flows that create a session),
// /api/cron/* (bearer-token auth via lib/auth/cron.ts), and static assets.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    !!key &&
    !url.includes('demo.supabase.co') &&
    !url.includes('your-project') &&
    !key.includes('your-anon')
  );
}

const PUBLIC_PATHS = ['/login', '/auth'];

export async function middleware(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Cron endpoints authenticate with their own bearer secret.
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  if (!isSupabaseConfigured()) {
    return new NextResponse(
      'Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        '(or NEXT_PUBLIC_DEMO_MODE=true for previews).',
      { status: 503 }
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and common static files.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
