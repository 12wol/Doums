import { parseMaterialListFromOcrText, parseMaterialLine, fixColorCode, normalizeOcrBlob } from "./ocr-text";

export type BBox = { x0: number; y0: number; x1: number; y1: number };

export type OcrToken = {
  text: string;
  bbox: BBox;
};

export type OcrLine = {
  text: string;
  bbox: BBox;
  tokens: OcrToken[];
};

/** 数量只在色号右侧或下方 */
export type LayoutDirection = "right" | "below";

export type RecognizedPair = {
  code: string;
  quantity: number;
  layout: LayoutDirection;
  confidence: number;
  method: "line-seq" | "line-text" | "line-below" | "cell";
};

const MIN_QTY = 1;
const MAX_QTY = 50000;
const LETTER_ONLY = /^[A-HM]$/i;
const DIGITS_ONLY = /^\d{1,5}$/;

const METHOD_PRIORITY: Record<RecognizedPair["method"], number> = {
  "line-seq": 5,
  "line-text": 4,
  "line-below": 3,
  cell: 2,
};

function center(b: BBox) {
  return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
}

function size(b: BBox) {
  return { w: b.x1 - b.x0, h: b.y1 - b.y0 };
}

function parseQuantity(text: string): number | null {
  const t = text.replace(/\D/g, "");
  if (!t) return null;
  const n = parseInt(t, 10);
  if (n < MIN_QTY || n > MAX_QTY) return null;
  return n;
}

function tokenAsCode(text: string): string | null {
  return fixColorCode(normalizeOcrBlob(text));
}

type Metrics = { medianH: number; medianW: number };

function computeMetrics(tokens: OcrToken[]): Metrics {
  if (tokens.length === 0) return { medianH: 16, medianW: 24 };
  const hs = tokens.map((t) => size(t.bbox).h).sort((a, b) => a - b);
  const ws = tokens.map((t) => size(t.bbox).w).sort((a, b) => a - b);
  const mid = Math.floor(hs.length / 2);
  return {
    medianH: hs[mid] || 16,
    medianW: ws[mid] || 24,
  };
}

/** 合并被拆开的色号：F + 11 → F11 */
function mergeSplitCodeTokens(tokens: OcrToken[], medianW: number): OcrToken[] {
  const sorted = [...tokens].sort(
    (a, b) => center(a.bbox).cy - center(b.bbox).cy || center(a.bbox).cx - center(b.bbox).cx
  );
  const out: OcrToken[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const letter = LETTER_ONLY.test(cur.text.trim());
    const digits = next && DIGITS_ONLY.test(next.text.trim()) && next.text.trim().length <= 3;

    // F + 11 → F11（单字母 + ≤2 位数字）
    if (letter && digits && next!.text.trim().length <= 2) {
      const sameRow = Math.abs(center(cur.bbox).cy - center(next.bbox).cy) <= medianW * 0.8;
      const closeX = center(next.bbox).cx > center(cur.bbox).cx && center(next.bbox).cx - center(cur.bbox).cx <= medianW * 4;
      const merged = fixColorCode(cur.text + next.text);
      if (sameRow && closeX && merged) {
        out.push({
          text: merged,
          bbox: {
            x0: Math.min(cur.bbox.x0, next.bbox.x0),
            y0: Math.min(cur.bbox.y0, next.bbox.y0),
            x1: Math.max(cur.bbox.x1, next.bbox.x1),
            y1: Math.max(cur.bbox.y1, next.bbox.y1),
          },
        });
        i++;
        continue;
      }
    }
    out.push(cur);
  }

  return out;
}

/** 将词级 token 按 Y 坐标合并为行 */
export function groupTokensIntoLines(tokens: OcrToken[]): OcrLine[] {
  if (tokens.length === 0) return [];

  const sorted = [...tokens].sort(
    (a, b) => center(a.bbox).cy - center(b.bbox).cy || center(a.bbox).cx - center(b.bbox).cx
  );

  const lines: OcrToken[][] = [];
  for (const token of sorted) {
    const cy = center(token.bbox).cy;
    const last = lines[lines.length - 1];
    if (!last) {
      lines.push([token]);
      continue;
    }
    const refCy = last.reduce((s, t) => s + center(t.bbox).cy, 0) / last.length;
    const avgH = last.reduce((s, t) => s + size(t.bbox).h, 0) / last.length;
    if (Math.abs(cy - refCy) <= avgH * 0.6) last.push(token);
    else lines.push([token]);
  }

  return lines.map((lineTokens) => {
    lineTokens.sort((a, b) => center(a.bbox).cx - center(b.bbox).cx);
    const text = lineTokens.map((t) => t.text).join(" ");
    const x0 = Math.min(...lineTokens.map((t) => t.bbox.x0));
    const y0 = Math.min(...lineTokens.map((t) => t.bbox.y0));
    const x1 = Math.max(...lineTokens.map((t) => t.bbox.x1));
    const y1 = Math.max(...lineTokens.map((t) => t.bbox.y1));
    return { text, bbox: { x0, y0, x1, y1 }, tokens: lineTokens };
  });
}

type Candidate = RecognizedPair & {
  qtyKey: string;
};

function qtyKeyFromBBox(b: BBox): string {
  const c = center(b);
  return `${Math.round(c.cx)}:${Math.round(c.cy)}`;
}

function addCandidate(
  pool: Candidate[],
  pair: Omit<Candidate, "qtyKey">,
  qtyBBox: BBox
) {
  pool.push({
    ...pair,
    qtyKey: qtyKeyFromBBox(qtyBBox),
  });
}

function pickBestPairs(candidates: Candidate[]): RecognizedPair[] {
  const sorted = [...candidates].sort((a, b) => {
    const pr = METHOD_PRIORITY[b.method] - METHOD_PRIORITY[a.method];
    if (pr !== 0) return pr;
    return b.confidence - a.confidence;
  });

  const usedCodes = new Set<string>();
  const usedQty = new Set<string>();
  const picked: RecognizedPair[] = [];

  for (const c of sorted) {
    if (usedCodes.has(c.code) || usedQty.has(c.qtyKey)) continue;
    usedCodes.add(c.code);
    usedQty.add(c.qtyKey);
    picked.push({
      code: c.code,
      quantity: c.quantity,
      layout: c.layout,
      confidence: c.confidence,
      method: c.method,
    });
  }

  return picked;
}

/**
 * 同行从左到右顺序配对：色号 → 右侧第一个未占用数字。
 * 禁止把左侧数字当成该色号的数量。
 */
function pairSequentialInLine(line: OcrLine): Candidate[] {
  const candidates: Candidate[] = [];
  const toks = line.tokens;
  const usedQty = new Set<number>();

  for (let i = 0; i < toks.length; i++) {
    const code = tokenAsCode(toks[i].text);
    if (!code) continue;

    let qtyIdx = -1;
    for (let j = i + 1; j < toks.length; j++) {
      if (usedQty.has(j)) continue;
      // 右侧又遇到色号 → 本色号没有同行数量
      if (tokenAsCode(toks[j].text)) break;
      const qty = parseQuantity(toks[j].text);
      if (qty !== null) {
        // 必须在色号右侧
        if (center(toks[j].bbox).cx <= center(toks[i].bbox).cx) continue;
        qtyIdx = j;
        break;
      }
    }

    if (qtyIdx < 0) continue;
    const qty = parseQuantity(toks[qtyIdx].text);
    if (qty === null) continue;

    usedQty.add(qtyIdx);
    addCandidate(
      candidates,
      {
        code,
        quantity: qty,
        layout: "right",
        confidence: 0.93,
        method: "line-seq",
      },
      toks[qtyIdx].bbox
    );
  }

  return candidates;
}

function pairFromLines(lines: OcrLine[], metrics: Metrics): Candidate[] {
  const candidates: Candidate[] = [];
  const { medianH, medianW } = metrics;

  for (const line of lines) {
    // 1. 坐标顺序配对（主路径）
    candidates.push(...pairSequentialInLine(line));

    // 2. 行文本解析补充（同样只认色号在前）
    for (const p of parseMaterialLine(line.text)) {
      candidates.push({
        code: p.code,
        quantity: p.quantity,
        layout: "right",
        confidence: 0.8,
        method: "line-text",
        qtyKey: `${p.code}:line-text:${p.quantity}`,
      });
    }
  }

  // 3. 上下布局：色号在上、数量在下，列对齐（禁止上方数量）
  for (let i = 0; i < lines.length - 1; i++) {
    const upper = lines[i].tokens
      .map((t) => ({ token: t, code: tokenAsCode(t.text) }))
      .filter((x): x is { token: OcrToken; code: string } => !!x.code);
    const lower = lines[i + 1].tokens
      .map((t) => ({ token: t, qty: parseQuantity(t.text) }))
      .filter((x): x is { token: OcrToken; qty: number } => x.qty !== null);

    for (const u of upper) {
      let best: { token: OcrToken; qty: number; score: number } | null = null;
      for (const l of lower) {
        const dy = center(l.token.bbox).cy - center(u.token.bbox).cy;
        if (dy < medianH * 0.3 || dy > medianH * 2.5) continue;
        const dx = Math.abs(center(u.token.bbox).cx - center(l.token.bbox).cx);
        if (dx > medianW * 2.5) continue;
        const score = 1 - Math.min(1, dx / (medianW * 2.5));
        if (!best || score > best.score) {
          best = { token: l.token, qty: l.qty, score };
        }
      }
      if (best && best.score >= 0.45) {
        addCandidate(
          candidates,
          {
            code: u.code,
            quantity: best.qty,
            layout: "below",
            confidence: 0.72 + best.score * 0.2,
            method: "line-below",
          },
          best.token.bbox
        );
      }
    }
  }

  return candidates;
}

/** 格内配对：仅接受右侧或下方的数量 */
function pairCells(tokens: OcrToken[], metrics: Metrics): Candidate[] {
  const candidates: Candidate[] = [];
  const { medianH } = metrics;
  const cellRadius = medianH * 2.2;

  const codes = tokens
    .map((t) => ({ token: t, code: tokenAsCode(t.text) }))
    .filter((x): x is { token: OcrToken; code: string } => !!x.code);
  const nums = tokens
    .map((t) => ({ token: t, qty: parseQuantity(t.text) }))
    .filter((x): x is { token: OcrToken; qty: number } => x.qty !== null);

  for (const c of codes) {
    const cc = center(c.token.bbox);
    const neighbors = nums.filter((n) => {
      const nc = center(n.token.bbox);
      const dist = Math.hypot(cc.cx - nc.cx, cc.cy - nc.cy);
      if (dist > cellRadius) return false;
      // 仅右或下
      const right = nc.cx > cc.cx && Math.abs(nc.cy - cc.cy) <= medianH * 0.9;
      const below = nc.cy > cc.cy && Math.abs(nc.cx - cc.cx) <= medianH * 1.2;
      return right || below;
    });
    if (neighbors.length !== 1) continue;

    const n = neighbors[0];
    const nc = center(n.token.bbox);
    const layout: LayoutDirection = nc.cy > cc.cy + medianH * 0.35 ? "below" : "right";
    addCandidate(
      candidates,
      {
        code: c.code,
        quantity: n.qty,
        layout,
        confidence: 0.86,
        method: "cell",
      },
      n.token.bbox
    );
  }

  return candidates;
}

/** 从 OCR tokens + 全文识别材料清单 */
export function recognizeFromTokens(
  tokens: OcrToken[],
  fullText?: string
): {
  pairs: RecognizedPair[];
  rawText: string;
  debug: {
    tokenCount: number;
    lineCount: number;
    candidateCount: number;
    medianH: number;
  };
} {
  const cleaned = tokens
    .map((t) => ({ ...t, text: t.text.trim() }))
    .filter((t) => t.text.length > 0);

  const metrics = computeMetrics(cleaned);
  const merged = mergeSplitCodeTokens(cleaned, metrics.medianW);
  const lines = groupTokensIntoLines(merged);

  const candidates: Candidate[] = [
    ...pairFromLines(lines, metrics),
    ...pairCells(merged, metrics),
  ];

  // 全文按行补充尚未出现的色号（仍只认色号在前）
  const lineText = fullText?.trim() || lines.map((l) => l.text).join("\n");
  const fromText = parseMaterialListFromOcrText(lineText);
  const existingCodes = new Set(candidates.map((c) => c.code));
  for (const p of fromText) {
    if (existingCodes.has(p.code)) continue;
    candidates.push({
      code: p.code,
      quantity: p.quantity,
      layout: "right",
      confidence: 0.65,
      method: "line-text",
      qtyKey: `${p.code}:fallback-text`,
    });
  }

  const pairs = pickBestPairs(candidates);

  return {
    pairs,
    rawText: lineText,
    debug: {
      tokenCount: cleaned.length,
      lineCount: lines.length,
      candidateCount: candidates.length,
      medianH: Math.round(metrics.medianH),
    },
  };
}

/** 仅从纯文本识别（粘贴清单） */
export function recognizeFromText(text: string): RecognizedPair[] {
  return parseMaterialListFromOcrText(text).map((p) => ({
    code: p.code,
    quantity: p.quantity,
    layout: "right" as LayoutDirection,
    confidence: 0.8,
    method: "line-text" as const,
  }));
}
