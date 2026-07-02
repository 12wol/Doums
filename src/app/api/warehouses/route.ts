import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWarehouseCode } from "@/lib/utils";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { stocks: true } } },
  });
  return NextResponse.json(warehouses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const defaultQty = Number(body.defaultQty ?? 1000);
  const description = body.description ? String(body.description).trim() : null;

  if (!name) {
    return NextResponse.json({ error: "仓库名称不能为空" }, { status: 400 });
  }
  if (!Number.isFinite(defaultQty) || defaultQty < 0) {
    return NextResponse.json({ error: "默认库存数量无效" }, { status: 400 });
  }

  const colors = await prisma.color.findMany();
  if (colors.length === 0) {
    return NextResponse.json({ error: "色号数据未初始化，请先运行 npm run db:setup" }, { status: 500 });
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      name,
      uniqueCode: generateWarehouseCode(),
      defaultQty,
      description,
      stocks: {
        create: colors.map((c) => ({
          colorId: c.id,
          quantity: defaultQty,
        })),
      },
    },
    include: { _count: { select: { stocks: true } } },
  });

  return NextResponse.json(warehouse, { status: 201 });
}
