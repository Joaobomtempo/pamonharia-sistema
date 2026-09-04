import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const produtos = await prisma.produto.findMany({
    orderBy: {
      nome: "asc",
    },
  });

  return NextResponse.json(produtos);
}

export async function POST(request: Request) {
  const body = await request.json();

  const produto = await prisma.produto.create({
    data: {
      nome: body.nome,
      precoCadastrado: Number(body.precoCadastrado),
    },
  });

  return NextResponse.json(produto, {
    status: 201,
  });
}