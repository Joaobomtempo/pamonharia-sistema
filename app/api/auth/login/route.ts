import { createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;
// Hash bcrypt válido para uma comparação de tempo semelhante para usuários inexistentes.
const HASH_FICTICIO = "$2b$12$C6UzMDM.H6dfI/f/IKxGhuMt0xC1/PRou/B0APcWD5xBvOZcrILwm";

type Registro = {
  tentativas: number;
  janelaInicio: Date;
  bloqueadoAte: Date | null;
};

type UsuarioAutenticado = {
  id: number;
  usuario: string;
  nomeCompleto: string;
  tipo: "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";
};

type ResultadoLogin =
  | { tipo: "BLOQUEADO"; segundos: number }
  | { tipo: "INVALIDO" }
  | { tipo: "AUTENTICADO"; usuario: UsuarioAutenticado };

function resposta(erro: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { erro },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(retryAfter !== undefined ? { "Retry-After": String(retryAfter) } : {}),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const dados: unknown = await request.json().catch(() => null);
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return resposta("Dados inválidos.", 400);
    }

    const body = dados as Record<string, unknown>;
    const usuario = typeof body.usuario === "string" ? body.usuario.trim() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";
    if (!usuario || !senha || usuario.length > 100 || senha.length > 256) {
      return resposta("Informe usuário e senha válidos.", 400);
    }

    // Limite por usuário, incluindo nomes inexistentes. Não dependemos de cookies nem
    // de cabeçalhos de IP controláveis pelo cliente.
    const chave = createHash("sha256").update(usuario.toLocaleLowerCase("pt-BR")).digest("hex");

    const resultado = await prisma.$transaction(async (tx): Promise<ResultadoLogin> => {
      // Impede que solicitações simultâneas para o mesmo identificador
      // ultrapassem o limite devido a uma corrida entre leitura e atualização.
      await tx.$queryRaw<{ locked: number }[]>`
        SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))
      `;

      const agora = new Date();
      const registros = await tx.$queryRaw<Registro[]>`
        SELECT "tentativas", "janelaInicio", "bloqueadoAte"
        FROM "TentativaLogin" WHERE "chave" = ${chave}
      `;
      const registro = registros[0];

      if (registro?.bloqueadoAte && registro.bloqueadoAte.getTime() > agora.getTime()) {
        return {
          tipo: "BLOQUEADO",
          segundos: Math.max(1, Math.ceil((registro.bloqueadoAte.getTime() - agora.getTime()) / 1000)),
        };
      }

      const conta = await tx.usuario.findUnique({
        where: { usuario },
        select: { id: true, usuario: true, nomeCompleto: true, tipo: true, status: true, senha: true },
      });
      const hash = conta?.senha?.startsWith("$2") ? conta.senha : HASH_FICTICIO;
      const confere = await compare(senha, hash);
      if (conta && conta.status === "ATIVO" && conta.senha.startsWith("$2") && confere) {
        await tx.$executeRaw`DELETE FROM "TentativaLogin" WHERE "chave" = ${chave}`;
        return {
          tipo: "AUTENTICADO",
          usuario: { id: conta.id, usuario: conta.usuario, nomeCompleto: conta.nomeCompleto, tipo: conta.tipo },
        };
      }

      const dentroDaJanela = registro && (agora.getTime() - registro.janelaInicio.getTime()) < JANELA_MS;
      const tentativas = (dentroDaJanela ? registro.tentativas : 0) + 1;
      const janelaInicio = dentroDaJanela ? registro.janelaInicio : agora;
      const bloqueadoAte = tentativas >= MAX_TENTATIVAS ? new Date(agora.getTime() + BLOQUEIO_MS) : null;

      await tx.$executeRaw`
        INSERT INTO "TentativaLogin" ("chave", "tentativas", "janelaInicio", "bloqueadoAte", "atualizadoEm")
        VALUES (${chave}, ${tentativas}, ${janelaInicio}, ${bloqueadoAte}, ${agora})
        ON CONFLICT ("chave") DO UPDATE SET
          "tentativas" = EXCLUDED."tentativas",
          "janelaInicio" = EXCLUDED."janelaInicio",
          "bloqueadoAte" = EXCLUDED."bloqueadoAte",
          "atualizadoEm" = EXCLUDED."atualizadoEm"
      `;

      return bloqueadoAte
        ? { tipo: "BLOQUEADO", segundos: Math.ceil(BLOQUEIO_MS / 1000) }
        : { tipo: "INVALIDO" };
    }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 20000 });

    if (resultado.tipo === "BLOQUEADO") {
      return resposta("Muitas tentativas de acesso. Aguarde 15 minutos antes de tentar novamente.", 429, resultado.segundos);
    }
    if (resultado.tipo === "INVALIDO") {
      return resposta("Usuário ou senha inválidos.", 401);
    }

    const conta = resultado.usuario;
    const token = await criarToken({ id: conta.id, usuario: conta.usuario, nome: conta.nomeCompleto, tipo: conta.tipo });
    const res = NextResponse.json(
      { usuario: { nome: conta.nomeCompleto, tipo: conta.tipo } },
      { headers: { "Cache-Control": "no-store" } }
    );
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (erro) {
    console.error("Falha ao autenticar:", erro);
    return resposta("Não foi possível entrar no momento.", 500);
  }
}
