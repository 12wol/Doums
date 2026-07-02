"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { formatNumber } from "@/lib/utils";

const ImageRecognizer = dynamic(
  () => import("@/components/wish/ImageRecognizer").then((m) => m.ImageRecognizer),
  { ssr: false, loading: () => <p className="text-sm opacity-60">加载识别组件…</p> }
);

type Warehouse = { id: string; name: string; uniqueCode: string };
type Color = { id: string; code: string; name: string; hex: string; series: string };
type ConsumeLine = { colorId: string; code: string; hex: string; quantity: number };

export default function ConsumePage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<ConsumeLine[]>([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [qty, setQty] = useState(1);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showImport, setShowImport] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseText, setParseText] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/colors").then((r) => r.json()),
    ]).then(([whs, cols]) => {
      setWarehouses(whs);
      setColors(cols);
      if (whs.length > 0) setWarehouseId(whs[0].id);
    });
  }, []);

  const filteredColors = colors.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  });

  const mergeLines = (incoming: ConsumeLine[]) => {
    setLines((prev) => {
      const map = new Map(prev.map((l) => [l.colorId, l]));
      for (const item of incoming) {
        const ex = map.get(item.colorId);
        if (ex) map.set(item.colorId, { ...ex, quantity: ex.quantity + item.quantity });
        else map.set(item.colorId, item);
      }
      return Array.from(map.values());
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setImportError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setImportError(data.error ?? "上传失败");
      return;
    }
    setImageUrl(data.url);
    if (!note) setNote(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleParse = async () => {
    setImportError("");
    const res = await fetch("/api/projects/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: parseText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error ?? "识别失败");
      return;
    }
    mergeLines(
      data.pairs.map((p: { colorId: string; code: string; hex: string; quantity: number }) => ({
        colorId: p.colorId,
        code: p.code,
        hex: p.hex,
        quantity: p.quantity,
      }))
    );
    if (data.unknown?.length) {
      setImportError(`未识别的色号：${data.unknown.join("、")}`);
    }
  };

  const addLine = () => {
    const color = colors.find((c) => c.id === selectedColor);
    if (!color || qty <= 0) return;
    mergeLines([{ colorId: color.id, code: color.code, hex: color.hex, quantity: qty }]);
    setQty(1);
    setSelectedColor("");
    setSearch("");
  };

  const removeLine = (colorId: string) => {
    setLines((prev) => prev.filter((l) => l.colorId !== colorId));
  };

  const handleSubmit = async () => {
    if (!warehouseId || lines.length === 0) {
      setError("请选择豆仓并添加消耗色号");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    const hadImage = !!imageUrl;
    const total = lines.reduce((s, l) => s + l.quantity, 0);
    const res = await fetch("/api/consumptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        note,
        imageUrl,
        projectTitle: note || undefined,
        items: lines.map((l) => ({ colorId: l.colorId, quantity: l.quantity })),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "提交失败");
      return;
    }
    setLines([]);
    setNote("");
    setImageUrl(null);
    setShowImport(false);
    if (hadImage) {
      router.push("/completed");
    } else {
      setMessage(`已扣除 ${formatNumber(total)} 粒`);
    }
  };

  const totalBeads = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <PageHeader
        eyebrow="BEADING"
        title="拼豆"
        description="导入图纸识别消耗量，选择豆仓扣减库存；有图纸时将自动收录到「拼完了」。"
        action={
          <Button onClick={() => setShowImport(!showImport)}>
            {showImport ? "收起导入" : "导入图纸"}
          </Button>
        }
      />

      {showImport && (
        <div className="color-block mb-8 bg-block-cream">
          <h2 className="mb-4 text-lg font-semibold">从图纸导入消耗</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block">
                <span className="eyebrow mb-1 block">上传图纸图片</span>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-sm"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                {uploading && <p className="mt-1 text-sm opacity-60">上传中…</p>}
                {imageUrl && (
                  <>
                    <img
                      src={imageUrl}
                      alt="预览"
                      className="mt-2 max-h-48 rounded-md border border-hairline object-contain"
                    />
                    <div className="mt-4">
                      <ImageRecognizer imageUrl={imageUrl} onConfirm={mergeLines} />
                    </div>
                  </>
                )}
              </label>
            </div>
            <div>
              <label className="block">
                <span className="eyebrow mb-1 block">或粘贴材料清单文字</span>
                <textarea
                  className="h-32 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm"
                  placeholder={"A1 320\nB12 150\n320 C5"}
                  value={parseText}
                  onChange={(e) => setParseText(e.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                onClick={handleParse}
                disabled={!parseText.trim()}
              >
                识别文字清单
              </Button>
              {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
              <p className="mt-3 text-xs opacity-50">
                识别结果会加入右侧消耗清单，确认无误后再扣减库存。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className="eyebrow mb-1 block">选择豆仓</span>
            <select
              className="w-full rounded-md border border-hairline px-3 py-3"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.uniqueCode})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow mb-1 block">备注（可选）</span>
            <input
              className="w-full rounded-md border border-hairline px-3 py-3"
              placeholder="图纸名称、项目等"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="color-block bg-block-mint">
            <p className="eyebrow mb-3">手动添加色号</p>
            <input
              className="mb-2 w-full rounded-md border border-hairline bg-canvas px-3 py-2"
              placeholder="搜索色号…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                const match = colors.find(
                  (c) =>
                    c.code.toLowerCase() === e.target.value.toLowerCase() ||
                    c.name.toLowerCase() === e.target.value.toLowerCase()
                );
                if (match) setSelectedColor(match.id);
              }}
            />
            <select
              className="mb-2 w-full rounded-md border border-hairline bg-canvas px-3 py-2"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              size={5}
            >
              {filteredColors.slice(0, 50).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="w-24 rounded-md border border-hairline bg-canvas px-3 py-2"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <Button type="button" variant="secondary" onClick={addLine}>
                添加
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">消耗清单</h2>
            <span className="text-sm opacity-60">
              {lines.length} 色 · {formatNumber(totalBeads)} 粒
            </span>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline p-8 text-center opacity-50">
              手动添加或导入图纸识别
            </div>
          ) : (
            <div className="divide-y divide-hairline-soft rounded-lg border border-hairline">
              {lines.map((l) => (
                <div key={l.colorId} className="flex items-center gap-3 px-4 py-3">
                  <ColorSwatch hex={l.hex} code={l.code} size="sm" />
                  <span className="flex-1 font-mono font-medium">{l.code}</span>
                  <span>{formatNumber(l.quantity)} 粒</span>
                  <button
                    type="button"
                    className="text-sm opacity-50 hover:opacity-100"
                    onClick={() => removeLine(l.colorId)}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {message && <p className="mt-3 text-sm text-success">{message}</p>}

          <div className="mt-4">
            <Button onClick={handleSubmit} disabled={submitting || lines.length === 0}>
              {submitting ? "提交中…" : "确认拼豆并扣减"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
