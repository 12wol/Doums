import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compareColorCode, parseColorSeries } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get("series");
  const search = req.nextUrl.searchParams.get("q");

  const colors = await prisma.color.findMany({
    where: {
      ...(series ? { series } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { name: { contains: search } },
            ],
          }
        : {}),
    },
  });
  colors.sort((a, b) => compareColorCode(a.code, b.code));
  return NextResponse.json(colors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? code).trim();
  const hex = String(body.hex ?? "").trim();
  const series = body.series ? String(body.series).trim().toUpperCase() : parseColorSeries(code);
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
  const initialQty = Math.max(0, Math.floor(Number(body.initialQty ?? 0)));

  if (!code) {
    return NextResponse.json({ error: "色号不能为空" }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return NextResponse.json({ error: "HEX 颜色格式无效（如 #ff0000）" }, { status: 400 });
  }

  const existing = await prisma.color.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: `色号 ${code} 已存在` }, { status: 409 });
  }

  const color = await prisma.$transaction(async (tx) => {
    const created = await tx.color.create({
      data: { code, name, hex, series, imageUrl },
    });

    const warehouses = await tx.warehouse.findMany();
    if (warehouses.length > 0) {
      await tx.stock.createMany({
        data: warehouses.map((wh) => ({
          warehouseId: wh.id,
          colorId: created.id,
          quantity: initialQty > 0 ? initialQty : wh.defaultQty,
        })),
      });
    }

    return created;
  });

  return NextResponse.json(color, { status: 201 });
}
