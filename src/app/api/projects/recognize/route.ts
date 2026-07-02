import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  recognizeFromTokens,
  recognizeFromText,
  type OcrToken,
  type RecognizedPair,
} from "@/lib/recognize-material";
import { compareColorCode } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tokens = body.tokens as OcrToken[] | undefined;
  const text = body.text as string | undefined;

  let pairs: RecognizedPair[] = [];
  let rawText = text ?? "";
  let debug = {};

  if (tokens && tokens.length > 0) {
    const result = recognizeFromTokens(tokens, text);
    pairs = result.pairs;
    rawText = result.rawText;
    debug = result.debug;
  } else if (text?.trim()) {
    pairs = recognizeFromText(text);
    rawText = text;
  } else {
    return NextResponse.json({ error: "请提供 OCR tokens 或文字" }, { status: 400 });
  }

  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "未能识别到色号与数量", pairs: [], unknown: [], rawText, debug },
      { status: 422 }
    );
  }

  const codes = pairs.map((p) => p.code);
  const colors = await prisma.color.findMany({ where: { code: { in: codes } } });
  const colorMap = new Map(colors.map((c) => [c.code, c]));

  const matched = pairs
    .filter((p) => colorMap.has(p.code))
    .map((p) => {
      const c = colorMap.get(p.code)!;
      return {
        ...p,
        colorId: c.id,
        hex: c.hex,
        name: c.name,
      };
    })
    .sort((a, b) => compareColorCode(a.code, b.code));

  const unknown = pairs.filter((p) => !colorMap.has(p.code)).map((p) => p.code);

  return NextResponse.json({ pairs: matched, unknown, rawText, debug });
}
