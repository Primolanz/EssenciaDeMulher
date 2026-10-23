import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";

const ADMIN_EMAIL = "admin@essenciademulher.com.br";

export async function GET() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "Configure ADMIN_SEED_PASSWORD para criar o administrador inicial." },
      { status: 503 },
    );
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existingAdmin) {
    return NextResponse.json({ error: "O administrador inicial já existe." }, { status: 409 });
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json(
      { error: "Já existe um usuário. A criação inicial foi desativada." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const admin = await prisma.user.create({
      data: { email: ADMIN_EMAIL, password: passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
    return NextResponse.json({ user: admin }, { status: 201 });
  } catch {
    // Handles concurrent seed requests that race after the count check.
    return NextResponse.json({ error: "O administrador já foi criado." }, { status: 409 });
  }
}
