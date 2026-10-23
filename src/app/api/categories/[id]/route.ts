import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function PUT(request: Request, { params }: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string"
    ? body.name.trim()
    : "";
  const slug = slugify(name);
  if (!name || !slug) {
    return NextResponse.json({ error: "Informe um nome de categoria válido." }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });

  const conflicting = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (conflicting && conflicting.id !== id) {
    return NextResponse.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
  }

  const category = await prisma.category.update({ where: { id }, data: { name, slug } });
  return NextResponse.json({ category });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  if (category._count.products > 0) {
    return NextResponse.json(
      { error: `Esta categoria tem ${category._count.products} produto(s). Mova ou exclua esses produtos antes de removê-la.` },
      { status: 409 },
    );
  }

  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir a categoria. Verifique se há produtos vinculados." }, { status: 409 });
  }
}
