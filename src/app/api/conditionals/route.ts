import { ConditionalStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const conditionals = await prisma.conditional.findMany({
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: { items: { include: { variant: { include: { product: { include: { images: true } } } } } } },
  });
  return NextResponse.json({ conditionals });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerName = String(body.customerName ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const dueDate = new Date(body.dueDate);
    const items = Array.isArray(body.items) ? body.items as { variantId: string; quantity: number }[] : [];
    if (!customerName || !customerPhone || !Number.isFinite(dueDate.getTime()) || !items.length) {
      return NextResponse.json({ error: "Informe cliente, WhatsApp, retorno e ao menos uma peça." }, { status: 400 });
    }
    if (items.some((item) => !item.variantId || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
      return NextResponse.json({ error: "As quantidades das peças são inválidas." }, { status: 400 });
    }
    const conditional = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const changed = await tx.productVariant.updateMany({ where: { id: item.variantId, stock: { gte: Number(item.quantity) } }, data: { stock: { decrement: Number(item.quantity) } } });
        if (!changed.count) throw new Error("ESTOQUE_INSUFICIENTE");
      }
      return tx.conditional.create({ data: {
        customerName, customerPhone, address: body.address ? String(body.address).trim() : null,
        dueDate, status: ConditionalStatus.IN_TRIAL,
        items: { create: items.map((item) => ({ variantId: item.variantId, quantity: Number(item.quantity) })) },
      }, include: { items: { include: { variant: { include: { product: { include: { images: true } } } } } } } });
    });
    return NextResponse.json({ conditional }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ESTOQUE_INSUFICIENTE") return NextResponse.json({ error: "Estoque insuficiente para uma ou mais variantes." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "Não foi possível registrar a prova em casa." }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível registrar a prova em casa." }, { status: 500 });
  }
}
