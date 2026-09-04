import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const padarias = await prisma.padaria.findMany({
    orderBy: {
      nome: "asc",
    },
  });

  return NextResponse.json(padarias);
}

export async function POST(request: Request) {
  const body = await request.json();

  const padaria = await prisma.padaria.create({
    data: {
      nome: body.nome,
      contato: body.contato,
      endereco: body.endereco,
    },
  });

  return NextResponse.json(padaria, {
    status: 201,
  });
}