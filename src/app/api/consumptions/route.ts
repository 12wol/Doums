import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const warehouseId = req.nextUrl.searchParams.get("warehouseId");
  const consumptions = await prisma.consumption.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      warehouse: true,
      items: { include: { color: true } },
    },
  });
  return NextResponse.json(consumptions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const warehouseId = String(body.warehouseId ?? "");
  const note = body.note ? String(body.note).trim() : null;
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const projectTitle = body.projectTitle ? String(body.projectTitle).trim() : null;
  const items: { colorId: string; quantity: number }[] = body.items ?? [];

  if (!warehouseId) {
    return NextResponse.json({ error: "请选择仓库" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "请添加消耗色号" }, { status: 400 });
  }

  const validItems = items
    .map((i) => ({ colorId: i.colorId, quantity: Math.floor(Number(i.quantity)) }))
    .filter((i) => i.quantity > 0);

  if (validItems.length === 0) {
    return NextResponse.json({ error: "消耗数量必须大于 0" }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    return NextResponse.json({ error: "仓库不存在" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const item of validItems) {
      const stock = await tx.stock.findUnique({
        where: {
          warehouseId_colorId: { warehouseId, colorId: item.colorId },
        },
      });
      if (!stock) {
        throw new Error("库存记录不存在");
      }
      if (stock.quantity < item.quantity) {
        const color = await tx.color.findUnique({ where: { id: item.colorId } });
        throw new Error(`${color?.code ?? "未知"} 库存不足（当前 ${stock.quantity}）`);
      }
    }

    const consumption = await tx.consumption.create({
      data: {
        warehouseId,
        note,
        source: "manual",
        items: { create: validItems },
      },
      include: { items: { include: { color: true } } },
    });

    for (const item of validItems) {
      await tx.stock.update({
        where: {
          warehouseId_colorId: { warehouseId, colorId: item.colorId },
        },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    if (imageUrl) {
      await tx.project.create({
        data: {
          title: projectTitle || note || "拼豆作品",
          imageUrl,
          status: "COMPLETED",
          warehouseId,
          consumptionId: consumption.id,
          completedAt: new Date(),
          items: {
            create: validItems.map((i) => ({
              colorId: i.colorId,
              quantity: i.quantity,
            })),
          },
        },
      });
    }

    return consumption;
  });

  return NextResponse.json(result, { status: 201 });
}
