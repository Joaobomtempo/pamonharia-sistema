import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, validarToken } from "@/lib/auth";
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await validarToken(token) : null;
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const user = await prisma.usuario.findUnique({ where: { id: session.id }, select: { id: true, usuario: true, nomeCompleto: true, tipo: true, status: true } });
  if (!user || user.status !== "ATIVO") return NextResponse.json({ erro: "Usuário desativado." }, { status: 401 });
  return NextResponse.json({ id: user.id, usuario: user.usuario, nome: user.nomeCompleto, tipo: user.tipo });
}
