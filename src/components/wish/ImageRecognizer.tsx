"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ColorSwatch } from "@/components/ui/Cards";
import { RegionSelector } from "@/components/wish/RegionSelector";
import { formatNumber, cn } from "@/lib/utils";
import { preprocessImageForOcr } from "@/lib/ocr-preprocess";
import type { CropRect } from "@/lib/crop-image";
import type { OcrToken } from "@/lib/recognize-material";

type TesseractWord = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type TesseractLine = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
};

type TesseractPage = {
  text: string;
  blocks: Array<{
    paragraphs: Array<{ lines: TesseractLine[] }>;
  }> | null;
};

function extractFromPage(data: TesseractPage): { tokens: OcrToken[]; fullText: string } {
  const tokens: OcrToken[] = [];
  const lineTexts: string[] = [];

  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const lt = line.text?.trim();
        if (lt) lineTexts.push(lt);
        for (const w of line.words ?? []) {
          const text = w.text.trim();
          if (!text) continue;
          tokens.push({ text, bbox: w.bbox });
        }
      }
    }
  }

  const fullText = lineTexts.length > 0 ? lineTexts.join("\n") : data.text ?? "";
  return { tokens, fullText };
}

type RecognizedItem = {
  code: string;
  quantity: number;
  layout: string;
  confidence: number;
  method: string;
  colorId: string;
  hex: string;
  name: string;
};

type DraftLine = { colorId: string; code: string; hex: string; quantity: number };

const LAYOUT_LABEL: Record<string, string> = {
  left: "左",
  right: "右",
  above: "上",
  below: "下",
};

const METHOD_LABEL: Record<string, string> = {
  cell: "格内",
  "line-adjacent": "同行",
  "line-text": "行文本",
  "line-below": "下方",
};

export function ImageRecognizer({
  imageUrl,
  onConfirm,
}: {
  imageUrl: string;
  onConfirm: (lines: DraftLine[]) => void;
}) {
  const [progress, setProgress] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [items, setItems] = useState<RecognizedItem[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  const handleCropChange = useCallback((url: string | null, rect: CropRect | null) => {
    setCroppedUrl(url);
    setCropRect(rect);
    setItems([]);
    setUnknown([]);
    setRawText("");
    setError("");
    setProgress("");
  }, []);

  const runOcr = useCallback(async () => {
    const targetUrl = croppedUrl ?? imageUrl;

    if (!croppedUrl) {
      setError("请先框选材料清单区域并点击「确认选区」，避免图纸区域干扰识别");
      return;
    }

    setRecognizing(true);
    setError("");
    setProgress("预处理图片…");
    setItems([]);
    setUnknown([]);
    setRawText("");

    try {
      const processed = await preprocessImageForOcr(targetUrl);
      const { createWorker, PSM } = await import("tesseract.js");

      setProgress("加载 OCR 引擎…");
      const worker = await createWorker("eng", undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(`识别中 ${Math.round((m.progress ?? 0) * 100)}%`);
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "ABCDEFGHIMTZ0123456789xX:：× ",
      });

      setProgress("正在读取选区…");
      const result = await worker.recognize(processed);
      await worker.terminate();

      const { tokens, fullText } = extractFromPage(result.data as TesseractPage);
      setRawText(fullText);

      setProgress("解析材料清单…");
      const res = await fetch("/api/projects/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, text: fullText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          (data.error ?? "识别失败") +
            (fullText ? "。可展开查看 OCR 原文，或改用手动/粘贴识别。" : "")
        );
        setShowRaw(true);
        setProgress("");
        return;
      }

      setItems(data.pairs ?? []);
      setUnknown(data.unknown ?? []);
      setProgress(
        data.pairs?.length
          ? `识别到 ${data.pairs.length} 个色号（选区 OCR ${tokens.length} 词），请核对`
          : "未识别到有效色号，请调整选区或改用手动添加"
      );
      if (!data.pairs?.length) setShowRaw(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR 失败");
      setProgress("");
    } finally {
      setRecognizing(false);
    }
  }, [croppedUrl, imageUrl]);

  const updateQty = (colorId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.colorId === colorId ? { ...i, quantity: Math.max(0, quantity) } : i))
    );
  };

  const removeItem = (colorId: string) => {
    setItems((prev) => prev.filter((i) => i.colorId !== colorId));
  };

  const handleConfirm = () => {
    const lines: DraftLine[] = items
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        colorId: i.colorId,
        code: i.code,
        hex: i.hex,
        quantity: i.quantity,
      }));
    onConfirm(lines);
  };

  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <RegionSelector imageUrl={imageUrl} onCropChange={handleCropChange} />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline-soft pt-4">
        <Button type="button" onClick={runOcr} disabled={recognizing || !cropRect}>
          {recognizing ? "识别中…" : "识别选区清单"}
        </Button>
        {progress && <span className="text-sm opacity-60">{progress}</span>}
      </div>
      {!cropRect && (
        <p className="mt-2 text-xs text-amber-700">请先框选并确认材料清单区域，再开始识别。</p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rawText && (
        <div className="mt-3">
          <button
            type="button"
            className="text-xs underline opacity-60"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? "收起" : "查看"} OCR 原文
          </button>
          {showRaw && (
            <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-surface-soft p-2 text-xs whitespace-pre-wrap">
              {rawText || "（空）"}
            </pre>
          )}
        </div>
      )}

      {unknown.length > 0 && (
        <p className="mt-2 text-sm text-amber-700">未在色号库中找到：{unknown.join("、")}</p>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-hairline divide-y divide-hairline-soft">
            {items.map((item) => (
              <div
                key={item.colorId}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-3 py-2 text-sm",
                  item.confidence < 0.5 && "bg-amber-50"
                )}
              >
                <ColorSwatch hex={item.hex} size="sm" />
                <span className="w-12 font-mono font-medium">{item.code}</span>
                <input
                  type="number"
                  min={0}
                  className="w-20 rounded-md border border-hairline px-2 py-1 text-sm"
                  value={item.quantity}
                  onChange={(e) => updateQty(item.colorId, Number(e.target.value))}
                />
                <span className="text-xs opacity-50">
                  {LAYOUT_LABEL[item.layout] ?? item.layout} ·{" "}
                  {METHOD_LABEL[item.method] ?? item.method} ·{" "}
                  {Math.round(item.confidence * 100)}%
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs opacity-40 hover:opacity-100"
                  onClick={() => removeItem(item.colorId)}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm opacity-60">
            共 {items.length} 色 · {formatNumber(items.reduce((s, i) => s + i.quantity, 0))} 粒
          </p>
          <Button type="button" variant="secondary" className="mt-2" onClick={handleConfirm}>
            确认加入清单
          </Button>
        </>
      )}
    </div>
  );
}
