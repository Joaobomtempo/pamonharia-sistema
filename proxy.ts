import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validarToken } from "./lib/auth";
import { prisma } from "./lib/prisma";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await validarToken(token) : null;
  const usuario = session ? await prisma.usuario.findUnique({ where: { id: session.id }, select: { usuario: true, tipo: true, status: true } }) : null;
  const valido = session && usuario && usuario.status === "ATIVO" && usuario.usuario === session.usuario && usuario.tipo === session.tipo;
  if (!valido) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Autenticação necessária." }, { status: 401 });
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    const resposta = NextResponse.redirect(url); resposta.cookies.delete(SESSION_COOKIE);
    return resposta;
  }
  if (session.tipo === "FUNCIONARIO") {
    const permitted = pathname === "/entregas" || pathname === "/devolucoes" || pathname === "/suporte" || pathname === "/api/auth/me" ||
      ((pathname === "/api/entregas" || pathname === "/api/devolucoes" || pathname === "/api/movimentacoes") && (request.method === "GET" || request.method === "POST")) ||
      ((pathname === "/api/padarias" || pathname === "/api/produtos") && request.method === "GET");
    if (!permitted) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Acesso exclusivo do dono." }, { status: 403 });
      const url = request.nextUrl.clone(); url.pathname = "/entregas"; url.search = "";
      return NextResponse.redirect(url);
    }
  }
  if (session.tipo === "DESENVOLVEDOR") {
    const permitted = pathname === "/manutencao" || pathname === "/api/manutencao" || pathname === "/suporte" || pathname === "/api/auth/me";
    if (!permitted) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "Acesso técnico restrito." }, { status: 403 });
      const url = request.nextUrl.clone(); url.pathname = "/manutencao"; url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2)$).*)"],
};
