import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { autorizarUsuario } from "../../../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

const falha = (erro: string, status = 400) => NextResponse.json({ erro }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acesso = await autorizarUsuario(request, ["DONO"]);
  if (!acesso.ok) return falha(acesso.erro, acesso.status);

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || !/^\d+$/.test(raw)) return falha("Fechamento inválido.");

  const body = await request.json().catch(() => null);
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  if (motivo.length < 10 || motivo.length > 500) return falha("Informe uma justificativa de 10 a 500 caracteres.");

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const pagamento = await tx.pagamento.findUnique({
        where: { id },
        include: {
          acertos: {
            select: { id: true, entregaId: true, quantidadeEntregue: true, quantidadeDevolvida: true, valorBruto: true, valorDevolvido: true, valorDevido: true },
          },
          itens: { select: { id: true } },
        },
      });
      if (!pagamento) throw new Error("NAO_ENCONTRADO");
      if (pagamento.status !== "PENDENTE" || pagamento.canceladoEm) throw new Error("NAO_PENDENTE");
      if (pagamento.valorRecebido !== null || pagamento.dataPagamento !== null) throw new Error("RECEBIMENTO_EXISTENTE");
      if (pagamento.itens.length > 0) throw new Error("MODELO_LEGADO");
      if (pagamento.acertos.length === 0) throw new Error("SEM_ACERTOS");

      // Registra um retrato imutável do fechamento antes de desvincular os acertos.
      const acertosAnteriores = pagamento.acertos.map((a) => ({
        id: a.id,
        entregaId: a.entregaId,
        quantidadeEntregue: a.quantidadeEntregue,
        quantidadeDevolvida: a.quantidadeDevolvida,
        valorBruto: String(a.valorBruto),
        valorDevolvido: String(a.valorDevolvido),
        valorDevido: String(a.valorDevido),
      }));
      const agora = new Date();
      const alterado = await tx.pagamento.updateMany({
        where: { id, status: "PENDENTE", canceladoEm: null, valorRecebido: null, dataPagamento: null },
        data: { status: "CANCELADO", canceladoEm: agora, canceladoPorId: acesso.usuario.id, motivoCancelamento: motivo },
      });
      if (alterado.count !== 1) throw new Error("CONCORRENCIA");

      const liberados = await tx.acertoMovimentacao.updateMany({
        where: { pagamentoId: id, id: { in: pagamento.acertos.map((a) => a.id) } },
        data: { pagamentoId: null },
      });
      if (liberados.count !== pagamento.acertos.length) throw new Error("CONCORRENCIA");

      await tx.historico.create({
        data: {
          tabelaAfetada: "Pagamento",
          registroId: id,
          acao: "EXCLUIDO",
          realizadoPorId: acesso.usuario.id,
          motivo,
          dadosAnteriores: {
            status: pagamento.status,
            valorDevido: String(pagamento.valorDevido),
            padariaId: pagamento.padariaId,
            dataInicio: pagamento.dataInicio.toISOString(),
            dataFim: pagamento.dataFim.toISOString(),
            acertos: acertosAnteriores,
          },
          dadosNovos: { status: "CANCELADO", canceladoEm: agora.toISOString(), acertosLiberados: liberados.count },
        },
      });
      return { id, status: "CANCELADO", acertosLiberados: liberados.count };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ mensagem: "Fechamento cancelado. Acertos liberados para correção.", ...resultado });
  } catch (erro) {
    const codigo = erro instanceof Error ? erro.message : "";
    if (codigo === "NAO_ENCONTRADO") return falha("Fechamento não encontrado.", 404);
    if (codigo === "NAO_PENDENTE") return falha("Somente fechamentos pendentes podem ser cancelados.", 409);
    if (codigo === "RECEBIMENTO_EXISTENTE") return falha("Há informações de recebimento; o cancelamento está bloqueado.", 409);
    if (codigo === "MODELO_LEGADO") return falha("Fechamento do modelo antigo exige regularização administrativa; não foi alterado.", 409);
    if (codigo === "SEM_ACERTOS") return falha("Fechamento sem acertos: solicite revisão administrativa.", 409);
    if (codigo === "CONCORRENCIA" || (erro !== null && typeof erro === "object" && "code" in erro && erro.code === "P2034")) {
      return falha("O fechamento foi alterado durante a operação. Atualize e tente novamente.", 409);
    }
    console.error("Erro ao cancelar fechamento:", erro);
    return falha("Erro interno ao cancelar fechamento.", 500);
  }
}
