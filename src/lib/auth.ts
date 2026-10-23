import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("A variável JWT_SECRET não está configurada.");
  }
  return secret;
};

export function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ email }, getJwtSecret(), {
    algorithm: "HS256",
    subject: userId,
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    return typeof payload === "string" ? null : payload;
  } catch {
    return null;
  }
}
