import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** 按色号汇总消耗量，从多到少 */
export async function GET(req: NextRequest) {
  const warehouseId = req.nextUrl.searchParams.get("warehouseId");

  const grouped = await prisma.consumptionItem.groupBy({
    by: ["colorId"],
    where: warehouseId
      ? { consumption: { warehouseId } }
      : undefined,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
  });

  if (grouped.length === 0) {
    return NextResponse.json({ items: [], totalBeads: 0 });
  }

  const colorIds = grouped.map((g) => g.colorId);
  const colors = await prisma.color.findMany({
    where: { id: { in: colorIds } },
  });
  const colorMap = new Map(colors.map((c) => [c.id, c]));

  const items = grouped
    .map((g) => {
      const color = colorMap.get(g.colorId);
      if (!color) return null;
      return {
        colorId: g.colorId,
        code: color.code,
        name: color.name,
        hex: color.hex,
        series: color.series,
        quantity: g._sum.quantity ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.quantity > 0);

  const totalBeads = items.reduce((s, i) => s + i.quantity, 0);

  return NextResponse.json({ items, totalBeads });
}
