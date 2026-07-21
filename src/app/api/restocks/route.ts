import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const warehouseId = req.nextUrl.searchParams.get("warehouseId");
  const restocks = await prisma.restock.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      warehouse: true,
      items: { include: { color: true } },
    },
  });
  return NextResponse.json(restocks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const warehouseId = String(body.warehouseId ?? "");
  const note = body.note ? String(body.note).trim() : null;
  const items: { colorId: string; quantity: number }[] = body.items ?? [];

  if (!warehouseId) {
    return NextResponse.json({ error: "请选择仓库" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "请添加补豆色号" }, { status: 400 });
  }

  const validItems = items
    .map((i) => ({ colorId: i.colorId, quantity: Math.floor(Number(i.quantity)) }))
    .filter((i) => i.quantity > 0);

  if (validItems.length === 0) {
    return NextResponse.json({ error: "补豆数量必须大于 0" }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    return NextResponse.json({ error: "仓库不存在" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const stock = await tx.stock.findUnique({
          where: {
            warehouseId_colorId: { warehouseId, colorId: item.colorId },
          },
        });
        if (!stock) {
          const color = await tx.color.findUnique({ where: { id: item.colorId } });
          throw new Error(`${color?.code ?? "未知"} 库存记录不存在`);
        }
      }

      const restock = await tx.restock.create({
        data: {
          warehouseId,
          note,
          items: { create: validItems },
        },
        include: { items: { include: { color: true } } },
      });

      for (const item of validItems) {
        await tx.stock.update({
          where: {
            warehouseId_colorId: { warehouseId, colorId: item.colorId },
          },
          data: { quantity: { increment: item.quantity } },
        });
      }

      return restock;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "补豆失败" },
      { status: 400 }
    );
  }
}
