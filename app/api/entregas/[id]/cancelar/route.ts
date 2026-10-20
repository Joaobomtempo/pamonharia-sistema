import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { autorizarUsuario } from "../../../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ id: string }>;
};

function falha(erro: string, status = 400) {
  return NextResponse.json({ erro }, { status });
}

export async function POST(request: NextRequest, contexto: Contexto) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO", "FUNCIONARIO"]);
    if (!acesso.ok) {
      return falha(acesso.erro, acesso.status);
    }

    const { id: idTexto } = await contexto.params;
    const id = Number(idTexto);
    if (!/^\d+$/.test(idTexto) || !Number.isSafeInteger(id) || id <= 0) {
      return falha("Movimentação inválida.");
    }

    const body = await request.json().catch(() => null);
    const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
    if (motivo.length < 10 || motivo.length > 500) {
      return falha("Informe uma justificativa entre 10 e 500 caracteres.");
    }

    const resultado = await prisma.$transaction(
      async (tx) => {
        const entrega = await tx.entrega.findUnique({
          where: { id },
          include: {
            devolucoes: { select: { id: true } },
            acerto: {
              select: {
                id: true,
                pagamentoId: true,
                devolucaoId: true,
                valorDevido: true,
              },
            },
          },
        });

        if (!entrega) throw new Error("NAO_ENCONTRADA");
        if (entrega.canceladoEm) throw new Error("JA_CANCELADA");
        if (!entrega.acerto) throw new Error("SEM_ACERTO");
        if (entrega.acerto.pagamentoId !== null) throw new Error("PAGAMENTO_VINCULADO");
        if (entrega.status === "FINALIZADA") throw new Error("FINALIZADA");
        if (entrega.devolucoes.length > 0) throw new Error("DEVOLUCOES_VINCULADAS");
        if (entrega.acerto.devolucaoId !== null) throw new Error("DEVOLUCAO_NO_ACERTO");

        const alterados = await tx.entrega.updateMany({
          where: { id, canceladoEm: null },
          data: {
            canceladoEm: new Date(),
            canceladoPorId: acesso.usuario.id,
            motivoCancelamento: motivo,
          },
        });
        if (alterados.count !== 1) throw new Error("JA_CANCELADA");

        await tx.historico.create({
          data: {
            tabelaAfetada: "Entrega",
            registroId: id,
            acao: "EXCLUIDO",
            realizadoPorId: acesso.usuario.id,
            motivo,
            dadosAnteriores: {
              codigo: entrega.codigo,
              padariaId: entrega.padariaId,
              status: entrega.status,
              acertoId: entrega.acerto.id,
              valorDevido: String(entrega.acerto.valorDevido),
            },
            dadosNovos: { cancelado: true, motivoCancelamento: motivo },
          },
        });

        return { id, codigo: entrega.codigo, cancelado: true };
      },
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json(resultado);
  } catch (erro) {
    if (erro instanceof Error) {
      const mensagens: Record<string, [string, number]> = {
        NAO_ENCONTRADA: ["Movimentação não encontrada.", 404],
        JA_CANCELADA: ["Movimentação já cancelada.", 409],
        SEM_ACERTO: ["Movimentação sem acerto financeiro. Solicite regularização.", 409],
        PAGAMENTO_VINCULADO: ["Existe um fechamento financeiro vinculado. Cancelamento bloqueado.", 409],
        FINALIZADA: ["Movimentação finalizada. Solicite regularização ao DONO.", 409],
        DEVOLUCOES_VINCULADAS: ["Existem devoluções vinculadas a esta entrega.", 409],
        DEVOLUCAO_NO_ACERTO: ["Esta movimentação contém devolução. O cancelamento conjunto ainda não está disponível.", 409],
      };
      const conhecida = mensagens[erro.message];
      if (conhecida) return falha(conhecida[0], conhecida[1]);
      if ("code" in erro && erro.code === "P2034") {
        return falha("Conflito entre operações. Atualize os dados e tente novamente.", 409);
      }
    }
    console.error("Erro ao cancelar movimentação:", erro);
    return falha("Erro interno ao cancelar movimentação.", 500);
  }
}
