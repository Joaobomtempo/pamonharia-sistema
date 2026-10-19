import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

// Datas da interface (YYYY-MM-DD) são comparadas pelo dia civil em UTC.
// A API de movimentações atualmente grava datas recebidas nesse formato em UTC.
function interpretarDia(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
    return null;
  }
  return data;
}

function erroJson(mensagem: string, status = 400) {
  return NextResponse.json({ erro: mensagem }, { status });
}

const detalhesPagamento = {
  padaria: true,
  itens: {
    include: {
      itemEntrega: {
        include: { produto: true, entrega: true },
      },
    },
  },
  acertos: {
    include: {
      entrega: {
        include: {
          itens: { include: { produto: true } },
        },
      },
      devolucao: {
        include: {
          itens: {
            include: { itemEntrega: { include: { produto: true } } },
          },
        },
      },
    },
  },
} as const;

/** Histórico de pagamentos, incluindo os acertos da nova regra financeira. */
export async function GET() {
  try {
    const pagamentos = await prisma.pagamento.findMany({
      include: detalhesPagamento,
      orderBy: { criadoEm: "desc" },
    });
    return NextResponse.json(pagamentos);
  } catch (erro) {
    console.error("Erro ao buscar pagamentos:", erro);
    return erroJson("Erro ao buscar pagamentos.", 500);
  }
}

/**
 * Cria um fechamento PENDENTE para acertos de movimentações no período.
 * Cada acerto já contém: nova entrega - devoluções recebidas naquela visita.
 * Entregas anteriores à migração sem acerto NÃO são cobradas automaticamente.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const padariaId = Number(body?.padariaId);
    const dataInicio = interpretarDia(body?.dataInicio);
    const dataFim = interpretarDia(body?.dataFim);

    if (!Number.isSafeInteger(padariaId) || padariaId <= 0 || !dataInicio || !dataFim) {
      return erroJson("Informe a padaria e um período válido (AAAA-MM-DD).");
    }
    if (dataInicio.getTime() > dataFim.getTime()) {
      return erroJson("A data inicial não pode ser posterior à data final.");
    }

    const fimExclusivo = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000);
    const padaria = await prisma.padaria.findUnique({ where: { id: padariaId } });
    if (!padaria) return erroJson("Padaria não encontrada.", 404);

    const acertos = await prisma.acertoMovimentacao.findMany({
      where: {
        entrega: {
          padariaId,
          dataEntrega: { gte: dataInicio, lt: fimExclusivo },
        },
      },
      select: { id: true, pagamentoId: true, valorDevido: true },
    });

    if (acertos.length === 0) {
      return erroJson(
        "Nenhum acerto financeiro encontrado nesse período. Entregas antigas sem acerto precisam de regularização antes do fechamento."
      );
    }

    // Permite fechar somente o que ainda não pertence a outro pagamento.
    const disponiveis = acertos.filter((acerto) => acerto.pagamentoId === null);
    if (disponiveis.length === 0) {
      return erroJson("Todos os acertos desse período já estão vinculados a pagamentos.", 409);
    }

    // Usar centavos evita arredondamento de números de ponto flutuante.
    const totalCentavos = disponiveis.reduce(
      (soma, acerto) => soma + Math.round(Number(acerto.valorDevido) * 100),
      0
    );
    if (!Number.isSafeInteger(totalCentavos) || totalCentavos < 0) {
      return erroJson("Valor dos acertos inválido. Revise os registros antes de fechar.");
    }

    const ids = disponiveis.map((acerto) => acerto.id);

    const pagamentoId = await prisma.$transaction(async (tx) => {
      const novoPagamento = await tx.pagamento.create({
        data: {
          padariaId,
          dataInicio,
          dataFim,
          valorDevido: (totalCentavos / 100).toFixed(2),
          valorRecebido: null,
          status: "PENDENTE",
          divergencia: false,
          dataPagamento: null,
          registradoPorId: null,
        },
      });

      // A condição pagamentoId:null impede vincular um acerto já tomado.
      // Se outra requisição o fechou, abortamos toda a transação.
      const vinculados = await tx.acertoMovimentacao.updateMany({
        where: { id: { in: ids }, pagamentoId: null },
        data: { pagamentoId: novoPagamento.id },
      });
      if (vinculados.count !== ids.length) {
        throw new Error("ACERTOS_JA_VINCULADOS");
      }
      return novoPagamento.id;
    });

    const pagamento = await prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: detalhesPagamento,
    });
    return NextResponse.json(pagamento, { status: 201 });
  } catch (erro) {
    if (erro instanceof Error && erro.message === "ACERTOS_JA_VINCULADOS") {
      return erroJson("Um ou mais acertos foram fechados por outra operação. Atualize a página.", 409);
    }
    console.error("Erro ao criar pagamento:", erro);
    return erroJson("Erro interno ao criar pagamento.", 500);
  }
}

/** Registra o recebimento de um fechamento PENDENTE. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const pagamentoId = Number(body?.pagamentoId);
    const valorRecebido = Number(body?.valorRecebido);

    if (!Number.isSafeInteger(pagamentoId) || pagamentoId <= 0) {
      return erroJson("Informe um pagamento válido.");
    }
    if (
      body?.valorRecebido === null ||
      body?.valorRecebido === undefined ||
      body?.valorRecebido === "" ||
      !Number.isFinite(valorRecebido) ||
      valorRecebido < 0 ||
      !Number.isSafeInteger(Math.round(valorRecebido * 100))
    ) {
      return erroJson("Informe um valor recebido válido.");
    }

    const pagamento = await prisma.pagamento.findUnique({ where: { id: pagamentoId } });
    if (!pagamento) return erroJson("Pagamento não encontrado.", 404);
    if (pagamento.status === "PAGO") return erroJson("Este pagamento já foi recebido.", 409);

    // Provisório enquanto a autenticação não identifica o usuário da sessão.
    const usuario = await prisma.usuario.findFirst({ where: { status: "ATIVO" } });
    if (!usuario) return erroJson("Nenhum usuário ativo cadastrado.");

    const recebidoCentavos = Math.round(valorRecebido * 100);
    const devidoCentavos = Math.round(Number(pagamento.valorDevido) * 100);
    const divergencia = recebidoCentavos !== devidoCentavos;

    if (divergencia && body?.confirmarDivergencia !== true) {
      return erroJson(
        "O valor recebido é diferente do devido. Confirme a divergência antes de registrar (confirmarDivergencia: true).",
        409
      );
    }

    // Atualização condicional evita marcar o mesmo pagamento duas vezes.
    const alterados = await prisma.pagamento.updateMany({
      where: { id: pagamentoId, status: "PENDENTE" },
      data: {
        valorRecebido: (recebidoCentavos / 100).toFixed(2),
        status: "PAGO",
        divergencia,
        dataPagamento: new Date(),
        registradoPorId: usuario.id,
      },
    });
    if (alterados.count !== 1) {
      return erroJson("O pagamento já foi recebido por outra operação.", 409);
    }

    const pagamentoAtualizado = await prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: detalhesPagamento,
    });
    return NextResponse.json(pagamentoAtualizado);
  } catch (erro) {
    console.error("Erro ao receber pagamento:", erro);
    return erroJson("Erro interno ao registrar recebimento.", 500);
  }
}
