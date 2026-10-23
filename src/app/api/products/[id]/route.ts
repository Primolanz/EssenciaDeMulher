import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/admin-auth";
import { deleteImage } from "../../../../lib/cloudinary";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const isAdmin = await isAdminRequest(request);
  const product = await prisma.product.findFirst({
    where: { id, ...(isAdmin ? {} : { active: true }) },
    include: {
      category: true,
      variants: true,
      images: { orderBy: { isMain: "desc" } },
    },
  });
  if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  return NextResponse.json({ product });
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dados do produto inválidos." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const current = await prisma.product.findUnique({
    where: { id },
    include: { images: true },
  });
  if (!current) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) {
    if (typeof data.description !== "string") return NextResponse.json({ error: "Descrição inválida." }, { status: 400 });
    updateData.description = data.description;
  }
  if (data.price !== undefined) {
    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    updateData.price = price;
  }
  if (data.categoryId !== undefined) {
    if (typeof data.categoryId !== "string" || !(await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 400 });
    }
    updateData.categoryId = data.categoryId;
  }
  if (data.active !== undefined) {
    if (typeof data.active !== "boolean") return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    updateData.active = data.active;
  }
  if (data.featured !== undefined) {
    if (typeof data.featured !== "boolean") return NextResponse.json({ error: "Destaque inválido." }, { status: 400 });
    updateData.featured = data.featured;
  }

  let imageInputs: Array<{ url: string; publicId: string; isMain: boolean }> | undefined;
  let variantInputs: Array<{ size: string; color: string; stock: number }> | undefined;
  try {
    if (data.images !== undefined || data.variants !== undefined) {
      const parsed = parseUpdateRelations(data);
      imageInputs = parsed.images;
      variantInputs = parsed.variants;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relações inválidas." }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...updateData,
      ...(variantInputs ? { variants: { deleteMany: {}, create: variantInputs } } : {}),
      ...(imageInputs ? { images: { deleteMany: {}, create: imageInputs } } : {}),
    },
    include: { category: true, variants: true, images: true },
  });

  const retainedPublicIds = new Set(imageInputs?.map((image) => image.publicId) ?? []);
  const removedImages = imageInputs
    ? current.images.filter((image) => !retainedPublicIds.has(image.publicId))
    : [];
  const cleanup = await Promise.allSettled(removedImages.map((image) => deleteImage(image.publicId)));
  const cleanupFailures = cleanup.flatMap((result, index) =>
    result.status === "rejected" ? [removedImages[index].publicId] : [],
  );

  return NextResponse.json({ product, ...(cleanupFailures.length ? { imageCleanupFailures: cleanupFailures } : {}) });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  const cleanup = await Promise.allSettled(product.images.map((image) => deleteImage(image.publicId)));
  const imageCleanupFailures = cleanup.flatMap((result, index) =>
    result.status === "rejected" ? [product.images[index].publicId] : [],
  );
  return NextResponse.json({ deleted: true, ...(imageCleanupFailures.length ? { imageCleanupFailures } : {}) });
}

function parseUpdateRelations(data: Record<string, unknown>) {
  const variants = data.variants;
  const images = data.images;
  if (variants !== undefined && !Array.isArray(variants)) throw new Error("Variantes inválidas.");
  if (images !== undefined && !Array.isArray(images)) throw new Error("Imagens inválidas.");

  const parsedVariants = (variants as unknown[] | undefined)?.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Variante inválida.");
    const value = item as Record<string, unknown>;
    if (typeof value.size !== "string" || !value.size.trim() || typeof value.color !== "string" || !value.color.trim() || !Number.isInteger(value.stock) || (value.stock as number) < 0) {
      throw new Error("Cada variante precisa de tamanho, cor e estoque válido.");
    }
    return { size: value.size.trim(), color: value.color.trim(), stock: value.stock as number };
  });
  const parsedImages = (images as unknown[] | undefined)?.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Imagem inválida.");
    const value = item as Record<string, unknown>;
    if (typeof value.url !== "string" || !value.url.trim() || typeof value.publicId !== "string" || !value.publicId.trim()) {
      throw new Error("Cada imagem precisa de URL e publicId.");
    }
    return { url: value.url.trim(), publicId: value.publicId.trim(), isMain: value.isMain === true };
  });
  if (parsedImages && parsedImages.filter((image) => image.isMain).length > 1) throw new Error("Defina no máximo uma imagem principal.");
  return { variants: parsedVariants, images: parsedImages };
}
