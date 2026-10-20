import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { SESSION_COOKIE, validarToken } from "./auth";

type Perfil = "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";

export async function autorizarUsuario(request: NextRequest, perfis: Perfil[]) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessao = token ? await validarToken(token) : null;
  if (!sessao) return { ok: false as const, erro: "Autenticação necessária.", status: 401 };
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id } });
  if (!usuario || usuario.status !== "ATIVO" || usuario.usuario !== sessao.usuario || usuario.tipo !== sessao.tipo) {
    return { ok: false as const, erro: "Sessão inválida ou usuário desativado.", status: 401 };
  }
  if (!perfis.includes(usuario.tipo)) {
    return { ok: false as const, erro: "Acesso não autorizado.", status: 403 };
  }
  return { ok: true as const, usuario };
}
