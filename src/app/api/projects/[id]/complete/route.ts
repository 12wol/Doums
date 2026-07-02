import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { items: true, warehouse: true },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  if (project.status !== "BUILDING") {
    return NextResponse.json({ error: "仅「正在拼」状态可完成" }, { status: 400 });
  }
  if (!project.warehouseId) {
    return NextResponse.json({ error: "未关联豆仓" }, { status: 400 });
  }

  const warehouseId = project.warehouseId;
  const validItems = project.items.filter((i) => i.quantity > 0);

  const result = await prisma.$transaction(async (tx) => {
    for (const item of validItems) {
      const stock = await tx.stock.findUnique({
        where: {
          warehouseId_colorId: { warehouseId, colorId: item.colorId },
        },
      });
      if (!stock || stock.quantity < item.quantity) {
        const color = await tx.color.findUnique({ where: { id: item.colorId } });
        throw new Error(`${color?.code ?? "未知"} 库存不足，无法完成`);
      }
    }

    const consumption = await tx.consumption.create({
      data: {
        warehouseId,
        note: `拼完了：${project.title}`,
        source: "project",
        items: {
          create: validItems.map((i) => ({
            colorId: i.colorId,
            quantity: i.quantity,
          })),
        },
      },
    });

    for (const item of validItems) {
      await tx.stock.update({
        where: {
          warehouseId_colorId: { warehouseId, colorId: item.colorId },
        },
        data: { quantity: { decrement: item.quantity } },
      });
    }

    return tx.project.update({
      where: { id },
      data: {
        status: "COMPLETED",
        consumptionId: consumption.id,
        completedAt: new Date(),
      },
      include: {
        items: { include: { color: true } },
        warehouse: true,
      },
    });
  });

  return NextResponse.json(result);
}
