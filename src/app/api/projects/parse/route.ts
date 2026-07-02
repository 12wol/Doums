import { NextRequest, NextResponse } from "next/server";
import { parseMaterialListText } from "@/lib/project";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = String(body.text ?? "");
  if (!text.trim()) {
    return NextResponse.json({ error: "请粘贴材料清单文字" }, { status: 400 });
  }

  const parsed = parseMaterialListText(text);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "未能识别到色号与数量，请检查格式" }, { status: 400 });
  }

  const codes = parsed.map((p) => p.code);
  const colors = await prisma.color.findMany({ where: { code: { in: codes } } });
  const colorMap = new Map(colors.map((c) => [c.code, c]));

  const items = parsed
    .filter((p) => colorMap.has(p.code))
    .map((p) => ({
      colorId: colorMap.get(p.code)!.id,
      code: p.code,
      hex: colorMap.get(p.code)!.hex,
      quantity: p.quantity,
    }));

  const unknown = parsed.filter((p) => !colorMap.has(p.code)).map((p) => p.code);

  return NextResponse.json({ items, unknown });
}
