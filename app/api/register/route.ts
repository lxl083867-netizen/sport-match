import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { err, handleApiError } from "@/lib/responses";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (typeof email !== "string" || !isValidEmail(email)) {
      return err(400, "请填写有效邮箱", "INVALID_PARAMS");
    }
    if (typeof password !== "string" || password.length < 6 || password.length > 100) {
      return err(400, "密码为必填，长度需为 6 到 100 位", "INVALID_PARAMS");
    }
    if (name !== undefined && name !== null && (typeof name !== "string" || name.length > 60)) {
      return err(400, "昵称不能超过 60 字", "INVALID_PARAMS");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return err(409, "该邮箱已被注册", "CONFLICT");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: typeof name === "string" ? name.trim() || null : null,
        email: normalizedEmail,
        passwordHash,
      },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
