import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware — runs on every request matched by `config.matcher`.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie so it stays valid.
 *  2. Redirect unauthenticated users to /login.
 *  3. Reject authenticated users whose email is not on the whitelist.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — do not add any logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && !isPublicRoute) {
    // Check whitelist — any authenticated user can read their own row via RLS.
    const { data: whitelisted } = await supabase
      .from("whitelisted_emails")
      .select("*")
      .eq("email", user.email ?? "")
      .maybeSingle();

    if (!whitelisted) {
      // Signed in but not whitelisted — sign out and redirect to login with error
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "not_whitelisted");
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|teams/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
