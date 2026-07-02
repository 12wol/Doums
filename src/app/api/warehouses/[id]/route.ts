import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compareColorCode } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      stocks: { include: { color: true } },
    },
  });
  if (!warehouse) {
    return NextResponse.json({ error: "仓库不存在" }, { status: 404 });
  }
  warehouse.stocks.sort((a, b) => compareColorCode(a.color.code, b.color.code));
  return NextResponse.json(warehouse);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; description?: string | null; defaultQty?: number } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.defaultQty !== undefined) data.defaultQty = Number(body.defaultQty);

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data,
  });
  return NextResponse.json(warehouse);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
