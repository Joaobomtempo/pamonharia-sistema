import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { autorizarUsuario } from "../../../lib/autorizarUsuario";

export const dynamic = "force-dynamic";

const MODULOS = new Set(["Entrega", "Devolucao", "Pagamento", "Usuario"]);
const CAMPOS_SIGILOSOS = /^(senha|password|passwordHash|senhaHash|token|accessToken|refreshToken|secret|segredo|authorization|cookie|sessionCookie|sessionToken|apiKey|chaveApi|DATABASE_URL|JWT_SECRET)$/i;

function interpretarData(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const data = new Date(`${texto}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto ? null : data;
}

// O histórico pode conter valores gravados por versões antigas do sistema.
// Nunca devolvemos credenciais e segredos para o navegador, mesmo ao proprietário.
function ocultarSigilosos(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 16) return "[Detalhe ocultado]";
  if (Array.isArray(valor)) return valor.map((item) => ocultarSigilosos(item, profundidade + 1));
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        CAMPOS_SIGILOSOS.test(chave) ? "[REDACTADO]" : ocultarSigilosos(item, profundidade + 1),
      ])
    );
  }
  return valor;
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarUsuario(request, ["DONO"]);
    if (!acesso.ok) {
      return NextResponse.json({ erro: acesso.erro }, { status: acesso.status });
    }

    const parametros = request.nextUrl.searchParams;
    const tabela = parametros.get("tabela")?.trim() ?? "";
    const textoInicio = parametros.get("inicio") ?? "";
    const textoFim = parametros.get("fim") ?? "";

    if (tabela && !MODULOS.has(tabela)) {
      return NextResponse.json({ erro: "Módulo inválido." }, { status: 400 });
    }

    const inicio = textoInicio ? interpretarData(textoInicio) : null;
    const fimInclusivo = textoFim ? interpretarData(textoFim) : null;
    if ((textoInicio && !inicio) || (textoFim && !fimInclusivo)) {
      return NextResponse.json({ erro: "Informe datas válidas no formato AAAA-MM-DD." }, { status: 400 });
    }
    if (inicio && fimInclusivo && inicio > fimInclusivo) {
      return NextResponse.json({ erro: "A data inicial não pode ser posterior à data final." }, { status: 400 });
    }

    const fimExclusivo = fimInclusivo ? new Date(fimInclusivo.getTime() + 86400000) : null;
    const where = {
      ...(tabela ? { tabelaAfetada: tabela } : {}),
      ...(inicio || fimExclusivo ? {
        realizadoEm: {
          ...(inicio ? { gte: inicio } : {}),
          ...(fimExclusivo ? { lt: fimExclusivo } : {}),
        },
      } : {}),
    };

    const registros = await prisma.historico.findMany({
      where,
      orderBy: [{ realizadoEm: "desc" }, { id: "desc" }],
      take: 200,
      include: {
        realizadoPor: {
          select: { id: true, nomeCompleto: true, usuario: true, tipo: true },
        },
      },
    });

    return NextResponse.json(
      registros.map((registro) => ({
        ...registro,
        dadosAnteriores: ocultarSigilosos(registro.dadosAnteriores),
        dadosNovos: ocultarSigilosos(registro.dadosNovos),
      })),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (erro) {
    console.error("Erro ao consultar auditoria:", erro);
    return NextResponse.json({ erro: "Não foi possível consultar a auditoria." }, { status: 500 });
  }
}
