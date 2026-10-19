import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pamonharia_session";
export type Perfil = "DONO" | "FUNCIONARIO" | "DESENVOLVEDOR";
export type SessionUser = { id: number; usuario: string; nome: string; tipo: Perfil };

function sessionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function criarToken(user: SessionUser) {
  return new SignJWT({ usuario: user.usuario, nome: user.nome, tipo: user.tipo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
}

export async function validarToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof payload.usuario !== "string" ||
      typeof payload.nome !== "string" || (payload.tipo !== "DONO" && payload.tipo !== "FUNCIONARIO" && payload.tipo !== "DESENVOLVEDOR")) return null;
    return { id, usuario: payload.usuario, nome: payload.nome, tipo: payload.tipo };
  } catch { return null; }
}
