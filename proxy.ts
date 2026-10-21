
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validarToken } from "./lib/auth";
import { prisma } from "./lib/prisma";

function respostaApi(erro: string, status: number) {
  return NextResponse.json(
    { erro },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const metodo = request.method;

  // Recursos públicos necessários à instalação da PWA.
  // Não libera nenhuma página ou API administrativa.
  if (
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  // Login e logout gerenciam a própria autenticação.
  if (
    ["/login", "/api/auth/login", "/api/auth/logout"].includes(
      pathname
    )
  ) {
    return NextResponse.next();
  }

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

  const valido = Boolean(
    sessao &&
      usuario &&
      usuario.status === "ATIVO" &&
      usuario.usuario === sessao.usuario &&
      usuario.tipo === sessao.tipo
  );

  if (!valido || !sessao) {
    if (pathname.startsWith("/api/")) {
      return respostaApi("Autenticação necessária.", 401);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";

    const resposta = NextResponse.redirect(url);
    resposta.cookies.delete(SESSION_COOKIE);

    return resposta;
  }

  if (pathname === "/api/auth/me") {
    return metodo === "GET"
      ? NextResponse.next()
      : respostaApi("Método não permitido.", 405);
  }

  if (sessao.tipo === "FUNCIONARIO") {
    const paginaPermitida = [
      "/entregas",
      "/devolucoes",
      "/historico",
      "/suporte",
    ].includes(pathname);

    const apiOperacional =
      [
        "/api/entregas",
        "/api/devolucoes",
        "/api/movimentacoes",
      ].includes(pathname) &&
      ["GET", "POST"].includes(metodo);

    const apiDevolucaoComplementar =
      pathname === "/api/devolucoes/complementar" &&
      metodo === "POST";

    const apiCancelarDevolucao =
      /^\/api\/devolucoes\/\d+\/cancelar$/.test(pathname) &&
      metodo === "POST";

    const apiListarDevolucoes =
      pathname === "/api/devolucoes/cancelaveis" &&
      metodo === "GET";

    const apiCancelarEntrega =
      /^\/api\/entregas\/\d+\/cancelar$/.test(pathname) &&
      metodo === "POST";

    const apiConsulta =
      ["/api/padarias", "/api/produtos"].includes(pathname) &&
      metodo === "GET";

    const apiComprovante =
      /^\/api\/comprovantes\/\d+$/.test(pathname) &&
      metodo === "GET";

    if (
      !(
        paginaPermitida ||
        apiOperacional ||
        apiDevolucaoComplementar ||
        apiCancelarDevolucao ||
        apiListarDevolucoes ||
        apiCancelarEntrega ||
        apiConsulta ||
        apiComprovante
      )
    ) {
      if (pathname.startsWith("/api/")) {
        return respostaApi(
          "Acesso exclusivo do proprietário.",
          403
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/entregas";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  if (sessao.tipo === "DESENVOLVEDOR") {
    const paginaPermitida =
      pathname === "/manutencao" ||
      pathname === "/suporte";

    const apiPermitida =
      pathname === "/api/manutencao";

    if (!paginaPermitida && !apiPermitida) {
      if (pathname.startsWith("/api/")) {
        return respostaApi(
          "Acesso técnico restrito.",
          403
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/manutencao";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  if (
    sessao.tipo === "DONO" &&
    ["/manutencao", "/api/manutencao"].includes(pathname)
  ) {
    if (pathname.startsWith("/api/")) {
      return respostaApi(
        "Acesso exclusivo do desenvolvedor.",
        403
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";

    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2)$).*)",
  ],
};
