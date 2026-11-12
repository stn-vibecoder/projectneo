import { NextResponse, type NextRequest } from "next/server";

/**
 * LOKAL MODUS: ingen innlogging. Innloggingssidene sender rett til appen.
 *
 * Når Supabase-innlogging slås på, bytt innholdet til:
 *   return supabaseProxy(request);   // fra "@/lib/supabase/proxy"
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
