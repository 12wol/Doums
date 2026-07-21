"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { SeriesFilter } from "@/components/colors/SeriesFilter";
import { RankingModal } from "@/components/ui/RankingModal";
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
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [showRank, setShowRank] = useState(false);

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
      if (
        !s.color.code.toLowerCase().includes(q) &&
        !s.color.name.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    const qty = editing[s.color.id] ?? s.quantity;
    if (minQty !== "" && !Number.isNaN(Number(minQty)) && qty < Number(minQty)) return false;
    if (maxQty !== "" && !Number.isNaN(Number(maxQty)) && qty > Number(maxQty)) return false;
    return true;
  });

  const remainingRank = useMemo(() => {
    if (!warehouse) return [];
    return [...warehouse.stocks]
      .sort((a, b) => a.quantity - b.quantity || a.color.code.localeCompare(b.color.code))
      .map((s) => ({
        code: s.color.code,
        hex: s.color.hex,
        name: s.color.name,
        value: s.quantity,
        hint: s.color.series ? `${s.color.series} 系` : undefined,
      }));
  }, [warehouse]);

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
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowRank(true)}>
              剩余排行榜
            </Button>
            <ButtonLink href="/restock">补豆</ButtonLink>
            <ButtonLink href="/consume">拼豆</ButtonLink>
            {hasEdits && (
              <Button variant="secondary" onClick={handleSave} disabled={saving}>
                {saving ? "保存中…" : "保存修改"}
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-md border border-hairline px-3 py-2.5"
          placeholder="搜索色号…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SeriesFilter series={series} options={seriesOptions} onChange={setSeries} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm opacity-55">数量范围</span>
        <input
          type="number"
          min={0}
          className="w-24 rounded-md border border-hairline px-2 py-2 text-sm"
          placeholder="最低"
          value={minQty}
          onChange={(e) => setMinQty(e.target.value)}
        />
        <span className="opacity-40">–</span>
        <input
          type="number"
          min={0}
          className="w-24 rounded-md border border-hairline px-2 py-2 text-sm"
          placeholder="最高"
          value={maxQty}
          onChange={(e) => setMaxQty(e.target.value)}
        />
        <span className="text-xs opacity-45">例：最高填 499 可筛低于 500 的色号</span>
        {(minQty !== "" || maxQty !== "") && (
          <button
            type="button"
            className="text-sm underline opacity-50 hover:opacity-100"
            onClick={() => {
              setMinQty("");
              setMaxQty("");
            }}
          >
            清除
          </button>
        )}
        {filtered && (
          <span className="ml-auto text-sm opacity-50">显示 {filtered.length} 色</span>
        )}
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
                isEmpty
                  ? "border-red-300 bg-red-50"
                  : isLow
                    ? "border-amber-300 bg-amber-50"
                    : "border-hairline"
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

      {filtered?.length === 0 && (
        <p className="mt-8 text-center text-sm opacity-50">没有符合筛选条件的色号</p>
      )}

      {showRank && (
        <RankingModal
          title="剩余排行榜"
          subtitle={`${warehouse.name} · 从少到多`}
          items={remainingRank}
          valueLabel="粒"
          variant="bars"
          stockThresholds
          onClose={() => setShowRank(false)}
        />
      )}
    </div>
  );
}
