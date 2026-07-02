/** OCR 常见误识别修正 + 材料清单文本解析（单行/粘贴文本） */

const CODE_STRICT = /^[A-HM-Z]{1,2}\d{1,3}$/i;

/** 全角、常见 OCR 混淆归一化 */
export function normalizeOcrBlob(text: string): string {
  return text
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48))
    .replace(/[\uFF21-\uFF3A]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff21 + 65))
    .replace(/[\uFF41-\uFF5A]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff41 + 97))
    .replace(/[×xX]/g, " ")
    .replace(/[：:]/g, " ")
    .replace(/[|]/g, "1")
    .replace(/\s+/g, " ")
    .trim();
}

/** 将 OCR 色号候选修正为 MARD 格式，如 Al → A1 */
export function fixColorCode(raw: string): string | null {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!t) return null;

  const m = t.match(/^([A-HM-Z]{1,2})([0-9Il|O]+)$/);
  if (!m) return CODE_STRICT.test(t) ? t : null;

  const series = m[1];
  const num = m[2]
    .replace(/[Il|]/g, "1")
    .replace(/[Oo]/g, "0")
    .replace(/^0+/, "") || "0";

  const code = `${series}${num}`;
  return CODE_STRICT.test(code) ? code : null;
}

/** 解析单行文本中的 色号+数量（禁止跨行） */
export function parseMaterialLine(line: string): { code: string; quantity: number }[] {
  const normalized = normalizeOcrBlob(line);
  if (!normalized) return [];

  const result = new Map<string, number>();

  const setPair = (code: string, qty: number) => {
    if (qty >= 1 && qty <= 50000) result.set(code, qty);
  };

  // 色号在前
  const codeFirst = /([A-HM-Z]{1,2}\s*[0-9Il|O]{1,3})\s*[x×:：\-]?\s*(\d{1,5})/gi;
  for (const m of normalized.matchAll(codeFirst)) {
    const code = fixColorCode(m[1]);
    if (code) setPair(code, parseInt(m[2], 10));
  }

  // 数量在前
  const qtyFirst = /(\d{1,5})\s*[x×:\-]?\s*([A-HM-Z]{1,2}\s*[0-9Il|O]{1,3})/gi;
  for (const m of normalized.matchAll(qtyFirst)) {
    const code = fixColorCode(m[2]);
    if (code) setPair(code, parseInt(m[1], 10));
  }

  // 相邻 token：A1 320 / 320 A1
  const tokens = normalized.match(/[A-HM-Z]{1,2}[0-9Il|O]{1,3}|\d{1,5}/gi) ?? [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = fixColorCode(tokens[i]);
    const b = fixColorCode(tokens[i + 1]);
    const nA = /^\d+$/.test(tokens[i]) ? parseInt(tokens[i], 10) : null;
    const nB = /^\d+$/.test(tokens[i + 1]) ? parseInt(tokens[i + 1], 10) : null;
    if (a && nB !== null && !result.has(a)) {
      setPair(a, nB);
      i++;
    } else if (nA !== null && b && !result.has(b)) {
      setPair(b, nA);
      i++;
    }
  }

  return Array.from(result.entries()).map(([code, quantity]) => ({ code, quantity }));
}

/** 粘贴的多行清单（每行独立解析，不跨行全局扫描） */
export function parseMaterialListFromOcrText(text: string): { code: string; quantity: number }[] {
  const result = new Map<string, number>();
  for (const rawLine of text.split(/\r?\n/)) {
    for (const p of parseMaterialLine(rawLine)) {
      if (!result.has(p.code)) result.set(p.code, p.quantity);
    }
  }
  return Array.from(result.entries()).map(([code, quantity]) => ({ code, quantity }));
}
