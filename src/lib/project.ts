const CODE_PATTERN = /([A-Z]+\d+)/i;

/** 从材料清单文字中解析 色号+数量（支持左/右/下方等文本顺序） */
export function parseMaterialListText(text: string): { code: string; quantity: number }[] {
  const lines = text.split(/\r?\n/);
  const result = new Map<string, number>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // A1 320 / A1:320 / A1×320
    const rightQty = line.match(new RegExp(`^${CODE_PATTERN.source}\\s*[x×:：]?\\s*(\\d+)`, "i"));
    if (rightQty) {
      merge(result, rightQty[1].toUpperCase(), parseInt(rightQty[2], 10));
      continue;
    }

    // 320 A1 / 320×A1
    const leftQty = line.match(new RegExp(`^(\\d+)\\s*[x×]?\\s*${CODE_PATTERN.source}`, "i"));
    if (leftQty) {
      merge(result, leftQty[2].toUpperCase(), parseInt(leftQty[1], 10));
      continue;
    }

    // 行内多个：A1 320 B2 150
    const tokens = line.match(/[A-Z]+\d+|\d+/gi);
    if (tokens && tokens.length >= 2) {
      for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i];
        const b = tokens[i + 1];
        if (CODE_PATTERN.test(a) && /^\d+$/.test(b)) {
          merge(result, a.toUpperCase(), parseInt(b, 10));
          i++;
        } else if (/^\d+$/.test(a) && CODE_PATTERN.test(b)) {
          merge(result, b.toUpperCase(), parseInt(a, 10));
          i++;
        }
      }
    }
  }

  return Array.from(result.entries()).map(([code, quantity]) => ({ code, quantity }));
}

function merge(map: Map<string, number>, code: string, qty: number) {
  if (qty > 0) map.set(code, (map.get(code) ?? 0) + qty);
}

export type StockCheckLine = {
  colorId: string;
  code: string;
  name: string;
  hex: string;
  required: number;
  available: number;
  shortage: number;
  sufficient: boolean;
};

export function checkProjectStock(
  items: { colorId: string; quantity: number; color: { code: string; name: string; hex: string } }[],
  stocks: { colorId: string; quantity: number }[]
): { lines: StockCheckLine[]; sufficient: boolean; totalRequired: number; totalShortage: number } {
  const stockMap = new Map(stocks.map((s) => [s.colorId, s.quantity]));
  const lines: StockCheckLine[] = items.map((item) => {
    const available = stockMap.get(item.colorId) ?? 0;
    const shortage = Math.max(0, item.quantity - available);
    return {
      colorId: item.colorId,
      code: item.color.code,
      name: item.color.name,
      hex: item.color.hex,
      required: item.quantity,
      available,
      shortage,
      sufficient: shortage === 0,
    };
  });
  const sufficient = lines.every((l) => l.sufficient);
  const totalRequired = lines.reduce((s, l) => s + l.required, 0);
  const totalShortage = lines.reduce((s, l) => s + l.shortage, 0);
  return { lines, sufficient, totalRequired, totalShortage };
}
