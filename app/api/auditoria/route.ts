import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { autorizarUsuario } from "../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO"]);
    if (!acesso.ok) return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    const parametros = request.nextUrl.searchParams;
    const tabela = parametros.get("tabela")?.trim() || undefined;
    const dataInicio = parametros.get("inicio") || "";
    const dataFim = parametros.get("fim") || "";
    const where: {
      tabelaAfetada?: string;
      realizadoEm?: { gte?: Date; lt?: Date };
    } = {};
    if (tabela) where.tabelaAfetada = tabela;
    if (dataInicio || dataFim) {
      if ((dataInicio && !/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) ||
          (dataFim && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim))) {
        return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
      }
      const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00.000Z`) : undefined;
      const fim = dataFim ? new Date(new Date(`${dataFim}T00:00:00.000Z`).getTime() + 86400000) : undefined;
      if ((inicio && Number.isNaN(inicio.getTime())) || (fim && Number.isNaN(fim.getTime()))) {
        return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
      }
      where.realizadoEm = { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: fim } : {}) };
    }
    const registros = await prisma.historico.findMany({
      where,
      orderBy: { realizadoEm: "desc" },
      take: 200,
      include: { realizadoPor: { select: { id: true, nomeCompleto: true, usuario: true, tipo: true } } },
    });
    return NextResponse.json(registros);
  } catch (erro) {
    console.error("Erro ao consultar auditoria:", erro);
    return NextResponse.json({ erro: "Não foi possível consultar a auditoria." }, { status: 500 });
  }
}
