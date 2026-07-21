"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { formatNumber } from "@/lib/utils";

type Warehouse = { id: string; name: string; uniqueCode: string };
type Color = { id: string; code: string; name: string; hex: string; series: string };
type RestockLine = { colorId: string; code: string; hex: string; quantity: number };

export default function RestockPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<RestockLine[]>([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [qty, setQty] = useState(100);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const mergeLines = (incoming: RestockLine[]) => {
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

  const addLine = () => {
    const color = colors.find((c) => c.id === selectedColor);
    if (!color || qty <= 0) return;
    mergeLines([{ colorId: color.id, code: color.code, hex: color.hex, quantity: qty }]);
    setSelectedColor("");
    setSearch("");
  };

  const removeLine = (colorId: string) => {
    setLines((prev) => prev.filter((l) => l.colorId !== colorId));
  };

  const updateQty = (colorId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.colorId === colorId ? { ...l, quantity: Math.max(1, quantity) } : l))
    );
  };

  const handleSubmit = async () => {
    if (!warehouseId || lines.length === 0) {
      setError("请选择豆仓并添加补豆色号");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    const total = lines.reduce((s, l) => s + l.quantity, 0);
    const res = await fetch("/api/restocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        note,
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
    setMessage(`已入库补充 ${formatNumber(total)} 粒`);
  };

  const totalBeads = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <PageHeader
        eyebrow="RESTOCK"
        title="补豆"
        description="按色号补充库存，类似拼豆入库，会留下补豆记录，而不是直接改库存数字。"
      />

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
              placeholder="采购批次、来源等"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="color-block bg-block-mint">
            <p className="eyebrow mb-3">添加补豆色号</p>
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
                className="w-28 rounded-md border border-hairline bg-canvas px-3 py-2"
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
            <h2 className="text-lg font-semibold">补豆清单</h2>
            <span className="text-sm opacity-60">
              {lines.length} 色 · {formatNumber(totalBeads)} 粒
            </span>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-hairline p-8 text-center opacity-50">
              添加需要补充的色号与数量
            </div>
          ) : (
            <div className="divide-y divide-hairline-soft rounded-lg border border-hairline">
              {lines.map((l) => (
                <div key={l.colorId} className="flex items-center gap-3 px-4 py-3">
                  <ColorSwatch hex={l.hex} code={l.code} size="sm" />
                  <span className="w-12 font-mono font-medium">{l.code}</span>
                  <input
                    type="number"
                    min={1}
                    className="w-24 rounded-md border border-hairline px-2 py-1 text-sm"
                    value={l.quantity}
                    onChange={(e) => updateQty(l.colorId, Number(e.target.value))}
                  />
                  <span className="text-sm opacity-50">粒</span>
                  <button
                    type="button"
                    className="ml-auto text-sm opacity-50 hover:opacity-100"
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
              {submitting ? "提交中…" : "确认补豆入库"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
