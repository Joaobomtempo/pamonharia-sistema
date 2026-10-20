-- Limitação persistente de tentativas de login por identificador normalizado.
-- A chave é SHA-256, para não armazenar o nome de usuário nesta tabela.
CREATE TABLE "TentativaLogin" (
  "chave" VARCHAR(64) NOT NULL PRIMARY KEY,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "janelaInicio" TIMESTAMP(3) NOT NULL,
  "bloqueadoAte" TIMESTAMP(3),
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TentativaLogin_atualizadoEm_idx" ON "TentativaLogin" ("atualizadoEm");
