import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compareColorCode } from "@/lib/utils";

const projectInclude = {
  items: { include: { color: true } },
  warehouse: true,
} as const;

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const projects = await prisma.project.findMany({
    where: status ? { status } : undefined,
    include: projectInclude,
    orderBy: { updatedAt: "desc" },
  });
  for (const p of projects) {
    p.items.sort((a, b) => compareColorCode(a.color.code, b.color.code));
  }
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body.title ?? "未命名图纸").trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  const note = body.note ? String(body.note).trim() : null;
  const items: { colorId: string; quantity: number }[] = body.items ?? [];

  if (items.length === 0) {
    return NextResponse.json({ error: "请添加所需豆子" }, { status: 400 });
  }

  const validItems = items
    .map((i) => ({ colorId: i.colorId, quantity: Math.floor(Number(i.quantity)) }))
    .filter((i) => i.quantity > 0);

  if (validItems.length === 0) {
    return NextResponse.json({ error: "数量必须大于 0" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      title,
      imageUrl,
      note,
      status: "WISH",
      items: { create: validItems },
    },
    include: projectInclude,
  });

  return NextResponse.json(project, { status: 201 });
}
