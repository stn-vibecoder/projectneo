import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, isAllowedEmail, isPublicPath, type AuthMode } from "@/lib/env";

/**
 * Brukes når innlogging er slått på (ikke i lokal modus): fornyer sesjonen
 * og sender ikke-innloggede til /login på sider som ikke er åpne.
 */
export async function supabaseProxy(request: NextRequest, mode: AuthMode) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Viktig: ingen kode mellom createServerClient og getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedIn = Boolean(user && isAllowedEmail(user.email));

  // Forsiden: Oversikt for innloggede, stillingene for besøkende.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(signedIn ? "/dashboard" : mode === "required" ? "/login" : "/feed", request.url));
  }
  if (signedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!signedIn && !isPublicPath(pathname, mode)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    if (user) url.search += "&error=forbidden"; // innlogget, men ikke på ALLOWED_EMAILS
    return NextResponse.redirect(url);
  }
  return response;
}
