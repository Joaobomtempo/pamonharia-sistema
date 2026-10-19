import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { SESSION_COOKIE, validarToken } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const selecao = {
  id: true,
  nomeCompleto: true,
  usuario: true,
  tipo: true,
  status: true,
  dataCadastro: true,
  atualizadoEm: true,
} as const;

async function autorizarDono(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessao = token ? await validarToken(token) : null;
  if (!sessao) return { erro: "Autenticação necessária.", status: 401 } as const;
  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id } });
  if (!usuario || usuario.status !== "ATIVO" || usuario.usuario !== sessao.usuario || usuario.tipo !== "DONO") {
    return { erro: "Acesso exclusivo de proprietário ativo.", status: 403 } as const;
  }
  return { usuario };
}

function falha(erro: string, status = 400) {
  return NextResponse.json({ erro }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const acesso = await autorizarDono(request);
    if ("erro" in acesso) return falha(acesso.erro ?? "Acesso negado.", acesso.status);
    const usuarios = await prisma.usuario.findMany({ select: selecao, orderBy: { id: "asc" } });
    return NextResponse.json(usuarios);
  } catch (erro) {
    console.error("Erro ao listar usuários:", erro);
    return falha("Erro ao listar usuários.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const acesso = await autorizarDono(request);
    if ("erro" in acesso) return falha(acesso.erro ?? "Acesso negado.", acesso.status);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return falha("Dados inválidos.");
    const nomeCompleto = String(body.nomeCompleto ?? "").trim();
    const usuario = String(body.usuario ?? "").trim().toLowerCase();
    const senha = body.senha;
    const tipo = body.tipo;
    if (nomeCompleto.length < 3 || nomeCompleto.length > 120) return falha("Informe o nome completo (3 a 120 caracteres).");
    if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) return falha("Usuário: 3 a 40 caracteres, letras minúsculas, números, ponto, hífen ou sublinhado.");
    if (typeof senha !== "string" || senha.length < 12 || senha.length > 128) return falha("A senha precisa ter entre 12 e 128 caracteres.");
    if (tipo !== "DONO" && tipo !== "FUNCIONARIO" && tipo !== "DESENVOLVEDOR") return falha("Perfil inválido.");
    const existente = await prisma.usuario.findUnique({ where: { usuario }, select: { id: true } });
    if (existente) return falha("Esse nome de usuário já existe.", 409);
    const criado = await prisma.usuario.create({
      data: { nomeCompleto, usuario, senha: await hash(senha, 12), tipo, status: "ATIVO" },
      select: selecao,
    });
    await prisma.historico.create({ data: { tabelaAfetada: "Usuario", registroId: criado.id, acao: "CRIADO", realizadoPorId: acesso.usuario.id, dadosNovos: { usuario: criado.usuario, tipo: criado.tipo, status: criado.status } } });
    return NextResponse.json(criado, { status: 201 });
  } catch (erro) {
    console.error("Erro ao cadastrar usuário:", erro);
    return falha("Erro ao cadastrar usuário.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acesso = await autorizarDono(request);
    if ("erro" in acesso) return falha(acesso.erro ?? "Acesso negado.", acesso.status);
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return falha("Usuário inválido.");
    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo) return falha("Usuário não encontrado.", 404);
    const acao = body?.acao;
    if (acao === "status") {
      if (id === acesso.usuario.id) return falha("Você não pode alterar seu próprio status.");
      if (body.status !== "ATIVO" && body.status !== "INATIVO") return falha("Status inválido.");
      const atualizado = await prisma.usuario.update({ where: { id }, data: { status: body.status }, select: selecao });
      await prisma.historico.create({ data: { tabelaAfetada: "Usuario", registroId: id, acao: "ALTERADO", realizadoPorId: acesso.usuario.id, motivo: "status", dadosAnteriores: { tipo: alvo.tipo, status: alvo.status }, dadosNovos: { tipo: atualizado.tipo, status: atualizado.status } } });
      return NextResponse.json(atualizado);
    }
    if (acao === "senha") {
      if (typeof body.senha !== "string" || body.senha.length < 12 || body.senha.length > 128) return falha("A nova senha precisa ter entre 12 e 128 caracteres.");
      const atualizado = await prisma.usuario.update({ where: { id }, data: { senha: await hash(body.senha, 12) }, select: selecao });
      await prisma.historico.create({ data: { tabelaAfetada: "Usuario", registroId: id, acao: "ALTERADO", realizadoPorId: acesso.usuario.id, motivo: "senha", dadosAnteriores: { tipo: alvo.tipo, status: alvo.status }, dadosNovos: { tipo: atualizado.tipo, status: atualizado.status } } });
      return NextResponse.json(atualizado);
    }
    if (acao === "perfil") {
      if (id === acesso.usuario.id) return falha("Você não pode alterar seu próprio perfil.");
      if (body.tipo !== "DONO" && body.tipo !== "FUNCIONARIO" && body.tipo !== "DESENVOLVEDOR") return falha("Perfil inválido.");
      const atualizado = await prisma.usuario.update({ where: { id }, data: { tipo: body.tipo }, select: selecao });
      await prisma.historico.create({ data: { tabelaAfetada: "Usuario", registroId: id, acao: "ALTERADO", realizadoPorId: acesso.usuario.id, motivo: "perfil", dadosAnteriores: { tipo: alvo.tipo, status: alvo.status }, dadosNovos: { tipo: atualizado.tipo, status: atualizado.status } } });
      return NextResponse.json(atualizado);
    }
    return falha("Ação não reconhecida.");
  } catch (erro) {
    console.error("Erro ao atualizar usuário:", erro);
    return falha("Erro ao atualizar usuário.", 500);
  }
}
