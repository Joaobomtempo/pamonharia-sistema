import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const entregas = await prisma.entrega.findMany({
    include: {
      padaria: true,
      itens: {
        include: {
          produto: true,
        },
      },
    },
    orderBy: {
      dataEntrega: "desc",
    },
  });

  return NextResponse.json(entregas);
}

export async function POST(request: Request) {
  const body = await request.json();

  const usuario = await prisma.usuario.findFirst();

  if (!usuario) {
    return NextResponse.json(
      {
        erro: "Nenhum usuário cadastrado.",
      },
      {
        status: 400,
      }
    );
  }

  const entrega = await prisma.entrega.create({
    data: {
      codigo: `ENT-${Date.now()}`,
      padariaId: Number(body.padariaId),
      dataEntrega: new Date(body.dataEntrega),
      criadoPorId: usuario.id,

      itens: {
        create: body.itens.map(
          (item: {
            produtoId: number;
            quantidadeEntregue: number;
            precoUnitario: number;
          }) => ({
            produtoId: Number(item.produtoId),
            quantidadeEntregue: Number(item.quantidadeEntregue),
            precoUnitario: Number(item.precoUnitario),
          })
        ),
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

  return NextResponse.json(entrega, {
    status: 201,
  });
}