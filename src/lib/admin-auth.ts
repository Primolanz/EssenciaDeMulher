import { verifyToken } from "./auth";
import { prisma } from "./prisma";

function getAuthCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("auth-token="));

  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("auth-token=".length));
  } catch {
    return null;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const token = getAuthCookie(request);
  if (!token) return false;

  const payload = verifyToken(token);
  if (!payload?.sub) return false;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true },
  });
  return Boolean(user);
}
