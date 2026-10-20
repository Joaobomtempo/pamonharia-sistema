
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validarToken } from "./lib/auth";
import { prisma } from "./lib/prisma";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const metodo = request.method;

  // Rotas públicas necessárias para autenticação.
  if (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout"
  ) {
    return NextResponse.next();
  }

  // Valida a sessão e confere o usuário no banco.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessao = token ? await validarToken(token) : null;

  const usuario = sessao
    ? await prisma.usuario.findUnique({
        where: { id: sessao.id },
        select: {
          usuario: true,
          tipo: true,
          status: true,
        },
      })
    : null;

  const valido =
    sessao &&
    usuario &&
    usuario.status === "ATIVO" &&
    usuario.usuario === sessao.usuario &&
    usuario.tipo === sessao.tipo;

  if (!valido) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { erro: "Autenticação necessária." },
        { status: 401 }
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const resposta = NextResponse.redirect(url);
    resposta.cookies.delete(SESSION_COOKIE);

    return resposta;
  }

  // A sessão autenticada sempre pode consultar seu perfil.
  if (pathname === "/api/auth/me") {
    return NextResponse.next();
  }

  // FUNCIONÁRIO:
  // Pode registrar movimentações e devoluções,
  // consultar histórico e emitir comprovantes.
  if (sessao.tipo === "FUNCIONARIO") {
    const paginasPermitidas = [
      "/entregas",
      "/devolucoes",
      "/historico",
      "/suporte",
    ];

    const paginaPermitida =
      paginasPermitidas.includes(pathname);

    const apiOperacional =
      (
        pathname === "/api/entregas" ||
        pathname === "/api/devolucoes" ||
        pathname === "/api/movimentacoes"
      ) &&
      (metodo === "GET" || metodo === "POST");

    const apiConsulta =
      (
        pathname === "/api/padarias" ||
        pathname === "/api/produtos"
      ) &&
      metodo === "GET";

    const apiComprovante =
      /^\/api\/comprovantes\/\d+$/.test(pathname) &&
      metodo === "GET";

    const permitido =
      paginaPermitida ||
      apiOperacional ||
      apiConsulta ||
      apiComprovante;

    if (!permitido) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { erro: "Acesso exclusivo do proprietário." },
          { status: 403 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/entregas";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  // DESENVOLVEDOR:
  // Acesso restrito à manutenção técnica e ao suporte.
  if (sessao.tipo === "DESENVOLVEDOR") {
    const paginaPermitida =
      pathname === "/manutencao" ||
      pathname === "/suporte";

    const apiPermitida =
      pathname === "/api/manutencao";

    if (!paginaPermitida && !apiPermitida) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { erro: "Acesso técnico restrito." },
          { status: 403 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/manutencao";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  // DONO:
  // Acesso administrativo, exceto manutenção técnica.
  if (sessao.tipo === "DONO") {
    const manutencao =
      pathname === "/manutencao" ||
      pathname === "/api/manutencao";

    if (manutencao) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { erro: "Acesso exclusivo do desenvolvedor." },
          { status: 403 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2)$).*)",
  ],
};

