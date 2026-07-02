import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkProjectStock } from "@/lib/project";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const warehouseId = String(body.warehouseId ?? "");

  if (!warehouseId) {
    return NextResponse.json({ error: "请选择豆仓" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: { items: { include: { color: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  if (project.status !== "WISH") {
    return NextResponse.json({ error: "仅「想拼」状态可检查库存" }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    include: { stocks: true },
  });
  if (!warehouse) {
    return NextResponse.json({ error: "豆仓不存在" }, { status: 404 });
  }

  const check = checkProjectStock(project.items, warehouse.stocks);
  return NextResponse.json({
    warehouseId,
    warehouseName: warehouse.name,
    ...check,
  });
}
