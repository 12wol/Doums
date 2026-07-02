"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { cropImageByRect, type CropRect } from "@/lib/crop-image";

type Point = { x: number; y: number };

type Props = {
  imageUrl: string;
  onCropChange: (croppedUrl: string | null, rect: CropRect | null) => void;
};

export function RegionSelector({ imageUrl, onCropChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [confirmedRect, setConfirmedRect] = useState<CropRect | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setConfirmedRect(null);
    setPreviewUrl(null);
    setStart(null);
    setCurrent(null);
    onCropChange(null, null);
  }, [imageUrl, onCropChange]);

  const getLocalPoint = (clientX: number, clientY: number): Point | null => {
    const el = containerRef.current;
    if (!el || imgSize.w === 0) return null;
    const box = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - box.left, imgSize.w));
    const y = Math.max(0, Math.min(clientY - box.top, imgSize.h));
    return { x, y };
  };

  const toNormRect = (a: Point, b: Point): CropRect => {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x);
    const y2 = Math.max(a.y, b.y);
    return {
      x: x1 / imgSize.w,
      y: y1 / imgSize.h,
      w: (x2 - x1) / imgSize.w,
      h: (y2 - y1) / imgSize.h,
    };
  };

  const draftRect =
    start && current && imgSize.w > 0
      ? toNormRect(start, current)
      : confirmedRect;

  const displayRect = draftRect
    ? {
        left: `${draftRect.x * 100}%`,
        top: `${draftRect.y * 100}%`,
        width: `${draftRect.w * 100}%`,
        height: `${draftRect.h * 100}%`,
      }
    : null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    const p = getLocalPoint(e.clientX, e.clientY);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setStart(p);
    setCurrent(p);
    setConfirmedRect(null);
    setPreviewUrl(null);
    setError("");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const p = getLocalPoint(e.clientX, e.clientY);
    if (p) setCurrent(p);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const applyCrop = useCallback(
    async (rect: CropRect) => {
      setBusy(true);
      setError("");
      try {
        const url = await cropImageByRect(imageUrl, rect);
        setPreviewUrl(url);
        setConfirmedRect(rect);
        onCropChange(url, rect);
      } catch (e) {
        setError(e instanceof Error ? e.message : "裁剪失败");
      } finally {
        setBusy(false);
      }
    },
    [imageUrl, onCropChange]
  );

  const confirmSelection = () => {
    if (!start || !current || imgSize.w === 0) {
      setError("请先在图片上拖拽框选材料清单区域");
      return;
    }
    const rect = toNormRect(start, current);
    if (rect.w < 0.02 || rect.h < 0.02) {
      setError("选区太小，请框选更大的区域");
      return;
    }
    applyCrop(rect);
  };

  const clearSelection = () => {
    setStart(null);
    setCurrent(null);
    setConfirmedRect(null);
    setPreviewUrl(null);
    setError("");
    onCropChange(null, null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs opacity-60">
        在图片上 <strong>拖拽框选</strong> 色号与数量清单区域（避开上方图纸），再点「确认选区」后识别。
      </p>

      <div
        ref={containerRef}
        className={cn(
          "relative mx-auto max-w-full select-none touch-none overflow-hidden rounded-md border border-hairline bg-surface-soft",
          busy && "opacity-60"
        )}
        style={{ maxHeight: 360 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          src={imageUrl}
          alt="框选识别区域"
          className="block max-h-[360px] w-full object-contain"
          draggable={false}
          onLoad={(e) => {
            const t = e.currentTarget;
            setImgSize({ w: t.clientWidth, h: t.clientHeight });
          }}
        />
        {displayRect && displayRect.width !== "0%" && (
          <div
            className="pointer-events-none absolute border-2 border-accent-magenta bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
            style={displayRect}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={confirmSelection} disabled={busy}>
          {busy ? "裁剪中…" : "确认选区"}
        </Button>
        <Button type="button" variant="secondary" onClick={clearSelection} disabled={busy}>
          清除选区
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {previewUrl && confirmedRect && (
        <div>
          <p className="eyebrow mb-1 opacity-60">已选区域预览</p>
          <img
            src={previewUrl}
            alt="选区预览"
            className="max-h-40 rounded-md border border-hairline object-contain"
          />
        </div>
      )}
    </div>
  );
}
