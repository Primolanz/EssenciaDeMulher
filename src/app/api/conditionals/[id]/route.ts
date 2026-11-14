import { ConditionalItemOutcome, ConditionalStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    if (body.action !== "CLOSE" && body.action !== "CANCEL") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const conditional = await tx.conditional.findUnique({ where: { id }, include: { items: true } });
      if (!conditional) throw new Error("NAO_ENCONTRADO");
      if (conditional.status !== ConditionalStatus.IN_TRIAL) throw new Error("JA_ENCERRADO");
      const outcomes = body.action === "CANCEL" ? [] : body.outcomes;
      if (body.action === "CLOSE" && (!Array.isArray(outcomes) || outcomes.length !== conditional.items.length)) throw new Error("ACERTO_INVALIDO");
      for (const item of conditional.items) {
        const outcome = body.action === "CANCEL" ? ConditionalItemOutcome.RETURNED : outcomes.find((entry: { itemId?: string }) => entry?.itemId === item.id)?.outcome;
        if (outcome !== ConditionalItemOutcome.RETURNED && outcome !== ConditionalItemOutcome.PURCHASED) throw new Error("ACERTO_INVALIDO");
        await tx.conditionalItem.update({ where: { id: item.id }, data: { outcome } });
        if (outcome === ConditionalItemOutcome.RETURNED) await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
      }
      return tx.conditional.update({ where: { id }, data: { status: body.action === "CANCEL" ? ConditionalStatus.CANCELED : ConditionalStatus.COMPLETED, closedAt: new Date() }, include: { items: { include: { variant: { include: { product: { include: { images: true } } } } } } } });
    });
    return NextResponse.json({ conditional: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "NAO_ENCONTRADO" ? 404 : message === "JA_ENCERRADO" ? 409 : message === "ACERTO_INVALIDO" ? 400 : 500;
    return NextResponse.json({ error: status === 404 ? "Prova não encontrada." : status === 409 ? "Esta prova já foi encerrada." : status === 400 ? "Informe o destino final de cada peça." : "Não foi possível atualizar a prova." }, { status });
  }
}
