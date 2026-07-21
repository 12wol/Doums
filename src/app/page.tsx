"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader, StatCard } from "@/components/ui/Cards";
import { RankingModal, type RankItem } from "@/components/ui/RankingModal";
import { formatNumber } from "@/lib/utils";

type DashboardData = {
  grandTotal: number;
  warehouseCount: number;
  colorCount: number;
  warehouses: {
    id: string;
    name: string;
    uniqueCode: string;
    totalQty: number;
    lowStock: number;
    emptyStock: number;
    consumptionCount: number;
    seriesTotals: Record<string, number>;
  }[];
  recentConsumptions: {
    id: string;
    note: string | null;
    createdAt: string;
    warehouseName: string;
    totalBeads: number;
    colorCount: number;
  }[];
};

const SERIES_COLORS: Record<string, string> = {
  A: "#dceeb1",
  B: "#c8e6cd",
  C: "#c5b0f4",
  D: "#efd4d4",
  E: "#f3c9b6",
  F: "#f4ecd6",
  G: "#fec993",
  H: "#e6e6e6",
  M: "#d1ccaf",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConsumeRank, setShowConsumeRank] = useState(false);
  const [rankItems, setRankItems] = useState<RankItem[]>([]);
  const [rankTotal, setRankTotal] = useState(0);
  const [rankLoading, setRankLoading] = useState(false);

  const [showStockRank, setShowStockRank] = useState(false);
  const [stockWhId, setStockWhId] = useState("");
  const [stockItems, setStockItems] = useState<RankItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockMeta, setStockMeta] = useState({ name: "", total: 0 });

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const loadStockRank = useCallback(async (warehouseId: string) => {
    setStockWhId(warehouseId);
    setStockLoading(true);
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}`);
      const wh = await res.json();
      if (!res.ok) {
        setStockItems([]);
        setStockMeta({ name: "", total: 0 });
        return;
      }
      const stocks = (wh.stocks ?? []) as {
        quantity: number;
        color: { code: string; hex: string; name: string; series: string };
      }[];
      const items = [...stocks]
        .sort(
          (a, b) =>
            a.quantity - b.quantity || a.color.code.localeCompare(b.color.code)
        )
        .map((s) => ({
          code: s.color.code,
          hex: s.color.hex,
          name: s.color.name,
          value: s.quantity,
          hint: `${s.color.series} 系`,
        }));
      const total = stocks.reduce((sum, s) => sum + s.quantity, 0);
      setStockItems(items);
      setStockMeta({ name: wh.name ?? "", total });
    } finally {
      setStockLoading(false);
    }
  }, []);

  const openStockRank = useCallback(
    (warehouseId: string) => {
      setShowStockRank(true);
      loadStockRank(warehouseId);
    },
    [loadStockRank]
  );

  const openConsumeRank = useCallback(async () => {
    setShowConsumeRank(true);
    setRankLoading(true);
    try {
      const res = await fetch("/api/dashboard/consumption-rank");
      const json = await res.json();
      setRankItems(
        (json.items ?? []).map(
          (i: { code: string; hex: string; name: string; series: string; quantity: number }) => ({
            code: i.code,
            hex: i.hex,
            name: i.name,
            value: i.quantity,
            hint: `${i.series} 系`,
          })
        )
      );
      setRankTotal(json.totalBeads ?? 0);
    } finally {
      setRankLoading(false);
    }
  }, []);

  if (loading) {
    return <p className="opacity-60">加载中…</p>;
  }

  if (!data) {
    return <p className="text-red-600">加载失败</p>;
  }

  const lowTotal = data.warehouses.reduce((s, w) => s + w.lowStock, 0);
  const consumeTimes = data.warehouses.reduce((s, w) => s + w.consumptionCount, 0);
  const firstWarehouseId = data.warehouses[0]?.id;

  return (
    <div>
      <PageHeader
        eyebrow="INVENTORY"
        title="豆仓仪表盘"
        description="查看所有拼豆仓库的总库存、低库存预警与最近消耗记录。"
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={openConsumeRank}>
              消耗排行榜
            </Button>
            <ButtonLink href="/restock">补豆</ButtonLink>
            <ButtonLink href="/warehouses">库存管理</ButtonLink>
          </div>
        }
      />

      <div className="mb-10 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          className="h-full w-full text-left"
          onClick={() => firstWarehouseId && openStockRank(firstWarehouseId)}
          disabled={!firstWarehouseId}
        >
          <StatCard
            label="总库存"
            value={formatNumber(data.grandTotal)}
            hint="点击查看余量柱状图"
            block="lime"
          />
        </button>
        <div className="h-full">
          <StatCard
            label="豆仓数"
            value={data.warehouseCount}
            hint={`${data.colorCount} 个 MARD 色号`}
            block="lilac"
          />
        </div>
        <button type="button" className="h-full w-full text-left" onClick={openConsumeRank}>
          <StatCard
            label="低库存色号"
            value={lowTotal}
            hint={`库存 < 200 · 消耗 ${consumeTimes} 次`}
            block="pink"
          />
        </button>
      </div>

      {data.warehouseCount === 0 ? (
        <div className="color-block bg-block-cream text-center">
          <p className="mb-4 text-lg">还没有豆仓，创建第一个开始管理库存吧。</p>
          <Link href="/warehouses">
            <Button>创建豆仓</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">各豆仓概览</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.warehouses.map((wh) => (
              <div
                key={wh.id}
                role="button"
                tabIndex={0}
                onClick={() => openStockRank(wh.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openStockRank(wh.id);
                  }
                }}
                className="cursor-pointer rounded-lg border border-hairline bg-canvas p-6 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="eyebrow opacity-60">{wh.uniqueCode}</p>
                    <h3 className="text-xl font-bold">{wh.name}</h3>
                  </div>
                  <span className="text-2xl font-semibold">{formatNumber(wh.totalQty)}</span>
                </div>
                <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                  {Object.entries(wh.seriesTotals).map(([series, qty]) => {
                    const pct = wh.totalQty > 0 ? (qty / wh.totalQty) * 100 : 0;
                    if (pct < 0.5) return null;
                    return (
                      <div
                        key={series}
                        style={{ width: `${pct}%`, backgroundColor: SERIES_COLORS[series] ?? "#ccc" }}
                        title={`${series} 系 ${formatNumber(qty)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex gap-4 opacity-70">
                    <span>低库存 {wh.lowStock}</span>
                    <span>缺货 {wh.emptyStock}</span>
                    <span>消耗 {wh.consumptionCount} 次</span>
                  </div>
                  <Link
                    href={`/warehouses/${wh.id}`}
                    className="shrink-0 underline opacity-50 hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    管理
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.recentConsumptions.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">最近消耗</h2>
            <button
              type="button"
              className="text-sm underline opacity-55 hover:opacity-100"
              onClick={openConsumeRank}
            >
              查看消耗排行榜
            </button>
          </div>
          <div className="divide-y divide-hairline-soft rounded-lg border border-hairline">
            {data.recentConsumptions.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{c.warehouseName}</span>
                  <span className="mx-2 opacity-40">·</span>
                  <span>
                    {c.colorCount} 色 / {formatNumber(c.totalBeads)} 粒
                  </span>
                  {c.note && <span className="ml-2 opacity-60">— {c.note}</span>}
                </div>
                <time className="opacity-50">{new Date(c.createdAt).toLocaleString("zh-CN")}</time>
              </div>
            ))}
          </div>
        </div>
      )}

      {showStockRank && (
        <RankingModal
          title="余量柱状图"
          subtitle={
            stockLoading
              ? "加载中…"
              : `${stockMeta.name} · ${formatNumber(stockMeta.total)} 粒 · 从少到多`
          }
          items={stockLoading ? [] : stockItems}
          emptyText={stockLoading ? "加载中…" : "暂无库存"}
          valueLabel="粒"
          variant="bars"
          stockThresholds
          warehouseTabs={data.warehouses.map((w) => ({ id: w.id, name: w.name }))}
          activeWarehouseId={stockWhId}
          onWarehouseChange={loadStockRank}
          onClose={() => setShowStockRank(false)}
        />
      )}

      {showConsumeRank && (
        <RankingModal
          title="消耗排行榜"
          subtitle={
            rankLoading
              ? "加载中…"
              : `累计消耗 ${formatNumber(rankTotal)} 粒 · 从多到少`
          }
          items={rankLoading ? [] : rankItems}
          emptyText={rankLoading ? "加载中…" : "暂无消耗记录"}
          valueLabel="粒"
          onClose={() => setShowConsumeRank(false)}
        />
      )}
    </div>
  );
}
