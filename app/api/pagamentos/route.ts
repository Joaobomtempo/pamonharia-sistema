import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { autorizarUsuario } from "../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

function interpretarDia(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor ? data : null;
}
const falha = (erro: string, status = 400) => NextResponse.json({ erro }, { status });
const detalhesPagamento = {
  padaria: true,
  itens: { include: { itemEntrega: { include: { produto: true, entrega: true } } } },
  acertos: {
    include: {
      entrega: { include: { itens: { include: { produto: true } } } },
      devolucao: { include: { itens: { include: { itemEntrega: { include: { produto: true } } } } } },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO"]);
    if (!acesso.ok) return falha(acesso.erro, acesso.status);
    return NextResponse.json(await prisma.pagamento.findMany({ include: detalhesPagamento, orderBy: { criadoEm: "desc" } }));
  } catch (erro) {
    console.error("Falha na consulta de pagamentos:", erro);
    return falha("Não foi possível consultar os pagamentos.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO"]);
    if (!acesso.ok) return falha(acesso.erro, acesso.status);
    const body = await request.json().catch(() => null);
    const padariaId = Number(body?.padariaId);
    const dataInicio = interpretarDia(body?.dataInicio);
    const dataFim = interpretarDia(body?.dataFim);
    if (!Number.isSafeInteger(padariaId) || padariaId <= 0 || !dataInicio || !dataFim) return falha("Informe a padaria e um período válido (AAAA-MM-DD).");
    if (dataInicio > dataFim) return falha("A data inicial não pode ser posterior à data final.");
    const fimExclusivo = new Date(dataFim.getTime() + 86400000);
    const existePadaria = await prisma.padaria.findUnique({ where: { id: padariaId }, select: { id: true } });
    if (!existePadaria) return falha("Padaria não encontrada.", 404);

    const acertos = await prisma.acertoMovimentacao.findMany({
      where: { entrega: { padariaId, dataEntrega: { gte: dataInicio, lt: fimExclusivo } } },
      select: { id: true, pagamentoId: true, valorDevido: true },
    });
    if (acertos.length === 0) return falha("Nenhum acerto financeiro encontrado nesse período. Entregas antigas sem acerto precisam de regularização antes do fechamento.");
    const disponiveis = acertos.filter((a) => a.pagamentoId === null);
    if (disponiveis.length === 0) return falha("Todos os acertos desse período já estão vinculados a pagamentos.", 409);
    const centavos = disponiveis.reduce((soma, a) => soma + Math.round(Number(a.valorDevido) * 100), 0);
    if (!Number.isSafeInteger(centavos) || centavos < 0) return falha("Valor dos acertos inválido.");
    const ids = disponiveis.map((a) => a.id);

    const pagamentoId = await prisma.$transaction(async (tx) => {
      const novo = await tx.pagamento.create({
        data: { padariaId, dataInicio, dataFim, valorDevido: (centavos / 100).toFixed(2), valorRecebido: null,
          status: "PENDENTE", divergencia: false, dataPagamento: null, registradoPorId: null },
      });
      const vinculados = await tx.acertoMovimentacao.updateMany({
        where: { id: { in: ids }, pagamentoId: null }, data: { pagamentoId: novo.id },
      });
      if (vinculados.count !== ids.length) throw new Error("ACERTOS_JA_VINCULADOS");
      await tx.historico.create({ data: {
        tabelaAfetada: "Pagamento", registroId: novo.id, acao: "CRIADO", realizadoPorId: acesso.usuario.id,
        dadosNovos: { padariaId, dataInicio: body.dataInicio, dataFim: body.dataFim, valorDevido: (centavos / 100).toFixed(2),
          status: "PENDENTE", acertosIds: ids },
      } });
      return novo.id;
    });
    const resultado = await prisma.pagamento.findUnique({ where: { id: pagamentoId }, include: detalhesPagamento });
    return NextResponse.json(resultado, { status: 201 });
  } catch (erro) {
    if (erro instanceof Error && erro.message === "ACERTOS_JA_VINCULADOS") return falha("Acertos já vinculados por outra operação. Atualize a página.", 409);
    console.error("Erro ao criar pagamento:", erro);
    return falha("Erro interno ao criar pagamento.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO"]);
    if (!acesso.ok) return falha(acesso.erro, acesso.status);
    const body = await request.json().catch(() => null);
    const id = Number(body?.pagamentoId);
    const recebido = Number(body?.valorRecebido);
    if (!Number.isSafeInteger(id) || id <= 0) return falha("Informe um pagamento válido.");
    if (body?.valorRecebido == null || body.valorRecebido === "" || !Number.isFinite(recebido) || recebido < 0 ||
        !Number.isSafeInteger(Math.round(recebido * 100))) return falha("Informe um valor recebido válido.");
    const anterior = await prisma.pagamento.findUnique({ where: { id } });
    if (!anterior) return falha("Pagamento não encontrado.", 404);
    if (anterior.status === "PAGO") return falha("Este pagamento já foi recebido.", 409);
    const recebidoCentavos = Math.round(recebido * 100);
    const devidoCentavos = Math.round(Number(anterior.valorDevido) * 100);
    const divergencia = recebidoCentavos !== devidoCentavos;
    if (divergencia && body?.confirmarDivergencia !== true) return falha("Confirme a divergência antes de registrar (confirmarDivergencia: true).", 409);

    await prisma.$transaction(async (tx) => {
      const mudanca = await tx.pagamento.updateMany({
        where: { id, status: "PENDENTE" },
        data: { status: "PAGO", valorRecebido: (recebidoCentavos / 100).toFixed(2), divergencia,
          dataPagamento: new Date(), registradoPorId: acesso.usuario.id },
      });
      if (mudanca.count !== 1) throw new Error("PAGAMENTO_JA_RECEBIDO");
      await tx.historico.create({ data: {
        tabelaAfetada: "Pagamento", registroId: id, acao: "ALTERADO", realizadoPorId: acesso.usuario.id,
        motivo: divergencia ? "Recebimento com divergência confirmada" : "Recebimento integral",
        dadosAnteriores: { status: anterior.status, valorDevido: String(anterior.valorDevido), valorRecebido: anterior.valorRecebido == null ? null : String(anterior.valorRecebido) },
        dadosNovos: { status: "PAGO", valorDevido: String(anterior.valorDevido), valorRecebido: (recebidoCentavos / 100).toFixed(2), divergencia },
      } });
    });
    return NextResponse.json(await prisma.pagamento.findUnique({ where: { id }, include: detalhesPagamento }));
  } catch (erro) {
    if (erro instanceof Error && erro.message === "PAGAMENTO_JA_RECEBIDO") return falha("O pagamento já foi recebido por outra operação.", 409);
    console.error("Erro ao registrar recebimento:", erro);
    return falha("Erro interno ao registrar recebimento.", 500);
  }
}
