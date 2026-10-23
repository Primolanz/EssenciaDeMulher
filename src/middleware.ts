import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  // Normalize a trailing slash so /admin/login/ is also treated as the public login page.
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth-token")?.value;
  const secret = process.env.JWT_SECRET;

  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      return NextResponse.next();
    } catch {
      // Invalid or expired tokens are redirected to the login page.
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
