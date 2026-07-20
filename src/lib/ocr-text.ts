/** OCR 常见误识别修正 + 材料清单文本解析（单行/粘贴文本） */

import { MARD_COLORS } from "@/data/mard-colors";

/** MARD：单字母 A–H / M + 1~2 位数字 */
const CODE_STRICT = /^[A-HM]\d{1,2}$/i;
const LETTER_ONLY = /^[A-HM]$/i;
const DIGITS_ONLY = /^\d{1,5}$/;
const KNOWN_CODES = new Set(MARD_COLORS.map((c) => c.code.toUpperCase()));

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

  const m = t.match(/^([A-HM])([0-9Il|O]{1,2})$/);
  if (!m) return null;

  const series = m[1];
  const num =
    m[2]
      .replace(/[Il|]/g, "1")
      .replace(/[Oo]/g, "0")
      .replace(/^0+(\d)/, "$1") || "0";

  // 避免 A0 这类无效号：数字部分全 0 且不在色库则丢弃
  const code = `${series}${num}`;
  if (!CODE_STRICT.test(code)) return null;
  if (KNOWN_CODES.size > 0 && !KNOWN_CODES.has(code)) return null;
  return code;
}

/**
 * 将一行拆成 token，并合并被 OCR 拆开的色号（如 F + 11 → F11）。
 * 规则：数量只跟在色号后面，禁止「数量在前」。
 */
export function tokenizeMaterialLine(line: string): string[] {
  const normalized = normalizeOcrBlob(line);
  if (!normalized) return [];

  // 单字母色号 / 纯数字；杂讯字母串不会整段吞掉
  const raw = normalized.match(/[A-HM]\d{0,2}|\d{1,5}/gi) ?? [];
  const out: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw[i + 1];

    // F + 11 → F11（仅单字母 + 1~2 位数字，且必须在色库中）
    if (
      next &&
      LETTER_ONLY.test(cur) &&
      DIGITS_ONLY.test(next) &&
      next.length <= 2
    ) {
      const merged = fixColorCode(cur + next);
      if (merged) {
        out.push(merged);
        i++;
        continue;
      }
    }

    const asCode = fixColorCode(cur);
    if (asCode) {
      out.push(asCode);
      continue;
    }

    if (DIGITS_ONLY.test(cur)) {
      out.push(cur);
      continue;
    }

    // 单独字母且无法合并 → 丢弃
  }

  return out;
}

/**
 * 从左到右顺序配对：色号 → 其后第一个纯数字为数量。
 * 不支持「数量在色号前面」。
 */
export function parseMaterialLine(line: string): { code: string; quantity: number }[] {
  const tokens = tokenizeMaterialLine(line);
  const result: { code: string; quantity: number }[] = [];
  const used = new Set<number>();

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const code = fixColorCode(tokens[i]);
    if (!code) continue;

    let qtyIdx = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      if (used.has(j)) continue;
      if (fixColorCode(tokens[j])) break;
      if (DIGITS_ONLY.test(tokens[j])) {
        qtyIdx = j;
        break;
      }
    }

    if (qtyIdx < 0) continue;
    const qty = parseInt(tokens[qtyIdx], 10);
    if (qty < 1 || qty > 50000) continue;

    used.add(i);
    used.add(qtyIdx);
    result.push({ code, quantity: qty });
  }

  return result;
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
