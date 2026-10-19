import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, validarToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessao = token ? await validarToken(token) : null;
  if (!sessao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { tipo: true, status: true, usuario: true } });
  if (!usuario || usuario.status !== "ATIVO" || usuario.usuario !== sessao.usuario || (usuario.tipo !== "DESENVOLVEDOR" && usuario.tipo !== "DONO")) return NextResponse.json({ erro: "Acesso técnico não autorizado." }, { status: 403 });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ sistema: "online", banco: "conectado", verificadoEm: new Date().toISOString() });
  } catch (erro) {
    console.error("Falha na verificação técnica:", erro);
    return NextResponse.json({ sistema: "degradado", banco: "indisponível", verificadoEm: new Date().toISOString() }, { status: 503 });
  }
}
