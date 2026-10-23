import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

type VariantInput = { size: string; color: string; stock: number };
type ImageInput = { url: string; publicId: string; isMain?: boolean };

function parseRelations(body: Record<string, unknown>) {
  const variants = body.variants;
  const images = body.images;
  if (variants !== undefined && !Array.isArray(variants)) return null;
  if (images !== undefined && !Array.isArray(images)) return null;

  const variantArray: unknown[] = Array.isArray(variants) ? variants : [];
  const imageArray: unknown[] = Array.isArray(images) ? images : [];

  const parsedVariants: VariantInput[] = variantArray.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Variante inválida.");
    const value = item as Record<string, unknown>;
    if (
      typeof value.size !== "string" ||
      !value.size.trim() ||
      typeof value.color !== "string" ||
      !value.color.trim() ||
      !Number.isInteger(value.stock) ||
      (value.stock as number) < 0
    ) throw new Error("Cada variante precisa de tamanho, cor e estoque válido.");
    return { size: value.size.trim(), color: value.color.trim(), stock: value.stock as number };
  });

  const parsedImages: ImageInput[] = imageArray.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Imagem inválida.");
    const value = item as Record<string, unknown>;
    if (typeof value.url !== "string" || !value.url.trim() || typeof value.publicId !== "string" || !value.publicId.trim()) {
      throw new Error("Cada imagem precisa de URL e publicId.");
    }
    return {
      url: value.url.trim(),
      publicId: value.publicId.trim(),
      isMain: value.isMain === true,
    };
  });
  if (parsedImages.filter((image) => image.isMain).length > 1) {
    throw new Error("Defina no máximo uma imagem principal.");
  }
  return { variants: parsedVariants, images: parsedImages };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "12", 10) || 12));
  const category = url.searchParams.get("category")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const isAdmin = await isAdminRequest(request);

  const where = {
    ...(isAdmin ? {} : { active: true }),
    ...(category ? { category: { slug: category } } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      include: { category: true, variants: true, images: { orderBy: { isMain: "desc" } } },
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({ products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

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
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const categoryId = typeof data.categoryId === "string" ? data.categoryId : "";
  const price = typeof data.price === "number" || typeof data.price === "string" ? Number(data.price) : NaN;
  let relations: ReturnType<typeof parseRelations>;
  try {
    relations = parseRelations(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relações inválidas." }, { status: 400 });
  }

  if (!name || !description || !categoryId || !Number.isFinite(price) || price < 0 || !relations) {
    return NextResponse.json({ error: "Nome, descrição, preço e categoria são obrigatórios." }, { status: 400 });
  }
  const categoryExists = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!categoryExists) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      name,
      description,
      price,
      categoryId,
      active: typeof data.active === "boolean" ? data.active : true,
      featured: typeof data.featured === "boolean" ? data.featured : false,
      variants: { create: relations.variants },
      images: { create: relations.images },
    },
    include: { category: true, variants: true, images: true },
  });
  return NextResponse.json({ product }, { status: 201 });
}
