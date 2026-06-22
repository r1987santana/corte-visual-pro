import { NextResponse, type NextRequest } from "next/server";

const APEX_HOST = "rdsssantanagroup.com";
const CANONICAL_HOST = "www.rdsssantanagroup.com";
const TURQUESA_APEX_HOST = "turquesarestaurante.com";
const TURQUESA_CANONICAL_HOST = "www.turquesarestaurante.com";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase().split(":")[0];

  if (host === APEX_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  if (host === TURQUESA_APEX_HOST) {
    const url = request.nextUrl.clone();
    url.hostname = TURQUESA_CANONICAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  if (host === TURQUESA_CANONICAL_HOST && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/turquesa-web";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|rdwood-icon.svg|manifest.json|sw.js|.*\\.(?:avif|css|gif|ico|jpg|jpeg|js|map|png|svg|webp)$).*)",
  ],
};
