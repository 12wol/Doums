"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CropRect } from "@/lib/crop-image";

type Point = { x: number; y: number };
type Mode = "pan" | "select";

type Props = {
  imageUrl: string;
  initialRect: CropRect | null;
  onSave: (rect: CropRect) => void;
  onClose: () => void;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;
const MIN_RECT = 0.015;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function RegionEditorModal({ imageUrl, initialRect, onSave, onClose }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fitSize, setFitSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<Mode>("select");
  const [draft, setDraft] = useState<CropRect | null>(initialRect);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [error, setError] = useState("");

  const panRef = useRef<{ start: Point; origin: Point } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number; mid: Point; offset: Point } | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const selectingRef = useRef(false);
  const dragStartRef = useRef<Point | null>(null);
  const dragCurrentRef = useRef<Point | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fitToView = useCallback(
    (nw: number, nh: number) => {
      const vp = viewportRef.current;
      if (!vp || nw === 0 || nh === 0) return;
      const pad = 24;
      const vw = vp.clientWidth - pad * 2;
      const vh = vp.clientHeight - pad * 2 - 72;
      const s = Math.min(vw / nw, vh / nh, 1);
      const fw = nw * s;
      const fh = nh * s;
      setFitSize({ w: fw, h: fh });
      setScale(1);
      setOffset({
        x: (vp.clientWidth - fw) / 2,
        y: (vp.clientHeight - fh) / 2 - 24,
      });
    },
    []
  );

  const screenToNorm = useCallback(
    (clientX: number, clientY: number, clampEdge = false): Point | null => {
      const vp = viewportRef.current;
      if (!vp || fitSize.w === 0) return null;
      const box = vp.getBoundingClientRect();
      let lx = (clientX - box.left - offset.x) / scale;
      let ly = (clientY - box.top - offset.y) / scale;
      if (clampEdge) {
        lx = clamp(lx, 0, fitSize.w);
        ly = clamp(ly, 0, fitSize.h);
        return { x: lx / fitSize.w, y: ly / fitSize.h };
      }
      if (lx < 0 || ly < 0 || lx > fitSize.w || ly > fitSize.h) return null;
      return { x: lx / fitSize.w, y: ly / fitSize.h };
    },
    [fitSize, offset, scale]
  );

  const normToRect = (a: Point, b: Point): CropRect => {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x);
    const y2 = Math.max(a.y, b.y);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  const activeRect =
    dragStart && dragCurrent ? normToRect(dragStart, dragCurrent) : draft;

  const zoomAt = (nextScale: number, anchor: Point) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const box = vp.getBoundingClientRect();
    const ax = anchor.x - box.left;
    const ay = anchor.y - box.top;
    const ratio = s / scale;
    setOffset({
      x: ax - (ax - offset.x) * ratio,
      y: ay - (ay - offset.y) * ratio,
    });
    setScale(s);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(scale * delta, { x: e.clientX, y: e.clientY });
  };

  const finishSelect = () => {
    if (!selectingRef.current) return;
    const a = dragStartRef.current;
    const b = dragCurrentRef.current;
    selectingRef.current = false;
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragStart(null);
    setDragCurrent(null);
    if (a && b) {
      const rect = normToRect(a, b);
      if (rect.w >= MIN_RECT && rect.h >= MIN_RECT) {
        setDraft(rect);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (natural.w === 0) return;
    // 仅响应主按键（鼠标左键 / 触控）
    if (e.pointerType === "mouse" && e.button !== 0) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: dist(pts[0], pts[1]),
        scale,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        offset: { ...offset },
      };
      panRef.current = null;
      selectingRef.current = false;
      dragStartRef.current = null;
      dragCurrentRef.current = null;
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    if (mode === "pan") {
      panRef.current = { start: { x: e.clientX, y: e.clientY }, origin: { ...offset } };
      return;
    }

    const p = screenToNorm(e.clientX, e.clientY);
    if (!p) return;
    selectingRef.current = true;
    dragStartRef.current = p;
    dragCurrentRef.current = p;
    setDragStart(p);
    setDragCurrent(p);
    setDraft(null);
    setError("");
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // 未按下时忽略（避免抬起后仍随鼠标移动改框）
    if (e.buttons === 0 && !pinchRef.current) {
      if (selectingRef.current) finishSelect();
      if (panRef.current) panRef.current = null;
      return;
    }

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()];
      const d = dist(pts[0], pts[1]);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const next = clamp(pinchRef.current.scale * (d / pinchRef.current.dist), MIN_SCALE, MAX_SCALE);
      const ratio = next / scale;
      const box = viewportRef.current?.getBoundingClientRect();
      if (box) {
        const ax = mid.x - box.left;
        const ay = mid.y - box.top;
        setOffset({
          x: ax - (ax - offset.x) * ratio,
          y: ay - (ay - offset.y) * ratio,
        });
      }
      setScale(next);
      return;
    }

    if (panRef.current) {
      const dx = e.clientX - panRef.current.start.x;
      const dy = e.clientY - panRef.current.start.y;
      setOffset({
        x: panRef.current.origin.x + dx,
        y: panRef.current.origin.y + dy,
      });
      return;
    }

    if (selectingRef.current && mode === "select") {
      const p = screenToNorm(e.clientX, e.clientY, true);
      if (p) {
        dragCurrentRef.current = p;
        setDragCurrent(p);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;

    if (selectingRef.current && pointersRef.current.size === 0) {
      finishSelect();
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSave = () => {
    const rect = activeRect;
    if (!rect || rect.w < MIN_RECT || rect.h < MIN_RECT) {
      setError("请框选材料清单区域（可双指缩放、单指拖拽移动图片）");
      return;
    }
    onSave(rect);
  };

  const handleResetView = () => {
    if (natural.w) fitToView(natural.w, natural.h);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-white">
        <p className="text-sm opacity-80">框选色号清单区域</p>
        <button type="button" className="text-sm opacity-60 hover:opacity-100" onClick={onClose}>
          关闭
        </button>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <div
          className="absolute left-0 top-0 will-change-transform"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <div className="relative" style={{ width: fitSize.w, height: fitSize.h }}>
            <img
              src={imageUrl}
              alt="全屏框选"
              className="block h-full w-full select-none"
              draggable={false}
              onLoad={(e) => {
                const t = e.currentTarget;
                setNatural({ w: t.naturalWidth, h: t.naturalHeight });
                fitToView(t.naturalWidth, t.naturalHeight);
              }}
            />
            {activeRect && activeRect.w > 0 && activeRect.h > 0 && (
              <div
                className="pointer-events-none absolute border-2 border-accent-magenta bg-accent-magenta/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{
                  left: `${activeRect.x * 100}%`,
                  top: `${activeRect.y * 100}%`,
                  width: `${activeRect.w * 100}%`,
                  height: `${activeRect.h * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              mode === "select" ? "bg-white text-black" : "bg-white/15 text-white"
            )}
            onClick={() => setMode("select")}
          >
            框选
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              mode === "pan" ? "bg-white text-black" : "bg-white/15 text-white"
            )}
            onClick={() => setMode("pan")}
          >
            移动
          </button>
          <button
            type="button"
            className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white"
            onClick={() => zoomAt(scale * 1.25, {
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            })}
          >
            放大
          </button>
          <button
            type="button"
            className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white"
            onClick={() => zoomAt(scale / 1.25, {
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            })}
          >
            缩小
          </button>
          <button
            type="button"
            className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white"
            onClick={handleResetView}
          >
            重置
          </button>
        </div>
        <p className="text-xs text-white/50">
          框选模式拖拽画矩形；移动模式拖拽平移；双指捏合或滚轮缩放
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={handleSave}>
            保存选区
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
