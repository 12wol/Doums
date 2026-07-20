"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { RegionEditorModal } from "@/components/wish/RegionEditorModal";
import { cropImageByRect, type CropRect } from "@/lib/crop-image";

type Props = {
  imageUrl: string;
  onCropChange: (croppedUrl: string | null, rect: CropRect | null) => void;
};

export function RegionSelector({ imageUrl, onCropChange }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmedRect, setConfirmedRect] = useState<CropRect | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setConfirmedRect(null);
    setPreviewUrl(null);
    setError("");
    onCropChange(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅换图时重置
  }, [imageUrl]);

  const applyCrop = useCallback(
    async (rect: CropRect) => {
      setBusy(true);
      setError("");
      try {
        const url = await cropImageByRect(imageUrl, rect);
        setPreviewUrl(url);
        setConfirmedRect(rect);
        onCropChange(url, rect);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "裁剪失败");
      } finally {
        setBusy(false);
      }
    },
    [imageUrl, onCropChange]
  );

  const clearSelection = () => {
    setConfirmedRect(null);
    setPreviewUrl(null);
    setError("");
    onCropChange(null, null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs opacity-60">
        点击缩略图进入<strong>全屏框选</strong>，可放大缩小、拖拽移动图片，框选材料清单后保存。
      </p>

      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-md border border-hairline bg-surface-soft text-left"
        onClick={() => setOpen(true)}
        disabled={busy}
      >
        <img
          src={previewUrl ?? imageUrl}
          alt="点击框选识别区域"
          className="mx-auto block max-h-48 w-full object-contain"
          draggable={false}
        />
        {confirmedRect ? (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
            已保存选区 · 点击重新框选
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-sm text-white">
            点击全屏框选
          </span>
        )}
      </button>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={busy}>
          {confirmedRect ? "重新框选" : "开始框选"}
        </Button>
        {confirmedRect && (
          <Button type="button" variant="secondary" onClick={clearSelection} disabled={busy}>
            清除选区
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {open && (
        <RegionEditorModal
          imageUrl={imageUrl}
          initialRect={confirmedRect}
          onSave={applyCrop}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
