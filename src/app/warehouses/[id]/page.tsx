"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { SeriesFilter } from "@/components/colors/SeriesFilter";
import { formatNumber, cn } from "@/lib/utils";

type StockItem = {
  id: string;
  quantity: number;
  color: {
    id: string;
    code: string;
    name: string;
    hex: string;
    series: string;
    imageUrl: string | null;
  };
};

type WarehouseDetail = {
  id: string;
  name: string;
  uniqueCode: string;
  defaultQty: number;
  stocks: StockItem[];
};

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [warehouse, setWarehouse] = useState<WarehouseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/warehouses/${id}`)
      .then((r) => r.json())
      .then(setWarehouse)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const seriesOptions = useMemo(() => {
    if (!warehouse) return [];
    const set = new Set(warehouse.stocks.map((s) => s.color.series));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [warehouse]);

  const filtered = warehouse?.stocks.filter((s) => {
    if (series && s.color.series !== series) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.color.code.toLowerCase().includes(q) ||
        s.color.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSave = async () => {
    const items = Object.entries(editing).map(([colorId, quantity]) => ({
      colorId,
      quantity,
    }));
    if (items.length === 0) return;
    setSaving(true);
    await fetch(`/api/warehouses/${id}/stocks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setEditing({});
    setSaving(false);
    load();
  };

  if (loading) return <p className="opacity-60">加载中…</p>;
  if (!warehouse) return <p>仓库不存在</p>;

  const totalQty = warehouse.stocks.reduce((s, st) => s + st.quantity, 0);
  const hasEdits = Object.keys(editing).length > 0;

  return (
    <div>
      <PageHeader
        eyebrow={warehouse.uniqueCode}
        title={warehouse.name}
        description={`共 ${formatNumber(totalQty)} 粒 · ${warehouse.stocks.length} 色号`}
        action={
          <div className="flex gap-2">
            <Link href="/consume">
              <Button>拼豆</Button>
            </Link>
            {hasEdits && (
              <Button variant="secondary" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存修改"}
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-md border border-hairline px-3 py-2.5"
          placeholder="搜索色号…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SeriesFilter series={series} options={seriesOptions} onChange={setSeries} />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered?.map((st) => {
          const qty = editing[st.color.id] ?? st.quantity;
          const isLow = qty < 200;
          const isEmpty = qty === 0;
          return (
            <div
              key={st.id}
              className={cn(
                "flex items-center gap-3 rounded-md border p-3",
                isEmpty ? "border-red-300 bg-red-50" : isLow ? "border-amber-300 bg-amber-50" : "border-hairline"
              )}
            >
              <ColorSwatch hex={st.color.hex} code={st.color.code} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{st.color.code}</span>
                  {st.color.name !== st.color.code && (
                    <span className="truncate text-sm opacity-60">{st.color.name}</span>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-md border border-hairline px-2 py-1 text-sm"
                  value={qty}
                  onChange={(e) =>
                    setEditing((prev) => ({
                      ...prev,
                      [st.color.id]: Math.max(0, Number(e.target.value)),
                    }))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
