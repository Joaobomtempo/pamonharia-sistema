import { prisma } from "../lib/prisma";

async function main() {
  const usuario = await prisma.usuario.create({
    data: {
      nomeCompleto: "Administrador",
      usuario: "admin",
      senha: "senha-temporaria",
      tipo: "DONO",
    },
  });

  const padaria = await prisma.padaria.create({
    data: {
      nome: "Padaria Teste",
      contato: "Contato Teste",
      endereco: "Endereço Teste",
    },
  });

  const produto = await prisma.produto.create({
    data: {
      nome: "Pamonha Doce",
      precoCadastrado: 8.5,
    },
  });

  const entrega = await prisma.entrega.create({
    data: {
      codigo: `ENT-${Date.now()}`,
      padariaId: padaria.id,
      dataEntrega: new Date(),
      criadoPorId: usuario.id,

      itens: {
        create: {
          produtoId: produto.id,
          quantidadeEntregue: 10,
          precoUnitario: 8.5,
        },
      },
    },

    include: {
      padaria: true,
      itens: {
        include: {
          produto: true,
        },
      },
    },
  });

  console.log("Usuário criado:");
  console.log(usuario);

  console.log("\nPadaria criada:");
  console.log(padaria);

  console.log("\nProduto criado:");
  console.log(produto);

  console.log("\nEntrega criada:");
  console.dir(entrega, { depth: null });
}

main()
  .catch((erro) => {
    console.error("Erro ao testar o banco:");
    console.error(erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });