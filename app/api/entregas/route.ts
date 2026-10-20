import { NextRequest, NextResponse } from "next/server";
import { autorizarUsuario } from "../../../lib/autorizarUsuario";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Lista apenas entregas ativas. Entregas canceladas continuam preservadas
 * no banco e na auditoria, mas não participam de novas movimentações.
 * A criação de entregas deve passar pela API de movimentações, que registra
 * o acerto financeiro e a auditoria na mesma transação.
 */
export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) {
      return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    }

    // Consulta completa apenas para o proprietário no Histórico.
    const incluirCanceladas = request.nextUrl.searchParams.get("incluirCanceladas") === "1" && acesso.usuario.tipo === "DONO";
    const entregas = await prisma.entrega.findMany({
      where: incluirCanceladas ? {} : { canceladoEm: null },
      include: {
        padaria: true,
        itens: {
          include: {
            produto: true,
            itensDevolucao: {
              where: { devolucao: { canceladoEm: null } },
              select: { quantidadeDevolvida: true },
            },
          },
        },
      },
      orderBy: [{ dataEntrega: "desc" }, { id: "desc" }],
    });

    return NextResponse.json(entregas, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (erro) {
    console.error("Erro ao consultar entregas:", erro);
    return NextResponse.json({ erro: "Erro ao consultar entregas." }, { status: 500 });
  }
}

/**
 * Impede o fluxo legado, que criava entregas sem acerto e sem auditoria.
 * O formulário atual utiliza POST /api/movimentacoes.
 */
export async function POST(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) {
      return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    }

    return NextResponse.json(
      {
        erro: "Registre entregas em Movimentações. A criação direta foi desativada para proteger os acertos financeiros.",
      },
      { status: 409 }
    );
  } catch (erro) {
    console.error("Erro ao validar criação de entrega:", erro);
    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}
