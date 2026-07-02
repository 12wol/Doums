import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: warehouseId } = await params;
  const body = await req.json();
  const items: { colorId: string; quantity: number }[] = body.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "请提供库存项" }, { status: 400 });
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.stock.update({
        where: {
          warehouseId_colorId: {
            warehouseId,
            colorId: item.colorId,
          },
        },
        data: { quantity: Math.max(0, Math.floor(item.quantity)) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
