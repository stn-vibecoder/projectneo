import { NextResponse, type NextRequest } from "next/server";
import { authMode } from "@/lib/env";
import { supabaseProxy } from "@/lib/supabase/proxy";

/**
 * Lokalt (ingen innlogging): rett inn i appen.
 * Med innlogging («optional» eller «required»): fornyer sesjonen og sender
 * ikke-innloggede til /login på sider som krever det (se isPublicPath).
 */
export function proxy(request: NextRequest) {
  const mode = authMode();
  if (mode !== "local") return supabaseProxy(request, mode);

  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
