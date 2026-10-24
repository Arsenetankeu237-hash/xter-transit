import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy Next 16 (ex-middleware) : redirige vers /connexion toute requête
 * vers l'espace staff ou l'espace client sans cookie de session.
 * La vérification complète (session valide en base, rôles) se fait côté serveur
 * dans les layouts et les server actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/admin") || pathname.startsWith("/espace-client");

  if (isProtected && !request.cookies.get("xter_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/espace-client/:path*"],
};
