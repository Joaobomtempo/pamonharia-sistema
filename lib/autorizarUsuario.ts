import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { SESSION_COOKIE, validarToken, type Perfil } from "./auth";

export async function autorizarUsuario(request: NextRequest, perfis: Perfil[]) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessao = token ? await validarToken(token) : null;
  if (!sessao) {
    return { ok: false as const, erro: "Autenticação necessária.", status: 401 };
  }

  // Evita consulta desnecessária ao banco para perfis sem permissão.
  if (!perfis.includes(sessao.tipo)) {
    return { ok: false as const, erro: "Acesso não autorizado.", status: 403 };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id } });
  if (!usuario || usuario.status !== "ATIVO" || usuario.usuario !== sessao.usuario ||
      usuario.tipo !== sessao.tipo) {
    return { ok: false as const, erro: "Sessão inválida ou usuário desativado.", status: 401 };
  }

  return { ok: true as const, usuario };
}
