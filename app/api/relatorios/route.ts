import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function parseDate(value: string | null, end = false): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function centavos(valor: unknown): number {
  return Math.round(Number(valor ?? 0) * 100);
}

function reais(valor: number): number {
  return Number((valor / 100).toFixed(2));
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Impede injeção de fórmulas quando o CSV é aberto numa planilha.
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const inicioTexto = params.get("inicio");
    const fimTexto = params.get("fim");
    const inicio = parseDate(inicioTexto);
    const fim = parseDate(fimTexto, true);
    const padariaTexto = params.get("padariaId");
    const padariaId = padariaTexto ? Number(padariaTexto) : null;
    const formato = params.get("formato");

    if ((inicioTexto && !inicio) || (fimTexto && !fim) || (inicio && fim && inicio > fim)) {
      return NextResponse.json({ erro: "Informe um período válido." }, { status: 400 });
    }
    if (padariaTexto && (!Number.isInteger(padariaId) || Number(padariaId) <= 0)) {
      return NextResponse.json({ erro: "Padaria inválida." }, { status: 400 });
    }

    // Acertos só entram nos relatórios quando sua entrega está ativa.
    const where = {
      entrega: {
        canceladoEm: null,
        ...(padariaId ? { padariaId } : {}),
        ...(inicio || fim ? {
          dataEntrega: {
            ...(inicio ? { gte: inicio } : {}),
            ...(fim ? { lte: fim } : {}),
          },
        } : {}),
      },
    };

    const acertos = await prisma.acertoMovimentacao.findMany({
      where,
      include: {
        entrega: { select: { codigo: true, dataEntrega: true, padariaId: true, padaria: { select: { nome: true } } } },
        pagamento: { select: { id: true, status: true, valorDevido: true, valorRecebido: true, divergencia: true } },
      },
      orderBy: [{ entrega: { dataEntrega: "desc" } }, { id: "desc" }],
    });

    const detalhes = acertos.map((a) => ({
      id: a.id,
      codigo: a.entrega.codigo,
      data: a.entrega.dataEntrega.toISOString().slice(0, 10),
      padariaId: a.entrega.padariaId,
      padaria: a.entrega.padaria.nome,
      entregue: a.quantidadeEntregue,
      devolvido: a.quantidadeDevolvida,
      cobrado: a.quantidadeEntregue - a.quantidadeDevolvida,
      bruto: reais(centavos(a.valorBruto)),
      devolucoes: reais(centavos(a.valorDevolvido)),
      devido: reais(centavos(a.valorDevido)),
      pagamentoId: a.pagamentoId,
      status: a.pagamento?.status ?? "SEM_FECHAMENTO",
    }));

    const totais = {
      movimentacoes: detalhes.length,
      unidadesEntregues: detalhes.reduce((s, d) => s + d.entregue, 0),
      unidadesDevolvidas: detalhes.reduce((s, d) => s + d.devolvido, 0),
      bruto: reais(acertos.reduce((s, a) => s + centavos(a.valorBruto), 0)),
      devolucoes: reais(acertos.reduce((s, a) => s + centavos(a.valorDevolvido), 0)),
      devido: reais(acertos.reduce((s, a) => s + centavos(a.valorDevido), 0)),
      semFechamento: reais(acertos.filter((a) => !a.pagamentoId).reduce((s, a) => s + centavos(a.valorDevido), 0)),
      emFechamentosPendentes: reais(acertos.filter((a) => a.pagamento?.status === "PENDENTE").reduce((s, a) => s + centavos(a.valorDevido), 0)),
    };

    const porPadaria = new Map<number, { padariaId: number; nome: string; movimentacoes: number; devidoCentavos: number; devolvidoCentavos: number }>();
    for (const a of acertos) {
      const id = a.entrega.padariaId;
      const atual = porPadaria.get(id) ?? { padariaId: id, nome: a.entrega.padaria.nome, movimentacoes: 0, devidoCentavos: 0, devolvidoCentavos: 0 };
      atual.movimentacoes += 1;
      atual.devidoCentavos += centavos(a.valorDevido);
      atual.devolvidoCentavos += centavos(a.valorDevolvido);
      porPadaria.set(id, atual);
    }
    const ranking = Array.from(porPadaria.values()).map((p) => ({ padariaId: p.padariaId, nome: p.nome, movimentacoes: p.movimentacoes, devido: reais(p.devidoCentavos), devolucoes: reais(p.devolvidoCentavos) })).sort((a, b) => b.devido - a.devido);

    // Fechamentos financeiros mantêm seu próprio período e histórico.
    // Cancelamento de uma entrega já vinculada a um fechamento é bloqueado pela API de cancelamento.
    const pagamentos = await prisma.pagamento.findMany({
      where: {
        // Fechamentos cancelados são preservados no Histórico Financeiro,
        // mas não fazem parte dos indicadores financeiros operacionais.
        status: { in: ["PENDENTE", "PAGO"] },
        ...(padariaId ? { padariaId } : {}),
        ...(inicio || fim ? { dataInicio: { ...(fim ? { lte: fim } : {}) }, dataFim: { ...(inicio ? { gte: inicio } : {}) } } : {}),
      },
      select: { id: true, status: true, valorDevido: true, valorRecebido: true, divergencia: true },
    });
    const financeiro = {
      fechamentos: pagamentos.length,
      pendentes: pagamentos.filter((p) => p.status === "PENDENTE").length,
      pagos: pagamentos.filter((p) => p.status === "PAGO").length,
      divergencias: pagamentos.filter((p) => p.divergencia).length,
      recebido: reais(pagamentos.reduce((s, p) => s + centavos(p.valorRecebido), 0)),
      pendente: reais(pagamentos.filter((p) => p.status === "PENDENTE").reduce((s, p) => s + centavos(p.valorDevido), 0)),
    };

    if (formato === "csv") {
      const cabecalho = ["Data", "Padaria", "Código", "Entregue", "Devolvido", "Cobrado", "Bruto (R$)", "Devoluções (R$)", "Devido (R$)", "Situação"];
      const linhas = detalhes.map((d) => [d.data, d.padaria, d.codigo, d.entregue, d.devolvido, d.cobrado, d.bruto.toFixed(2).replace(".", ","), d.devolucoes.toFixed(2).replace(".", ","), d.devido.toFixed(2).replace(".", ","), d.status]);
      const csv = "\uFEFF" + [cabecalho, ...linhas].map((linha) => linha.map(csvCell).join(";")).join("\r\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="relatorio-pamonharia.csv"', "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ totais, financeiro, ranking, detalhes, observacao: "Valores operacionais baseados em acertos registrados de entregas não canceladas. Entregas sem acerto não entram no relatório." });
  } catch (erro) {
    console.error("Erro ao gerar relatório:", erro);
    return NextResponse.json({ erro: "Não foi possível gerar o relatório." }, { status: 500 });
  }
}
