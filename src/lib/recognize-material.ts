import { parseMaterialListFromOcrText, parseMaterialLine } from "./ocr-text";
import { fixColorCode, normalizeOcrBlob } from "./ocr-text";

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

export type LayoutDirection = "left" | "right" | "above" | "below";

export type RecognizedPair = {
  code: string;
  quantity: number;
  layout: LayoutDirection;
  confidence: number;
  method: "line-text" | "line-adjacent" | "line-below" | "cell";
};

const MIN_QTY = 1;
const MAX_QTY = 50000;

const METHOD_PRIORITY: Record<RecognizedPair["method"], number> = {
  "line-adjacent": 5,
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

function yOverlap(a: BBox, b: BBox): number {
  const top = Math.max(a.y0, b.y0);
  const bottom = Math.min(a.y1, b.y1);
  const overlap = Math.max(0, bottom - top);
  const minH = Math.min(size(a).h, size(b).h) || 1;
  return overlap / minH;
}

export function detectLayout(codeBox: BBox, qtyBox: BBox): LayoutDirection {
  const cc = center(codeBox);
  const qc = center(qtyBox);
  const dx = qc.cx - cc.cx;
  const dy = qc.cy - cc.cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "below" : "above";
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

function xAlignScore(a: BBox, b: BBox, medianW: number): number {
  return 1 - Math.min(1, Math.abs(center(a).cx - center(b).cx) / (medianW * 3));
}

function addCandidate(
  pool: Candidate[],
  pair: Omit<Candidate, "qtyKey"> & { qtyBBox?: BBox },
  qtyBBox?: BBox
) {
  const box = qtyBBox ?? pair.qtyBBox;
  if (!box) return;
  pool.push({
    ...pair,
    qtyKey: qtyKeyFromBBox(box),
  });
}

function pickBestPairs(candidates: Candidate[]): RecognizedPair[] {
  // 按方法优先级 + 置信度排序，贪心一对一（色号、数量均不可复用）
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

function pairFromLines(lines: OcrLine[], metrics: Metrics): Candidate[] {
  const candidates: Candidate[] = [];
  const { medianH, medianW } = metrics;

  for (const line of lines) {
    // 1. 整行文本解析（同一行内）
    for (const p of parseMaterialLine(line.text)) {
      candidates.push({
        code: p.code,
        quantity: p.quantity,
        layout: "right",
        confidence: 0.82,
        method: "line-text",
        qtyKey: `${p.code}:line-text`,
      });
    }

    // 2. 行内相邻 token
    const toks = line.tokens;
    for (let i = 0; i < toks.length - 1; i++) {
      const codeL = tokenAsCode(toks[i].text);
      const qtyR = parseQuantity(toks[i + 1].text);
      if (codeL && qtyR !== null) {
        addCandidate(candidates, {
          code: codeL,
          quantity: qtyR,
          layout: detectLayout(toks[i].bbox, toks[i + 1].bbox),
          confidence: 0.92,
          method: "line-adjacent",
        }, toks[i + 1].bbox);
        i++;
        continue;
      }
      const qtyL = parseQuantity(toks[i].text);
      const codeR = tokenAsCode(toks[i + 1].text);
      if (qtyL !== null && codeR) {
        addCandidate(candidates, {
          code: codeR,
          quantity: qtyL,
          layout: detectLayout(toks[i].bbox, toks[i + 1].bbox),
          confidence: 0.92,
          method: "line-adjacent",
        }, toks[i].bbox);
        i++;
      }
    }

    // 3. 行内非相邻但同一行：色号与最近数量（限制水平距离）
    const codeToks = toks
      .map((t) => ({ token: t, code: tokenAsCode(t.text) }))
      .filter((x): x is { token: OcrToken; code: string } => !!x.code);
    const numToks = toks
      .map((t) => ({ token: t, qty: parseQuantity(t.text) }))
      .filter((x): x is { token: OcrToken; qty: number } => x.qty !== null);

    for (const ct of codeToks) {
      let best: { token: OcrToken; qty: number; score: number } | null = null;
      for (const nt of numToks) {
        if (yOverlap(ct.token.bbox, nt.token.bbox) < 0.35) continue;
        const dx = Math.abs(center(ct.token.bbox).cx - center(nt.token.bbox).cx);
        if (dx > medianW * 8) continue;
        const score = xAlignScore(ct.token.bbox, nt.token.bbox, medianW) * 0.5 + yOverlap(ct.token.bbox, nt.token.bbox) * 0.5;
        if (!best || score > best.score) {
          best = { token: nt.token, qty: nt.qty, score };
        }
      }
      if (best && best.score > 0.4) {
        addCandidate(candidates, {
          code: ct.code,
          quantity: best.qty,
          layout: detectLayout(ct.token.bbox, best.token.bbox),
          confidence: 0.75 + best.score * 0.15,
          method: "line-adjacent",
        }, best.token.bbox);
      }
    }
  }

  // 4. 上下行：色号在上、数量在下，列对齐
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
        const align = xAlignScore(u.token.bbox, l.token.bbox, medianW);
        if (align < 0.55) continue;
        if (!best || align > best.score) {
          best = { token: l.token, qty: l.qty, score: align };
        }
      }
      if (best) {
        addCandidate(candidates, {
          code: u.code,
          quantity: best.qty,
          layout: "below",
          confidence: 0.7 + best.score * 0.2,
          method: "line-below",
        }, best.token.bbox);
      }
    }
  }

  return candidates;
}

/** 格内配对：极小范围内 1 色号 + 1 数量 */
function pairCells(tokens: OcrToken[], metrics: Metrics): Candidate[] {
  const candidates: Candidate[] = [];
  const { medianH } = metrics;
  const cellRadius = medianH * 2.2;

  const codes = tokens
    .map((t, i) => ({ i, token: t, code: tokenAsCode(t.text) }))
    .filter((x): x is { i: number; token: OcrToken; code: string } => !!x.code);
  const nums = tokens
    .map((t, i) => ({ i, token: t, qty: parseQuantity(t.text) }))
    .filter((x): x is { i: number; token: OcrToken; qty: number } => x.qty !== null);

  for (const c of codes) {
    const cc = center(c.token.bbox);
    const neighbors = nums.filter((n) => {
      const nc = center(n.token.bbox);
      return Math.hypot(cc.cx - nc.cx, cc.cy - nc.cy) <= cellRadius;
    });
    if (neighbors.length !== 1) continue;

    const n = neighbors[0];
    addCandidate(candidates, {
      code: c.code,
      quantity: n.qty,
      layout: detectLayout(c.token.bbox, n.token.bbox),
      confidence: 0.88,
      method: "cell",
    }, n.token.bbox);
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
  const lines = groupTokensIntoLines(cleaned);

  const candidates: Candidate[] = [
    ...pairFromLines(lines, metrics),
    ...pairCells(cleaned, metrics),
  ];

  // 全文仅按行解析补充（不跨行），且只补充尚未出现的色号
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
