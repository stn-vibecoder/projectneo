import { NextResponse, type NextRequest } from "next/server";
import { isLoginEnabled } from "@/lib/env";
import { supabaseProxy } from "@/lib/supabase/proxy";

/**
 * Uten innlogging (standard): rett inn i appen.
 * Med innlogging (NEXT_PUBLIC_REQUIRE_LOGIN=true): fornyer sesjonen og
 * sender ikke-innloggede til /login.
 */
export function proxy(request: NextRequest) {
  if (isLoginEnabled()) return supabaseProxy(request);

  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
