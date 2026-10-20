
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, validarToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica a sessão.
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const sessao = token ? await validarToken(token) : null;

    if (!sessao) {
      return NextResponse.json(
        { erro: "Autenticação necessária." },
        { status: 401 }
      );
    }

    // 2. Confere a identidade e as permissões no banco.
    const usuario = await prisma.usuario.findUnique({
      where: { id: sessao.id },
      select: {
        usuario: true,
        tipo: true,
        status: true,
      },
    });

    if (
      !usuario ||
      usuario.status !== "ATIVO" ||
      usuario.usuario !== sessao.usuario ||
      usuario.tipo !== sessao.tipo ||
      usuario.tipo !== "DESENVOLVEDOR"
    ) {
      return NextResponse.json(
        { erro: "Acesso exclusivo do desenvolvedor." },
        { status: 403 }
      );
    }

    // 3. Verifica se o PostgreSQL responde.
    try {
      await prisma.$queryRaw`SELECT 1`;

      return NextResponse.json(
        {
          sistema: "online",
          banco: "conectado",
          verificadoEm: new Date().toISOString(),
        },
        {
          headers: { "Cache-Control": "no-store" },
        }
      );
    } catch (erro) {
      console.error("Falha na conexão com o PostgreSQL:", erro);

      return NextResponse.json(
        {
          sistema: "degradado",
          banco: "indisponível",
          verificadoEm: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
  } catch (erro) {
    console.error("Erro na API de manutenção:", erro);

    return NextResponse.json(
      { erro: "Erro interno na verificação técnica." },
      { status: 500 }
    );
  }
}
