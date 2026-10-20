import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../../../../lib/prisma";
import { SESSION_COOKIE, validarToken } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);
const texto = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const sessao = token ? await validarToken(token) : null;
    if (!sessao) return NextResponse.json({ erro: "Autenticação necessária." }, { status: 401 });
    if (sessao.tipo === "DESENVOLVEDOR") return NextResponse.json({ erro: "Acesso não autorizado." }, { status: 403 });
    const usuario = await prisma.usuario.findUnique({ where: { id: sessao.id }, select: { usuario: true, status: true, tipo: true } });
    if (
  !usuario ||
  usuario.status !== "ATIVO" ||
  usuario.tipo !== sessao.tipo ||
  usuario.usuario !== sessao.usuario ||
  !["DONO", "FUNCIONARIO"].includes(usuario.tipo)
) {
      return NextResponse.json({ erro: "Sessão sem autorização." }, { status: 403 });
    }

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ erro: "ID inválido." }, { status: 400 });

    const acerto = await prisma.acertoMovimentacao.findUnique({
      where: { entregaId: id },
      include: {
        entrega: {
          include: {
            padaria: true,
            itens: { include: { produto: true }, orderBy: { id: "asc" } },
          },
        },
        devolucao: {
          include: { itens: { include: { itemEntrega: { include: { produto: true } } } } },
        },
      },
    });
    if (!acerto) return NextResponse.json({ erro: "Acerto não encontrado para esta entrega." }, { status: 404 });

    const pdf = await PDFDocument.create();
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const forte = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28;
    const H = 841.89;
    const margem = 45;
    let pagina = pdf.addPage([W, H]);
    let y = H - margem;
    const verde = rgb(0.02, 0.40, 0.28);
    const cinza = rgb(0.32, 0.38, 0.42);
    const preto = rgb(0.1, 0.14, 0.18);

    function proxima(linhas = 1) {
      if (y - linhas * 20 < margem + 25) {
        pagina = pdf.addPage([W, H]);
        y = H - margem;
      }
    }
    function linha(conteudo: string, opcoes?: { bold?: boolean; size?: number; color?: typeof preto; gap?: number }) {
      const size = opcoes?.size ?? 10;
      const gap = opcoes?.gap ?? 18;
      const fonte = opcoes?.bold ? forte : normal;
      // Quebra visual de linhas compridas, sem perder informações.
      let restante = texto(conteudo);
      do {
        proxima();
        let parte = restante;
        while (parte.length > 1 && fonte.widthOfTextAtSize(parte, size) > W - 2 * margem) parte = parte.slice(0, -1);
        pagina.drawText(parte, { x: margem, y, font: fonte, size, color: opcoes?.color ?? preto });
        y -= gap;
        restante = restante.slice(parte.length).trimStart();
      } while (restante.length > 0);
    }
    function separador() {
      proxima();
      pagina.drawLine({ start: { x: margem, y }, end: { x: W - margem, y }, thickness: 0.7, color: rgb(0.83, 0.87, 0.86) });
      y -= 20;
    }

    linha("PAMONHARIA ROCINHA", { bold: true, size: 18, color: verde, gap: 24 });
    linha("COMPROVANTE DE MOVIMENTAÇÃO", { bold: true, size: 12, gap: 23 });
    linha(`Código: ${texto(acerto.entrega.codigo)}   |   Entrega nº ${id}`);
    linha(`Padaria: ${texto(acerto.entrega.padaria.nome)}`);
    if (acerto.entrega.padaria.endereco) linha(`Endereço: ${texto(acerto.entrega.padaria.endereco)}`);
    linha(`Data da movimentação: ${dataBR(acerto.entrega.dataEntrega)}`);
    linha(`Emitido em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
    separador();

    linha("PRODUTOS ENTREGUES", { bold: true, color: verde });
    for (const item of acerto.entrega.itens) {
      const preco = Number(item.precoUnitario);
      linha(`${texto(item.produto.nome)} | ${item.quantidadeEntregue} un. x ${moeda(preco)} = ${moeda(item.quantidadeEntregue * preco)}`);
    }
    separador();

    linha("DEVOLUÇÕES RECEBIDAS NESTA MOVIMENTAÇÃO", { bold: true, color: verde });
    if (!acerto.devolucao || acerto.devolucao.itens.length === 0) {
      linha("Nenhuma devolução.", { color: cinza });
    } else {
      for (const item of acerto.devolucao.itens) {
        const produtoId = item.itemEntrega.produtoId;
        const novoItem = acerto.entrega.itens.find(i => i.produtoId === produtoId);
        const precoAcerto = novoItem ? Number(novoItem.precoUnitario) : Number(item.precoUnitario);
        linha(`${texto(item.itemEntrega.produto.nome)} | ${item.quantidadeDevolvida} un. x ${moeda(precoAcerto)} = ${moeda(item.quantidadeDevolvida * precoAcerto)}`);
      }
    }
    separador();

    linha(`Quantidade entregue: ${acerto.quantidadeEntregue} un.`);
    linha(`Quantidade devolvida: ${acerto.quantidadeDevolvida} un.`);
    linha(`Quantidade cobrada: ${acerto.quantidadeEntregue - acerto.quantidadeDevolvida} un.`);
    linha(`Valor bruto: ${moeda(Number(acerto.valorBruto))}`);
    linha(`Valor das devoluções: ${moeda(Number(acerto.valorDevolvido))}`);
    linha(`VALOR DEVIDO: ${moeda(Number(acerto.valorDevido))}`, { bold: true, size: 15, color: verde, gap: 25 });
    if (acerto.entrega.observacoes) {
      separador();
      linha("OBSERVAÇÕES", { bold: true });
      linha(texto(acerto.entrega.observacoes));
    }
    separador();
    linha("Comprovante de movimentação. Não comprova quitação ou recebimento.", { color: cinza, size: 9 });

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="comprovante-entrega-${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erro) {
    console.error("Erro ao gerar comprovante:", erro);
    return NextResponse.json({ erro: "Não foi possível gerar o comprovante." }, { status: 500 });
  }
}
