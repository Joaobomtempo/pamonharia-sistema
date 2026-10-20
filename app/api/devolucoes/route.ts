import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { autorizarUsuario } from "../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

const respostaErro = (erro: string, status = 400) =>
  NextResponse.json({ erro }, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * Consulta historica de devolucoes sem expor credenciais dos usuarios.
 * Registros cancelados permanecem disponiveis para rastreabilidade.
 */
export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) return respostaErro(acesso.erro, acesso.status);

    const devolucoes = await prisma.devolucao.findMany({
      include: {
        entrega: {
          include: {
            padaria: true,
          },
        },
        itens: {
          include: {
            itemEntrega: {
              include: {
                produto: true,
              },
            },
          },
        },
        registradaPor: {
          select: {
            id: true,
            nomeCompleto: true,
            usuario: true,
          },
        },
      },
      orderBy: [{ dataDevolucao: "desc" }, { id: "desc" }],
    });

    return NextResponse.json(devolucoes, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (erro) {
    console.error("Erro ao consultar devolucoes:", erro);
    return respostaErro("Nao foi possivel consultar as devolucoes.", 500);
  }
}

/**
 * A criacao direta anterior podia gerar devolucoes sem atualizar o acerto.
 * Novos registros devem passar pela API transacional de devolucao complementar
 * ou pela API de movimentacoes, conforme o fluxo de negocio.
 */
export async function POST(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) return respostaErro(acesso.erro, acesso.status);

    return respostaErro(
      "O cadastro antigo de devolucoes foi desativado para proteger os acertos financeiros. Utilize a tela Devolucoes (registro complementar) ou registre a devolucao junto da nova movimentacao.",
      409
    );
  } catch (erro) {
    console.error("Erro ao validar cadastro antigo de devolucao:", erro);
    return respostaErro("Erro interno ao validar a operacao.", 500);
  }
}
