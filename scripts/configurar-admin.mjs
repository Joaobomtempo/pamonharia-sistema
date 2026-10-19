import "dotenv/config";
import pg from "pg";
import { hash } from "bcryptjs";

const senha = process.env.ADMIN_INITIAL_PASSWORD;
if (!senha || senha.length < 12) {
  console.error("Defina ADMIN_INITIAL_PASSWORD com pelo menos 12 caracteres nesta sessão do terminal.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await db.connect();
  const senhaHash = await hash(senha, 12);
  await db.query(`INSERT INTO "Usuario" ("nomeCompleto", "usuario", "senha", "tipo", "status", "dataCadastro", "atualizadoEm")
    VALUES ($1, $2, $3, 'DONO', 'ATIVO', NOW(), NOW())
    ON CONFLICT ("usuario") DO UPDATE SET "senha" = EXCLUDED."senha", "tipo" = 'DONO', "status" = 'ATIVO', "atualizadoEm" = NOW()`,
    ["Administrador", "admin_teste", senhaHash]);
  console.log("Administrador admin_teste preparado com senha protegida por hash.");
} finally { await db.end(); }
