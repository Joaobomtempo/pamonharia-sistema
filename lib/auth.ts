import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pamonharia_session";
export type Perfil = "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";
export type SessionUser = { id: number; usuario: string; nome: string; tipo: Perfil };

function sessionKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function criarToken(user: SessionUser): Promise<string> {
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.usuario || !user.nome ||
      !["DONO", "FUNCIONARIO", "DESENVOLVEDOR"].includes(user.tipo)) {
    throw new Error("Dados de sessão inválidos.");
  }
  return new SignJWT({ usuario: user.usuario, nome: user.nome, tipo: user.tipo })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
}

export async function validarToken(token: string): Promise<SessionUser | null> {
  try {
    if (!token || token.length > 8192) return null;
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0 ||
        typeof payload.usuario !== "string" || payload.usuario.length === 0 ||
        typeof payload.nome !== "string" || payload.nome.length === 0 ||
        (payload.tipo !== "DONO" && payload.tipo !== "FUNCIONARIO" && payload.tipo !== "DESENVOLVEDOR")) {
      return null;
    }
    return { id, usuario: payload.usuario, nome: payload.nome, tipo: payload.tipo };
  } catch {
    return null;
  }
}
