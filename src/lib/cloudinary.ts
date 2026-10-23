import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

console.log("Cloudinary Config Loaded:", !!process.env.CLOUDINARY_API_SECRET);

function ensureCloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET.");
  }
}

export function uploadToCloudinary(
  buffer: Buffer,
  folder = "essencia-de-mulher",
): Promise<UploadApiResponse> {
  ensureCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("O Cloudinary não retornou os dados da imagem."));
        resolve(result);
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  ensureCloudinaryConfig();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Falha ao excluir imagem do Cloudinary: ${result.result}`);
  }
}
