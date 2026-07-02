import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const colors = await prisma.color.findMany({
    select: { series: true },
    distinct: ["series"],
  });
  const series = colors
    .map((c) => c.series)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return NextResponse.json(series);
}
