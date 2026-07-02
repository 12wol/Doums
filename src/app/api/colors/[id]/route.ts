import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; hex?: string; imageUrl?: string | null } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.hex !== undefined) {
    const hex = String(body.hex).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return NextResponse.json({ error: "HEX 颜色格式无效" }, { status: 400 });
    }
    data.hex = hex;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  }

  const color = await prisma.color.update({ where: { id }, data });
  return NextResponse.json(color);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const color = await prisma.color.findUnique({ where: { id } });
  if (!color) {
    return NextResponse.json({ error: "色号不存在" }, { status: 404 });
  }
  await prisma.color.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
