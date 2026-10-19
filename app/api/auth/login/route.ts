import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { criarToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const data: unknown = await request.json();
    if (!data || typeof data !== "object") return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
    const body = data as Record<string, unknown>;
    const usuario = typeof body.usuario === "string" ? body.usuario.trim() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";
    if (!usuario || !senha || usuario.length > 100 || senha.length > 256) {
      return NextResponse.json({ erro: "Informe usuário e senha válidos." }, { status: 400 });
    }
    const user = await prisma.usuario.findUnique({ where: { usuario } });
    // Também executa a comparação para usuários inexistentes, reduzindo diferenças de tempo.
    const hash = user?.senha?.startsWith("$2") ? user.senha : "$2b$12$C6UzMDM.H6dfI/f/IKxGhuMt0xC1/PRou/B0APcWD5xBvOZcrILwm";
    const senhaCorreta = await compare(senha, hash);
    if (!user || user.status !== "ATIVO" || !user.senha.startsWith("$2") || !senhaCorreta) {
      return NextResponse.json({ erro: "Usuário ou senha inválidos." }, { status: 401 });
    }
    const token = await criarToken({ id: user.id, usuario: user.usuario, nome: user.nomeCompleto, tipo: user.tipo });
    const res = NextResponse.json({ usuario: { nome: user.nomeCompleto, tipo: user.tipo } });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (err) {
    console.error("Falha ao autenticar:", err);
    return NextResponse.json({ erro: "Não foi possível entrar no momento." }, { status: 500 });
  }
}
