import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({
    include: {
      stocks: { include: { color: true } },
      _count: { select: { consumptions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const colorCount = await prisma.color.count();

  const stats = warehouses.map((wh) => {
    const totalQty = wh.stocks.reduce((s, st) => s + st.quantity, 0);
    const lowStock = wh.stocks.filter((st) => st.quantity < 200).length;
    const emptyStock = wh.stocks.filter((st) => st.quantity === 0).length;
    const seriesTotals: Record<string, number> = {};
    for (const st of wh.stocks) {
      seriesTotals[st.color.series] = (seriesTotals[st.color.series] ?? 0) + st.quantity;
    }
    return {
      id: wh.id,
      name: wh.name,
      uniqueCode: wh.uniqueCode,
      defaultQty: wh.defaultQty,
      totalQty,
      colorCount: wh.stocks.length,
      lowStock,
      emptyStock,
      consumptionCount: wh._count.consumptions,
      seriesTotals,
      createdAt: wh.createdAt,
    };
  });

  const grandTotal = stats.reduce((s, w) => s + w.totalQty, 0);

  const recentConsumptions = await prisma.consumption.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      items: { include: { color: true } },
    },
  });

  return NextResponse.json({
    grandTotal,
    warehouseCount: warehouses.length,
    colorCount,
    warehouses: stats,
    recentConsumptions: recentConsumptions.map((c) => ({
      id: c.id,
      note: c.note,
      source: c.source,
      createdAt: c.createdAt,
      warehouseName: c.warehouse.name,
      totalBeads: c.items.reduce((s, i) => s + i.quantity, 0),
      colorCount: c.items.length,
    })),
  });
}
