import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/admin-auth";
import { deleteImage, uploadToCloudinary } from "../../../lib/cloudinary";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie um formulário multipart válido." }, { status: 400 });
  }

  const files = [...formData.getAll("images"), ...formData.getAll("files")].filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  if (files.length === 0) return NextResponse.json({ error: "Envie ao menos uma imagem." }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Envie no máximo ${MAX_FILES} imagens por requisição.` }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `Formato de imagem não permitido: ${file.name}` }, { status: 415 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: `A imagem ${file.name} excede 10 MB.` }, { status: 413 });
  }

  const uploaded: Array<{ url: string; publicId: string }> = [];
  try {
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await uploadToCloudinary(buffer);
      uploaded.push({ url: result.secure_url, publicId: result.public_id });
    }
  } catch (err) {
    await Promise.allSettled(uploaded.map((image) => deleteImage(image.publicId)));
    console.error("Cloudinary Error Detail:", err);
    const message = err instanceof Error && err.message
      ? err.message
      : JSON.stringify(err) || "Erro no Cloudinary";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ images: uploaded }, { status: 201 });
}
